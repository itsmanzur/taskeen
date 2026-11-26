import { useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { getLocalDateKey } from '../../lib/date';
import { getCryptoStatus, setSecureWritesFrozen } from '../../lib/secureStorage';
import { saveTextFile } from '../../lib/saveFile';
import { Notify } from '../../lib/constants';

export default function BackupModal({
  onClose,
  notify,
  reloadAllUserData,
}: {
  onClose: () => void;
  notify: Notify;
  reloadAllUserData: () => Promise<void>;
}) {
  const [backupPass, setBackupPass] = useState<string>('');
  const [restorePass, setRestorePass] = useState<string>('');
  const [cloudSyncUrl, setCloudSyncUrl] = useState<string>(() => {
    try { return JSON.parse(localStorage.getItem('taskeen_cloud_sync_v1') || '{}').url || ''; } catch { return ''; }
  });
  const [cloudSyncKey, setCloudSyncKey] = useState<string>(() => {
    try { return JSON.parse(localStorage.getItem('taskeen_cloud_sync_v1') || '{}').key || ''; } catch { return ''; }
  });
  const [cloudSyncId, setCloudSyncId] = useState<string>(() => {
    try { return JSON.parse(localStorage.getItem('taskeen_cloud_sync_v1') || '{}').id || 'taskeen-main'; } catch { return 'taskeen-main'; }
  });
  const [cloudSyncBusy, setCloudSyncBusy] = useState<boolean>(false);

  return (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white text-[#0F1A17] w-full max-w-md rounded-2xl p-6 space-y-4 text-xs">
            <div className="flex justify-between items-center">
              <h3 className="font-serif-bn font-bold text-base">এনক্রিপ্টেড ব্যাকআপ ও রিস্টোর</h3>
              <button onClick={() => onClose()}>✕</button>
            </div>

            <div className="p-3 rounded-xl bg-[#F4F7F5] space-y-2">
              <p className="font-semibold">নতুন ব্যাকআপ তৈরি করুন (.taskeen-backup)</p>
              <input
                type="password"
                value={backupPass}
                onChange={(e) => setBackupPass(e.target.value)}
                placeholder="পাসওয়ার্ড দিন (কমপক্ষে ১০ অক্ষর)"
                className="w-full px-3 py-2 rounded border bg-white"
              />
              <button
                onClick={async () => {
                  try {
                    const encrypted = await invoke<string>('export_backup', { passphrase: backupPass });
                    const res = await saveTextFile(`taskeen-${getLocalDateKey()}.taskeen-backup`, encrypted, 'application/json', 'Taskeen ব্যাকআপ', ['taskeen-backup']);
                    if (res !== 'saved') {
                      notify('সংরক্ষণ বাতিল করা হয়েছে');
                      return;
                    }
                    setBackupPass('');
                    notify('এনক্রিপ্টেড ব্যাকআপ ডাউনলোড হয়েছে');
                  } catch (err) {
                    notify(String(err));
                  }
                }}
                className="w-full py-2 rounded-lg bg-[#0E5A45] text-white font-semibold"
              >
                ব্যাকআপ এক্সপোর্ট করুন
              </button>
            </div>

            <div className="p-3 rounded-xl border border-[#DCE3E0] space-y-2">
              <p className="font-semibold">ব্যাকআপ থেকে রিস্টোর করুন</p>
              <input
                type="password"
                value={restorePass}
                onChange={(e) => setRestorePass(e.target.value)}
                placeholder="ব্যাকআপের পাসওয়ার্ড দিন"
                className="w-full px-3 py-2 rounded border"
              />
              <input
                type="file"
                accept=".taskeen-backup,.json"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  try {
                    const content = await file.text();
                    setSecureWritesFrozen(true);
                    const restoredCount = await invoke<number>('import_backup', { content, passphrase: restorePass });
                    if (getCryptoStatus().enabled) {
                      // The in-memory secure cache is stale now: reload so it is rebuilt from the restored data.
                      notify(`${restoredCount}টি রেকর্ড রিস্টোর হয়েছে — অ্যাপ রিলোড হচ্ছে`);
                      window.setTimeout(() => window.location.reload(), 700);
                      return;
                    }
                    setSecureWritesFrozen(false);
                    await reloadAllUserData();
                    setRestorePass('');
                    onClose();
                    notify(`${restoredCount}টি রেকর্ড রিস্টোর হয়েছে`);
                  } catch (err) {
                    setSecureWritesFrozen(false);
                    notify(String(err));
                  }
                }}
                className="w-full text-[11px]"
              />
            </div>

            <div className="p-3 rounded-xl border border-[#0E5A45]/30 bg-[#0E5A45]/5 space-y-2">
              <p className="font-semibold text-[#0E5A45]">ক্লাউড সিঙ্ক (ঐচ্ছিক E2E এনক্রিপ্টেড)</p>
              <input
                value={cloudSyncUrl}
                onChange={(e) => {
                  setCloudSyncUrl(e.target.value);
                  localStorage.setItem('taskeen_cloud_sync_v1', JSON.stringify({ url: e.target.value, key: cloudSyncKey, id: cloudSyncId }));
                }}
                placeholder="Supabase REST / কাস্টম URL (https://...)"
                className="w-full px-2.5 py-1.5 rounded border bg-white"
              />
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="password"
                  value={cloudSyncKey}
                  onChange={(e) => {
                    setCloudSyncKey(e.target.value);
                    localStorage.setItem('taskeen_cloud_sync_v1', JSON.stringify({ url: cloudSyncUrl, key: e.target.value, id: cloudSyncId }));
                  }}
                  placeholder="API Key / Bearer Token"
                  className="px-2.5 py-1.5 rounded border bg-white"
                />
                <input
                  value={cloudSyncId}
                  onChange={(e) => {
                    setCloudSyncId(e.target.value);
                    localStorage.setItem('taskeen_cloud_sync_v1', JSON.stringify({ url: cloudSyncUrl, key: cloudSyncKey, id: e.target.value }));
                  }}
                  placeholder="প্রোফাইল আইডি"
                  className="px-2.5 py-1.5 rounded border bg-white"
                />
              </div>
              <div className="flex gap-2">
                <button
                  disabled={cloudSyncBusy || !cloudSyncUrl.trim()}
                  onClick={async () => {
                    setCloudSyncBusy(true);
                    try {
                      const pass = backupPass || restorePass;
                      await invoke('cloud_sync_push', {
                        url: cloudSyncUrl.trim(),
                        apiKey: cloudSyncKey.trim(),
                        syncId: cloudSyncId || 'taskeen-main',
                        passphrase: pass,
                      });
                      notify('এনক্রিপ্টেড ব্যাকআপ ক্লাউডে সিঙ্ক হয়েছে');
                    } catch (err) {
                      notify(`ক্লাউড সিঙ্ক ত্রুটি: ${String(err)}`);
                    } finally {
                      setCloudSyncBusy(false);
                    }
                  }}
                  className="flex-1 py-1.5 rounded-lg bg-[#0E5A45] text-white font-semibold disabled:opacity-50"
                >
                  ক্লাউডে পুশ
                </button>
                <button
                  disabled={cloudSyncBusy || !cloudSyncUrl.trim()}
                  onClick={async () => {
                    setCloudSyncBusy(true);
                    try {
                      const sep = cloudSyncUrl.includes('?') ? '&' : '?';
                      const url = `${cloudSyncUrl.trim()}${sep}id=eq.${encodeURIComponent(cloudSyncId || 'taskeen-main')}`;
                      const pass = restorePass || backupPass;
                      setSecureWritesFrozen(true);
                      const restoredCount = await invoke<number>('cloud_sync_pull', {
                        url,
                        apiKey: cloudSyncKey.trim(),
                        passphrase: pass,
                      });
                      if (getCryptoStatus().enabled) {
                        notify(`${restoredCount}টি রেকর্ড রিস্টোর হয়েছে — অ্যাপ রিলোড হচ্ছে`);
                        window.setTimeout(() => window.location.reload(), 700);
                        return;
                      }
                      setSecureWritesFrozen(false);
                      await reloadAllUserData();
                      onClose();
                      notify(`ক্লাউড থেকে ${restoredCount}টি রেকর্ড রিস্টোর হয়েছে`);
                    } catch (err) {
                      setSecureWritesFrozen(false);
                      notify(`ক্লাউড রিস্টোর ত্রুটি: ${String(err)}`);
                    } finally {
                      setCloudSyncBusy(false);
                    }
                  }}
                  className="flex-1 py-1.5 rounded-lg border border-[#0E5A45] text-[#0A4736] font-semibold disabled:opacity-50"
                >
                  ক্লাউড থেকে আনুন
                </button>
              </div>
            </div>
          </div>
        </div>
  );
}
