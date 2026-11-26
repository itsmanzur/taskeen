import React, { useEffect, useState } from 'react';
import { Pause, Play, RotateCcw, Shield, Timer, Wallet } from 'lucide-react';

export interface SadaqahEntry {
  id: string;
  date: string;
  amount: number;
  note: string;
}

export interface WasiyyahData {
  assets: string;
  unfulfilledDuties: string;
  finalWords: string;
  updatedAt?: string;
}

interface ToolsViewProps {
  darkMode: boolean;
  sadaqahList: SadaqahEntry[];
  onAddSadaqah: (entry: SadaqahEntry) => void;
  zakatWealth: number;
  onChangeZakatWealth: (val: number) => void;
  wasiyyah: WasiyyahData;
  onSaveWasiyyah: (data: WasiyyahData) => void;
  onNotify: (msg: string) => void;
}

const DHIKR_BREAKS = [
  { ar: 'سُبْحَانَ اللَّهِ وَبِحَمْدِهِ', bn: 'সুবহানাল্লাহি ওয়া বিহামদিহি — আল্লাহর পবিত্রতা ও প্রশংসা' },
  { ar: 'أَسْتَغْفِرُ اللَّهَ الْعَظِيمَ', bn: 'আস্তাগফিরুল্লাহাল আযীম — আমি মহান আল্লাহর কাছে ক্ষমা চাই' },
  { ar: 'لَا حَوْلَ وَلَا قُوَّةَ إِلَّا بِاللَّهِ', bn: 'লা হাওলা ওয়ালা কুওয়াতা ইল্লা বিল্লাহ' },
  { ar: 'اللَّهُمَّ صَلِّ عَلَى مُحَمَّدٍ', bn: 'আল্লাহুম্মা সাল্লি আলা মুহাম্মাদ — দরুদ শরীফ' },
];

