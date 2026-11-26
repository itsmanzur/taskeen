import React, { useMemo, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { BookOpen, CalendarCheck2, Check, CheckCircle2, Flame, Plus, Sparkles, Star, Target, Trash2 } from 'lucide-react';
import { getLocalDateKey } from '../lib/date';

export interface HabitItem {
  id: string;
  title: string;
  category: 'ইবাদত' | 'ইলম' | 'চরিত্র' | 'স্বাস্থ্য';
  days: Record<string, boolean>; // YYYY-MM-DD -> true
}

const DEFAULT_HABITS: HabitItem[] = [
  { id: 'hab_fajr', title: 'ফজর ও তাহাজ্জুদ / আউয়াল ওয়াক্তে নামাজ', category: 'ইবাদত', days: {} },
  { id: 'hab_quran', title: 'দৈনিক কুরআন তিলাওয়াত (কমপক্ষে ১ পৃষ্ঠা)', category: 'ইলম', days: {} },
  { id: 'hab_azkar', title: 'সকাল-সন্ধ্যার মাসনুন যিকির', category: 'ইবাদত', days: {} },
  { id: 'hab_mulk', title: 'রাতে সূরা মুলক ও ইস্তেগফার', category: 'ইবাদত', days: {} },
  { id: 'hab_akhlaq', title: 'রাগ নিয়ন্ত্রণ ও একটি ভালো কাজ / সদকাহ', category: 'চরিত্র', days: {} },
];

function computeHabitStreak(days: Record<string, boolean>): number {
  let streak = 0;
  const now = new Date();
  for (let i = 0; i < 365; i++) {
    const d = new Date(now);
    d.setDate(now.getDate() - i);
    const key = getLocalDateKey(d);
    if (days[key]) {
      streak++;
    } else if (i > 0) {
      break;
    }
  }
  return streak;
}

export interface MuhasabahEntry {
  id: string;
  date: string;
  gratitude: string[];
  wentWell: string;
  toImprove: string;
  rating: number;
}

export interface NiyyahGoal {
  id: string;
  title: string;
  target: number;
  current: number;
  unit: string;
}

interface MuhasabahNiyyahViewProps {
  darkMode: boolean;
  entries: MuhasabahEntry[];
  onAddEntry: (entry: MuhasabahEntry) => void;
  goals: NiyyahGoal[];
  onUpdateGoals: (goals: NiyyahGoal[]) => void;
  onNotify: (msg: string) => void;
}

export default function MuhasabahNiyyahView({
  darkMode,
  entries,
  onAddEntry,
  goals,
  onUpdateGoals,
  onNotify,
}: MuhasabahNiyyahViewProps) {
  const [subTab, setSubTab] = useState<'habits' | 'muhasabah'>('habits');

  const [habits, setHabits] = useState<HabitItem[]>(() => {
    try {
      const saved = localStorage.getItem('taskeen_habits_v1');
      if (saved) return JSON.parse(saved);
    } catch {}
    return DEFAULT_HABITS;
  });
  const [newHabitTitle, setNewHabitTitle] = useState('');
  const [newHabitCat, setNewHabitCat] = useState<HabitItem['category']>('ইবাদত');
  const [selectedHabitId, setSelectedHabitId] = useState<string | null>(null);

  const saveHabits = (next: HabitItem[]) => {
    setHabits(next);
    try {
      localStorage.setItem('taskeen_habits_v1', JSON.stringify(next));
      invoke('upsert_user_kv', { key: 'taskeen_habits_v1', value: JSON.stringify(next) }).catch(() => {});
    } catch {}
  };

  const toggleHabitDay = (habitId: string, dateKey: string) => {
    const next = habits.map((h) => {
      if (h.id !== habitId) return h;
      const nextDays = { ...h.days, [dateKey]: !h.days[dateKey] };
      return { ...h, days: nextDays };
    });
    saveHabits(next);
  };

  const handleAddHabit = (e: React.FormEvent) => {
    e.preventDefault();
    const title = newHabitTitle.trim();
    if (!title) return;
    const item: HabitItem = {
      id: `hab_${Date.now()}`,
      title,
      category: newHabitCat,
      days: {},
    };
    saveHabits([item, ...habits]);
    setNewHabitTitle('');
    onNotify('নতুন হ্যাবিট যুক্ত হয়েছে ✓');
  };

  const last7Days = useMemo(() => {
    const arr: { key: string; dayBn: string; num: number; isToday: boolean }[] = [];
    const now = new Date();
    const dayNames = ['রবি', 'সোম', 'মঙ্গল', 'বুধ', 'বৃহঃ', 'শুক্র', 'শনি'];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(now.getDate() - i);
      arr.push({
        key: getLocalDateKey(d),
        dayBn: dayNames[d.getDay()],
        num: d.getDate(),
        isToday: i === 0,
      });
    }
    return arr;
  }, []);

  const last30Days = useMemo(() => {
    const arr: { key: string; label: string }[] = [];
    const now = new Date();
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(now.getDate() - i);
      arr.push({
        key: getLocalDateKey(d),
        label: d.toLocaleDateString('bn-BD', { day: 'numeric', month: 'short' }),
      });
    }
    return arr;
  }, []);

  const todayKey = last7Days[6]?.key || getLocalDateKey();
  const todayDoneCount = habits.filter((h) => h.days[todayKey]).length;
  const todayPct = habits.length > 0 ? Math.round((todayDoneCount / habits.length) * 100) : 0;
  const bestStreak = habits.reduce((mx, h) => Math.max(mx, computeHabitStreak(h.days)), 0);
  const inspectedHabit = habits.find((h) => h.id === selectedHabitId) || habits[0];

  const [g1, setG1] = useState('');
  const [g2, setG2] = useState('');
  const [g3, setG3] = useState('');
  const [wentWell, setWentWell] = useState('');
  const [toImprove, setToImprove] = useState('');
  const [rating, setRating] = useState(4);

  const [goalTitle, setGoalTitle] = useState('');
  const [goalTarget, setGoalTarget] = useState('30');
  const [goalUnit, setGoalUnit] = useState('পৃষ্ঠা / বার');

  const cardCls = darkMode ? 'bg-[#121F1B] border-[#243832]' : 'bg-white border-[#DCE3E0]';

  const handleSaveMuhasabah = (e: React.FormEvent) => {
    e.preventDefault();
    onAddEntry({
      id: 'muh-' + Date.now(),
      date: new Date().toLocaleDateString('bn-BD'),
      gratitude: [g1, g2, g3].filter(Boolean),
      wentWell,
      toImprove,
      rating,
    });
    setG1('');
    setG2('');
    setG3('');
    setWentWell('');
    setToImprove('');
    onNotify('আজকের মুহাসাবাহ সংরক্ষণ হয়েছে');
  };

  const handleAddGoal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!goalTitle.trim()) return;
    onUpdateGoals([
      {
        id: 'niy-' + Date.now(),
        title: goalTitle.trim(),
        target: Math.max(1, Number(goalTarget) || 30),
        current: 0,
        unit: goalUnit.trim() || 'বার',
      },
      ...goals,
    ]);
    setGoalTitle('');
    onNotify('নতুন নিয়্যত লক্ষ্য যুক্ত হয়েছে');
  };

  return (
    <div className="p-6 max-w-6xl mx-auto w-full space-y-6">
      {/* Top Sub-tabs */}
      <div className="ts-bento-card p-2 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setSubTab('habits')}
          className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition ${
            subTab === 'habits' ? 'bg-[#0E5A45] text-white' : 'hover:bg-[#0E5A45]/10'
          }`}
        >
          <CalendarCheck2 className="w-4 h-4" /> ইন্টারেক্টিভ হ্যাবিট ট্র্যাকার ({todayDoneCount}/{habits.length})
        </button>
        <button
          type="button"
          onClick={() => setSubTab('muhasabah')}
          className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition ${
            subTab === 'muhasabah' ? 'bg-[#0E5A45] text-white' : 'hover:bg-[#0E5A45]/10'
          }`}
        >
          <BookOpen className="w-4 h-4" /> দৈনিক মুহাসাবাহ ও নিয়্যত লক্ষ্য
        </button>
      </div>

      {subTab === 'habits' && (
        <div className="space-y-5">
          {/* Summary + Add Habit */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            <div className="lg:col-span-5 ts-bento-card ts-card-accent-left p-5 flex flex-col justify-between space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="font-serif-bn font-bold text-lg flex items-center gap-2">
                    <Sparkles className="w-4 h-4 ts-accent-text" /> আজকের হ্যাবিট স্কোর
                  </h2>
                  <p className="text-xs ts-muted-text">প্রতিদিনের ভালো অভ্যাস ও ইবাদতের ধারাবাহিকতা</p>
                </div>
                <span className="font-mono-code text-2xl font-bold ts-accent-text">{todayPct}%</span>
              </div>
              <div className="ts-progress">
                <div className="ts-progress-fill" style={{ width: `${todayPct}%` }} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="ts-stat-pill">
                  <div className="text-[11px] ts-muted-text">আজ সম্পন্ন</div>
                  <div className="font-mono-code font-bold text-lg">{todayDoneCount} / {habits.length}</div>
                </div>
                <div className="ts-stat-pill">
                  <div className="text-[11px] ts-muted-text flex items-center gap-1">
                    <Flame className="w-3.5 h-3.5 text-amber-600" /> সেরা স্ট্রিক
                  </div>
                  <div className="font-mono-code font-bold text-lg">{bestStreak} দিন</div>
                </div>
              </div>
            </div>

            <form onSubmit={handleAddHabit} className="lg:col-span-7 ts-bento-card p-5 space-y-3">
              <h3 className="font-serif-bn font-bold text-base">নতুন হ্যাবিট যুক্ত করুন</h3>
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 text-xs">
                <input
                  type="text"
                  value={newHabitTitle}
                  onChange={(e) => setNewHabitTitle(e.target.value)}
                  placeholder="যেমন: প্রতিদিন ১০ মিনিট তিলাওয়াত / ৩০ মিনিট হাঁটা..."
                  className="sm:col-span-7 px-3 py-2.5 rounded-xl border border-[#D2DDD8] bg-transparent text-sm"
                  required
                />
                <select
                  value={newHabitCat}
                  onChange={(e) => setNewHabitCat(e.target.value as HabitItem['category'])}
                  className="sm:col-span-3 px-3 py-2.5 rounded-xl border border-[#D2DDD8] bg-transparent text-sm"
                >
                  <option value="ইবাদত" className="text-black">ইবাদত</option>
                  <option value="ইলম" className="text-black">ইলম</option>
                  <option value="চরিত্র" className="text-black">চরিত্র</option>
                  <option value="স্বাস্থ্য" className="text-black">স্বাস্থ্য</option>
                </select>
                <button
                  type="submit"
                  className="sm:col-span-2 py-2.5 rounded-xl bg-[#0E5A45] text-white font-semibold flex items-center justify-center gap-1"
                >
                  <Plus className="w-4 h-4" /> যোগ
                </button>
              </div>
              <p className="text-[11px] ts-muted-text">
                নিচের ৭-দিনের বোর্ডে যেকোনো দিনের বক্সে ক্লিক করে হ্যাবিট টিক/আনটিক করুন। কোনো হ্যাবিটে ক্লিক করলে ৩০-দিনের ধারাবাহিকতা দেখাবে।
              </p>
            </form>
          </div>

          {/* 7-Day Interactive Matrix */}
          <div className="ts-bento-card p-5 overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[640px]">
              <thead>
                <tr className="border-b border-[#D2DDD8]/60 text-xs ts-muted-text">
                  <th className="py-2 pr-3 font-semibold">হ্যাবিট ও ক্যাটাগরি</th>
                  {last7Days.map((d) => (
                    <th key={d.key} className="py-2 px-1.5 text-center w-14">
                      <div className={d.isToday ? 'ts-accent-text font-bold' : ''}>{d.dayBn}</div>
                      <div className="font-mono-code text-[10px] opacity-75">{d.num}</div>
                    </th>
                  ))}
                  <th className="py-2 pl-3 text-center w-20">স্ট্রিক</th>
                  <th className="py-2 w-10" />
                </tr>
              </thead>
              <tbody className="divide-y divide-[#D2DDD8]/40 text-sm">
                {habits.map((h) => {
                  const streak = computeHabitStreak(h.days);
                  const isSelected = inspectedHabit?.id === h.id;
                  return (
                    <tr
                      key={h.id}
                      onClick={() => setSelectedHabitId(h.id)}
                      className={`cursor-pointer transition ${isSelected ? 'ts-accent-soft' : 'hover:bg-black/5'}`}
                    >
                      <td className="py-3 pr-3">
                        <div className="font-semibold">{h.title}</div>
                        <span className="text-[10px] px-2 py-0.5 rounded-full ts-subsurface ts-muted-text font-semibold">
                          {h.category}
                        </span>
                      </td>
                      {last7Days.map((d) => {
                        const checked = !!h.days[d.key];
                        return (
                          <td key={d.key} className="py-3 px-1.5 text-center">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleHabitDay(h.id, d.key);
                              }}
                              className={`w-8 h-8 rounded-xl border inline-flex items-center justify-center transition ${
                                checked
                                  ? 'bg-[#0E5A45] text-white border-[#0E5A45] shadow-sm scale-105'
                                  : 'border-[#D2DDD8] hover:border-[#0E5A45]'
                              }`}
                            >
                              {checked && <Check className="w-4 h-4" />}
                            </button>
                          </td>
                        );
                      })}
                      <td className="py-3 pl-3 text-center">
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full ts-subsurface text-xs font-mono-code font-bold">
                          <Flame className="w-3.5 h-3.5 text-amber-600" /> {streak}
                        </span>
                      </td>
                      <td className="py-3 text-right">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            saveHabits(habits.filter((x) => x.id !== h.id));
                          }}
                          className="p-1.5 rounded-lg opacity-50 hover:opacity-100 hover:text-red-600"
                          title="হ্যাবিট মুছুন"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* 30-Day Consistency Dots for Selected Habit */}
          {inspectedHabit && (
            <div className="ts-bento-card p-5 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="font-serif-bn font-bold text-sm">
                  ৩০ দিনের ধারাবাহিকতা: <span className="ts-accent-text">{inspectedHabit.title}</span>
                </div>
                <span className="text-xs ts-muted-text">
                  মোট সম্পন্ন: {Object.values(inspectedHabit.days).filter(Boolean).length} দিন
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {last30Days.map((d) => {
                  const done = !!inspectedHabit.days[d.key];
                  return (
                    <button
                      key={d.key}
                      type="button"
                      title={`${d.label}: ${done ? 'সম্পন্ন ✓' : 'বাকি'}`}
                      onClick={() => toggleHabitDay(inspectedHabit.id, d.key)}
                      className={`w-7 h-7 rounded-lg border text-[10px] font-mono-code transition ${
                        done
                          ? 'bg-[#0E5A45] text-white border-[#0E5A45]'
                          : 'border-[#D2DDD8] ts-subsurface opacity-60 hover:opacity-100'
                      }`}
                    >
                      {d.key.slice(-2)}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {subTab === 'muhasabah' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      {/* Muhasabah Journal */}
      <div className={`lg:col-span-6 p-6 rounded-2xl border space-y-4 ${cardCls}`}>
        <div className="flex items-center gap-2">
          <BookOpen className="w-5 h-5 text-[#0E5A45]" />
          <h2 className="font-serif-bn font-bold text-xl">দৈনিক মুহাসাবাহ (আত্ম-সমালোচনা)</h2>
        </div>

        <form onSubmit={handleSaveMuhasabah} className="space-y-3 text-xs sensitive-data">
          <div>
            <label className="font-semibold block mb-1">আজকের ৩টি শোকরগুজারি (আলহামদুলিল্লাহ)</label>
            <div className="space-y-1.5">
              <input value={g1} onChange={(e) => setG1(e.target.value)} placeholder="১. ..." className="w-full px-3 py-2 rounded-lg border border-[#D2DDD8] bg-transparent" />
              <input value={g2} onChange={(e) => setG2(e.target.value)} placeholder="২. ..." className="w-full px-3 py-2 rounded-lg border border-[#D2DDD8] bg-transparent" />
              <input value={g3} onChange={(e) => setG3(e.target.value)} placeholder="৩. ..." className="w-full px-3 py-2 rounded-lg border border-[#D2DDD8] bg-transparent" />
            </div>
          </div>

          <div>
            <label className="font-semibold block mb-1">আজ কোন আমলটি সবচেয়ে ভালো হয়েছে?</label>
            <textarea rows={2} value={wentWell} onChange={(e) => setWentWell(e.target.value)} placeholder="যেমন: সময়মতো জামাতে নামাজ, কুরআন তিলাওয়াত..." className="w-full px-3 py-2 rounded-lg border border-[#D2DDD8] bg-transparent" />
          </div>

          <div>
            <label className="font-semibold block mb-1">আগামীকাল কোন বিষয়ে উন্নতি করতে চাই?</label>
            <textarea rows={2} value={toImprove} onChange={(e) => setToImprove(e.target.value)} placeholder="যেমন: গীবত থেকে বাঁচা, তাহাজ্জুদে উঠা..." className="w-full px-3 py-2 rounded-lg border border-[#D2DDD8] bg-transparent" />
          </div>

          <div className="flex items-center justify-between">
            <span className="font-semibold">আজকের আত্ম-মূল্যায়ন:</span>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  type="button"
                  key={n}
                  onClick={() => setRating(n)}
                  className={`p-1.5 rounded-lg border ${rating >= n ? 'bg-[#0E5A45] text-white border-[#0E5A45]' : 'border-[#D2DDD8]'}`}
                >
                  <Star className="w-3.5 h-3.5" />
                </button>
              ))}
            </div>
          </div>

          <button type="submit" className="w-full py-2.5 rounded-xl bg-[#0E5A45] text-white font-semibold">
            মুহাসাবাহ সেভ করুন
          </button>
        </form>

        {entries.length > 0 && (
          <div className="pt-4 border-t border-[#DCE3E0] space-y-2 max-h-56 overflow-y-auto sensitive-data">
            <p className="text-xs font-semibold opacity-75">পূর্ববর্তী রেকর্ড ({entries.length})</p>
            {entries.slice(0, 5).map((en) => (
              <div key={en.id} className="p-3 rounded-xl border border-[#DCE3E0] text-xs space-y-1">
                <div className="flex justify-between font-semibold">
                  <span>{en.date}</span>
                  <span>রেটিং: {en.rating}/5 ★</span>
                </div>
                {en.wentWell && <p className="opacity-80">✓ {en.wentWell}</p>}
                {en.toImprove && <p className="opacity-70">→ {en.toImprove}</p>}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Niyyah Board */}
      <div className={`lg:col-span-6 p-6 rounded-2xl border space-y-4 ${cardCls}`}>
        <div className="flex items-center gap-2">
          <Target className="w-5 h-5 text-[#0E5A45]" />
          <h2 className="font-serif-bn font-bold text-xl">নিয়্যত বোর্ড (আধ্যাত্মিক লক্ষ্য)</h2>
        </div>

        <form onSubmit={handleAddGoal} className="grid grid-cols-1 sm:grid-cols-12 gap-2 text-xs">
          <input
            value={goalTitle}
            onChange={(e) => setGoalTitle(e.target.value)}
            placeholder="নতুন নিয়্যত (যেমন: মাসে ১ খতম কুরআন)"
            className="sm:col-span-6 px-3 py-2 rounded-lg border border-[#D2DDD8] bg-transparent"
          />
          <input
            type="number"
            value={goalTarget}
            onChange={(e) => setGoalTarget(e.target.value)}
            placeholder="লক্ষ্য"
            className="sm:col-span-2 px-3 py-2 rounded-lg border border-[#D2DDD8] bg-transparent"
          />
          <input
            value={goalUnit}
            onChange={(e) => setGoalUnit(e.target.value)}
            placeholder="একক"
            className="sm:col-span-2 px-3 py-2 rounded-lg border border-[#D2DDD8] bg-transparent"
          />
          <button type="submit" className="sm:col-span-2 py-2 rounded-lg bg-[#0E5A45] text-white font-semibold flex items-center justify-center gap-1">
            <Plus className="w-3.5 h-3.5" /> যোগ
          </button>
        </form>

        <div className="space-y-3">
          {goals.length === 0 ? (
            <p className="text-xs opacity-70 py-6 text-center">এখনো কোনো নিয়্যত যোগ করা হয়নি।</p>
          ) : (
            goals.map((g) => {
              const pct = Math.min(100, Math.round((g.current / g.target) * 100));
              return (
                <div key={g.id} className="p-4 rounded-xl border border-[#DCE3E0] space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-sm flex items-center gap-1.5">
                      {pct >= 100 && <CheckCircle2 className="w-4 h-4 text-[#0E5A45]" />}
                      {g.title}
                    </span>
                    <button
                      onClick={() => onUpdateGoals(goals.filter((x) => x.id !== g.id))}
                      className="opacity-60 hover:opacity-100"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="w-full h-2 bg-[#DCE3E0] rounded-full overflow-hidden">
                    <div className="h-full bg-[#0E5A45] transition-all" style={{ width: `${pct}%` }} />
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-mono-code">
                      {g.current} / {g.target} {g.unit} ({pct}%)
                    </span>
                    <div className="flex gap-1.5">
                      <button
                        onClick={() =>
                          onUpdateGoals(
                            goals.map((x) =>
                              x.id === g.id ? { ...x, current: Math.min(x.target, x.current + 1) } : x
                            )
                          )
                        }
                        className="px-2.5 py-1 rounded bg-[#0E5A45] text-white font-semibold"
                      >
                        +১ অগ্রগতি
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
        </div>
      )}
    </div>
  );
}
