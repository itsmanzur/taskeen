/**
 * Cross-platform "Save As".
 * Desktop (Tauri): native save dialog via the Rust `save_file` command, which works the same on
 * Windows, macOS and Linux (`<a download>` does not work in macOS/Linux WebViews).
 * Browser preview: falls back to a normal anchor download.
 */
import { invoke } from '@tauri-apps/api/core';

export type SaveResult = 'saved' | 'cancelled';

const isTauri = () => typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

function browserDownload(name: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function saveTextFile(
  defaultName: string,
  text: string,
  mime: string,
  filterName: string,
  extensions: string[]
): Promise<SaveResult> {
  if (!isTauri()) {
    browserDownload(defaultName, new Blob([text], { type: `${mime};charset=utf-8` }));
    return 'saved';
  }
  const path = await invoke<string | null>('save_file', {
    defaultName,
    filterName,
    extensions,
    content: text,
    isBase64: false,
  });
  return path ? 'saved' : 'cancelled';
}

/** Saves a `data:image/png;base64,...` URL (e.g. from canvas.toDataURL) as a PNG file. */
export async function savePngDataUrl(defaultName: string, dataUrl: string): Promise<SaveResult> {
  const base64 = dataUrl.split(',')[1] || '';
  if (!isTauri()) {
    const bin = atob(base64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    browserDownload(defaultName, new Blob([bytes], { type: 'image/png' }));
    return 'saved';
  }
  const path = await invoke<string | null>('save_file', {
    defaultName,
    filterName: 'PNG ছবি',
    extensions: ['png'],
    content: base64,
    isBase64: true,
  });
  return path ? 'saved' : 'cancelled';
}
