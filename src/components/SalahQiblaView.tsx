import React, { useMemo, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { CalendarDays, CheckCircle2, ChevronLeft, ChevronRight, Clock, Compass, History, MapPin, Minus, Plus } from 'lucide-react';
import { PrayerDay, PrayerName, PrayerStatus, PrayerTimes } from './DashboardView';
import { getLocalDateKey } from '../lib/date';
import {
  AsrMadhab,
  CalculationMethod,
  CITY_PRESETS,
  computeOfflinePrayerTimes,
} from '../lib/prayerTimes';

interface SalahQiblaViewProps {
  darkMode: boolean;
  prayers: Record<string, PrayerDay>;
  onCyclePrayer: (prayer: PrayerName) => void;
  onNotify: (msg: string) => void;
}

const PRAYER_LABELS: { key: PrayerName; bn: string; apiKey: keyof PrayerTimes }[] = [
  { key: 'fajr', bn: 'ফজর', apiKey: 'Fajr' },
  { key: 'dhuhr', bn: 'যোহর', apiKey: 'Dhuhr' },
  { key: 'asr', bn: 'আসর', apiKey: 'Asr' },
  { key: 'maghrib', bn: 'মাগরিব', apiKey: 'Maghrib' },
  { key: 'isha', bn: 'ইশা', apiKey: 'Isha' },
];

const STATUS_STYLE: Record<PrayerStatus, { label: string; cls: string }> = {
  pending: { label: 'বাকি', cls: 'border-[#D2DDD8] opacity-80' },
  done: { label: 'আদায় ✓', cls: 'bg-[#0E5A45] text-white border-[#0E5A45]' },
  qaza: { label: 'কাযা', cls: 'bg-[#FDF3E7] text-[#7A4404] border-[#E0B074]' },
  missed: { label: 'মিস', cls: 'bg-[#FDECEC] text-[#8F1D1D] border-[#E5A3A3]' },
};

const KAABA_LAT = 21.422487;
const KAABA_LNG = 39.826206;

function calculateQibla(latitude: number, longitude: number): number {
  const kaabaLat = KAABA_LAT * (Math.PI / 180);
  const kaabaLng = KAABA_LNG * (Math.PI / 180);
  const userLat = latitude * (Math.PI / 180);
  const userLng = longitude * (Math.PI / 180);
  const y = Math.sin(kaabaLng - userLng);
  const x = Math.cos(userLat) * Math.tan(kaabaLat) - Math.sin(userLat) * Math.cos(kaabaLng - userLng);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

function calculateDistanceKm(lat1: number, lon1: number): number {
  const R = 6371;
  const dLat = ((KAABA_LAT - lat1) * Math.PI) / 180;
  const dLon = ((KAABA_LNG - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((KAABA_LAT * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

export default function SalahQiblaView({
  darkMode,
  prayers,
  onCyclePrayer,
  onNotify,
}: SalahQiblaViewProps) {
  const todayKey = getLocalDateKey();
  const todayPrayers: PrayerDay = prayers[todayKey] || {
    fajr: 'pending',
    dhuhr: 'pending',
    asr: 'pending',
    maghrib: 'pending',
    isha: 'pending',
  };

  const [prefs, setPrefs] = useState<{
    name: string;
    lat: number;
    lng: number;
    tz: number;
    method: CalculationMethod;
    madhab: AsrMadhab;
  }>(() => {
    try {
      const saved = localStorage.getItem('taskeen_prayer_prefs_v1');
      if (saved) return JSON.parse(saved);
    } catch {}
    return {
      name: 'ঢাকা',
      lat: 23.8103,
      lng: 90.4125,
      tz: 6,
      method: 'Karachi',
      madhab: 'Hanafi',
    };
  });

  const updatePrefs = (next: typeof prefs) => {
    setPrefs(next);
    try {
      localStorage.setItem('taskeen_prayer_prefs_v1', JSON.stringify(next));
    } catch {}
  };

  const prayerTimes = useMemo(
    () =>
      computeOfflinePrayerTimes(
        new Date(),
        prefs.lat,
        prefs.lng,
        prefs.tz,
        prefs.method,
        prefs.madhab
      ),
    [prefs]
  );

  const qiblaAngle = useMemo(() => calculateQibla(prefs.lat, prefs.lng), [prefs.lat, prefs.lng]);
  const distanceKm = useMemo(() => calculateDistanceKm(prefs.lat, prefs.lng), [prefs.lat, prefs.lng]);

  const heatmapWeeks = useMemo(() => {
    const days: { date: string; count: number }[] = [];
    const today = new Date();
    for (let i = 111; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const key = getLocalDateKey(d);
      const day = prayers[key];
      const count = day ? PRAYER_LABELS.filter((p) => day[p.key] === 'done').length : 0;
      days.push({ date: key, count });
    }
    const weeks: { date: string; count: number }[][] = [];
    for (let i = 0; i < days.length; i += 7) weeks.push(days.slice(i, i + 7));
    return weeks;
  }, [prayers]);

  const [subTab, setSubTab] = useState<'today' | 'qaza' | 'calendar'>('today');

  // Qaza Manager State
  type QazaKey = 'fajr' | 'dhuhr' | 'asr' | 'maghrib' | 'isha' | 'witr';
  const [qazaCounts, setQazaCounts] = useState<Record<QazaKey, number>>(() => {
    try {
      const saved = localStorage.getItem('taskeen_qaza_v1');
      if (saved) return JSON.parse(saved);
    } catch {}
    return { fajr: 0, dhuhr: 0, asr: 0, maghrib: 0, isha: 0, witr: 0 };
  });
  const [qazaDailyGoal, setQazaDailyGoal] = useState<number>(() => {
    try { return Number(localStorage.getItem('taskeen_qaza_goal_v1') || '2') || 2; } catch { return 2; }
  });

  const updateQaza = (next: Record<QazaKey, number>) => {
    setQazaCounts(next);
    try {
      localStorage.setItem('taskeen_qaza_v1', JSON.stringify(next));
      invoke('upsert_user_kv', { key: 'taskeen_qaza_v1', value: JSON.stringify(next) }).catch(() => {});
    } catch {}
  };

  // Monthly Hijri + Bangla + Gregorian Calendar State
  const [calCursor, setCalCursor] = useState<Date>(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

  const calendarCells = useMemo(() => {
    const year = calCursor.getFullYear();
    const month = calCursor.getMonth();
    const firstDow = new Date(year, month, 1).getDay(); // 0=Sun
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const todayStr = getLocalDateKey();

    const cells: ({
      date: Date;
      dayNum: number;
      isToday: boolean;
      hijriDay: number;
      hijriMonth: number;
      hijriLabel: string;
      bnDate: string;
      tags: { label: string; tone: 'gold' | 'green' | 'blue' }[];
    } | null)[] = [];

    for (let i = 0; i < firstDow; i++) cells.push(null);

    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(year, month, d);
      const iso = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      let hijriDay = 0;
      let hijriMonth = 0;
      let hijriLabel = '';
      try {
        const parts = new Intl.DateTimeFormat('en-u-ca-islamic-uma', { day: 'numeric', month: 'numeric' }).formatToParts(date);
        hijriDay = parseInt(parts.find((p) => p.type === 'day')?.value || '0', 10);
        hijriMonth = parseInt(parts.find((p) => p.type === 'month')?.value || '0', 10);
        hijriLabel = new Intl.DateTimeFormat('bn-BD-u-ca-islamic-uma', { day: 'numeric', month: 'short' }).format(date);
      } catch {}

      let bnDate = '';
      try {
        bnDate = new Intl.DateTimeFormat('bn-BD', { day: 'numeric' }).format(date);
      } catch {
        bnDate = String(d);
      }

      const tags: { label: string; tone: 'gold' | 'green' | 'blue' }[] = [];
      const dow = date.getDay();
      if (hijriMonth === 9) tags.push({ label: 'রমজান', tone: 'gold' });
      if (hijriMonth === 1 && hijriDay === 10) tags.push({ label: 'আশুরা', tone: 'gold' });
      if (hijriMonth === 8 && hijriDay === 15) tags.push({ label: 'শবে বরাত', tone: 'blue' });
      if (hijriMonth === 10 && hijriDay === 1) tags.push({ label: 'ঈদুল ফিতর', tone: 'gold' });
      if (hijriMonth === 12 && hijriDay === 9) tags.push({ label: 'আরাফা', tone: 'gold' });
      if (hijriMonth === 12 && hijriDay === 10) tags.push({ label: 'ঈদুল আযহা', tone: 'gold' });
      if (hijriDay === 13 || hijriDay === 14 || hijriDay === 15) tags.push({ label: 'আইয়ামে বীজ', tone: 'blue' });
      if (dow === 1 || dow === 4) tags.push({ label: dow === 1 ? 'সোম রোজা' : 'বৃহঃ রোজা', tone: 'green' });

      cells.push({
        date,
        dayNum: d,
        isToday: iso === todayStr,
        hijriDay,
        hijriMonth,
        hijriLabel,
        bnDate,
        tags,
      });
    }
    return cells;
  }, [calCursor]);

  const totalQaza = Object.values(qazaCounts).reduce((a, b) => a + b, 0);
  const estDays = qazaDailyGoal > 0 ? Math.ceil(totalQaza / qazaDailyGoal) : 0;

  const cardCls = darkMode ? 'ts-card border' : 'ts-card border';

  return (
    <div className="p-6 max-w-6xl mx-auto w-full space-y-6">
      {/* Sub-navigation Tabs */}
      <div className="ts-bento-card p-2 flex flex-wrap gap-2">
        {[
          { id: 'today', label: 'আজকের নামাজ ও কিবলা', icon: <Compass className="w-4 h-4" /> },
          { id: 'qaza', label: `কাযা নামাজ ম্যানেজার (${totalQaza})`, icon: <History className="w-4 h-4" /> },
          { id: 'calendar', label: 'মাসিক হিজরি ও রোজা ক্যালেন্ডার', icon: <CalendarDays className="w-4 h-4" /> },
        ].map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setSubTab(t.id as typeof subTab)}
            className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition ${
              subTab === t.id ? 'bg-[#0E5A45] text-white' : 'hover:bg-[#0E5A45]/10'
            }`}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {subTab === 'qaza' && (
        <div className="space-y-5">
          <div className="ts-bento-card ts-card-accent-left p-5 flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="font-serif-bn font-bold text-xl">কাযা (Qaza) নামাজ ম্যানেজার</h2>
              <p className="text-xs ts-muted-text mt-1">
                জমে থাকা কাযা নামাজের হিসাব রাখুন; প্রতিদিন ১-২ ওয়াক্ত আদায় করে “আদায় ✓” চাপলে স্বয়ংক্রিয়ভাবে কমে যাবে।
              </p>
            </div>
            <div className="flex items-center gap-3">
              <div className="ts-stat-pill text-center">
                <div className="text-[11px] ts-muted-text">মোট বাকি কাযা</div>
                <div className="font-mono-code font-bold text-xl ts-accent-text">{totalQaza} ওয়াক্ত</div>
              </div>
              <div className="ts-stat-pill text-center">
                <div className="text-[11px] ts-muted-text">দৈনিক লক্ষ্য ({qazaDailyGoal} ওয়াক্ত)</div>
                <div className="font-mono-code font-bold text-xl">{estDays} দিন</div>
              </div>
            </div>
          </div>

          <div className="ts-bento-card p-4 flex flex-wrap items-center justify-between gap-3 text-xs">
            <span className="font-semibold">প্রতিদিন অতিরিক্ত কত ওয়াক্ত কাযা আদায় করতে চান?</span>
            <div className="flex items-center gap-2">
              {[1, 2, 3, 5].map((g) => (
                <button
                  key={g}
                  type="button"
                  onClick={() => {
                    setQazaDailyGoal(g);
                    localStorage.setItem('taskeen_qaza_goal_v1', String(g));
                  }}
                  className={`px-3 py-1.5 rounded-xl font-semibold ${
                    qazaDailyGoal === g ? 'bg-[#0E5A45] text-white' : 'ts-subsurface'
                  }`}
                >
                  দৈনিক {g} ওয়াক্ত
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {(
              [
                ['fajr', 'ফজর'],
                ['dhuhr', 'যোহর'],
                ['asr', 'আসর'],
                ['maghrib', 'মাগরিব'],
                ['isha', 'ইশা'],
                ['witr', 'বিতর'],
              ] as [QazaKey, string][]
            ).map(([k, label]) => (
              <div key={k} className="ts-bento-card p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-serif-bn font-bold text-lg">{label}</h3>
                  <span className="font-mono-code text-2xl font-bold ts-accent-text">{qazaCounts[k]}</span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={qazaCounts[k] <= 0}
                    onClick={() => {
                      const next = { ...qazaCounts, [k]: Math.max(0, qazaCounts[k] - 1) };
                      updateQaza(next);
                      onNotify(`মাশাআল্লাহ! ১ ওয়াক্ত ${label} কাযা আদায় হয়েছে।`);
                    }}
                    className="flex-1 py-2 rounded-xl bg-[#0E5A45] text-white text-xs font-semibold flex items-center justify-center gap-1 disabled:opacity-40"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" /> ১ ওয়াক্ত আদায় ✓
                  </button>
                  <button
                    type="button"
                    onClick={() => updateQaza({ ...qazaCounts, [k]: qazaCounts[k] + 1 })}
                    className="p-2 rounded-xl border border-[#D2DDD8] hover:bg-[#0E5A45]/10"
                    title="১ যোগ করুন"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => updateQaza({ ...qazaCounts, [k]: Math.max(0, qazaCounts[k] - 1) })}
                    className="p-2 rounded-xl border border-[#D2DDD8] hover:bg-[#0E5A45]/10"
                    title="১ কমান"
                  >
                    <Minus className="w-4 h-4" />
                  </button>
                </div>

                <div className="flex items-center justify-between text-xs pt-2 border-t border-[#D2DDD8]/50">
                  <span className="ts-muted-text">সরাসরি সংখ্যা সেট করুন:</span>
                  <input
                    type="number"
                    min={0}
                    value={qazaCounts[k]}
                    onChange={(e) => updateQaza({ ...qazaCounts, [k]: Math.max(0, Number(e.target.value) || 0) })}
                    className="w-20 px-2 py-1 rounded-lg border border-[#D2DDD8] bg-transparent font-mono-code text-right"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {subTab === 'calendar' && (
        <div className="ts-bento-card p-5 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-serif-bn font-bold text-xl">মাসিক হিজরি ও বাংলা-ইংরেজি ক্যালেন্ডার (অফলাইন)</h2>
              <p className="text-xs ts-muted-text">
                আইয়ামে বীজ (১৩-১৫ হিজরি), সোমবার-বৃহস্পতিবার সুন্নাহ রোজা, রমজান, আশুরা ও ঈদ হাইলাইট করা আছে
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setCalCursor(new Date(calCursor.getFullYear(), calCursor.getMonth() - 1, 1))}
                className="p-2 rounded-xl border border-[#D2DDD8] hover:bg-[#0E5A45]/10"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="px-3 py-1.5 rounded-xl ts-subsurface text-xs font-bold min-w-[160px] text-center">
                {calCursor.toLocaleDateString('bn-BD', { month: 'long', year: 'numeric' })}
              </span>
              <button
                type="button"
                onClick={() => setCalCursor(new Date(calCursor.getFullYear(), calCursor.getMonth() + 1, 1))}
                className="p-2 rounded-xl border border-[#D2DDD8] hover:bg-[#0E5A45]/10"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-7 gap-2 text-center text-xs font-bold ts-muted-text">
            {['রবি', 'সোম', 'মঙ্গল', 'বুধ', 'বৃহঃ', 'শুক্র', 'শনি'].map((d) => (
              <div key={d} className="py-1">{d}</div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-2">
            {calendarCells.map((cell, idx) =>
              cell ? (
                <div
                  key={idx}
                  className={`min-h-[86px] p-2 rounded-xl border flex flex-col justify-between transition ${
                    cell.isToday
                      ? 'border-[#0E5A45] ring-2 ring-[#0E5A45]/30 ts-accent-soft'
                      : 'border-[#D2DDD8]/70 ts-subsurface'
                  }`}
                >
                  <div className="flex items-start justify-between gap-1">
                    <span className="font-mono-code font-bold text-sm">{cell.dayNum}</span>
                    <span className="text-[10px] ts-muted-text font-medium">{cell.bnDate}</span>
                  </div>
                  <div className="text-[10px] font-semibold ts-accent-text truncate">{cell.hijriLabel}</div>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {cell.tags.slice(0, 2).map((tg) => (
                      <span
                        key={tg.label}
                        className={`text-[9px] px-1.5 py-0.5 rounded font-semibold ${
                          tg.tone === 'gold'
                            ? 'bg-amber-500/20 text-amber-700 dark:text-amber-300'
                            : tg.tone === 'blue'
                            ? 'bg-sky-500/20 text-sky-700 dark:text-sky-300'
                            : 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300'
                        }`}
                      >
                        {tg.label}
                      </span>
                    ))}
                  </div>
                </div>
              ) : (
                <div key={idx} />
              )
            )}
          </div>
        </div>
      )}

      {subTab === 'today' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      {/* Left: Salah Tracker + Heatmap */}
      <div className="lg:col-span-8 space-y-6">
        <div className={`p-6 rounded-2xl border ${cardCls}`}>
          <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
            <div>
              <h2 className="font-serif-bn font-bold text-xl">৫ ওয়াক্ত নামাজ ট্র্যাকার ও সময়সূচি</h2>
              <p className="text-xs opacity-70">প্রতিটি ওয়াক্তে ক্লিক করে আদায়, কাযা বা মিস লগ করুন</p>
            </div>
            <span className="text-xs opacity-75 flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" /> ১০০% অফলাইন ইঞ্জিন ✓ ({prefs.name})
            </span>
          </div>

          <div className="flex flex-wrap gap-2 mb-4 text-xs">
            <select
              value={prefs.method}
              onChange={(e) => updatePrefs({ ...prefs, method: e.target.value as CalculationMethod })}
              className="px-2.5 py-1.5 rounded-lg border border-[#D2DDD8] bg-transparent"
            >
              <option value="Karachi">পদ্ধতি: করাচি (বাংলাদেশ)</option>
              <option value="MWL">পদ্ধতি: MWL</option>
              <option value="Makkah">পদ্ধতি: উম্মুল কুরা (মক্কা)</option>
              <option value="ISNA">পদ্ধতি: ISNA</option>
              <option value="Egypt">পদ্ধতি: মিশর</option>
            </select>
            <select
              value={prefs.madhab}
              onChange={(e) => updatePrefs({ ...prefs, madhab: e.target.value as AsrMadhab })}
              className="px-2.5 py-1.5 rounded-lg border border-[#D2DDD8] bg-transparent"
            >
              <option value="Hanafi">আসর: হানাফী</option>
              <option value="Shafi">আসর: শাফেয়ী / জমহুর</option>
            </select>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {PRAYER_LABELS.map((p) => {
              const st = todayPrayers[p.key];
              const style = STATUS_STYLE[st];
              return (
                <button
                  key={p.key}
                  onClick={() => onCyclePrayer(p.key)}
                  className={`p-4 rounded-xl border text-left transition-all ${style.cls}`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-serif-bn font-bold text-base">{p.bn}</span>
                    <span className="text-xs font-semibold">{style.label}</span>
                  </div>
                  <div className="text-xs font-mono-code opacity-80 mt-2">
                    {prayerTimes[p.apiKey]}
                  </div>
                </button>
              );
            })}
          </div>

          <div className="mt-4 pt-3 border-t border-[#DCE3E0] grid grid-cols-3 gap-3 text-xs text-center">
            <div className="p-2.5 rounded-xl bg-[#0E5A45]/10">
              <span className="opacity-70 block">সেহরি শেষ</span>
              <strong className="font-mono-code text-sm">{prayerTimes.SehriEnd}</strong>
            </div>
            <div className="p-2.5 rounded-xl bg-[#0E5A45]/10">
              <span className="opacity-70 block">সূর্যোদয়</span>
              <strong className="font-mono-code text-sm">{prayerTimes.Sunrise}</strong>
            </div>
            <div className="p-2.5 rounded-xl bg-[#FDF3E7] text-[#7A4404]">
              <span className="opacity-75 block">ইফতার</span>
              <strong className="font-mono-code text-sm">{prayerTimes.Iftar}</strong>
            </div>
          </div>
        </div>

        <div className={`p-6 rounded-2xl border ${cardCls}`}>
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-serif-bn font-bold text-base">১৬ সপ্তাহের নামাজ ধারাবাহিকতা হিটম্যাপ</h3>
            <span className="text-xs opacity-65">প্রতি ঘর = ১ দিন</span>
          </div>
          <div className="flex gap-1.5 overflow-x-auto py-2">
            {heatmapWeeks.map((week, wi) => (
              <div key={wi} className="flex flex-col gap-1.5">
                {week.map((day) => {
                  const bg =
                    day.count === 5
                      ? 'bg-[#0E5A45]'
                      : day.count >= 3
                      ? 'bg-[#3A9679]'
                      : day.count >= 1
                      ? 'bg-[#A7D0C2]'
                      : darkMode
                      ? 'bg-[#1D2D27]'
                      : 'bg-[#E9EFEC]';
                  return <div key={day.date} title={`${day.date}: ${day.count}/5 ওয়াক্ত`} className={`w-4 h-4 rounded-sm ${bg}`} />;
                })}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right: Qibla Compass */}
      <div className={`lg:col-span-4 p-6 rounded-2xl border flex flex-col items-center justify-between gap-4 ${cardCls}`}>
        <div className="w-full flex items-center justify-between">
          <h2 className="font-serif-bn font-bold text-lg flex items-center gap-2">
            <Compass className="w-5 h-5 text-[#0E5A45]" /> কিবলা কম্পাস
          </h2>
        </div>

        <div className="relative w-52 h-52 flex items-center justify-center">
          <svg viewBox="0 0 200 200" className="w-full h-full">
            <circle cx="100" cy="100" r="92" fill="none" stroke="currentColor" strokeOpacity="0.18" strokeWidth="2" />
            <circle cx="100" cy="100" r="72" fill="none" stroke="currentColor" strokeOpacity="0.1" strokeDasharray="4 4" />
            <text x="100" y="22" textAnchor="middle" fill="currentColor" fontSize="12" fontWeight="bold">N</text>
            <text x="182" y="104" textAnchor="middle" fill="currentColor" fontSize="12" opacity="0.6">E</text>
            <text x="100" y="188" textAnchor="middle" fill="currentColor" fontSize="12" opacity="0.6">S</text>
            <text x="18" y="104" textAnchor="middle" fill="currentColor" fontSize="12" opacity="0.6">W</text>
            <g transform={`rotate(${qiblaAngle} 100 100)`}>
              <polygon points="100,26 108,100 100,114 92,100" fill="#0E5A45" />
              <circle cx="100" cy="100" r="7" fill="#B4690E" />
            </g>
          </svg>
        </div>

        <div className="text-center space-y-1">
          <div className="font-mono-code text-2xl font-bold text-[#0E5A45]">{qiblaAngle.toFixed(1)}°</div>
          <p className="text-xs opacity-75">
            {prefs.name} থেকে কাবা শরীফ ({distanceKm.toLocaleString('en-US')} কি.মি.)
          </p>
        </div>

        <div className="w-full space-y-2 text-xs">
          <select
            value={prefs.name}
            onChange={(e) => {
              const city = CITY_PRESETS.find((c) => c.name === e.target.value);
              if (city) updatePrefs({ ...prefs, name: city.name, lat: city.lat, lng: city.lng, tz: city.tz });
            }}
            className="w-full px-3 py-2 rounded-xl border border-[#D2DDD8] bg-transparent"
          >
            {CITY_PRESETS.map((c) => (
              <option key={c.name} value={c.name}>শহর: {c.name}</option>
            ))}
          </select>
          <button
            onClick={() => {
              if (!navigator.geolocation) {
                onNotify('লোকেশন সার্ভিস পাওয়া যায়নি');
                return;
              }
              navigator.geolocation.getCurrentPosition(
                (pos) => {
                  const tz = -new Date().getTimezoneOffset() / 60;
                  updatePrefs({ ...prefs, name: 'বর্তমান অবস্থান', lat: pos.coords.latitude, lng: pos.coords.longitude, tz });
                  onNotify('আপনার লোকেশন অনুযায়ী নামাজ ও কিবলা আপডেট হয়েছে');
                },
                () => onNotify('লোকেশন অনুমতি পাওয়া যায়নি')
              );
            }}
            className="w-full py-2.5 rounded-xl border border-[#0E5A45] text-[#0A4736] font-semibold flex items-center justify-center gap-1.5"
          >
            <MapPin className="w-4 h-4" /> আমার লোকেশন নিন
          </button>
        </div>
      </div>
    </div>
      )}
    </div>
  );
}