export default function ToolsView({
  darkMode,
  sadaqahList,
  onAddSadaqah,
  zakatWealth,
  onChangeZakatWealth,
  wasiyyah,
  onSaveWasiyyah,
  onNotify,
}: ToolsViewProps) {
  // Pomodoro state
  const [mode, setMode] = useState<'work' | 'break'>('work');
  const [secondsLeft, setSecondsLeft] = useState(25 * 60);
  const [running, setRunning] = useState(false);
  const [dhikrIdx, setDhikrIdx] = useState(0);

  // Sadaqah form
  const [sadAmount, setSadAmount] = useState('');
  const [sadNote, setSadNote] = useState('');

  // Wasiyyah form
  const [assets, setAssets] = useState(wasiyyah.assets);
  const [duties, setDuties] = useState(wasiyyah.unfulfilledDuties);
  const [words, setWords] = useState(wasiyyah.finalWords);

  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          const nextMode = mode === 'work' ? 'break' : 'work';
          setMode(nextMode);
          setRunning(false);
          setDhikrIdx((i) => (i + 1) % DHIKR_BREAKS.length);
          onNotify(
            nextMode === 'break'
              ? 'ফোকাস সেশন শেষ! ৫ মিনিট যিকির ও বিশ্রাম নিন।'
              : 'বিরতি শেষ! নতুন ফোকাস সেশন শুরু করতে পারেন।'
          );
          return nextMode === 'work' ? 25 * 60 : 5 * 60;
        }
        return prev - 1;
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [running, mode, onNotify]);

  const mins = String(Math.floor(secondsLeft / 60)).padStart(2, '0');
  const secs = String(secondsLeft % 60).padStart(2, '0');
  const cardCls = darkMode ? 'bg-[#121F1B] border-[#243832]' : 'bg-white border-[#DCE3E0]';

  const totalSadaqah = sadaqahList.reduce((sum, s) => sum + s.amount, 0);
  const zakatDue = zakatWealth > 0 ? Math.round(zakatWealth * 0.025) : 0;

  return (
    <div className="p-6 max-w-6xl mx-auto w-full grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Islamic Pomodoro */}
      <div className={`p-6 rounded-2xl border flex flex-col justify-between gap-4 ${cardCls}`}>
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-serif-bn font-bold text-lg flex items-center gap-2">
              <Timer className="w-5 h-5 text-[#0E5A45]" /> ইসলামিক পোমোডোরো
            </h2>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-[#E6F2EE] text-[#0A4736] font-semibold">
              {mode === 'work' ? 'ফোকাস (২৫ মি.)' : 'যিকির বিরতি (৫ মি.)'}
            </span>
          </div>

          <div className="py-8 rounded-2xl bg-[#0E5A45]/10 text-center my-3">
            <div className="font-mono-code text-5xl font-bold text-[#0E5A45]">
              {mins}:{secs}
            </div>
            <p className="text-xs opacity-75 mt-2">
              {mode === 'work' ? 'বিসমিল্লাহ বলে কাজে মনোযোগ দিন' : 'বিরতির যিকির পাঠ করুন'}
            </p>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => setRunning(!running)}
              className="flex-1 py-2.5 rounded-xl bg-[#0E5A45] text-white text-xs font-semibold flex items-center justify-center gap-1.5"
            >
              {running ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
              {running ? 'বিরতি' : 'শুরু করুন'}
            </button>
            <button
              onClick={() => {
                setRunning(false);
                setSecondsLeft(mode === 'work' ? 25 * 60 : 5 * 60);
              }}
              className="px-3 py-2.5 rounded-xl border border-[#D2DDD8] text-xs"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
            <button
              onClick={() => {
                const next = mode === 'work' ? 'break' : 'work';
                setMode(next);
                setRunning(false);
                setSecondsLeft(next === 'work' ? 25 * 60 : 5 * 60);
              }}
              className="px-3 py-2.5 rounded-xl border border-[#D2DDD8] text-xs"
            >
              {mode === 'work' ? 'বিরতিতে যান' : 'কাজে ফিরুন'}
            </button>
          </div>
        </div>

        <div className="p-3.5 rounded-xl border border-[#DCE3E0] bg-[#0E5A45]/5 text-center space-y-1">
          <p className="text-[11px] font-semibold opacity-70">বিরতির যিকির সাজেশন</p>
          <p className="font-arabic-amiri text-xl">{DHIKR_BREAKS[dhikrIdx].ar}</p>
          <p className="text-xs opacity-80">{DHIKR_BREAKS[dhikrIdx].bn}</p>
        </div>
      </div>

      {/* Zakat & Sadaqah */}
      <div className={`p-6 rounded-2xl border space-y-4 ${cardCls}`}>
        <h2 className="font-serif-bn font-bold text-lg flex items-center gap-2">
          <Wallet className="w-5 h-5 text-[#B4690E]" /> সদকাহ ও যাকাত হিসাব
        </h2>

        <div className="p-3.5 rounded-xl bg-[#FDF3E7] text-[#7A4404] space-y-2 text-xs sensitive-data">
          <label className="font-semibold block">যাকাতযোগ্য নিট সম্পদ (টাকা)</label>
          <input
            type="number"
            value={zakatWealth || ''}
            onChange={(e) => onChangeZakatWealth(Number(e.target.value) || 0)}
            placeholder="যেমন: 500000"
            className="w-full px-3 py-2 rounded-lg border border-[#E0B074] bg-white text-[#0F1A17]"
          />
          <div className="flex justify-between items-center pt-1 font-bold">
            <span>প্রদেয় যাকাত (২.৫%):</span>
            <span className="font-mono-code text-base">৳ {zakatDue.toLocaleString('en-US')}</span>
          </div>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            const amt = Number(sadAmount);
            if (!amt || amt <= 0) return;
            onAddSadaqah({
              id: 'sad-' + Date.now(),
              date: new Date().toLocaleDateString('bn-BD'),
              amount: amt,
              note: sadNote.trim() || 'সাধারণ সদকাহ',
            });
            setSadAmount('');
            setSadNote('');
            onNotify('সদকাহ লগ যুক্ত হয়েছে');
          }}
          className="space-y-2 text-xs"
        >
          <p className="font-semibold">নতুন সদকাহ লগ করুন (মোট: ৳ {totalSadaqah.toLocaleString('en-US')})</p>
          <div className="flex gap-2">
            <input
              type="number"
              required
              value={sadAmount}
              onChange={(e) => setSadAmount(e.target.value)}
              placeholder="পরিমাণ (৳)"
              className="w-28 px-3 py-2 rounded-lg border border-[#D2DDD8] bg-transparent"
            />
            <input
              value={sadNote}
              onChange={(e) => setSadNote(e.target.value)}
              placeholder="বিবরণ (যেমন: এতিমখানা)"
              className="flex-1 px-3 py-2 rounded-lg border border-[#D2DDD8] bg-transparent"
            />
          </div>
          <button type="submit" className="w-full py-2 rounded-lg bg-[#0E5A45] text-white font-semibold">
            সদকাহ যুক্ত করুন
          </button>
        </form>

        <div className="space-y-1.5 max-h-36 overflow-y-auto text-xs">
          {sadaqahList.slice(0, 6).map((s) => (
            <div key={s.id} className="flex justify-between p-2 rounded-lg border border-[#DCE3E0]">
              <span>{s.note} ({s.date})</span>
              <span className="font-mono-code font-semibold">৳ {s.amount}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Wasiyyah */}
      <div className={`p-6 rounded-2xl border space-y-3 ${cardCls}`}>
        <div className="flex items-center justify-between">
          <h2 className="font-serif-bn font-bold text-lg flex items-center gap-2">
            <Shield className="w-5 h-5 text-[#0E5A45]" /> ওসিয়তনামা (Wasiyyah)
          </h2>
          {wasiyyah.updatedAt && <span className="text-[10px] opacity-65">আপডেট: {wasiyyah.updatedAt}</span>}
        </div>
        <p className="text-xs opacity-75">
          হাদিস অনুযায়ী কোনো মুমিনের উচিত নয় ওসিয়ত ছাড়া দুই রাত অতিবাহিত করা। আপনার আমানত, ঋণ ও শেষ কথা নিরাপদে লিখুন।
        </p>

        <div className="space-y-2.5 text-xs sensitive-data">
          <div>
            <label className="font-semibold block mb-1">সম্পদ ও আমানতের বিবরণ</label>
            <textarea rows={2} value={assets} onChange={(e) => setAssets(e.target.value)} placeholder="ব্যাংক হিসাব, জমি, প্রাপ্য/দেয় ঋণ..." className="w-full px-3 py-2 rounded-lg border border-[#D2DDD8] bg-transparent" />
          </div>
          <div>
            <label className="font-semibold block mb-1">অসম্পূর্ণ দায়িত্ব / কাযা ইবাদত</label>
            <textarea rows={2} value={duties} onChange={(e) => setDuties(e.target.value)} placeholder="বাকি রোজা, কাফফারা বা কারো হক..." className="w-full px-3 py-2 rounded-lg border border-[#D2DDD8] bg-transparent" />
          </div>
          <div>
            <label className="font-semibold block mb-1">পরিবারের প্রতি শেষ উপদেশ</label>
            <textarea rows={2} value={words} onChange={(e) => setWords(e.target.value)} placeholder="তাকওয়া, নামাজ ও সুন্নাহর ওপর অটল থাকার উপদেশ..." className="w-full px-3 py-2 rounded-lg border border-[#D2DDD8] bg-transparent" />
          </div>
          <button
            onClick={() => {
              onSaveWasiyyah({
                assets,
                unfulfilledDuties: duties,
                finalWords: words,
                updatedAt: new Date().toLocaleDateString('bn-BD'),
              });
              onNotify('ওসিয়তনামা নিরাপদে সংরক্ষণ হয়েছে');
            }}
            className="w-full py-2.5 rounded-xl bg-[#0E5A45] text-white font-semibold"
          >
            ওসিয়ত সংরক্ষণ করুন
          </button>
        </div>
      </div>
    </div>
  );
}
