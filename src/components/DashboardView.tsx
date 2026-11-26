import React, { useMemo } from 'react';
import { Calendar, Compass, Flame, Sparkles, Timer } from 'lucide-react';
import { TaskeenItem } from '../types';
import { TodoItem } from './TodoQiblaReportsView';
import { SadaqahEntry } from './ToolsView';
import { AsrMadhab, CalculationMethod, computeOfflinePrayerTimes, OfflinePrayerTimes } from '../lib/prayerTimes';
import { getLocalDateKey } from '../lib/date';
import { DashboardWidgetsPrefs, DEFAULT_DASHBOARD_WIDGETS } from './SettingsView';

export type PrayerStatus = 'pending' | 'done' | 'qaza' | 'missed';
export type PrayerName = 'fajr' | 'dhuhr' | 'asr' | 'maghrib' | 'isha';

export interface PrayerDay {
  fajr: PrayerStatus;
  dhuhr: PrayerStatus;
  asr: PrayerStatus;
  maghrib: PrayerStatus;
  isha: PrayerStatus;
}

export type PrayerTimes = OfflinePrayerTimes;

interface DashboardViewProps {
  darkMode: boolean;
  selectedItem: TaskeenItem | undefined;
  currentCount: number;
  target: number;
  onIncrementTasbih: () => void;
  prayers: Record<string, PrayerDay>;
  onCyclePrayer: (prayer: PrayerName) => void;
  dailyAmalList: { id: string; label: string }[];
  dailyDone: Record<string, boolean>;
  onToggleDaily: (id: string, checked: boolean) => void;
  todos: TodoItem[];
  onToggleTodo: (id: string) => void;
  sadaqahList: SadaqahEntry[];
  fastingDays: Record<string, boolean>;
  onToggleFasting: () => void;
  onNavigate: (view: 'library' | 'quran' | 'salah' | 'amal' | 'life' | 'reports' | 'settings') => void;
  widgets?: DashboardWidgetsPrefs;
}

const PRAYER_LABELS: { key: PrayerName; bn: string; apiKey: keyof PrayerTimes; fallback: string }[] = [
  { key: 'fajr', bn: 'ফজর', apiKey: 'Fajr', fallback: '05:05' },
  { key: 'dhuhr', bn: 'যোহর', apiKey: 'Dhuhr', fallback: '12:00' },
  { key: 'asr', bn: 'আসর', apiKey: 'Asr', fallback: '15:45' },
  { key: 'maghrib', bn: 'মাগরিব', apiKey: 'Maghrib', fallback: '17:20' },
  { key: 'isha', bn: 'ইশা', apiKey: 'Isha', fallback: '18:45' },
];

