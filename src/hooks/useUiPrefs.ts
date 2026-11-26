import { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { DEFAULT_UI_PREFS, UiPrefs } from '../components/SettingsView';

export function useUiPrefs() {
  const [uiPrefs, setUiPrefs] = useState<UiPrefs>(() => {
    try {
      const saved = localStorage.getItem('taskeen_ui_prefs_v1');
      if (saved) return { ...DEFAULT_UI_PREFS, ...JSON.parse(saved) };
    } catch {}
    return DEFAULT_UI_PREFS;
  });

  const updateUiPrefs = (next: UiPrefs) => {
    setUiPrefs(next);
    try {
      localStorage.setItem('taskeen_ui_prefs_v1', JSON.stringify(next));
      invoke('upsert_user_kv', { key: 'taskeen_ui_prefs_v1', value: JSON.stringify(next) }).catch(() => {});
    } catch {}
  };

  useEffect(() => {
    const root = document.documentElement;
    const fontStack =
      uiPrefs.uiFont === 'Kalpurush'
        ? "'Kalpurush', 'Noto Sans Bengali', sans-serif"
        : uiPrefs.uiFont === 'Noto Serif Bengali'
        ? "'Noto Serif Bengali', 'Noto Sans Bengali', serif"
        : uiPrefs.uiFont === 'Hind Siliguri'
        ? "'Hind Siliguri', 'Noto Sans Bengali', sans-serif"
        : uiPrefs.uiFont === 'Anek Bangla'
        ? "'Anek Bangla', 'Noto Sans Bengali', sans-serif"
        : "'Noto Sans Bengali', system-ui, -apple-system, 'Segoe UI', sans-serif";
    root.style.setProperty('--ts-font-ui', fontStack);
    root.style.setProperty('--ts-root-size', `${uiPrefs.uiFontSize}px`);
    if (uiPrefs.customAccent) {
      root.style.setProperty('--ts-accent', uiPrefs.customAccent);
      root.style.setProperty('--ts-accent-hover', uiPrefs.customAccent);
      root.style.setProperty('--ts-accent-soft', `${uiPrefs.customAccent}22`);
    } else {
      root.style.removeProperty('--ts-accent');
      root.style.removeProperty('--ts-accent-hover');
      root.style.removeProperty('--ts-accent-soft');
    }
  }, [uiPrefs]);
  return { uiPrefs, updateUiPrefs };
}
