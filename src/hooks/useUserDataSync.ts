import { useEffect, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { ReminderSettings, TaskeenItem } from '../types';
import { PrayerDay } from '../components/DashboardView';
import { MuhasabahEntry, NiyyahGoal } from '../components/MuhasabahNiyyahView';
import { SadaqahEntry, WasiyyahData } from '../components/ToolsView';
import { TodoItem } from '../components/TodoQiblaReportsView';
import { QuranState } from '../components/QuranView';
import { DEFAULT_ITEMS } from '../lib/constants';

type SetState<T> = React.Dispatch<React.SetStateAction<T>>;

export interface UserDataBindings {
  items: TaskeenItem[]; setItems: SetState<TaskeenItem[]>;
  setSelectedId: SetState<string>;
  setNativeDbHash: SetState<string>;
  setNativeDbVerified: SetState<boolean | null>;
  counts: Record<string, number>; setCounts: SetState<Record<string, number>>;
  favorites: string[]; setFavorites: SetState<string[]>;
  dailyDone: Record<string, boolean>; setDailyDone: SetState<Record<string, boolean>>;
  tadabburNotes: Record<string, string>; setTadabburNotes: SetState<Record<string, string>>;
  reminders: ReminderSettings; setReminders: SetState<ReminderSettings>;
  prayers: Record<string, PrayerDay>; setPrayers: SetState<Record<string, PrayerDay>>;
  muhasabahEntries: MuhasabahEntry[]; setMuhasabahEntries: SetState<MuhasabahEntry[]>;
  niyyahGoals: NiyyahGoal[]; setNiyyahGoals: SetState<NiyyahGoal[]>;
  sadaqahList: SadaqahEntry[]; setSadaqahList: SetState<SadaqahEntry[]>;
  zakatWealth: number; setZakatWealth: SetState<number>;
  wasiyyah: WasiyyahData; setWasiyyah: SetState<WasiyyahData>;
  todos: TodoItem[]; setTodos: SetState<TodoItem[]>;
  quranState: QuranState; setQuranState: SetState<QuranState>;
  fastingDays: Record<string, boolean>; setFastingDays: SetState<Record<string, boolean>>;
  selectedItem: TaskeenItem | undefined;
}

/** Hydrates user state from SQLite on start and writes every change back (localStorage shim + SQLite kv/logs). */
export function useUserDataSync(d: UserDataBindings) {
  const {
    items, setItems, setSelectedId, setNativeDbHash, setNativeDbVerified,
    counts, setCounts, favorites, setFavorites, dailyDone, setDailyDone,
    tadabburNotes, setTadabburNotes, reminders, setReminders,
    prayers, setPrayers, muhasabahEntries, setMuhasabahEntries, niyyahGoals, setNiyyahGoals,
    sadaqahList, setSadaqahList, zakatWealth, setZakatWealth, wasiyyah, setWasiyyah,
    todos, setTodos, quranState, setQuranState, fastingDays, setFastingDays, selectedItem,
  } = d;

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

  const logsHydratedRef = useRef<boolean>(false);

  useEffect(() => {
    (async () => {
      try {
        let localCustom: TaskeenItem[] = [];
        try {
          const saved = JSON.parse(localStorage.getItem('taskeen_local_v1') || '{}');
          if (Array.isArray(saved.customItems)) localCustom = saved.customItems;
        } catch {}

        const dbItems = await invoke<TaskeenItem[]>('fetch_items');
        if (Array.isArray(dbItems) && dbItems.length > 0) {
          setItems([...localCustom, ...dbItems]);
          setSelectedId((prev) => prev || dbItems[0].id);
        }
        const status = await invoke<{ db_sha256: string; db_verified?: boolean }>('get_app_status');
        if (status?.db_sha256) setNativeDbHash(status.db_sha256.slice(0, 12));
        if (typeof status?.db_verified === 'boolean') setNativeDbVerified(status.db_verified);

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
        logsHydratedRef.current = true;

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
              } else if (row.key === 'custom_items' && Array.isArray(parsed)) {
                setItems((prev) => {
                  const existingIds = new Set(prev.map((x) => x.id));
                  const extra = (parsed as TaskeenItem[]).filter((x) => !existingIds.has(x.id));
                  return extra.length > 0 ? [...extra, ...prev] : prev;
                });
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
        logsHydratedRef.current = true;
        kvHydratedRef.current = true;
        // Browser preview fallback: uses bundled JSON + localStorage
      }
    })();
  }, []);

  useEffect(() => {
    try {
      const customItems = items.filter((i) => !DEFAULT_ITEMS.some((d) => d.id === i.id));
      localStorage.setItem(
        'taskeen_local_v1',
        JSON.stringify({ customItems, favorites, counts, dailyDone, tadabburNotes })
      );
      if (kvHydratedRef.current) {
        invoke('upsert_user_kv', { key: 'custom_items', value: JSON.stringify(customItems) }).catch(() => {});
      }
    } catch {}
  }, [items, favorites, counts, dailyDone, tadabburNotes]);

  const reloadAllUserDataFromSqlite = async (): Promise<void> => {
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
    if (!selectedItem || !logsHydratedRef.current) return;
    const timer = window.setTimeout(() => {
      invoke('upsert_user_log', {
        itemId: selectedItem.id,
        tasbihCount: counts[selectedItem.id] || 0,
        isFavorite: favorites.includes(selectedItem.id),
        tadabburNote: tadabburNotes[selectedItem.id] || '',
      }).catch(() => {});
    }, 500);
    return () => window.clearTimeout(timer);
  }, [selectedItem, counts, favorites, tadabburNotes]);

  return { reloadAllUserData: reloadAllUserDataFromSqlite };
}