export function getHijriLabel(date = new Date()): string {
  try {
    return new Intl.DateTimeFormat('bn-BD-u-ca-islamic-uma', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(date);
  } catch {
    return new Intl.DateTimeFormat('en-u-ca-islamic-uma', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(date);
  }
}

function getNextPrayerInfo(prayerTimes: PrayerTimes | null) {
  const now = new Date();
  const nowMins = now.getHours() * 60 + now.getMinutes();

  for (const p of PRAYER_LABELS) {
    const raw = prayerTimes ? prayerTimes[p.apiKey] : p.fallback;
    const match = String(raw).match(/(\d{1,2}):(\d{2})/);
    if (!match) continue;
    const h = parseInt(match[1], 10);
    const m = parseInt(match[2], 10);
    const pMins = h * 60 + m;
    if (pMins > nowMins) {
      const diff = pMins - nowMins;
      const dh = Math.floor(diff / 60);
      const dm = diff % 60;
      const timeStr = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
      return {
        name: p.bn,
        time: timeStr,
        remaining: dh > 0 ? `${dh} ঘণ্টা ${dm} মিনিট বাকি` : `${dm} মিনিট বাকি`,
      };
    }
  }
  return {
    name: 'ফজর (আগামীকাল)',
    time: prayerTimes ? prayerTimes.Fajr.slice(0, 5) : '05:05',
    remaining: 'রাতের ইবাদত ও তাহাজ্জুদের সময়',
  };
}

function getUpcomingIslamicEvents(daysAhead = 60) {
  const events: { id: string; name: string; hijri: string; daysLeft: number }[] = [];
  const today = new Date();
  for (let i = 0; i <= daysAhead; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    try {
      const parts = new Intl.DateTimeFormat('en-u-ca-islamic-uma', {
        day: 'numeric',
        month: 'numeric',
      }).formatToParts(d);
      const day = parseInt(parts.find((p) => p.type === 'day')?.value || '0', 10);
      const month = parseInt(parts.find((p) => p.type === 'month')?.value || '0', 10);

      const add = (name: string) =>
        events.push({ id: `${month}-${day}-${i}`, name, hijri: getHijriLabel(d), daysLeft: i });

      if (month === 1 && day === 10) add('আশুরা (১০ মুহাররম)');
      if (month === 8 && day === 15) add('শবে বরাত (১৫ শাবান)');
      if (month === 9 && day === 1) add('রমজানুল মুবারক শুরু');
      if (month === 9 && day === 27) add('লাইলাতুল কদর (সম্ভাব্য)');
      if (month === 10 && day === 1) add('ঈদুল ফিতর');
      if (month === 12 && day === 9) add('আরাফার দিন (৯ জিলহজ)');
      if (month === 12 && day === 10) add('ঈদুল আযহা');
    } catch {}
  }
  return events[0] || null;
}

export default function DashboardView({
  darkMode,
  selectedItem,
  currentCount,
  target,
  onIncrementTasbih,
  prayers,
  onCyclePrayer,
  dailyAmalList,
  dailyDone,
  onToggleDaily,
  todos,
  onToggleTodo,
  sadaqahList,
  fastingDays,
  onToggleFasting,
  onNavigate,
  widgets = DEFAULT_DASHBOARD_WIDGETS,
}: DashboardViewProps) {
  const todayKey = getLocalDateKey();
  const todayPrayers: PrayerDay = prayers[todayKey] || {
    fajr: 'pending',
    dhuhr: 'pending',
    asr: 'pending',
    maghrib: 'pending',
    isha: 'pending',
  };

  const prayerPrefs = useMemo(() => {
    try {
      const saved = localStorage.getItem('taskeen_prayer_prefs_v1');
      if (saved) return JSON.parse(saved) as { name: string; lat: number; lng: number; tz: number; method: CalculationMethod; madhab: AsrMadhab };
    } catch {}
    return { name: 'ঢাকা', lat: 23.8103, lng: 90.4125, tz: 6, method: 'Karachi' as CalculationMethod, madhab: 'Hanafi' as AsrMadhab };
  }, []);

  const prayerTimes = useMemo(
    () => computeOfflinePrayerTimes(new Date(), prayerPrefs.lat, prayerPrefs.lng, prayerPrefs.tz, prayerPrefs.method, prayerPrefs.madhab),
    [prayerPrefs]
  );

  const nextPrayer = useMemo(() => getNextPrayerInfo(prayerTimes), [prayerTimes]);
  const nextEvent = useMemo(() => getUpcomingIslamicEvents(60), []);

  const streakDays = useMemo(() => {
    let streak = 0;
    const d = new Date();
    for (let i = 0; i < 365; i++) {
      const check = new Date(d);
      check.setDate(d.getDate() - i);
      const key = getLocalDateKey(check);
      const day = prayers[key];
      const done = day
        ? PRAYER_LABELS.filter((p) => day[p.key] === 'done').length
        : 0;
      if (done >= 3) streak++;
      else if (i > 0) break;
    }
    return streak;
  }, [prayers]);

  const totalSadaqah = sadaqahList.reduce((sum, s) => sum + s.amount, 0);
  const isFastingToday = !!fastingDays[todayKey];
  const totalFasts = Object.values(fastingDays).filter(Boolean).length;

  const fastingLabel = useMemo(() => {
    const now = new Date();
    const dow = now.getDay(); // 1=Mon, 4=Thu
    try {
      const parts = new Intl.DateTimeFormat('en-u-ca-islamic-uma', { day: 'numeric', month: 'numeric' }).formatToParts(now);
      const hDay = parseInt(parts.find((p) => p.type === 'day')?.value || '0', 10);
      const hMonth = parseInt(parts.find((p) => p.type === 'month')?.value || '0', 10);
      if (hMonth === 9) return 'পবিত্র রমজান মাস';
      if (hMonth === 12 && hDay === 9) return 'ইয়াওমে আরাফা (সুন্নাহ রোজা)';
      if (hMonth === 1 && (hDay === 9 || hDay === 10)) return 'আশুরার সুন্নাহ রোজা';
      if (hDay === 13 || hDay === 14 || hDay === 15) return `আইয়ামে বীজ (${hDay} হিজরি)`;
    } catch {}
    if (dow === 1) return 'সোমবারের সুন্নাহ রোজা';
    if (dow === 4) return 'বৃহস্পতিবারের সুন্নাহ রোজা';
    return 'নফল / সুন্নাহ রোজা ট্র্যাকার';
  }, []);

  const tasbihPct = target > 0 ? Math.min(100, Math.round((currentCount / target) * 100)) : 0;
  const isFriday = new Date().getDay() === 5;
  const showRightCol = widgets.streakSadaqah || widgets.fastingAndEvent || widgets.quickShortcuts;
  const nothingVisible = !widgets.heroPrayer && !widgets.quickTasbih && !widgets.dailyAmalTodo && !showRightCol;

  return (
    <div className="p-6 max-w-6xl mx-auto w-full space-y-6 animate-view">
      {nothingVisible && (
        <div className="ts-bento-card p-10 text-center space-y-3">
          <div className="font-serif-bn font-bold text-lg">ড্যাশবোর্ডের সব কার্ড লুকানো আছে</div>
          <p className="text-xs ts-muted-text">সেটিংস থেকে আপনার পছন্দের কার্ডগুলো চালু করুন।</p>
          <button
            type="button"
            onClick={() => onNavigate('settings')}
            className="px-4 py-2 rounded-xl bg-[#0E5A45] text-white text-xs font-semibold"
          >
            সেটিংস খুলুন
          </button>
        </div>
      )}

      {/* Live Next Prayer Countdown Hero */}
      {widgets.heroPrayer && (
        <div className="rounded-2xl p-6 ts-hero pattern-hero text-white flex flex-wrap items-center justify-between gap-6 shadow-md relative overflow-hidden">
          <div className="space-y-1.5 relative z-10">
            <div className="text-xs opacity-90 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5" />
              <span>আসসালামু আলাইকুম · {getHijriLabel()}</span>
            </div>
            <h1 className="font-serif-bn text-2xl font-bold tracking-tight">
              পরবর্তী নামাজ: {nextPrayer.name} ({nextPrayer.time})
            </h1>
            <p className="text-sm opacity-90">
              <strong>{nextPrayer.remaining}</strong> · সেহরি শেষ: {prayerTimes.SehriEnd} · ইফতার: {prayerTimes.Iftar}
            </p>
          </div>

          {/* Interactive 5-Waqt Quick Pills */}
          <div className="flex flex-wrap gap-2 relative z-10">
            {PRAYER_LABELS.map((p) => {
              const st = todayPrayers[p.key];
              const isDone = st === 'done';
              return (
                <button
                  key={p.key}
                  onClick={() => onCyclePrayer(p.key)}
                  title="ক্লিক করে অবস্থা পরিবর্তন করুন"
                  className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition ${
                    isDone
                      ? 'ts-prayer-pill-done'
                      : st === 'qaza'
                      ? 'ts-prayer-pill-qaza'
                      : 'ts-prayer-pill-pending'
                  }`}
                >
                  {p.bn} {isDone ? '✓' : st === 'qaza' ? '(কাযা)' : ''}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Jumuah (Friday) Special Auto-Card */}
      {isFriday && (
        <div className="ts-bento-card ts-card-gold-left pattern-geo p-5 flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1.5 relative z-10">
            <div className="text-xs font-bold ts-accent-text flex items-center gap-1.5">
              <Sparkles className="w-4 h-4" /> জুমআ মোবারক · শুক্রবার স্পেশাল রিমাইন্ডার
            </div>
            <div className="font-serif-bn font-bold text-base">
              আজকের ৩টি বিশেষ সুন্নাহ: সূরা আল-কাহফ, দরূদ শরীফ ও আসর-মাগরিবের দোয়া
            </div>
            <p className="text-xs ts-muted-text">
              দোয়া কবুলের বিশেষ সময়: <strong>{prayerTimes.Asr} – {prayerTimes.Maghrib}</strong> · নবীজি ﷺ-এর ওপর বেশি বেশি দরূদ পাঠ করুন।
            </p>
          </div>
          <div className="flex flex-wrap gap-2 relative z-10">
            <button
              type="button"
              onClick={() => onNavigate('quran')}
              className="px-3.5 py-2 rounded-xl bg-[#0E5A45] text-white text-xs font-semibold hover:bg-[#0A4736] transition"
            >
              সূরা কাহফ পড়ুন →
            </button>
          </div>
        </div>
      )}

      {/* 3-Column Bento Grid */}
      {(widgets.quickTasbih || widgets.dailyAmalTodo || showRightCol) && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Quick Tasbih Card */}
          {widgets.quickTasbih && (
            <div className="lg:col-span-4 ts-bento-card ts-card-accent-left p-5 flex flex-col justify-between space-y-4">
              <div className="space-y-2 relative z-10">
                <div className="flex items-center justify-between">
                  <h2 className="font-serif-bn font-bold text-base flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 ts-accent-text" /> তাৎক্ষণিক তাসবীহ
                  </h2>
                  <span className="text-xs px-2.5 py-0.5 rounded-full ts-accent-soft ts-accent-text font-semibold">
                    লক্ষ্য: {target}
                  </span>
                </div>
                <div className="ts-progress">
                  <div className="ts-progress-fill" style={{ width: `${tasbihPct}%` }} />
                </div>
              </div>
              <div className="text-center py-2 relative z-10">
                <div className="font-arabic-amiri text-2xl font-bold leading-relaxed">
                  {selectedItem?.arabic_uthmani || 'سُبْحَانَ اللَّهِ وَبِحَمْدِهِ'}
                </div>
                <div className="text-xs ts-muted-text mt-1 truncate">
                  {selectedItem?.title_bn || 'সুবহানাল্লাহি ওয়া বিহামদিহি'}
                </div>
              </div>
              <button
                onClick={onIncrementTasbih}
                className="w-full py-5 ts-tasbih-btn relative z-10"
              >
                <div className="text-4xl font-bold font-mono-code relative z-10">{currentCount}</div>
                <div className="text-xs opacity-90 mt-1 relative z-10">ক্লিক করুন বা Space চাপুন</div>
              </button>
            </div>
          )}

          {/* Daily Checklist & Priority To-Do */}
          {widgets.dailyAmalTodo && (
            <div className="lg:col-span-4 ts-bento-card ts-card-gold-left p-5 space-y-4">
              <div className="flex items-center justify-between relative z-10">
                <h2 className="font-serif-bn font-bold text-base">আজকের আমল ও টু-ডু</h2>
                <button onClick={() => onNavigate('amal')} className="text-xs ts-accent-text font-semibold hover:underline">
                  সব দেখুন →
                </button>
              </div>
              <div className="space-y-2 text-xs relative z-10">
                {dailyAmalList.map((a) => (
                  <label
                    key={a.id}
                    className="flex items-center gap-3 p-2.5 ts-subsurface cursor-pointer transition hover:opacity-90"
                  >
                    <input
                      type="checkbox"
                      checked={!!dailyDone[a.id]}
                      onChange={(e) => onToggleDaily(a.id, e.target.checked)}
                      className="w-4 h-4 accent-[#0E5A45]"
                    />
                    <span className={dailyDone[a.id] ? 'line-through opacity-60' : 'font-medium'}>{a.label}</span>
                  </label>
                ))}
                {todos.slice(0, 2).map((t) => (
                  <label
                    key={t.id}
                    className="flex items-center gap-3 p-2.5 ts-subsurface cursor-pointer transition hover:opacity-90"
                  >
                    <input
                      type="checkbox"
                      checked={t.completed}
                      onChange={() => onToggleTodo(t.id)}
                      className="w-4 h-4 accent-[#0E5A45]"
                    />
                    <span className={t.completed ? 'line-through opacity-60' : 'font-medium'}>{t.title}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Streak, Sadaqah, Upcoming Event & Quick Shortcuts */}
          {showRightCol && (
            <div className="lg:col-span-4 ts-bento-card p-5 flex flex-col justify-between space-y-4">
              {widgets.streakSadaqah && (
                <div className="grid grid-cols-2 gap-3 relative z-10">
                  <div className="ts-stat-pill pattern-lattice">
                    <div className="text-xs ts-muted-text flex items-center gap-1 font-medium">
                      <Flame className="w-3.5 h-3.5 text-[#B4690E]" /> নামাজ স্ট্রিক
                    </div>
                    <div className="text-2xl font-bold font-mono-code mt-1">{streakDays} দিন</div>
                  </div>
                  <div className="ts-stat-pill pattern-lattice">
                    <div className="text-xs ts-muted-text font-medium">মোট সদকাহ</div>
                    <div className="text-2xl font-bold font-mono-code mt-1">৳ {totalSadaqah}</div>
                  </div>
                </div>
              )}

              {widgets.fastingAndEvent && (
                <div className="p-3.5 rounded-xl bg-[#0E5A45]/10 border border-[#0E5A45]/25 space-y-2 relative z-10">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <div className="text-xs font-semibold text-[#0E5A45]">{fastingLabel}</div>
                      <div className="text-[11px] ts-muted-text">মোট রোজা: {totalFasts} দিন</div>
                    </div>
                    <button
                      onClick={onToggleFasting}
                      className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
                        isFastingToday ? 'bg-[#0E5A45] text-white' : 'border border-[#0E5A45] text-[#0A4736]'
                      }`}
                    >
                      {isFastingToday ? 'রোজা আছি ✓' : 'আজ রোজা রাখুন'}
                    </button>
                  </div>
                  <div className="text-xs opacity-85 pt-1.5 border-t border-[#0E5A45]/15">
                    {nextEvent
                      ? `আসন্ন দিবস: ${nextEvent.name} (${nextEvent.daysLeft === 0 ? 'আজ' : `${nextEvent.daysLeft} দিন বাকি`})`
                      : 'আগামী ৬০ দিনে বিশেষ দিবস নেই'}
                  </div>
                </div>
              )}

              {widgets.quickShortcuts && (
                <div className="grid grid-cols-2 gap-2 relative z-10">
                  <button
                    onClick={() => onNavigate('life')}
                    className="py-2.5 px-3 rounded-xl border border-[#D2DDD8] text-xs font-semibold flex items-center justify-center gap-1.5 hover:bg-[#0E5A45]/10 transition"
                  >
                    <Timer className="w-4 h-4 text-[#0E5A45]" /> পোমোডোরো
                  </button>
                  <button
                    onClick={() => onNavigate('salah')}
                    className="py-2.5 px-3 rounded-xl border border-[#D2DDD8] text-xs font-semibold flex items-center justify-center gap-1.5 hover:bg-[#0E5A45]/10 transition"
                  >
                    <Compass className="w-4 h-4 text-[#0E5A45]" /> নামাজ ও কিবলা
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
