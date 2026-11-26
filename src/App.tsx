import React, { useEffect, useMemo, useRef, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { BarChart3, BookMarked, BookOpen, Compass, Copy, Eye, EyeOff, Home, Info, Lock, Moon, NotebookPen, Settings, Sparkles, Sun, Timer } from 'lucide-react';
import rawEntries from './data/entries.json';
import { ReminderSettings, TaskeenItem } from './types';
import DashboardView, { getHijriLabel, PrayerDay, PrayerName, PrayerStatus } from './components/DashboardView';
import MuhasabahNiyyahView, { MuhasabahEntry, NiyyahGoal } from './components/MuhasabahNiyyahView';
import ToolsView, { SadaqahEntry, WasiyyahData } from './components/ToolsView';
import TodoQiblaReportsView, { TodoItem } from './components/TodoQiblaReportsView';
import SalahQiblaView from './components/SalahQiblaView';
import QuranView, { QuranState } from './components/QuranView';
import NotesView, { DEFAULT_NOTE_CATEGORIES, NoteCategory, UserNote } from './components/NotesView';
import SettingsView, { DEFAULT_DASHBOARD_WIDGETS, DEFAULT_UI_PREFS, UiPrefs } from './components/SettingsView';
import AboutView from './components/AboutView';
import { OnboardingWizard, PinLockScreen, PinSettingsModal } from './components/OnboardingAndPin';
import { CITY_PRESETS, computeOfflinePrayerTimes } from './lib/prayerTimes';

const DEFAULT_ITEMS = rawEntries as TaskeenItem[];

const DAILY_AMAL_LIST = [
  { id: 'amal_morning', label: 'সকালের মাসনুন যিকির ও সুরক্ষা' },
  { id: 'amal_istighfar', label: 'দৈনিক ১০০ বার ইস্তেগফার' },
  { id: 'amal_durood', label: 'নবীজি ﷺ-এর ওপর দরূদ শরীফ' },
  { id: 'amal_evening', label: 'সন্ধ্যার যিকির ও সাইয়িদুল ইস্তেগফার' },
];

const EMOTIONS = [
  'ক্ষমা ও তাওবা',
  'ভালোবাসা ও দরুদ',
  'দুশ্চিন্তা ও ঋণ',
  'বিপদ ও সংকট',
  'রিজিক ও হালাল',
  'সকাল-সন্ধ্যা ও সুরক্ষা',
];

export default function App() {
  const [items, setItems] = useState<TaskeenItem[]>(() => {
    try {
      const saved = localStorage.getItem('taskeen_local_v1');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed.customItems)) {
          return [...parsed.customItems, ...DEFAULT_ITEMS];
        }
      }
    } catch {}
    return DEFAULT_ITEMS;
  });

  const [category, setCategory] = useState<string>('all');
  const [emotion, setEmotion] = useState<string>('all');
  const [gradeFilter, setGradeFilter] = useState<string>('all');
  const [bookFilter, setBookFilter] = useState<string>('all');
  const [search, setSearch] = useState<string>('');
  const [ftsIds, setFtsIds] = useState<Set<string> | null>(null);
  const [selectedId, setSelectedId] = useState<string>(DEFAULT_ITEMS[0]?.id || '');
  const [activeTab, setActiveTab] = useState<'text' | 'fazilat' | 'story' | 'tahqeeq'>('text');
  const [arabicSize, setArabicSize] = useState<number>(28);
  const [arabicFont, setArabicFont] = useState<'amiri' | 'scheherazade'>('amiri');
  const [showPronunciation, setShowPronunciation] = useState<boolean>(true);
  const [theme, setTheme] = useState<'andalusia' | 'sandstone' | 'midnight' | 'subhe-sadiq'>(() => {
    const saved = localStorage.getItem('taskeen_theme_v1');
    if (saved === 'andalusia' || saved === 'sandstone' || saved === 'midnight' || saved === 'subhe-sadiq') return saved;
    return 'andalusia';
  });
  const darkMode = theme === 'midnight' || theme === 'subhe-sadiq';
  const changeTheme = (t: 'andalusia' | 'sandstone' | 'midnight' | 'subhe-sadiq') => {
    setTheme(t);
    localStorage.setItem('taskeen_theme_v1', t);
  };

  const [favorites, setFavorites] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('taskeen_local_v1') || '{}').favorites || [];
    } catch { return []; }
  });
  const [counts, setCounts] = useState<Record<string, number>>(() => {
    try {
      return JSON.parse(localStorage.getItem('taskeen_local_v1') || '{}').counts || {};
    } catch { return {}; }
  });
  const [verifiedMap, setVerifiedMap] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    DEFAULT_ITEMS.forEach((i) => { initial[i.id] = i.verified; });
    try {
      const saved = JSON.parse(localStorage.getItem('taskeen_local_v1') || '{}').verifiedMap;
      return saved ? { ...initial, ...saved } : initial;
    } catch { return initial; }
  });
  const [dailyDone, setDailyDone] = useState<Record<string, boolean>>(() => {
    try {
      return JSON.parse(localStorage.getItem('taskeen_local_v1') || '{}').dailyDone || {};
    } catch { return {}; }
  });
  const [tadabburNotes, setTadabburNotes] = useState<Record<string, string>>(() => {
    try {
      return JSON.parse(localStorage.getItem('taskeen_local_v1') || '{}').tadabburNotes || {};
    } catch { return {}; }
  });
  const [reminders, setReminders] = useState<ReminderSettings>({
    enabled: true,
    interval: '60',
    silent: true,
    fridayDurood: true,
  });

  const [target, setTarget] = useState<number>(100);
  const [streakFreeze, setStreakFreeze] = useState<boolean>(true);
  const [toast, setToast] = useState<string>('');
  const [audioPlaying, setAudioPlaying] = useState<boolean>(false);
  const [audioProgress, setAudioProgress] = useState<number>(0);
  const [audioSpeed, setAudioSpeed] = useState<number>(1);

  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [showRemModal, setShowRemModal] = useState<boolean>(false);
  const [showStatsModal, setShowStatsModal] = useState<boolean>(false);
  const [showShareModal, setShowShareModal] = useState<boolean>(false);
  const [cardTheme, setCardTheme] = useState<'emerald' | 'ivory' | 'night'>('emerald');

  const [nativeDbHash, setNativeDbHash] = useState<string>('');
  const [miniMode, setMiniMode] = useState<boolean>(false);
  const [showBackupModal, setShowBackupModal] = useState<boolean>(false);
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
  const [audioMode, setAudioMode] = useState<'idle' | 'pack' | 'tts'>('idle');
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const audioElRef = useRef<HTMLAudioElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  const [activeView, setActiveView] = useState<'dashboard' | 'library' | 'quran' | 'salah' | 'amal' | 'life' | 'notes' | 'reports' | 'settings' | 'about'>('dashboard');

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

  const [notes, setNotes] = useState<UserNote[]>(() => {
    try {
      const saved = localStorage.getItem('taskeen_notes_v1');
      if (saved) return JSON.parse(saved);
    } catch {}
    return [];
  });
  const [noteCategories, setNoteCategories] = useState<NoteCategory[]>(() => {
    try {
      const saved = localStorage.getItem('taskeen_note_categories_v1');
      if (saved) return JSON.parse(saved);
    } catch {}
    return DEFAULT_NOTE_CATEGORIES;
  });

  const saveNotes = (next: UserNote[]) => {
    setNotes(next);
    try {
      localStorage.setItem('taskeen_notes_v1', JSON.stringify(next));
      invoke('upsert_user_kv', { key: 'taskeen_notes_v1', value: JSON.stringify(next) }).catch(() => {});
    } catch {}
  };

  const saveNoteCategories = (next: NoteCategory[]) => {
    setNoteCategories(next);
    try {
      localStorage.setItem('taskeen_note_categories_v1', JSON.stringify(next));
      invoke('upsert_user_kv', { key: 'taskeen_note_categories_v1', value: JSON.stringify(next) }).catch(() => {});
    } catch {}
  };
  const [quranState, setQuranState] = useState<QuranState>(() => {
    try {
      return JSON.parse(localStorage.getItem('taskeen_amalify_v1') || '{}').quranState || {
        pagesRead: 0,
        targetDays: 30,
        lastSurahId: 1,
        bookmarks: [],
      };
    } catch { return { pagesRead: 0, targetDays: 30, lastSurahId: 1, bookmarks: [] }; }
  });
  const [onboardingDone, setOnboardingDone] = useState<boolean>(() => {
    return localStorage.getItem('taskeen_onboarding_done') === '1';
  });
  const [appPin, setAppPin] = useState<string>(() => localStorage.getItem('taskeen_app_pin') || '');
  const [isLocked, setIsLocked] = useState<boolean>(() => Boolean(localStorage.getItem('taskeen_app_pin')));
  const [showPinModal, setShowPinModal] = useState<boolean>(false);
  const [showAboutModal, setShowAboutModal] = useState<boolean>(false);
  const [privacyBlur, setPrivacyBlur] = useState<boolean>(false);
  const [hifzMode, setHifzMode] = useState<boolean>(false);
  const [hifzHideArabic, setHifzHideArabic] = useState<boolean>(true);
  const [hifzHideMeaning, setHifzHideMeaning] = useState<boolean>(true);
  const [hifzRevealed, setHifzRevealed] = useState<{ arabic: boolean; meaning: boolean }>({ arabic: false, meaning: false });
  const [memorizedIds, setMemorizedIds] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem('taskeen_memorized_v1') || '[]'); } catch { return []; }
  });
  const [fbCat, setFbCat] = useState<string>('হাদীস/তাহকীক সংশোধন');
  const [fbText, setFbText] = useState<string>('');
  const [todos, setTodos] = useState<TodoItem[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('taskeen_amalify_v1') || '{}').todos || [];
    } catch { return []; }
  });
  const [fastingDays, setFastingDays] = useState<Record<string, boolean>>(() => {
    try {
      return JSON.parse(localStorage.getItem('taskeen_amalify_v1') || '{}').fastingDays || {};
    } catch { return {}; }
  });
  const [prayers, setPrayers] = useState<Record<string, PrayerDay>>(() => {
    try {
      return JSON.parse(localStorage.getItem('taskeen_amalify_v1') || '{}').prayers || {};
    } catch { return {}; }
  });
  const [muhasabahEntries, setMuhasabahEntries] = useState<MuhasabahEntry[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('taskeen_amalify_v1') || '{}').muhasabahEntries || [];
    } catch { return []; }
  });
  const [niyyahGoals, setNiyyahGoals] = useState<NiyyahGoal[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('taskeen_amalify_v1') || '{}').niyyahGoals || [];
    } catch { return []; }
  });
  const [sadaqahList, setSadaqahList] = useState<SadaqahEntry[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('taskeen_amalify_v1') || '{}').sadaqahList || [];
    } catch { return []; }
  });
  const [zakatWealth, setZakatWealth] = useState<number>(() => {
    try {
      return JSON.parse(localStorage.getItem('taskeen_amalify_v1') || '{}').zakatWealth || 0;
    } catch { return 0; }
  });
  const [wasiyyah, setWasiyyah] = useState<WasiyyahData>(() => {
    try {
      return JSON.parse(localStorage.getItem('taskeen_amalify_v1') || '{}').wasiyyah || {
        assets: '',
        unfulfilledDuties: '',
        finalWords: '',
      };
    } catch { return { assets: '', unfulfilledDuties: '', finalWords: '' }; }
  });

  const kvHydratedRef = useRef<boolean>(false);

  useEffect(() => {
    const payload = JSON.stringify({ prayers, muhasabahEntries, niyyahGoals, sadaqahList, zakatWealth, wasiyyah, todos, quranState, fastingDays });
    try {
      localStorage.setItem('taskeen_amalify_v1', payload);
    } catch {}
    if (kvHydratedRef.current) {
      invoke('upsert_user_kv', { key: 'amalify_state', value: payload }).catch(() => {});
    }
  }, [prayers, muhasabahEntries, niyyahGoals, sadaqahList, zakatWealth, wasiyyah, todos, quranState, fastingDays]);

  useEffect(() => {
    if (kvHydratedRef.current) {
      invoke('upsert_user_kv', { key: 'daily_done', value: JSON.stringify(dailyDone) }).catch(() => {});
    }
  }, [dailyDone]);

  useEffect(() => {
    if (kvHydratedRef.current) {
      invoke('upsert_user_kv', { key: 'reminders', value: JSON.stringify(reminders) }).catch(() => {});
    }
  }, [reminders]);

  const cyclePrayer = (prayer: PrayerName) => {
    const todayKey = new Date().toISOString().split('T')[0];
    const order: PrayerStatus[] = ['pending', 'done', 'qaza', 'missed'];
    setPrayers((prev) => {
      const curDay: PrayerDay = prev[todayKey] || {
        fajr: 'pending',
        dhuhr: 'pending',
        asr: 'pending',
        maghrib: 'pending',
        isha: 'pending',
      };
      const nextIdx = (order.indexOf(curDay[prayer]) + 1) % order.length;
      const nextStatus = order[nextIdx] === 'pending' ? 'done' : order[nextIdx];
      return { ...prev, [todayKey]: { ...curDay, [prayer]: nextStatus } };
    });
  };

  useEffect(() => {
    (async () => {
      try {
        const dbItems = await invoke<TaskeenItem[]>('fetch_items');
        if (Array.isArray(dbItems) && dbItems.length > 0) {
          setItems(dbItems);
          setSelectedId((prev) => prev || dbItems[0].id);
        }
        const status = await invoke<{ db_sha256: string }>('get_app_status');
        if (status?.db_sha256) setNativeDbHash(status.db_sha256.slice(0, 12));

        const logs = await invoke<Array<{ item_id: string; tasbih_count: number; is_favorite: boolean; tadabbur_note: string }>>('load_user_logs');
        if (Array.isArray(logs) && logs.length > 0) {
          const cMap: Record<string, number> = {};
          const favs: string[] = [];
          const notes: Record<string, string> = {};
          logs.forEach((l) => {
            cMap[l.item_id] = l.tasbih_count;
            if (l.is_favorite) favs.push(l.item_id);
            if (l.tadabbur_note) notes[l.item_id] = l.tadabbur_note;
          });
          setCounts((p) => ({ ...p, ...cMap }));
          setFavorites((p) => Array.from(new Set([...p, ...favs])));
          setTadabburNotes((p) => ({ ...p, ...notes }));
        }

        const kvRows = await invoke<Array<{ key: string; value: string }>>('load_user_kv');
        if (Array.isArray(kvRows) && kvRows.length > 0) {
          kvRows.forEach((row) => {
            try {
              const parsed = JSON.parse(row.value);
              if (row.key === 'amalify_state') {
                if (parsed.prayers) setPrayers(parsed.prayers);
                if (Array.isArray(parsed.muhasabahEntries)) setMuhasabahEntries(parsed.muhasabahEntries);
                if (Array.isArray(parsed.niyyahGoals)) setNiyyahGoals(parsed.niyyahGoals);
                if (Array.isArray(parsed.sadaqahList)) setSadaqahList(parsed.sadaqahList);
                if (typeof parsed.zakatWealth === 'number') setZakatWealth(parsed.zakatWealth);
                if (parsed.wasiyyah) setWasiyyah(parsed.wasiyyah);
                if (Array.isArray(parsed.todos)) setTodos(parsed.todos);
                if (parsed.quranState) setQuranState(parsed.quranState);
                if (parsed.fastingDays) setFastingDays(parsed.fastingDays);
              } else if (row.key === 'daily_done') {
                setDailyDone(parsed);
              } else if (row.key === 'reminders') {
                setReminders(parsed);
              }
            } catch {}
          });
        } else {
          // Auto-migrate existing localStorage data into SQLite on first launch
          const existingAmalify = localStorage.getItem('taskeen_amalify_v1');
          if (existingAmalify) {
            await invoke('upsert_user_kv', { key: 'amalify_state', value: existingAmalify }).catch(() => {});
          }
          await invoke('upsert_user_kv', { key: 'daily_done', value: JSON.stringify(dailyDone) }).catch(() => {});
        }
        kvHydratedRef.current = true;
      } catch {
        kvHydratedRef.current = true;
        // Browser preview fallback: uses bundled JSON + localStorage
      }
    })();
  }, []);

  const audioTimerRef = useRef<number | null>(null);

  useEffect(() => {
    try {
      const customItems = items.filter((i) => !DEFAULT_ITEMS.some((d) => d.id === i.id));
      localStorage.setItem(
        'taskeen_local_v1',
        JSON.stringify({ customItems, favorites, counts, verifiedMap, dailyDone, tadabburNotes })
      );
    } catch {}
  }, [items, favorites, counts, verifiedMap, dailyDone, tadabburNotes]);

  const notify = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(''), 2600);
  };

  const reloadAllUserDataFromSqlite = async () => {
    const logs = await invoke<Array<{ item_id: string; tasbih_count: number; is_favorite: boolean; tadabbur_note: string }>>('load_user_logs');
    const cMap: Record<string, number> = {};
    const favs: string[] = [];
    const notes: Record<string, string> = {};
    logs.forEach((l) => {
      cMap[l.item_id] = l.tasbih_count;
      if (l.is_favorite) favs.push(l.item_id);
      if (l.tadabbur_note) notes[l.item_id] = l.tadabbur_note;
    });
    setCounts(cMap);
    setFavorites(favs);
    setTadabburNotes(notes);
    const kvRows = await invoke<Array<{ key: string; value: string }>>('load_user_kv');
    kvRows.forEach((row) => {
      try {
        const parsed = JSON.parse(row.value);
        if (row.key === 'amalify_state') {
          if (parsed.prayers) setPrayers(parsed.prayers);
          if (Array.isArray(parsed.muhasabahEntries)) setMuhasabahEntries(parsed.muhasabahEntries);
          if (Array.isArray(parsed.niyyahGoals)) setNiyyahGoals(parsed.niyyahGoals);
          if (Array.isArray(parsed.sadaqahList)) setSadaqahList(parsed.sadaqahList);
          if (typeof parsed.zakatWealth === 'number') setZakatWealth(parsed.zakatWealth);
          if (parsed.wasiyyah) setWasiyyah(parsed.wasiyyah);
          if (Array.isArray(parsed.todos)) setTodos(parsed.todos);
          if (parsed.quranState) setQuranState(parsed.quranState);
          if (parsed.fastingDays) setFastingDays(parsed.fastingDays);
        } else if (row.key === 'daily_done') {
          setDailyDone(parsed);
        } else if (row.key === 'reminders') {
          setReminders(parsed);
        }
      } catch {}
    });
  };

  useEffect(() => {
    const q = search.trim();
    if (!q) {
      setFtsIds(null);
      return;
    }
    let cancelled = false;
    invoke<TaskeenItem[]>('search_items', { query: q })
      .then((res) => {
        if (!cancelled && Array.isArray(res)) {
          setFtsIds(new Set(res.map((r) => r.id)));
        }
      })
      .catch(() => {
        if (!cancelled) setFtsIds(null);
      });
    return () => { cancelled = true; };
  }, [search]);

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      if (category === 'favorites' && !favorites.includes(item.id)) return false;
      if (category !== 'all' && category !== 'favorites' && item.category !== category) return false;
      if (emotion !== 'all' && item.emotion_tag !== emotion) return false;
      if (gradeFilter !== 'all' && !item.hadith_grade.toLowerCase().includes(gradeFilter.toLowerCase())) return false;
      if (bookFilter !== 'all' && !item.primary_source.includes(bookFilter)) return false;
      if (search.trim()) {
        if (ftsIds) return ftsIds.has(item.id);
        const q = search.trim().toLowerCase();
        const hay = `${item.title_bn} ${item.bangla_pronunciation || ''} ${item.bangla_meaning} ${item.primary_source} ${item.fazilat_text} ${item.hadith_grade}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [items, category, emotion, gradeFilter, bookFilter, search, ftsIds, favorites]);

  const selectedItem = useMemo(() => {
    return filteredItems.find((i) => i.id === selectedId) || filteredItems[0] || items[0];
  }, [filteredItems, selectedId, items]);

  useEffect(() => {
    if (!selectedItem) return;
    invoke('upsert_user_log', {
      itemId: selectedItem.id,
      tasbihCount: counts[selectedItem.id] || 0,
      isFavorite: favorites.includes(selectedItem.id),
      tadabburNote: tadabburNotes[selectedItem.id] || '',
    }).catch(() => {});
  }, [selectedItem, counts, favorites, tadabburNotes]);

  const toggleMiniMode = () => {
    setMiniMode((prev) => {
      const next = !prev;
      invoke('set_mini_mode', { mini: next }).catch(() => {});
      return next;
    });
  };

  useEffect(() => {
    let unlisten: (() => void) | undefined;
    listen('toggle-mini-mode', () => {
      toggleMiniMode();
    })
      .then((fn) => { unlisten = fn; })
      .catch(() => {});
    return () => { if (unlisten) unlisten(); };
  }, []);

  useEffect(() => {
    if (!reminders.enabled || reminders.silent) return;
    const mins = Math.max(15, Number(reminders.interval) || 60);
    const id = window.setInterval(() => {
      const isFriday = new Date().getDay() === 5;
      const title = isFriday && reminders.fridayDurood
        ? 'জুমআর দরূদ শরীফ স্মরণ'
        : 'তাসকীন — যিকির ও দোয়া স্মরণ';
      const body = isFriday && reminders.fridayDurood
        ? 'আজ জুমআর দিন। নবীজি ﷺ-এর ওপর বেশি বেশি দরূদ শরীফ পাঠ করুন।'
        : 'কাজের ফাঁকে কিছুক্ষণ আল্লাহর যিকির ও ইস্তেগফার করে নিন।';
      invoke('send_reminder_notification', { title, body }).catch(() => {});
    }, mins * 60 * 1000);
    return () => window.clearInterval(id);
  }, [reminders]);

  const lastPrayerAlertRef = useRef<string>('');
  useEffect(() => {
    const checkPrayerAlertAndTray = () => {
      try {
        const now = new Date();
        const nowMins = now.getHours() * 60 + now.getMinutes();
        const hhmm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
        const dateKey = now.toISOString().split('T')[0];
        let prefs = { lat: 23.8103, lng: 90.4125, tz: 6, method: 'Karachi' as const, madhab: 'Hanafi' as const };
        try {
          const saved = localStorage.getItem('taskeen_prayer_prefs_v1');
          if (saved) prefs = { ...prefs, ...JSON.parse(saved) };
        } catch {}
        const times = computeOfflinePrayerTimes(now, prefs.lat, prefs.lng, prefs.tz, prefs.method, prefs.madhab);
        const waqts: [string, string][] = [
          [times.Fajr, 'ফজর'],
          [times.Dhuhr, 'যোহর'],
          [times.Asr, 'আসর'],
          [times.Maghrib, 'মাগরিব'],
          [times.Isha, 'ইশা'],
        ];

        // Update Windows System Tray next prayer label
        let nextLabel = `পরবর্তী: ফজর (${times.Fajr})`;
        for (const [tStr, bnName] of waqts) {
          const m = tStr.match(/(\d{1,2}):(\d{2})/);
          if (!m) continue;
          const pMins = parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
          if (pMins > nowMins) {
            const diff = pMins - nowMins;
            const dh = Math.floor(diff / 60);
            const dm = diff % 60;
            const rem = dh > 0 ? `${dh}ঘ ${dm}মি বাকি` : `${dm}মি বাকি`;
            nextLabel = `পরবর্তী: ${bnName} (${tStr}) · ${rem}`;
            break;
          }
        }
        invoke('update_tray_next_prayer', { label: nextLabel }).catch(() => {});

        if (!reminders.enabled || reminders.silent) return;
        for (const [tStr, bnName] of waqts) {
          const alertKey = `${dateKey}-${bnName}`;
          if (tStr === hhmm && lastPrayerAlertRef.current !== alertKey) {
            lastPrayerAlertRef.current = alertKey;
            notify(`নামাজের সময় হয়েছে: ${bnName} (${tStr})`);
            invoke('send_reminder_notification', {
              title: `নামাজের সময় হয়েছে: ${bnName}`,
              body: `এখন ${bnName} ওয়াক্তের সময় (${tStr})। ওযু করে নামাজের প্রস্তুতি নিন।`,
            }).catch(() => {});
          }
        }
      } catch {}
    };
    checkPrayerAlertAndTray();
    const id = window.setInterval(checkPrayerAlertAndTray, 30000);
    return () => window.clearInterval(id);
  }, [reminders]);

  const playSoftChime = () => {
    try {
      const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!Ctx) return;
      const ctx = new Ctx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(528, ctx.currentTime);
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.45);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.45);
    } catch {}
  };

  const incrementTasbih = () => {
    if (!selectedItem) return;
    const nextVal = (counts[selectedItem.id] || 0) + 1;
    setCounts((prev) => ({ ...prev, [selectedItem.id]: nextVal }));
    if (nextVal === target) {
      playSoftChime();
      notify(`মাশাআল্লাহ! ${target} বার তাসবীহ পূর্ণ হয়েছে।`);
    }
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowAddModal(false);
        setShowRemModal(false);
        setShowStatsModal(false);
        setShowShareModal(false);
        setShowBackupModal(false);
        setShowPinModal(false);
        setShowAboutModal(false);
        return;
      }
      if (e.ctrlKey && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
        return;
      }
      if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 't') {
        e.preventDefault();
        toggleMiniMode();
        return;
      }
      const tag = (document.activeElement?.tagName || '').toUpperCase();
      if (e.code === 'Space' && !['INPUT', 'TEXTAREA', 'SELECT'].includes(tag)) {
        e.preventDefault();
        incrementTasbih();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const stopAudio = () => {
    setAudioPlaying(false);
    setAudioProgress(0);
    setAudioMode('idle');
    if (audioTimerRef.current) window.clearInterval(audioTimerRef.current);
    if (audioElRef.current) {
      audioElRef.current.pause();
      audioElRef.current.currentTime = 0;
    }
    try { window.speechSynthesis?.cancel(); } catch {}
  };

  const playTtsFallback = () => {
    setAudioMode('tts');
    let pct = 0;
    audioTimerRef.current = window.setInterval(() => {
      pct += 4 * audioSpeed;
      if (pct >= 100) {
        stopAudio();
        notify('তিলাওয়াত সম্পন্ন হয়েছে');
      } else {
        setAudioProgress(Math.min(100, pct));
      }
    }, 250);
    try {
      if (window.speechSynthesis && selectedItem) {
        window.speechSynthesis.cancel();
        const utter = new SpeechSynthesisUtterance(selectedItem.arabic_uthmani);
        utter.lang = 'ar-SA';
        utter.rate = audioSpeed;
        utter.onend = () => stopAudio();
        window.speechSynthesis.speak(utter);
      }
    } catch {}
  };

  const toggleAudio = () => {
    if (audioPlaying) {
      stopAudio();
      return;
    }
    if (!selectedItem) return;
    setAudioPlaying(true);

    const tryAudioFile = (ext: 'opus' | 'mp3') => {
      const audio = new Audio(`/audio/${selectedItem.id}.${ext}`);
      audio.playbackRate = audioSpeed;
      audioElRef.current = audio;
      audio.oncanplaythrough = () => {
        setAudioMode('pack');
      };
      audio.ontimeupdate = () => {
        if (audio.duration > 0) {
          setAudioProgress(Math.min(100, (audio.currentTime / audio.duration) * 100));
        }
      };
      audio.onended = () => {
        stopAudio();
        notify('তিলাওয়াত সম্পন্ন হয়েছে');
      };
      audio.onerror = () => {
        if (ext === 'opus') {
          tryAudioFile('mp3');
        } else {
          playTtsFallback();
        }
      };
      audio.play().catch(() => {
        if (ext === 'opus') tryAudioFile('mp3');
        else playTtsFallback();
      });
    };

    tryAudioFile('opus');
  };

  const drawShareCard = () => {
    const canvas = canvasRef.current;
    if (!canvas || !selectedItem) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const w = canvas.width;
    const h = canvas.height;
    const themes = {
      emerald: { bg: '#0E5A45', border: '#2D8A6E', title: '#FFFFFF', arabic: '#F4F7F5', body: '#DCE8E3', meta: '#A7D0C2' },
      ivory: { bg: '#F7FAF8', border: '#0E5A45', title: '#0A4736', arabic: '#0F1A17', body: '#243630', meta: '#4A5B55' },
      night: { bg: '#0D1412', border: '#2D8A6E', title: '#8CE0C3', arabic: '#FFFFFF', body: '#CFE0D9', meta: '#8FA89E' },
    };
    const t = themes[cardTheme];
    ctx.fillStyle = t.bg;
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = t.border;
    ctx.lineWidth = 4;
    ctx.strokeRect(24, 24, w - 48, h - 48);

    ctx.fillStyle = t.meta;
    ctx.font = '600 18px "Hind Siliguri", sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('তাসকীন (Taskeen) · প্রামাণিক আমল কার্ড', 54, 68);

    ctx.fillStyle = t.title;
    ctx.font = '700 26px "Noto Serif Bengali", serif';
    ctx.fillText(selectedItem.title_bn, 54, 110);

    ctx.fillStyle = t.arabic;
    ctx.font = '700 30px "Amiri", serif';
    ctx.textAlign = 'right';
    const arWords = selectedItem.arabic_uthmani.split(' ');
    const arLines: string[] = [];
    let cur = '';
    for (const word of arWords) {
      const test = cur ? `${cur} ${word}` : word;
      if (ctx.measureText(test).width > w - 120) { arLines.push(cur); cur = word; }
      else cur = test;
    }
    if (cur) arLines.push(cur);
    let y = 175;
    for (const line of arLines.slice(0, 3)) { ctx.fillText(line, w - 54, y); y += 50; }

    ctx.textAlign = 'left';
    ctx.fillStyle = t.body;
    ctx.font = '400 18px "Hind Siliguri", sans-serif';
    const bnWords = selectedItem.bangla_meaning.split(' ');
    const bnLines: string[] = [];
    let bCur = '';
    for (const word of bnWords) {
      const test = bCur ? `${bCur} ${word}` : word;
      if (ctx.measureText(test).width > w - 110) { bnLines.push(bCur); bCur = word; }
      else bCur = test;
    }
    if (bCur) bnLines.push(bCur);
    let by = Math.max(y + 24, 345);
    for (const line of bnLines.slice(0, 3)) { ctx.fillText(line, 54, by); by += 28; }

    ctx.fillStyle = t.meta;
    ctx.font = '500 15px "Google Sans Code", monospace';
    ctx.fillText(`সূত্র: ${selectedItem.primary_source} (${selectedItem.hadith_grade})`, 54, h - 48);
  };

  useEffect(() => {
    if (showShareModal) drawShareCard();
  }, [showShareModal, cardTheme, selectedItem]);

  const exportJson = () => {
    const payload = items.map((i) => ({ ...i, tahqeeq_status: verifiedMap[i.id] ? 'verified' : 'pending' }));
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'taskeen_tahqeeq_export.json';
    a.click();
    URL.revokeObjectURL(url);
    notify('JSON ফাইল এক্সপোর্ট হয়েছে');
  };

  const totalCount = Object.values(counts).reduce((a, b) => a + b, 0);
  const verifiedTotal = items.filter((i) => verifiedMap[i.id]).length;
  const currentCount = selectedItem ? counts[selectedItem.id] || 0 : 0;

  if (miniMode && selectedItem) {
    return (
      <div className={`${darkMode ? 'bg-[#080D0B] text-[#E7EFEA]' : 'bg-[#F7FAF8] text-[#0F1A17]'} min-h-screen p-4 flex flex-col justify-between`}>
        <div className="flex items-center justify-between gap-2 pb-2 border-b border-[#DCE3E0]">
          <span className="font-serif-bn font-bold text-sm truncate">{selectedItem.title_bn}</span>
          <button onClick={toggleMiniMode} className="px-2 py-1 text-[11px] rounded border border-[#0E5A45] text-[#0A4736] shrink-0">বড় মোড</button>
        </div>
        <div className="my-3 p-3 rounded-xl border border-[#DCE3E0] bg-white/70 dark:bg-[#121F1B]">
          <p className="font-arabic-amiri text-right text-xl leading-loose">{selectedItem.arabic_uthmani}</p>
          <p className="text-xs opacity-80 mt-2 line-clamp-2">{selectedItem.bangla_meaning}</p>
        </div>
        <button onClick={incrementTasbih} className="w-full py-5 rounded-2xl bg-[#0E5A45] hover:bg-[#0A4736] text-white flex flex-col items-center justify-center shadow">
          <span className="font-mono-code text-4xl font-semibold">{currentCount}</span>
          <span className="text-[11px] opacity-80 mt-1">লক্ষ্য: {target} (ক্লিক / Space · Ctrl+Shift+T)</span>
        </button>
      </div>
    );
  }

  if (isLocked && appPin) {
    return <PinLockScreen expectedPin={appPin} onUnlock={() => setIsLocked(false)} />;
  }

  const dailyCompletedCount = DAILY_AMAL_LIST.filter((a) => dailyDone[a.id]).length;
  const dailyScorePct = Math.round((dailyCompletedCount / DAILY_AMAL_LIST.length) * 100);

  const navItems: { id: typeof activeView; label: string; icon: React.ReactNode }[] = [
    { id: 'dashboard', label: 'হোম ড্যাশবোর্ড', icon: <Home className="w-4 h-4" /> },
    { id: 'library', label: 'দোয়া ও তাহকীক', icon: <BookOpen className="w-4 h-4" /> },
    { id: 'quran', label: 'কুরআন ও খতম', icon: <BookMarked className="w-4 h-4" /> },
    { id: 'salah', label: 'নামাজ ও কিবলা', icon: <Compass className="w-4 h-4" /> },
    { id: 'amal', label: 'আমল ও মুহাসাবাহ', icon: <Sparkles className="w-4 h-4" /> },
    { id: 'life', label: 'ফোকাস, যাকাত ও ওসিয়ত', icon: <Timer className="w-4 h-4" /> },
    { id: 'notes', label: 'নোটবুক', icon: <NotebookPen className="w-4 h-4" /> },
    { id: 'reports', label: 'টু-ডু, রিপোর্ট ও ব্যাকআপ', icon: <BarChart3 className="w-4 h-4" /> },
    { id: 'settings', label: 'সেটিংস ও ফন্ট স্টুডিও', icon: <Settings className="w-4 h-4" /> },
    { id: 'about', label: 'পরিচিতি ও ডোনেট', icon: <Info className="w-4 h-4" /> },
  ];

  return (
    <div
      data-theme={theme}
      data-pattern={uiPrefs.patternEnabled ? 'on' : 'off'}
      className={`ts-shell ${privacyBlur ? 'privacy-blur-active' : ''} h-screen overflow-hidden flex`}
    >
      {/* Left App-Shell Sidebar */}
      <aside className="ts-sidebar pattern-arabesque w-64 shrink-0 border-r border-white/10 hidden md:flex flex-col justify-between p-4">
        <div className="space-y-6">
          <div className="flex items-center gap-3 px-2">
            <div className="w-10 h-10 rounded-xl bg-[#0E5A45] text-white flex items-center justify-center font-serif-bn font-bold text-xl shadow-md">ت</div>
            <div>
              <div className="font-serif-bn font-bold text-lg leading-tight tracking-wide">তাসকীন</div>
              <div className="text-[11px] opacity-70">পাণ্ডুলিপি ও আমল কম্প্যানিয়ন</div>
            </div>
          </div>

          <nav className="space-y-1 text-xs">
            {navItems.map((n) => (
              <button
                key={n.id}
                onClick={() => setActiveView(n.id)}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl font-semibold transition ${
                  activeView === n.id
                    ? 'bg-[#0E5A45] text-white shadow-sm'
                    : 'opacity-80 hover:bg-white/10'
                }`}
              >
                {n.icon}
                <span>{n.label}</span>
              </button>
            ))}
          </nav>
        </div>

        <div className="space-y-3">
          <div className="p-3 rounded-xl bg-white/5 border border-white/10 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="opacity-80">দৈনিক আমল স্কোর</span>
              <span className="font-bold font-mono-code text-[#E2A856]">{dailyScorePct}%</span>
            </div>
            <div className="w-full h-2 rounded-full bg-white/15 overflow-hidden">
              <div className="h-full bg-[#0E5A45] transition-all" style={{ width: `${dailyScorePct}%` }} />
            </div>
          </div>

          <div className="flex items-center justify-between px-1 text-[11px] opacity-75">
            <button onClick={() => setShowAboutModal(true)} className="font-mono-code underline hover:opacity-100">
              {nativeDbHash ? `SQLite ✓ ${nativeDbHash.slice(0, 6)}` : 'তথ্য ও ফিডব্যাক'}
            </button>
            <button onClick={() => changeTheme(darkMode ? 'andalusia' : 'midnight')} className="flex items-center gap-1 px-2 py-1 rounded-lg border border-white/20">
              {darkMode ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
              <span>{darkMode ? 'আলো' : 'রাত'}</span>
            </button>
          </div>
          <button
            onClick={() => setShowAboutModal(true)}
            className="w-full py-1.5 rounded-lg border border-white/15 text-[11px] font-medium hover:bg-white/10"
          >
            অ্যাপ সম্পর্কে ও টেস্টার ফিডব্যাক
          </button>
        </div>
      </aside>

      {/* Main Content Shell */}
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden ts-shell">
        {/* Global Top Bar */}
        <header className="ts-card min-h-14 px-5 py-2.5 border-b flex flex-wrap items-center justify-between gap-3">
          <input
            ref={searchInputRef}
            type="search"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              if (e.target.value.trim() && activeView !== 'library') setActiveView('library');
            }}
            placeholder="যেকোনো দোয়া, উচ্চারণ, কিতাব বা হাদিস খুঁজুন (Ctrl+K)..."
            className={`flex-1 min-w-[200px] max-w-md px-3.5 py-1.5 text-sm rounded-xl border ${darkMode ? 'bg-[#0F1916] border-[#243832] text-white' : 'bg-[#F7FAF8] border-[#D2DDD8]'}`}
          />

          <div className="flex flex-wrap items-center gap-2">
            <span className="hidden lg:inline-block px-3 py-1.5 text-xs rounded-xl border border-[#DCE3E0] opacity-85">
              📅 {getHijriLabel()}
            </span>
            <button onClick={toggleMiniMode} title="Ctrl+Shift+T" className="px-3 py-1.5 text-xs rounded-xl border border-[#0E5A45] text-[#0A4736] font-semibold">
              মিনি তাসবীহ
            </button>
            <button onClick={() => setShowBackupModal(true)} className="px-3 py-1.5 text-xs rounded-xl border border-[#D2DDD8]">ব্যাকআপ</button>
            <button
              onClick={() => {
                setPrivacyBlur((p) => {
                  const next = !p;
                  notify(next ? 'প্রাইভেসি ব্লার চালু হয়েছে' : 'প্রাইভেসি ব্লার বন্ধ হয়েছে');
                  return next;
                });
              }}
              title="সংবেদনশীল নোট ও হিসাব ঝাপসা করুন"
              className={`px-2.5 py-1.5 text-xs rounded-xl border flex items-center gap-1 ${
                privacyBlur ? 'bg-[#0E5A45] text-white border-[#0E5A45]' : 'border-[#D2DDD8]'
              }`}
            >
              {privacyBlur ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              <span>প্রাইভেসি</span>
            </button>
            <button onClick={() => setShowPinModal(true)} title="পিন লক সেটিংস" className="px-2.5 py-1.5 text-xs rounded-xl border border-[#D2DDD8] flex items-center gap-1">
              <Lock className="w-3.5 h-3.5" /> {appPin ? 'পিন ✓' : 'পিন'}
            </button>
            {appPin && (
              <button onClick={() => setIsLocked(true)} className="px-2.5 py-1.5 text-xs rounded-xl border border-[#D2DDD8]">লক</button>
            )}
            <button onClick={() => setShowRemModal(true)} className="px-3 py-1.5 text-xs rounded-xl border border-[#D2DDD8]">রিমাইন্ডার</button>
            <button onClick={() => setShowAddModal(true)} className="px-3 py-1.5 text-xs font-semibold rounded-xl bg-[#0E5A45] text-white">+ নতুন দোয়া</button>
          </div>
        </header>

        {/* Mobile Nav Fallback */}
        <nav className={`md:hidden px-4 py-2 border-b flex gap-1.5 overflow-x-auto ${darkMode ? 'border-[#243832] bg-[#0F1916]' : 'border-[#DCE3E0] bg-white'}`}>
          {navItems.map((n) => (
            <button
              key={n.id}
              onClick={() => setActiveView(n.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap ${
                activeView === n.id ? 'bg-[#0E5A45] text-white' : 'opacity-75'
              }`}
            >
              {n.label}
            </button>
          ))}
        </nav>

        <div className="flex-1 overflow-y-auto ts-scroll-area flex flex-col">
        {activeView === 'dashboard' && (
          <DashboardView
            darkMode={darkMode}
            selectedItem={selectedItem}
            currentCount={currentCount}
            target={target}
            onIncrementTasbih={incrementTasbih}
            prayers={prayers}
            onCyclePrayer={cyclePrayer}
            dailyAmalList={DAILY_AMAL_LIST}
            dailyDone={dailyDone}
            onToggleDaily={(id, checked) => setDailyDone((p) => ({ ...p, [id]: checked }))}
            todos={todos}
            onToggleTodo={(id) =>
              setTodos((prev) => prev.map((t) => (t.id === id ? { ...t, completed: !t.completed } : t)))
            }
            sadaqahList={sadaqahList}
            fastingDays={fastingDays}
            onToggleFasting={() => {
              const todayKey = new Date().toISOString().split('T')[0];
              setFastingDays((p) => {
                const next = !p[todayKey];
                notify(next ? 'মাশাআল্লাহ! আজকের রোজা লগ হয়েছে।' : 'আজকের রোজা সরানো হয়েছে।');
                return { ...p, [todayKey]: next };
              });
            }}
            onNavigate={(v) => setActiveView(v)}
            widgets={{ ...DEFAULT_DASHBOARD_WIDGETS, ...(uiPrefs.dashboardWidgets || {}) }}
          />
        )}

        {activeView === 'quran' && (
          <QuranView
            darkMode={darkMode}
            quranState={quranState}
            onChangeQuran={setQuranState}
            onNotify={notify}
          />
        )}

        {activeView === 'salah' && (
          <SalahQiblaView
            darkMode={darkMode}
            prayers={prayers}
            onCyclePrayer={cyclePrayer}
            onNotify={notify}
          />
        )}

        {activeView === 'amal' && (
          <MuhasabahNiyyahView
            darkMode={darkMode}
            entries={muhasabahEntries}
            onAddEntry={(entry) => setMuhasabahEntries((p) => [entry, ...p])}
            goals={niyyahGoals}
            onUpdateGoals={setNiyyahGoals}
            onNotify={notify}
          />
        )}

        {activeView === 'life' && (
          <ToolsView
            darkMode={darkMode}
            sadaqahList={sadaqahList}
            onAddSadaqah={(s) => setSadaqahList((p) => [s, ...p])}
            zakatWealth={zakatWealth}
            onChangeZakatWealth={setZakatWealth}
            wasiyyah={wasiyyah}
            onSaveWasiyyah={setWasiyyah}
            onNotify={notify}
          />
        )}

        {activeView === 'notes' && (
          <NotesView
            notes={notes}
            categories={noteCategories}
            onSaveNotes={saveNotes}
            onSaveCategories={saveNoteCategories}
          />
        )}

        {activeView === 'settings' && (
          <SettingsView
            theme={theme}
            onChangeTheme={changeTheme}
            uiPrefs={uiPrefs}
            onChangeUiPrefs={updateUiPrefs}
            arabicFont={arabicFont}
            onChangeArabicFont={setArabicFont}
            arabicSize={arabicSize}
            onChangeArabicSize={setArabicSize}
            privacyBlur={privacyBlur}
            onTogglePrivacyBlur={() => setPrivacyBlur((v) => !v)}
            hasPin={Boolean(appPin)}
            onOpenPinModal={() => setShowPinModal(true)}
            onOpenBackupModal={() => setShowBackupModal(true)}
            reminders={reminders}
            onChangeReminders={setReminders}
          />
        )}

        {activeView === 'about' && (
          <AboutView
            nativeDbHash={nativeDbHash}
            onOpenFeedbackModal={() => setShowAboutModal(true)}
          />
        )}

        {activeView === 'reports' && (
          <div className="space-y-2">
            <div className="px-6 pt-5 max-w-6xl mx-auto w-full flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs opacity-75">রিপোর্ট, টু-ডু ও নিরাপদ ব্যাকআপ</span>
              <div className="flex gap-2">
                <button onClick={() => setShowBackupModal(true)} className="px-3 py-1.5 rounded-xl bg-[#0E5A45] text-white text-xs font-semibold">
                  এনক্রিপ্টেড ব্যাকআপ / রিস্টোর
                </button>
                <button onClick={exportJson} className="px-3 py-1.5 rounded-xl border border-[#D2DDD8] text-xs">
                  তাহকীক JSON এক্সপোর্ট
                </button>
                <button onClick={() => setShowStatsModal(true)} className="px-3 py-1.5 rounded-xl border border-[#D2DDD8] text-xs">
                  স্ট্রিক ও পরিসংখ্যান
                </button>
              </div>
            </div>
            <TodoQiblaReportsView
              darkMode={darkMode}
              todos={todos}
              onUpdateTodos={setTodos}
              prayers={prayers}
              totalTasbihCount={totalCount}
              sadaqahList={sadaqahList}
              muhasabahEntries={muhasabahEntries}
              onNotify={notify}
            />
          </div>
        )}

        {/* 3-Column Workspace */}
        {activeView === 'library' && (
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-12">
          {/* Sidebar */}
          <aside className={`lg:col-span-3 border-r p-4 flex flex-col gap-4 ${darkMode ? 'border-[#243832] bg-[#121F1B]' : 'border-[#DCE3E0] bg-[#F9FBFA]'}`}>
            <nav className="flex lg:flex-col gap-1 overflow-x-auto">
              {[
                ['all', `সবগুলো (${items.length})`],
                ['dua', 'দোয়া ও মুনাজাত'],
                ['durood', 'দরুদ শরীফ'],
                ['istighfar', 'ইস্তেগফার'],
                ['favorites', `প্রিয় তালিকা (${favorites.length})`],
              ].map(([k, label]) => (
                <button
                  key={k}
                  onClick={() => setCategory(k)}
                  className={`text-left px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap ${category === k ? 'bg-[#0E5A45] text-white' : 'hover:bg-[#E6F2EE]/40'}`}
                >
                  {label}
                </button>
              ))}
            </nav>

            <div className="flex flex-wrap gap-1.5">
              <button onClick={() => setEmotion('all')} className={`px-2.5 py-1 rounded-full text-xs border ${emotion === 'all' ? 'border-[#0E5A45] bg-[#E6F2EE] text-[#0A4736]' : 'border-[#D2DDD8]'}`}>সব অবস্থা</button>
              {EMOTIONS.map((em) => (
                <button key={em} onClick={() => setEmotion(em)} className={`px-2.5 py-1 rounded-full text-xs border ${emotion === em ? 'border-[#0E5A45] bg-[#E6F2EE] text-[#0A4736]' : 'border-[#D2DDD8]'}`}>{em}</button>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-1.5">
              <select
                value={gradeFilter}
                onChange={(e) => setGradeFilter(e.target.value)}
                className="px-2 py-1.5 text-xs rounded-lg border border-[#D2DDD8] bg-transparent"
              >
                <option value="all">সব মান (Grade)</option>
                <option value="Sahih">Sahih (সহীহ)</option>
                <option value="Hasan">Hasan (হাসান)</option>
                <option value="Quran">Quran (কুরআন)</option>
              </select>
              <select
                value={bookFilter}
                onChange={(e) => setBookFilter(e.target.value)}
                className="px-2 py-1.5 text-xs rounded-lg border border-[#D2DDD8] bg-transparent"
              >
                <option value="all">সব কিতাব</option>
                <option value="বুখারী">সহীহ বুখারী</option>
                <option value="মুসলিম">সহীহ মুসলিম</option>
                <option value="আবু দাউদ">আবু দাউদ</option>
                <option value="তিরমিযী">তিরমিযী</option>
                <option value="নাসায়ী">নাসায়ী</option>
                <option value="ইবনে মাজাহ">ইবনে মাজাহ</option>
                <option value="মুসনাদে আহমাদ">মুসনাদে আহমাদ</option>
                <option value="সূরা">আল-কুরআন</option>
              </select>
            </div>

            <div className="flex-1 overflow-y-auto max-h-[380px] border-t border-[#DCE3E0] pt-3 space-y-1.5">
              {filteredItems.map((it) => (
                <button
                  key={it.id}
                  onClick={() => { stopAudio(); setSelectedId(it.id); setTarget(it.recommended_count || 33); }}
                  className={`w-full text-left px-3 py-2 rounded-lg text-xs border ${selectedItem?.id === it.id ? 'bg-[#E6F2EE] text-[#0A4736] border-[#0E5A45] font-semibold' : 'border-transparent hover:bg-[#EEF3F0]/50'}`}
                >
                  <div className="truncate">{it.title_bn}</div>
                  <div className="text-[11px] opacity-75 font-mono-code mt-0.5">{it.primary_source}</div>
                </button>
              ))}
            </div>
          </aside>

          {/* Main Reading Canvas */}
          <main className="lg:col-span-6 p-6 flex flex-col justify-between">
            {selectedItem && (
              <div>
                <div className="flex flex-wrap items-center justify-between gap-2 pb-4 border-b border-[#DCE3E0]">
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-0.5 text-xs font-mono-code rounded-full bg-[#E6F2EE] text-[#0A4736]">{selectedItem.hadith_grade}</span>
                    <span className="px-2.5 py-0.5 text-xs rounded-full bg-[#FDF3E7] text-[#7A4404]">{verifiedMap[selectedItem.id] ? '✓ আলেম-যাচাইকৃত' : '⏳ যাচাই বাকি'}</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <select value={arabicFont} onChange={(e) => setArabicFont(e.target.value as 'amiri' | 'scheherazade')} className="px-2 py-1 text-xs rounded border border-[#D2DDD8] bg-transparent">
                      <option value="amiri">নাসখ (Noto Naskh)</option>
                      <option value="scheherazade">লাতিফ (Lateef)</option>
                    </select>
                    <button onClick={() => setShowPronunciation(!showPronunciation)} className="px-2 py-1 rounded border border-[#D2DDD8] text-xs">উচ্চারণ</button>
                    <button onClick={() => setArabicSize((s) => Math.max(20, s - 2))} className="w-7 h-7 rounded border border-[#D2DDD8] text-xs font-bold">A-</button>
                    <button onClick={() => setArabicSize((s) => Math.min(42, s + 2))} className="w-7 h-7 rounded border border-[#D2DDD8] text-xs font-bold">A+</button>
                    <button onClick={() => setShowShareModal(true)} className="px-2 py-1 rounded border border-[#0E5A45] text-[#0A4736] text-xs font-medium">কার্ড শেয়ার</button>
                    <button
                      onClick={() => {
                        const text = `${selectedItem.title_bn}\n\n${selectedItem.arabic_uthmani}${selectedItem.bangla_pronunciation ? `\n\nউচ্চারণ: ${selectedItem.bangla_pronunciation}` : ''}\n\nঅর্থ: ${selectedItem.bangla_meaning}\n\nসূত্র: ${selectedItem.primary_source} (${selectedItem.hadith_grade})`;
                        navigator.clipboard?.writeText(text);
                        notify('দোয়াটি কপি হয়েছে!');
                      }}
                      className="px-2 py-1 rounded border border-[#D2DDD8] text-xs flex items-center gap-1"
                    >
                      <Copy className="w-3 h-3" /> কপি
                    </button>
                    <button
                      onClick={() => setFavorites((prev) => prev.includes(selectedItem.id) ? prev.filter((x) => x !== selectedItem.id) : [...prev, selectedItem.id])}
                      className="px-2.5 py-1 rounded border border-[#D2DDD8] text-xs"
                    >
                      {favorites.includes(selectedItem.id) ? '★ প্রিয়তে' : '☆ প্রিয়'}
                    </button>
                  </div>
                </div>

                <h1 className="font-serif-bn text-2xl font-bold mt-4 mb-1">{selectedItem.title_bn}</h1>
                <p className="text-xs opacity-70 font-mono-code mb-3">{selectedItem.primary_source}</p>

                {/* Audio Bar */}
                <div className={`mb-4 px-3.5 py-2.5 rounded-xl border flex flex-wrap items-center justify-between gap-3 ${darkMode ? 'border-[#243832] bg-[#121F1B]' : 'border-[#DCE3E0] bg-[#F7FAF8]'}`}>
                  <div className="flex items-center gap-2">
                    <button onClick={toggleAudio} className="px-3 py-1.5 rounded-lg bg-[#0E5A45] text-white text-xs font-semibold">
                      {audioPlaying ? '⏸ থামুন' : '▶ অডিও শুনুন'}
                    </button>
                    {audioMode !== 'idle' && (
                      <span className="text-[11px] opacity-70">
                        {audioMode === 'pack' ? 'অফলাইন অডিও প্যাক ✓' : 'ভয়েস সিন্থেসিস (ফলব্যাক)'}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-28 h-1.5 bg-[#DCE3E0] rounded-full overflow-hidden">
                      <div className="h-full bg-[#0E5A45] transition-all" style={{ width: `${audioProgress}%` }} />
                    </div>
                    <select value={audioSpeed} onChange={(e) => setAudioSpeed(Number(e.target.value))} className="px-2 py-1 text-xs rounded border border-[#D2DDD8] bg-transparent">
                      <option value={0.75}>0.75x</option>
                      <option value={1}>1.0x</option>
                      <option value={1.25}>1.25x</option>
                      <option value={1.5}>1.5x</option>
                    </select>
                  </div>
                </div>

                {/* Tabs */}
                <div className="flex gap-2 border-b border-[#DCE3E0] mb-4">
                  {[
                    ['text', 'মূল পাঠ ও অর্থ'],
                    ['fazilat', 'ফজিলত ও গুরুত্ব'],
                    ['story', 'প্রামাণিক ঘটনা'],
                    ['tahqeeq', 'তাহকীক ও সনদ'],
                  ].map(([k, lbl]) => (
                    <button
                      key={k}
                      onClick={() => setActiveTab(k as typeof activeTab)}
                      className={`px-3 py-2 text-sm border-b-2 ${activeTab === k ? 'border-[#0E5A45] text-[#0A4736] font-semibold' : 'border-transparent opacity-70'}`}
                    >
                      {lbl}
                    </button>
                  ))}
                </div>

                {activeTab === 'text' && (
                  <div className="space-y-4">
                    {/* Hifz / Memorization Mode Bar */}
                    <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-xl ts-subsurface text-xs">
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setHifzMode((v) => !v);
                            setHifzRevealed({ arabic: false, meaning: false });
                          }}
                          className={`px-3 py-1 rounded-lg font-semibold transition ${
                            hifzMode ? 'bg-[#0E5A45] text-white' : 'border border-[#D2DDD8]'
                          }`}
                        >
                          {hifzMode ? 'মুখস্থ মোড চালু ✓' : 'মুখস্থ মোড (Hifz)'}
                        </button>
                        {hifzMode && (
                          <>
                            <label className="flex items-center gap-1 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={hifzHideArabic}
                                onChange={(e) => setHifzHideArabic(e.target.checked)}
                                className="accent-[#0E5A45]"
                              />
                              <span>আরবি লুকান</span>
                            </label>
                            <label className="flex items-center gap-1 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={hifzHideMeaning}
                                onChange={(e) => setHifzHideMeaning(e.target.checked)}
                                className="accent-[#0E5A45]"
                              />
                              <span>অর্থ লুকান</span>
                            </label>
                            <button
                              type="button"
                              onClick={() =>
                                setHifzRevealed((r) =>
                                  r.arabic && r.meaning ? { arabic: false, meaning: false } : { arabic: true, meaning: true }
                                )
                              }
                              className="px-2 py-0.5 rounded border border-[#D2DDD8] font-semibold"
                            >
                              {hifzRevealed.arabic && hifzRevealed.meaning ? 'আবার লুকান' : 'সব দেখুন'}
                            </button>
                          </>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          setMemorizedIds((prev) => {
                            const exists = prev.includes(selectedItem.id);
                            const next = exists ? prev.filter((x) => x !== selectedItem.id) : [...prev, selectedItem.id];
                            localStorage.setItem('taskeen_memorized_v1', JSON.stringify(next));
                            notify(exists ? 'মুখস্থ তালিকা থেকে সরানো হয়েছে' : 'মাশাআল্লাহ! মুখস্থ হিসেবে মার্ক হয়েছে ✓');
                            return next;
                          });
                        }}
                        className={`px-2.5 py-1 rounded-lg font-semibold ${
                          memorizedIds.includes(selectedItem.id)
                            ? 'bg-[#0E5A45]/15 ts-accent-text'
                            : 'border border-[#D2DDD8]'
                        }`}
                      >
                        {memorizedIds.includes(selectedItem.id) ? 'মুখস্থ হয়েছে ✓' : 'মুখস্থ মার্ক করুন'}
                      </button>
                    </div>

                    <div
                      onClick={() => hifzMode && setHifzRevealed((r) => ({ ...r, arabic: !r.arabic }))}
                      title={hifzMode ? 'ক্লিক করে আরবি দেখুন/লুকান' : undefined}
                      className={`p-5 rounded-xl border ${darkMode ? 'bg-[#16211E] border-[#263833]' : 'bg-[#F4F7F5] border-[#DCE3E0]'} ${
                        hifzMode ? 'cursor-pointer' : ''
                      }`}
                    >
                      <p
                        className={`${arabicFont === 'scheherazade' ? 'font-arabic-scheherazade' : 'font-arabic-amiri'} text-right transition ${
                          hifzMode && hifzHideArabic && !hifzRevealed.arabic ? 'blur-md select-none' : ''
                        }`}
                        style={{ fontSize: `${arabicSize}px` }}
                      >
                        {selectedItem.arabic_uthmani}
                      </p>
                    </div>
                    {showPronunciation && selectedItem.bangla_pronunciation && (
                      <p
                        className={`text-sm italic opacity-85 transition ${
                          hifzMode && hifzHideArabic && !hifzRevealed.arabic ? 'blur-sm select-none' : ''
                        }`}
                      >
                        {selectedItem.bangla_pronunciation}
                      </p>
                    )}
                    <p
                      onClick={() => hifzMode && setHifzRevealed((r) => ({ ...r, meaning: !r.meaning }))}
                      title={hifzMode ? 'ক্লিক করে অর্থ দেখুন/লুকান' : undefined}
                      className={`text-base leading-relaxed transition ${
                        hifzMode ? 'cursor-pointer' : ''
                      } ${hifzMode && hifzHideMeaning && !hifzRevealed.meaning ? 'blur-md select-none' : ''}`}
                    >
                      {selectedItem.bangla_meaning}
                    </p>
                  </div>
                )}

                {activeTab === 'fazilat' && (
                  <div className="p-5 rounded-xl border border-[#DCE3E0]">
                    <p className="text-base leading-relaxed">{selectedItem.fazilat_text}</p>
                  </div>
                )}

                {activeTab === 'story' && (
                  <div className="p-5 rounded-xl border border-[#DCE3E0]">
                    <h3 className="font-serif-bn font-bold text-lg mb-2">{selectedItem.story_title}</h3>
                    <p className="text-base leading-relaxed">{selectedItem.story_context}</p>
                  </div>
                )}

                {activeTab === 'tahqeeq' && (
                  <div className="p-5 rounded-xl border border-[#DCE3E0] space-y-3">
                    <div className="flex justify-between text-sm"><span>সূত্র:</span><span className="font-mono-code">{selectedItem.primary_source}</span></div>
                    <div className="flex justify-between text-sm"><span>মান:</span><span className="font-mono-code">{selectedItem.hadith_grade}</span></div>
                    <p className="text-sm opacity-80">{selectedItem.alim_note}</p>
                    <button
                      onClick={() => setVerifiedMap((p) => ({ ...p, [selectedItem.id]: !p[selectedItem.id] }))}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#0E5A45] text-white"
                    >
                      {verifiedMap[selectedItem.id] ? 'যাচাই সম্পন্ন ✓' : 'যাচাই অনুমোদন দিন'}
                    </button>
                  </div>
                )}

                {/* Tadabbur Note */}
                <div className="mt-5 pt-4 border-t border-[#DCE3E0] sensitive-data">
                  <label className="block text-xs font-semibold opacity-75 mb-1">ব্যক্তিগত তাদাব্বুর ও আমল নোট</label>
                  <textarea
                    rows={2}
                    value={tadabburNotes[selectedItem.id] || ''}
                    onChange={(e) => setTadabburNotes((p) => ({ ...p, [selectedItem.id]: e.target.value }))}
                    placeholder="আপনার ব্যক্তিগত উপলব্ধি বা আমলের নোট লিখুন..."
                    className="w-full px-3 py-2 text-xs rounded-xl border border-[#D2DDD8] bg-transparent"
                  />
                </div>
              </div>
            )}
          </main>

          {/* Right Panel: Tasbih & Checklist */}
          <aside className={`lg:col-span-3 border-l p-5 flex flex-col justify-between gap-5 ${darkMode ? 'border-[#243832] bg-[#121F1B]' : 'border-[#DCE3E0] bg-[#F9FBFA]'}`}>
            <div>
              <p className="text-xs font-semibold opacity-75 mb-1">ইন্টারঅ্যাক্টিভ তাসবীহ</p>
              <h2 className="font-serif-bn font-bold text-base mb-3">{selectedItem?.title_bn}</h2>
              <div className="flex gap-1.5 mb-3">
                {[1, 33, 100].map((t) => (
                  <button key={t} onClick={() => setTarget(t)} className={`px-2 py-1 text-xs rounded border ${target === t ? 'bg-[#0E5A45] text-white border-[#0E5A45]' : 'border-[#D2DDD8]'}`}>{t}</button>
                ))}
              </div>
              <button onClick={incrementTasbih} className="w-full py-7 rounded-2xl bg-[#0E5A45] hover:bg-[#0A4736] text-white flex flex-col items-center justify-center shadow-md">
                <span className="font-mono-code text-5xl font-medium">{currentCount}</span>
                <span className="text-xs opacity-80 mt-2">লক্ষ্য: {target} বার (ক্লিক বা Space)</span>
              </button>
              <div className="flex justify-between items-center mt-2 text-xs">
                <span className="text-[#0A4736] font-medium">{currentCount >= target ? 'মাশাআল্লাহ! লক্ষ্য পূর্ণ।' : ''}</span>
                <button onClick={() => selectedItem && setCounts((p) => ({ ...p, [selectedItem.id]: 0 }))} className="underline opacity-75">রিসেট</button>
              </div>
            </div>

            <div className="border-t border-[#DCE3E0] pt-4">
              <p className="text-xs font-semibold opacity-75 mb-2">দৈনিক আমল চেকলিস্ট</p>
              <div className="space-y-1.5 text-xs">
                {DAILY_AMAL_LIST.map((a) => (
                  <label key={a.id} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={!!dailyDone[a.id]}
                      onChange={(e) => setDailyDone((p) => ({ ...p, [a.id]: e.target.checked }))}
                      className="accent-[#0E5A45]"
                    />
                    <span className={dailyDone[a.id] ? 'line-through opacity-60' : ''}>{a.label}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="border-t border-[#DCE3E0] pt-3 flex justify-between items-baseline">
              <span className="text-xs opacity-75">আজকের সর্বমোট পাঠ</span>
              <span className="font-mono-code text-xl font-bold text-[#0A4736]">{totalCount}</span>
            </div>
          </aside>
        </div>
        )}
        </div>
      </div>

      {/* Share Card Modal */}
      {showShareModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white text-[#0F1A17] w-full max-w-2xl rounded-2xl p-6 space-y-3">
            <div className="flex justify-between items-center">
              <h3 className="font-serif-bn font-bold text-lg">কার্ড শেয়ার ও ডাউনলোড</h3>
              <button onClick={() => setShowShareModal(false)}>✕</button>
            </div>
            <div className="flex justify-between items-center">
              <div className="flex gap-2 text-xs">
                {(['emerald', 'ivory', 'night'] as const).map((th) => (
                  <button key={th} onClick={() => setCardTheme(th)} className={`px-2.5 py-1 rounded border ${cardTheme === th ? 'bg-[#0E5A45] text-white' : ''}`}>{th}</button>
                ))}
              </div>
              <button
                onClick={() => {
                  const c = canvasRef.current;
                  if (!c) return;
                  const a = document.createElement('a');
                  a.href = c.toDataURL('image/png');
                  a.download = `taskeen-${selectedItem?.id}.png`;
                  a.click();
                  notify('কার্ড PNG ডাউনলোড হয়েছে');
                }}
                className="px-3 py-1.5 rounded-lg bg-[#0E5A45] text-white text-xs font-semibold"
              >
                PNG ডাউনলোড
              </button>
            </div>
            <canvas ref={canvasRef} width={900} height={520} className="w-full h-auto rounded-xl border" />
          </div>
        </div>
      )}

      {/* Stats Modal */}
      {showStatsModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white text-[#0F1A17] w-full max-w-md rounded-2xl p-6 space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="font-serif-bn font-bold text-lg">পরিসংখ্যান ও স্ট্রিক</h3>
              <button onClick={() => setShowStatsModal(false)}>✕</button>
            </div>
            <div className="grid grid-cols-2 gap-3 text-center">
              <div className="p-3 rounded-xl bg-[#F4F7F5]"><span className="text-xs block">মোট পাঠ</span><strong className="text-2xl font-mono-code">{totalCount}</strong></div>
              <div className="p-3 rounded-xl bg-[#FDF3E7]">
                <span className="text-xs block">স্ট্রিক ফ্রিজ</span>
                <button onClick={() => setStreakFreeze(!streakFreeze)} className="mt-1 px-2 py-0.5 rounded bg-[#B4690E] text-white text-xs">{streakFreeze ? 'সক্রিয় ✓' : 'বন্ধ'}</button>
              </div>
            </div>
            <button onClick={() => setShowStatsModal(false)} className="w-full py-2 rounded-lg bg-[#0E5A45] text-white text-xs font-semibold">বন্ধ করুন</button>
          </div>
        </div>
      )}

      {/* Reminder Modal */}
      {showRemModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white text-[#0F1A17] w-full max-w-md rounded-2xl p-6 space-y-3 text-sm">
            <div className="flex justify-between items-center">
              <h3 className="font-serif-bn font-bold text-lg">রিমাইন্ডার সেটিংস</h3>
              <button onClick={() => setShowRemModal(false)}>✕</button>
            </div>
            <label className="flex justify-between"><span>রিমাইন্ডার চালু</span><input type="checkbox" checked={reminders.enabled} onChange={(e) => setReminders({ ...reminders, enabled: e.target.checked })} /></label>
            <label className="flex justify-between items-center">
              <span>বিরতি (মিনিট)</span>
              <select value={reminders.interval} onChange={(e) => setReminders({ ...reminders, interval: e.target.value })} className="px-2 py-1 rounded border text-xs">
                <option value="30">৩০ মিনিট</option>
                <option value="60">১ ঘণ্টা</option>
                <option value="120">২ ঘণ্টা</option>
              </select>
            </label>
            <label className="flex justify-between"><span>সাইলেন্ট / মিটিং মোড</span><input type="checkbox" checked={reminders.silent} onChange={(e) => setReminders({ ...reminders, silent: e.target.checked })} /></label>
            <label className="flex justify-between"><span>জুমআর দরূদ স্মরণ</span><input type="checkbox" checked={reminders.fridayDurood} onChange={(e) => setReminders({ ...reminders, fridayDurood: e.target.checked })} /></label>
            <div className="flex gap-2 pt-1">
              <button
                onClick={() => {
                  invoke('send_reminder_notification', {
                    title: 'তাসকীন — টেস্ট নোটিফিকেশন',
                    body: 'আলহামদুলিল্লাহ! ডেস্কটপ নোটিফিকেশন সঠিকভাবে কাজ করছে।',
                  })
                    .then(() => notify('নোটিফিকেশন পাঠানো হয়েছে'))
                    .catch(() => notify('ডেস্কটপ অ্যাপ মোডে নোটিফিকেশন কাজ করে'));
                }}
                className="flex-1 py-2 rounded-lg border border-[#0E5A45] text-[#0A4736] text-xs font-semibold"
              >
                টেস্ট নোটিফিকেশন
              </button>
              <button onClick={() => { setShowRemModal(false); notify('রিমাইন্ডার সেভ হয়েছে'); }} className="flex-1 py-2 rounded-lg bg-[#0E5A45] text-white text-xs font-semibold">সেভ করুন</button>
            </div>
          </div>
        </div>
      )}

      {/* Encrypted Backup Modal */}
      {showBackupModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white text-[#0F1A17] w-full max-w-md rounded-2xl p-6 space-y-4 text-xs">
            <div className="flex justify-between items-center">
              <h3 className="font-serif-bn font-bold text-base">এনক্রিপ্টেড ব্যাকআপ ও রিস্টোর</h3>
              <button onClick={() => setShowBackupModal(false)}>✕</button>
            </div>

            <div className="p-3 rounded-xl bg-[#F4F7F5] space-y-2">
              <p className="font-semibold">নতুন ব্যাকআপ তৈরি করুন (.taskeen-backup)</p>
              <input
                type="password"
                value={backupPass}
                onChange={(e) => setBackupPass(e.target.value)}
                placeholder="পাসওয়ার্ড দিন (কমপক্ষে ৪ অক্ষর)"
                className="w-full px-3 py-2 rounded border bg-white"
              />
              <button
                onClick={async () => {
                  try {
                    const encrypted = await invoke<string>('export_backup', { passphrase: backupPass });
                    const blob = new Blob([encrypted], { type: 'application/json' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `taskeen-${new Date().toISOString().slice(0, 10)}.taskeen-backup`;
                    a.click();
                    URL.revokeObjectURL(url);
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
                    const restoredCount = await invoke<number>('import_backup', { content, passphrase: restorePass });
                    await reloadAllUserDataFromSqlite();
                    setRestorePass('');
                    setShowBackupModal(false);
                    notify(`${restoredCount}টি রেকর্ড রিস্টোর হয়েছে`);
                  } catch (err) {
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
                      const encrypted = await invoke<string>('export_backup', { passphrase: pass });
                      const headers: Record<string, string> = { 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates' };
                      if (cloudSyncKey.trim()) {
                        headers['apikey'] = cloudSyncKey.trim();
                        headers['Authorization'] = `Bearer ${cloudSyncKey.trim()}`;
                      }
                      const res = await fetch(cloudSyncUrl.trim(), {
                        method: 'POST',
                        headers,
                        body: JSON.stringify({ id: cloudSyncId || 'taskeen-main', payload: encrypted, updated_at: new Date().toISOString() }),
                      });
                      if (!res.ok) throw new Error(`HTTP ${res.status}`);
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
                      const headers: Record<string, string> = {};
                      if (cloudSyncKey.trim()) {
                        headers['apikey'] = cloudSyncKey.trim();
                        headers['Authorization'] = `Bearer ${cloudSyncKey.trim()}`;
                      }
                      const sep = cloudSyncUrl.includes('?') ? '&' : '?';
                      const url = `${cloudSyncUrl.trim()}${sep}id=eq.${encodeURIComponent(cloudSyncId || 'taskeen-main')}`;
                      const res = await fetch(url, { headers });
                      if (!res.ok) throw new Error(`HTTP ${res.status}`);
                      const json = await res.json();
                      const row = Array.isArray(json) ? json[0] : json;
                      const content = typeof row?.payload === 'string' ? row.payload : JSON.stringify(row?.payload || row);
                      const pass = restorePass || backupPass;
                      const restoredCount = await invoke<number>('import_backup', { content, passphrase: pass });
                      await reloadAllUserDataFromSqlite();
                      setShowBackupModal(false);
                      notify(`ক্লাউড থেকে ${restoredCount}টি রেকর্ড রিস্টোর হয়েছে`);
                    } catch (err) {
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
      )}

      {/* Add Entry Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              const item: TaskeenItem = {
                id: 'custom-' + Date.now(),
                category: (fd.get('category') as TaskeenItem['category']) || 'dua',
                title_bn: String(fd.get('title') || ''),
                emotion_tag: String(fd.get('emotion') || 'ক্ষমা ও তাওবা'),
                arabic_uthmani: String(fd.get('arabic') || ''),
                bangla_meaning: String(fd.get('bangla') || ''),
                fazilat_text: String(fd.get('fazilat') || ''),
                story_title: String(fd.get('storyTitle') || 'প্রামাণিক ঘটনা'),
                story_context: String(fd.get('story') || ''),
                primary_source: String(fd.get('source') || ''),
                hadith_grade: String(fd.get('grade') || 'Sahih'),
                recommended_count: 33,
                verified: true,
                alim_note: 'সরাসরি যুক্ত ও যাচাইকৃত।',
              };
              setItems([item, ...items]);
              setVerifiedMap((p) => ({ ...p, [item.id]: true }));
              setSelectedId(item.id);
              setShowAddModal(false);
              notify('নতুন এন্ট্রি যুক্ত হয়েছে');
            }}
            className="bg-white text-[#0F1A17] w-full max-w-lg rounded-2xl p-6 space-y-2.5 text-xs max-h-[90vh] overflow-y-auto"
          >
            <div className="flex justify-between items-center mb-2"><h3 className="font-serif-bn font-bold text-base">নতুন এন্ট্রি যোগ করুন</h3><button type="button" onClick={() => setShowAddModal(false)}>✕</button></div>
            <input name="title" required placeholder="শিরোনাম (বাংলায়)" className="w-full px-3 py-2 rounded border" />
            <select name="category" className="w-full px-3 py-2 rounded border"><option value="dua">দোয়া</option><option value="durood">দরুদ</option><option value="istighfar">ইস্তেগফার</option></select>
            <textarea name="arabic" required rows={2} dir="rtl" placeholder="আরবি পাঠ" className="w-full px-3 py-2 rounded border font-arabic-amiri text-base" />
            <textarea name="bangla" required rows={2} placeholder="বাংলা অনুবাদ" className="w-full px-3 py-2 rounded border" />
            <textarea name="fazilat" required rows={2} placeholder="ফজিলত" className="w-full px-3 py-2 rounded border" />
            <input name="source" required placeholder="রেফারেন্স (যেমন: সহীহ মুসলিম: ২৭২৬)" className="w-full px-3 py-2 rounded border" />
            <textarea name="story" rows={2} placeholder="প্রামাণিক ঘটনা" className="w-full px-3 py-2 rounded border" />
            <button type="submit" className="w-full py-2 rounded-lg bg-[#0E5A45] text-white font-semibold">সংরক্ষণ করুন</button>
          </form>
        </div>
      )}

      {!onboardingDone && (
        <OnboardingWizard
          onComplete={(cityName, madhab, defaultTarget) => {
            const found = CITY_PRESETS.find((c) => c.name === cityName) || CITY_PRESETS[0];
            localStorage.setItem(
              'taskeen_prayer_prefs_v1',
              JSON.stringify({
                name: found.name,
                lat: found.lat,
                lng: found.lng,
                tz: found.tz,
                method: 'Karachi',
                madhab,
              })
            );
            localStorage.setItem('taskeen_onboarding_done', '1');
            setTarget(defaultTarget);
            setOnboardingDone(true);
            notify('সেটিংস সেভ হয়েছে! তাসকীনে স্বাগতম।');
          }}
        />
      )}

      {showPinModal && (
        <PinSettingsModal
          hasPin={Boolean(appPin)}
          onSavePin={(newPin) => {
            setAppPin(newPin);
            if (newPin) {
              localStorage.setItem('taskeen_app_pin', newPin);
              notify('অ্যাপ পিন লক সক্রিয় হয়েছে');
            } else {
              localStorage.removeItem('taskeen_app_pin');
              notify('অ্যাপ পিন লক বন্ধ করা হয়েছে');
            }
          }}
          onClose={() => setShowPinModal(false)}
        />
      )}

      {showAboutModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white text-[#0F1A17] w-full max-w-md rounded-2xl p-6 space-y-4 text-xs">
            <div className="flex justify-between items-center">
              <h3 className="font-serif-bn font-bold text-base">তাসকীন (Taskeen) — অ্যাপ তথ্য ও ফিডব্যাক</h3>
              <button onClick={() => setShowAboutModal(false)}>✕</button>
            </div>
            <div className="p-3 rounded-xl bg-[#F4F7F5] space-y-1 font-mono-code text-[11px]">
              <div>ভার্সন: v0.4.2 (All-in-One Offline Edition)</div>
              <div>তাহকীক এন্ট্রি: {verifiedTotal}/{items.length} যাচাইকৃত</div>
              <div>SQLite SHA-256: {nativeDbHash || 'Browser Preview'}</div>
              <div>গোপনীয়তা: ১০০% অফলাইন · জিরো অ্যাডস</div>
            </div>
            <div className="space-y-2">
              <p className="font-semibold">টেস্টার ফিডব্যাক / তাহকীক সংশোধন রিপোর্ট</p>
              <select value={fbCat} onChange={(e) => setFbCat(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-[#D2DDD8]">
                <option>হাদীস/তাহকীক সংশোধন</option>
                <option>বাগ বা কারিগরি সমস্যা</option>
                <option>নতুন ফিচারের পরামর্শ</option>
              </select>
              <textarea
                rows={3}
                value={fbText}
                onChange={(e) => setFbText(e.target.value)}
                placeholder="বিস্তারিত লিখুন (যেমন: কোন দোয়ার সূত্র, বানান বা ফিচারের মতামত)..."
                className="w-full px-3 py-2 rounded-lg border border-[#D2DDD8]"
              />
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    const report = `Taskeen Feedback Report\nVersion: v0.4.2\nDB Hash: ${nativeDbHash || 'N/A'}\nCategory: ${fbCat}\nDate: ${new Date().toISOString()}\nDetails:\n${fbText}`;
                    navigator.clipboard?.writeText(report);
                    notify('ফিডব্যাক রিপোর্ট কপি হয়েছে!');
                  }}
                  className="flex-1 py-2 rounded-xl bg-[#0E5A45] text-white font-semibold"
                >
                  রিপোর্ট কপি করুন
                </button>
                <button
                  onClick={() => {
                    const report = `Taskeen Feedback Report\nVersion: v0.4.2\nDB Hash: ${nativeDbHash || 'N/A'}\nCategory: ${fbCat}\nDate: ${new Date().toISOString()}\nDetails:\n${fbText}`;
                    const blob = new Blob([report], { type: 'text/plain;charset=utf-8' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `taskeen-feedback-${Date.now()}.txt`;
                    a.click();
                    URL.revokeObjectURL(url);
                    setFbText('');
                    notify('ফিডব্যাক ফাইল ডাউনলোড হয়েছে');
                  }}
                  className="flex-1 py-2 rounded-xl border border-[#0E5A45] text-[#0A4736] font-semibold"
                >
                  .txt ডাউনলোড
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {toast && <div className="fixed bottom-5 right-5 z-50 px-4 py-2 rounded-xl bg-[#0E5A45] text-white text-xs shadow-lg">{toast}</div>}
    </div>
  );
}
