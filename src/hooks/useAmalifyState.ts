import { useState } from 'react';
import { PrayerDay, PrayerName, PrayerStatus } from '../components/DashboardView';
import { MuhasabahEntry, NiyyahGoal } from '../components/MuhasabahNiyyahView';
import { SadaqahEntry, WasiyyahData } from '../components/ToolsView';
import { TodoItem } from '../components/TodoQiblaReportsView';
import { QuranState } from '../components/QuranView';
import { getLocalDateKey } from '../lib/date';

/** Prayer log, muhasabah, niyyah, sadaqah, zakat, wasiyyah, to-dos, quran progress, fasting. */
export function useAmalifyState() {
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
  const cyclePrayer = (prayer: PrayerName) => {
    const todayKey = getLocalDateKey();
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
  return {
    quranState, setQuranState, todos, setTodos, fastingDays, setFastingDays, prayers, setPrayers,
    muhasabahEntries, setMuhasabahEntries, niyyahGoals, setNiyyahGoals, sadaqahList, setSadaqahList,
    zakatWealth, setZakatWealth, wasiyyah, setWasiyyah, cyclePrayer,
  };
}

export type AmalifyState = ReturnType<typeof useAmalifyState>;
