/**
 * Transparent encrypted storage for every `taskeen_*` localStorage key.
 *
 * In the Tauri desktop app the values are kept in an in-memory cache and persisted to the
 * Rust side (`user_kv`, sealed with AES-256-GCM using a key held in the OS keychain).
 * They are never written to the WebView's plaintext localStorage. Existing plaintext values
 * are migrated once and then removed. Components keep using localStorage unchanged.
 *
 * If encryption is unavailable (browser preview, keychain error) nothing is patched and the
 * app falls back to ordinary localStorage; the status says so.
 */
import { invoke } from '@tauri-apps/api/core';

export interface CryptoStatus {
  enabled: boolean;
  error?: string | null;
  recovered?: boolean;
}

const KEY_PREFIX = 'taskeen_';
const KV_PREFIX = 'ls:';
const FLUSH_DELAY_MS = 250;

let status: CryptoStatus = { enabled: false };
let frozen = false;
const cache = new Map<string, string>();
const dirty = new Set<string>();
let timer: number | null = null;

export function getCryptoStatus(): CryptoStatus {
  return status;
}

const isSecureKey = (k: string) => k.startsWith(KEY_PREFIX);

async function flushNow(): Promise<void> {
  if (timer !== null) {
    window.clearTimeout(timer);
    timer = null;
  }
  if (frozen) return;
  const keys = Array.from(dirty);
  dirty.clear();
  await Promise.all(
    keys.map((k) => {
      if (cache.has(k)) {
        return invoke('upsert_user_kv', { key: KV_PREFIX + k, value: cache.get(k) as string }).catch(() => {
          dirty.add(k);
        });
      }
      return invoke('delete_user_kv', { key: KV_PREFIX + k }).catch(() => {
        dirty.add(k);
      });
    })
  );
}

function schedule(k: string) {
  dirty.add(k);
  if (frozen || timer !== null) return;
  timer = window.setTimeout(() => {
    timer = null;
    void flushNow();
  }, FLUSH_DELAY_MS);
}

/** Stop persisting (used around a backup restore so stale cache cannot overwrite restored rows). */
export function setSecureWritesFrozen(value: boolean) {
  frozen = value;
  if (value) {
    dirty.clear();
    if (timer !== null) {
      window.clearTimeout(timer);
      timer = null;
    }
  }
}

export async function initSecureStorage(): Promise<CryptoStatus> {
  if (typeof window === 'undefined' || !('__TAURI_INTERNALS__' in window)) {
    status = { enabled: false };
    return status;
  }

  try {
    status = await invoke<CryptoStatus>('get_crypto_status');
  } catch (e) {
    status = { enabled: false, error: String(e) };
    return status;
  }
  if (!status.enabled) return status;

  try {
    const rows = await invoke<Array<{ key: string; value: string }>>('load_user_kv');
    rows.forEach((r) => {
      if (r.key.startsWith(KV_PREFIX)) cache.set(r.key.slice(KV_PREFIX.length), r.value);
    });
    // Rows saved by older builds / backups under their plain names (e.g. taskeen_notes_v1).
    rows.forEach((r) => {
      if (isSecureKey(r.key) && !cache.has(r.key)) {
        cache.set(r.key, r.value);
        dirty.add(r.key);
      }
    });
    if (dirty.size > 0) await flushNow();

    // One-time migration of plaintext localStorage -> encrypted store.
    const legacyKeys: string[] = [];
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i);
      if (k && isSecureKey(k)) legacyKeys.push(k);
    }
    for (const k of legacyKeys) {
      const v = window.localStorage.getItem(k);
      if (v === null) continue;
      if (!cache.has(k)) {
        await invoke('upsert_user_kv', { key: KV_PREFIX + k, value: v });
        cache.set(k, v);
      }
      window.localStorage.removeItem(k); // only after the encrypted copy is safely stored
    }
  } catch (e) {
    status = { enabled: false, error: `সিকিউর স্টোরেজ চালু করা যায়নি: ${String(e)}` };
    return status;
  }

  const proto = Storage.prototype;
  const origGet = proto.getItem;
  const origSet = proto.setItem;
  const origRemove = proto.removeItem;

  proto.getItem = function (this: Storage, key: string) {
    if (this === window.localStorage && isSecureKey(key)) {
      return cache.has(key) ? (cache.get(key) as string) : null;
    }
    return origGet.call(this, key);
  };
  proto.setItem = function (this: Storage, key: string, value: string) {
    if (this === window.localStorage && isSecureKey(key)) {
      cache.set(key, String(value));
      schedule(key);
      return;
    }
    origSet.call(this, key, value);
  };
  proto.removeItem = function (this: Storage, key: string) {
    if (this === window.localStorage && isSecureKey(key)) {
      cache.delete(key);
      schedule(key);
      return;
    }
    origRemove.call(this, key);
  };

  const flushOnHide = () => void flushNow();
  window.addEventListener('pagehide', flushOnHide);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flushOnHide();
  });

  return status;
}
