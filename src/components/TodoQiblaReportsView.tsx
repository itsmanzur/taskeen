import { savePngDataUrl } from '../lib/saveFile';
import React, { useMemo, useRef, useState } from 'react';
import { getLocalDateKey } from '../lib/date';
import {
  BarChart3,
  CheckCircle2,
  Circle,
  Compass,
  Download,
  ListTodo,
  MapPin,
  Plus,
  Printer,
  Trash2,
} from 'lucide-react';
import { PrayerDay } from './DashboardView';
import { MuhasabahEntry } from './MuhasabahNiyyahView';
import { SadaqahEntry } from './ToolsView';

export interface TodoItem {
  id: string;
  title: string;
  category: 'deen' | 'personal' | 'family' | 'work';
  priority: 'high' | 'medium' | 'low';
  completed: boolean;
  createdAt: string;
}

interface TodoQiblaReportsViewProps {
  darkMode: boolean;
  todos: TodoItem[];
  onUpdateTodos: (todos: TodoItem[]) => void;
  prayers: Record<string, PrayerDay>;
  totalTasbihCount: number;
  sadaqahList: SadaqahEntry[];
  muhasabahEntries: MuhasabahEntry[];
  onNotify: (msg: string) => void;
}

const KAABA_LAT = 21.422487;
const KAABA_LNG = 39.826206;

function calculateQibla(latitude: number, longitude: number): number {
  const kaabaLat = KAABA_LAT * (Math.PI / 180);
  const kaabaLng = KAABA_LNG * (Math.PI / 180);
  const userLat = latitude * (Math.PI / 180);
  const userLng = longitude * (Math.PI / 180);

  const y = Math.sin(kaabaLng - userLng);
  const x =
    Math.cos(userLat) * Math.tan(kaabaLat) -
    Math.sin(userLat) * Math.cos(kaabaLng - userLng);

  const qibla = Math.atan2(y, x) * (180 / Math.PI);
  return (qibla + 360) % 360;
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

const CITIES = [
  { name: 'ঢাকা', lat: 23.8103, lng: 90.4125 },
  { name: 'চট্টগ্রাম', lat: 22.3569, lng: 91.7832 },
  { name: 'সিলেট', lat: 24.8949, lng: 91.8687 },
  { name: 'রাজশাহী', lat: 24.3745, lng: 88.6042 },
  { name: 'খুলনা', lat: 22.8456, lng: 89.5403 },
  { name: 'লন্ডন', lat: 51.5072, lng: -0.1276 },
  { name: 'নিউ ইয়র্ক', lat: 40.7128, lng: -74.006 },
];

const PRAYER_KEYS: (keyof PrayerDay)[] = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'];

export default function TodoQiblaReportsView({
  darkMode,
  todos,
  onUpdateTodos,
  prayers,
  totalTasbihCount,
  sadaqahList,
  muhasabahEntries,
  onNotify,
}: TodoQiblaReportsViewProps) {
  // Todo states
  const [todoText, setTodoText] = useState('');
  const [todoCat, setTodoCat] = useState<TodoItem['category']>('deen');
  const [todoPriority, setTodoPriority] = useState<TodoItem['priority']>('medium');
  const [todoFilter, setTodoFilter] = useState<'all' | 'pending' | 'done'>('all');

  // Qibla states
  const [coords, setCoords] = useState<{ lat: number; lng: number; label: string }>({
    lat: 23.8103,
    lng: 90.4125,
    label: 'ঢাকা',
  });

  // Report states
  const [period, setPeriod] = useState<'week' | 'month'>('week');
  const reportCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const qiblaAngle = useMemo(
    () => calculateQibla(coords.lat, coords.lng),
    [coords.lat, coords.lng]
  );
  const distanceKm = useMemo(
    () => calculateDistanceKm(coords.lat, coords.lng),
    [coords.lat, coords.lng]
  );

  const filteredTodos = useMemo(() => {
    return todos.filter((t) => {
      if (todoFilter === 'pending') return !t.completed;
      if (todoFilter === 'done') return t.completed;
      return true;
    });
  }, [todos, todoFilter]);

  const reportStats = useMemo(() => {
    const days = period === 'week' ? 7 : 30;
    const today = new Date();
    let doneCount = 0;
    let qazaCount = 0;
    let missedCount = 0;
    const series: { label: string; done: number }[] = [];

    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const key = getLocalDateKey(d);
      const day = prayers[key];
      let dayDone = 0;
      if (day) {
        PRAYER_KEYS.forEach((k) => {
          if (day[k] === 'done') {
            doneCount++;
            dayDone++;
          } else if (day[k] === 'qaza') qazaCount++;
          else if (day[k] === 'missed') missedCount++;
        });
      }
      series.push({
        label: d.toLocaleDateString('bn-BD', { day: 'numeric', month: 'numeric' }),
        done: dayDone,
      });
    }

    const totalPossible = days * 5;
    const rate = Math.round((doneCount / totalPossible) * 100);
    const totalSadaqah = sadaqahList.reduce((sum, s) => sum + s.amount, 0);
    const completedTodos = todos.filter((t) => t.completed).length;

    return {
      days,
      doneCount,
      qazaCount,
      missedCount,
      totalPossible,
      rate,
      totalSadaqah,
      completedTodos,
      series,
    };
  }, [period, prayers, sadaqahList, todos]);

  const downloadReportPng = async () => {
    const canvas = reportCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = '#0E5A45';
    ctx.fillRect(0, 0, 900, 520);
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(28, 28, 844, 464);

    ctx.fillStyle = '#0A4736';
    ctx.font = '700 26px "Noto Serif Bengali", sans-serif';
    ctx.fillText(
      `তাসকীন — ${period === 'week' ? 'সাপ্তাহিক (৭ দিন)' : 'মাসিক (৩০ দিন)'} আমল রিপোর্ট`,
      56,
      82
    );

    ctx.fillStyle = '#4A5B55';
    ctx.font = '400 15px "Hind Siliguri", sans-serif';
    ctx.fillText(`তারিখ: ${new Date().toLocaleDateString('bn-BD')}`, 56, 112);

    const cards = [
      ['নামাজ আদায়', `${reportStats.doneCount}/${reportStats.totalPossible} (${reportStats.rate}%)`],
      ['মোট তাসবীহ পাঠ', `${totalTasbihCount}`],
      ['সম্পন্ন টু-ডু', `${reportStats.completedTodos}/${todos.length}`],
      ['মোট সদকাহ', `৳ ${reportStats.totalSadaqah.toLocaleString('en-US')}`],
      ['মুহাসাবাহ জার্নাল', `${muhasabahEntries.length}টি`],
      ['কাযা / মিস নামাজ', `${reportStats.qazaCount} / ${reportStats.missedCount}`],
    ];

    cards.forEach(([label, val], idx) => {
      const col = idx % 2;
      const row = Math.floor(idx / 2);
      const x = 56 + col * 400;
      const y = 148 + row * 102;
      ctx.fillStyle = '#F4F7F5';
      ctx.fillRect(x, y, 376, 84);
      ctx.fillStyle = '#4A5B55';
      ctx.font = '600 15px "Hind Siliguri", sans-serif';
      ctx.fillText(label, x + 20, y + 30);
      ctx.fillStyle = '#0E5A45';
      ctx.font = '700 24px "Google Sans Code", monospace';
      ctx.fillText(val, x + 20, y + 64);
    });

    const res = await savePngDataUrl(`taskeen-report-${period}.png`, canvas.toDataURL('image/png')).catch((e) => {
      onNotify(String(e));
      return 'error' as const;
    });
    if (res !== 'saved') {
      if (res === 'cancelled') onNotify('সংরক্ষণ বাতিল করা হয়েছে');
      return;
    }
    onNotify('রিপোর্ট PNG ডাউনলোড হয়েছে');
  };

  const cardCls = darkMode ? 'bg-[#121F1B] border-[#243832]' : 'bg-white border-[#DCE3E0]';

  return (
    <div className="p-6 max-w-6xl mx-auto w-full grid grid-cols-1 lg:grid-cols-12 gap-6">
      {/* To-Do List */}
      <div className={`lg:col-span-5 p-6 rounded-2xl border space-y-4 ${cardCls}`}>
        <div className="flex items-center justify-between">
          <h2 className="font-serif-bn font-bold text-lg flex items-center gap-2">
            <ListTodo className="w-5 h-5 text-[#0E5A45]" /> দৈনিক টু-ডু লিস্ট
          </h2>
          <span className="text-xs opacity-70">
            {todos.filter((t) => t.completed).length}/{todos.length} সম্পন্ন
          </span>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!todoText.trim()) return;
            onUpdateTodos([
              {
                id: 'todo-' + Date.now(),
                title: todoText.trim(),
                category: todoCat,
                priority: todoPriority,
                completed: false,
                createdAt: new Date().toLocaleDateString('bn-BD'),
              },
              ...todos,
            ]);
            setTodoText('');
            onNotify('নতুন কাজ যুক্ত হয়েছে');
          }}
          className="space-y-2 text-xs"
        >
          <input
            value={todoText}
            onChange={(e) => setTodoText(e.target.value)}
            placeholder="নতুন কাজ লিখুন (যেমন: সূরা কাহাফ পাঠ)..."
            className="w-full px-3 py-2 rounded-lg border border-[#D2DDD8] bg-transparent"
          />
          <div className="flex gap-2">
            <select
              value={todoCat}
              onChange={(e) => setTodoCat(e.target.value as TodoItem['category'])}
              className="flex-1 px-2 py-1.5 rounded-lg border border-[#D2DDD8] bg-transparent"
            >
              <option value="deen">দ্বীনি</option>
              <option value="personal">ব্যক্তিগত</option>
              <option value="family">পারিবারিক</option>
              <option value="work">কাজ</option>
            </select>
            <select
              value={todoPriority}
              onChange={(e) => setTodoPriority(e.target.value as TodoItem['priority'])}
              className="flex-1 px-2 py-1.5 rounded-lg border border-[#D2DDD8] bg-transparent"
            >
              <option value="high">উচ্চ অগ্রাধিকার</option>
              <option value="medium">মাঝারি</option>
              <option value="low">সাধারণ</option>
            </select>
            <button
              type="submit"
              className="px-3 py-1.5 rounded-lg bg-[#0E5A45] text-white font-semibold flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" /> যোগ
            </button>
          </div>
        </form>

        <div className="flex gap-1.5 text-xs">
          {[
            ['all', 'সব'],
            ['pending', 'বাকি'],
            ['done', 'সম্পন্ন'],
          ].map(([k, lbl]) => (
            <button
              key={k}
              onClick={() => setTodoFilter(k as typeof todoFilter)}
              className={`px-2.5 py-1 rounded-full border ${
                todoFilter === k ? 'bg-[#0E5A45] text-white border-[#0E5A45]' : 'border-[#D2DDD8]'
              }`}
            >
              {lbl}
            </button>
          ))}
        </div>

        <div className="space-y-2 max-h-72 overflow-y-auto">
          {filteredTodos.length === 0 ? (
            <p className="text-xs opacity-65 text-center py-6">কোনো কাজ পাওয়া যায়নি।</p>
          ) : (
            filteredTodos.map((t) => (
              <div
                key={t.id}
                className="flex items-center justify-between gap-2 p-2.5 rounded-xl border border-[#DCE3E0] text-xs"
              >
                <button
                  onClick={() =>
                    onUpdateTodos(
                      todos.map((x) => (x.id === t.id ? { ...x, completed: !x.completed } : x))
                    )
                  }
                  className="flex items-center gap-2 text-left flex-1"
                >
                  {t.completed ? (
                    <CheckCircle2 className="w-4 h-4 text-[#0E5A45] shrink-0" />
                  ) : (
                    <Circle className="w-4 h-4 opacity-50 shrink-0" />
                  )}
                  <span className={t.completed ? 'line-through opacity-60' : ''}>{t.title}</span>
                </button>
                <button
                  onClick={() => onUpdateTodos(todos.filter((x) => x.id !== t.id))}
                  className="opacity-55 hover:opacity-100"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Qibla Compass */}
      <div className={`lg:col-span-3 p-6 rounded-2xl border flex flex-col items-center justify-between gap-4 ${cardCls}`}>
        <div className="w-full flex items-center justify-between">
          <h2 className="font-serif-bn font-bold text-lg flex items-center gap-2">
            <Compass className="w-5 h-5 text-[#0E5A45]" /> কিবলা কম্পাস
          </h2>
        </div>

        <div className="relative w-48 h-48 flex items-center justify-center">
          <svg viewBox="0 0 200 200" className="w-full h-full">
            <circle cx="100" cy="100" r="92" fill="none" stroke="currentColor" strokeOpacity="0.18" strokeWidth="2" />
            <circle cx="100" cy="100" r="72" fill="none" stroke="currentColor" strokeOpacity="0.1" strokeDasharray="4 4" />
            <text x="100" y="22" textAnchor="middle" fill="currentColor" fontSize="12" fontWeight="bold">N</text>
            <text x="182" y="104" textAnchor="middle" fill="currentColor" fontSize="11" opacity="0.6">E</text>
            <text x="100" y="188" textAnchor="middle" fill="currentColor" fontSize="11" opacity="0.6">S</text>
            <text x="18" y="104" textAnchor="middle" fill="currentColor" fontSize="11" opacity="0.6">W</text>
            <g transform={`rotate(${qiblaAngle} 100 100)`}>
              <polygon points="100,26 108,100 100,114 92,100" fill="#0E5A45" />
              <circle cx="100" cy="100" r="7" fill="#B4690E" />
            </g>
          </svg>
        </div>

        <div className="text-center space-y-1">
          <div className="font-mono-code text-2xl font-bold text-[#0E5A45]">
            {qiblaAngle.toFixed(1)}°
          </div>
          <p className="text-xs opacity-75">
            {coords.label} থেকে কাবা শরীফ ({distanceKm.toLocaleString('en-US')} কি.মি.)
          </p>
        </div>

        <div className="w-full space-y-2 text-xs">
          <select
            value={coords.label}
            onChange={(e) => {
              const city = CITIES.find((c) => c.name === e.target.value);
              if (city) setCoords({ lat: city.lat, lng: city.lng, label: city.name });
            }}
            className="w-full px-3 py-1.5 rounded-lg border border-[#D2DDD8] bg-transparent"
          >
            {CITIES.map((c) => (
              <option key={c.name} value={c.name}>
                শহর: {c.name}
              </option>
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
                  setCoords({
                    lat: pos.coords.latitude,
                    lng: pos.coords.longitude,
                    label: 'বর্তমান অবস্থান',
                  });
                  onNotify('আপনার লোকেশন অনুযায়ী কিবলা আপডেট হয়েছে');
                },
                () => onNotify('লোকেশন অনুমতি পাওয়া যায়নি')
              );
            }}
            className="w-full py-2 rounded-lg border border-[#0E5A45] text-[#0A4736] font-semibold flex items-center justify-center gap-1.5"
          >
            <MapPin className="w-3.5 h-3.5" /> আমার লোকেশন নিন
          </button>
        </div>
      </div>

      {/* Weekly / Monthly Report & PDF Export */}
      <div className={`lg:col-span-4 p-6 rounded-2xl border space-y-4 ${cardCls}`}>
        <div className="flex items-center justify-between">
          <h2 className="font-serif-bn font-bold text-lg flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-[#0E5A45]" /> আমল রিপোর্ট
          </h2>
          <div className="flex gap-1 text-xs">
            <button
              onClick={() => setPeriod('week')}
              className={`px-2.5 py-1 rounded-lg border ${
                period === 'week' ? 'bg-[#0E5A45] text-white border-[#0E5A45]' : 'border-[#D2DDD8]'
              }`}
            >
              ৭ দিন
            </button>
            <button
              onClick={() => setPeriod('month')}
              className={`px-2.5 py-1 rounded-lg border ${
                period === 'month' ? 'bg-[#0E5A45] text-white border-[#0E5A45]' : 'border-[#D2DDD8]'
              }`}
            >
              ৩০ দিন
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2.5 text-xs">
          <div className="p-3 rounded-xl bg-[#0E5A45]/10">
            <span className="opacity-75 block">নামাজ আদায়</span>
            <strong className="text-lg font-mono-code text-[#0E5A45]">
              {reportStats.doneCount}/{reportStats.totalPossible} ({reportStats.rate}%)
            </strong>
          </div>
          <div className="p-3 rounded-xl bg-[#FDF3E7] text-[#7A4404]">
            <span className="opacity-75 block">মোট তাসবীহ</span>
            <strong className="text-lg font-mono-code">{totalTasbihCount}</strong>
          </div>
          <div className="p-3 rounded-xl border border-[#DCE3E0]">
            <span className="opacity-75 block">সম্পন্ন টু-ডু</span>
            <strong className="text-lg font-mono-code">
              {reportStats.completedTodos}/{todos.length}
            </strong>
          </div>
          <div className="p-3 rounded-xl border border-[#DCE3E0]">
            <span className="opacity-75 block">মোট সদকাহ</span>
            <strong className="text-lg font-mono-code">৳ {reportStats.totalSadaqah}</strong>
          </div>
        </div>

        {/* Mini Bar Chart */}
        <div>
          <p className="text-xs font-semibold opacity-75 mb-2">
            দৈনিক নামাজ গ্রাফ ({period === 'week' ? 'গত ৭ দিন' : 'গত ৩০ দিন'})
          </p>
          <div className="h-24 flex items-end gap-1 border-b border-[#DCE3E0] pb-1">
            {reportStats.series.map((pt, idx) => (
              <div
                key={idx}
                title={`${pt.label}: ${pt.done}/5`}
                className="flex-1 bg-[#0E5A45] rounded-t transition-all"
                style={{ height: `${Math.max(8, (pt.done / 5) * 100)}%`, opacity: pt.done > 0 ? 1 : 0.2 }}
              />
            ))}
          </div>
        </div>

        <div className="flex gap-2 pt-2">
          <button
            onClick={() => window.print()}
            className="flex-1 py-2 rounded-xl bg-[#0E5A45] text-white text-xs font-semibold flex items-center justify-center gap-1.5"
          >
            <Printer className="w-4 h-4" /> PDF / প্রিন্ট
          </button>
          <button
            onClick={downloadReportPng}
            className="flex-1 py-2 rounded-xl border border-[#0E5A45] text-[#0A4736] text-xs font-semibold flex items-center justify-center gap-1.5"
          >
            <Download className="w-4 h-4" /> PNG কার্ড
          </button>
        </div>

        <canvas ref={reportCanvasRef} width={900} height={520} className="hidden" />
      </div>
    </div>
  );
}
