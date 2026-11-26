import React, { useMemo, useState } from 'react';
import { Bell, Clock, Eye, LayoutGrid, Lock, Palette, RotateCcw, Settings, Shield, Sparkles, Type } from 'lucide-react';
import { AsrMadhab, CalculationMethod, CITY_PRESETS, computeOfflinePrayerTimes } from '../lib/prayerTimes';
import { ReminderSettings } from '../types';

export type AppTheme = 'andalusia' | 'sandstone' | 'midnight' | 'subhe-sadiq';
export type UiFontFamily =
  | 'Noto Sans Bengali'
  | 'Noto Serif Bengali'
  | 'Kalpurush'
  | 'Hind Siliguri'
  | 'Anek Bangla';

export interface DashboardWidgetsPrefs {
  heroPrayer: boolean;
  quickTasbih: boolean;
  dailyAmalTodo: boolean;
  streakSadaqah: boolean;
  fastingAndEvent: boolean;
  quickShortcuts: boolean;
}

export const DEFAULT_DASHBOARD_WIDGETS: DashboardWidgetsPrefs = {
  heroPrayer: true,
  quickTasbih: true,
  dailyAmalTodo: true,
  streakSadaqah: true,
  fastingAndEvent: true,
  quickShortcuts: true,
};

export interface UiPrefs {
  uiFont: UiFontFamily;
  uiFontSize: number; // root px: 13..19 (default 16)
  customAccent: string; // '' means theme default
  patternEnabled: boolean;
  dashboardWidgets?: DashboardWidgetsPrefs;
}

export const DEFAULT_UI_PREFS: UiPrefs = {
  uiFont: 'Noto Sans Bengali',
  uiFontSize: 16,
  customAccent: '',
  patternEnabled: true,
  dashboardWidgets: DEFAULT_DASHBOARD_WIDGETS,
};

interface PrayerPrefs {
  name: string;
  lat: number;
  lng: number;
  tz: number;
  method: CalculationMethod;
  madhab: AsrMadhab;
}

interface SettingsViewProps {
  theme: AppTheme;
  onChangeTheme: (t: AppTheme) => void;
  uiPrefs: UiPrefs;
  onChangeUiPrefs: (next: UiPrefs) => void;
  arabicFont: 'amiri' | 'scheherazade';
  onChangeArabicFont: (f: 'amiri' | 'scheherazade') => void;
  arabicSize: number;
  onChangeArabicSize: (s: number) => void;
  privacyBlur: boolean;
  onTogglePrivacyBlur: () => void;
  hasPin: boolean;
  onOpenPinModal: () => void;
  onOpenBackupModal: () => void;
  reminders: ReminderSettings;
  onChangeReminders: (next: ReminderSettings) => void;
}

const THEME_CARDS: { id: AppTheme; title: string; subtitle: string; previewBg: string; previewAccent: string }[] = [
  { id: 'andalusia', title: 'আন্দালুসিয়া', subtitle: 'উষ্ণ পারচমেন্ট ও পোড়ামাটি', previewBg: '#F5EFE2', previewAccent: '#A6603A' },
  { id: 'sandstone', title: 'স্যান্ডস্টোন', subtitle: 'মদিনা অলিভ ও পাথুরে উষ্ণতা', previewBg: '#EBE6DA', previewAccent: '#3D5E36' },
  { id: 'midnight', title: 'মিডনাইট', subtitle: 'তাহাজ্জুদ ডার্ক ও সোনালি', previewBg: '#141720', previewAccent: '#C4883A' },
  { id: 'subhe-sadiq', title: 'সুবহে সাদিক', subtitle: 'ভোরের গভীর নীল ও টার্কোয়াজ', previewBg: '#172038', previewAccent: '#4A9FCC' },
];

const UI_FONTS: { id: UiFontFamily; label: string; note: string }[] = [
  { id: 'Noto Sans Bengali', label: 'Noto Sans Bengali (ডিফল্ট)', note: 'স্ক্রিনে সবচেয়ে স্পষ্ট ও ঝকঝকে' },
  { id: 'Kalpurush', label: 'কালপুরুষ (Kalpurush)', note: 'ক্লাসিক ও জনপ্রিয় বাংলা ফন্ট (অফলাইন বান্ডেলড)' },
  { id: 'Noto Serif Bengali', label: 'Noto Serif Bengali', note: 'পাণ্ডুলিপি ও বইয়ের মতো মার্জিত' },
  { id: 'Hind Siliguri', label: 'Hind Siliguri', note: 'আধুনিক ও মসৃণ UI ফন্ট' },
  { id: 'Anek Bangla', label: 'Anek Bangla', note: 'হালকা ও জ্যামিতিক' },
];

const ACCENT_SWATCHES = ['#A6603A', '#3D5E36', '#0E5A45', '#C4883A', '#4A9FCC', '#7C3AED', '#B91C1C'];

export default function SettingsView({
  theme,
  onChangeTheme,
  uiPrefs,
  onChangeUiPrefs,
  arabicFont,
  onChangeArabicFont,
  arabicSize,
  onChangeArabicSize,
  privacyBlur,
  onTogglePrivacyBlur,
  hasPin,
  onOpenPinModal,
  onOpenBackupModal,
  reminders,
  onChangeReminders,
}: SettingsViewProps) {
  const [prayerPrefs, setPrayerPrefs] = useState<PrayerPrefs>(() => {
    try {
      const saved = localStorage.getItem('taskeen_prayer_prefs_v1');
      if (saved) return JSON.parse(saved);
    } catch {}
    return { name: 'ঢাকা', lat: 23.8103, lng: 90.4125, tz: 6, method: 'Karachi', madhab: 'Hanafi' };
  });

  const [savedToast, setSavedToast] = useState('');

  const updatePrayerPrefs = (next: PrayerPrefs) => {
    setPrayerPrefs(next);
    try {
      localStorage.setItem('taskeen_prayer_prefs_v1', JSON.stringify(next));
      setSavedToast('নামাজের সময় সেটিংস সেভ হয়েছে ✓');
      setTimeout(() => setSavedToast(''), 2000);
    } catch {}
  };

  const previewTimes = useMemo(
    () =>
      computeOfflinePrayerTimes(
        new Date(),
        prayerPrefs.lat,
        prayerPrefs.lng,
        prayerPrefs.tz,
        prayerPrefs.method,
        prayerPrefs.madhab
      ),
    [prayerPrefs]
  );

  return (
    <div className="p-6 max-w-5xl mx-auto w-full space-y-6 animate-view">
      {/* Header */}
      <div className="ts-bento-card ts-card-accent-left p-5 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-serif-bn text-xl font-bold flex items-center gap-2">
            <Settings className="w-5 h-5 ts-accent-text" /> অ্যাপ সেটিংস ও কাস্টমাইজেশন
          </h1>
          <p className="text-xs ts-muted-text mt-1">
            এক জায়গা থেকেই থিম, কাস্টম কালার, বাংলা-আরবি ফন্ট, ফন্ট সাইজ, নামাজের সময় ও প্রাইভেসি নিয়ন্ত্রণ করুন।
          </p>
        </div>
        {savedToast && (
          <span className="text-xs px-3 py-1.5 rounded-full bg-[#0E5A45] text-white font-semibold">
            {savedToast}
          </span>
        )}
      </div>

      {/* 1. Theme, Color & Pattern */}
      <section className="ts-bento-card p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-serif-bn font-bold text-base flex items-center gap-2">
            <Palette className="w-4 h-4 ts-accent-text" /> থিম, অ্যাকসেন্ট কালার ও প্যাটার্ন
          </h2>
          <label className="flex items-center gap-2 text-xs font-semibold cursor-pointer">
            <input
              type="checkbox"
              checked={uiPrefs.patternEnabled}
              onChange={(e) => onChangeUiPrefs({ ...uiPrefs, patternEnabled: e.target.checked })}
              className="w-4 h-4 accent-[#0E5A45]"
            />
            <span>ইসলামিক জ্যামিতিক প্যাটার্ন</span>
          </label>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {THEME_CARDS.map((t) => {
            const active = theme === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => onChangeTheme(t.id)}
                className={`p-3.5 rounded-xl border text-left transition space-y-2 ${
                  active ? 'border-[#0E5A45] ring-2 ring-[#0E5A45]/30' : 'border-[#D2DDD8] hover:opacity-90'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span
                      className="w-5 h-5 rounded-full border border-black/15 inline-block"
                      style={{ background: `linear-gradient(135deg, ${t.previewBg} 50%, ${t.previewAccent} 50%)` }}
                    />
                    <span className="font-bold text-sm">{t.title}</span>
                  </div>
                  {active && <span className="text-[11px] font-bold ts-accent-text">সক্রিয় ✓</span>}
                </div>
                <div className="text-[11px] ts-muted-text">{t.subtitle}</div>
              </button>
            );
          })}
        </div>

        <div className="pt-2 border-t border-[#D2DDD8]/50 flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="text-xs font-semibold">কাস্টম অ্যাকসেন্ট কালার (বাটন ও হাইলাইট)</div>
            <div className="flex flex-wrap items-center gap-2">
              {ACCENT_SWATCHES.map((hex) => (
                <button
                  key={hex}
                  type="button"
                  onClick={() => onChangeUiPrefs({ ...uiPrefs, customAccent: hex })}
                  className={`w-7 h-7 rounded-full border-2 transition ${
                    uiPrefs.customAccent === hex ? 'border-current scale-110' : 'border-transparent'
                  }`}
                  style={{ backgroundColor: hex }}
                  title={hex}
                />
              ))}
              <input
                type="color"
                value={uiPrefs.customAccent || '#A6603A'}
                onChange={(e) => onChangeUiPrefs({ ...uiPrefs, customAccent: e.target.value })}
                className="w-8 h-8 rounded-lg cursor-pointer border border-[#D2DDD8] bg-transparent p-0.5"
                title="নিজের পছন্দের কালার বেছে নিন"
              />
            </div>
          </div>

          {uiPrefs.customAccent && (
            <button
              type="button"
              onClick={() => onChangeUiPrefs({ ...uiPrefs, customAccent: '' })}
              className="px-3 py-1.5 rounded-xl border border-[#D2DDD8] text-xs font-semibold flex items-center gap-1.5 hover:bg-[#0E5A45]/10"
            >
              <RotateCcw className="w-3.5 h-3.5" /> থিমের ডিফল্ট কালার ফিরিয়ে আনুন
            </button>
          )}
        </div>
      </section>

      {/* 2. Font & Size Controls */}
      <section className="ts-bento-card p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-serif-bn font-bold text-base flex items-center gap-2">
            <Type className="w-4 h-4 ts-accent-text" /> ফন্ট ও ফন্ট সাইজ কন্ট্রোল
          </h2>
          <button
            type="button"
            onClick={() => {
              onChangeUiPrefs({ ...uiPrefs, uiFont: 'Noto Sans Bengali', uiFontSize: 16 });
              onChangeArabicFont('amiri');
              onChangeArabicSize(28);
            }}
            className="text-xs ts-accent-text font-semibold hover:underline flex items-center gap-1"
          >
            <RotateCcw className="w-3.5 h-3.5" /> ডিফল্ট ফন্ট
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Bangla UI Font */}
          <div className="space-y-2">
            <label className="text-xs font-semibold block">বাংলা অ্যাপ ফন্ট</label>
            <select
              value={uiPrefs.uiFont}
              onChange={(e) => onChangeUiPrefs({ ...uiPrefs, uiFont: e.target.value as UiFontFamily })}
              className="w-full px-3 py-2 text-sm rounded-xl border border-[#D2DDD8] bg-transparent"
            >
              {UI_FONTS.map((f) => (
                <option key={f.id} value={f.id} className="text-black">
                  {f.label}
                </option>
              ))}
            </select>
            <p className="text-[11px] ts-muted-text">
              {UI_FONTS.find((f) => f.id === uiPrefs.uiFont)?.note}
            </p>
          </div>

          {/* Arabic Font */}
          <div className="space-y-2">
            <label className="text-xs font-semibold block">আরবি দোয়া ও কুরআন ফন্ট</label>
            <select
              value={arabicFont}
              onChange={(e) => onChangeArabicFont(e.target.value as 'amiri' | 'scheherazade')}
              className="w-full px-3 py-2 text-sm rounded-xl border border-[#D2DDD8] bg-transparent"
            >
              <option value="amiri" className="text-black">Noto Naskh Arabic (স্পষ্ট নসখ)</option>
              <option value="scheherazade" className="text-black">Lateef (ক্লাসিক ক্যালিগ্রাফি)</option>
            </select>
            <p className="text-[11px] ts-muted-text">সব দোয়া, কুরআন ও তাসবীহ কার্ডে প্রয়োগ হবে।</p>
          </div>

          {/* UI Font Size Slider */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs font-semibold">
              <span>অ্যাপের লেখা সাইজ (UI Scale)</span>
              <span className="font-mono-code ts-accent-text">{uiPrefs.uiFontSize}px</span>
            </div>
            <input
              type="range"
              min={13}
              max={19}
              step={1}
              value={uiPrefs.uiFontSize}
              onChange={(e) => onChangeUiPrefs({ ...uiPrefs, uiFontSize: Number(e.target.value) })}
              className="w-full accent-[#0E5A45]"
            />
          </div>

          {/* Arabic Font Size Slider */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs font-semibold">
              <span>আরবি লেখা সাইজ</span>
              <span className="font-mono-code ts-accent-text">{arabicSize}px</span>
            </div>
            <input
              type="range"
              min={20}
              max={42}
              step={2}
              value={arabicSize}
              onChange={(e) => onChangeArabicSize(Number(e.target.value))}
              className="w-full accent-[#0E5A45]"
            />
          </div>
        </div>

        {/* Live Preview */}
        <div className="p-4 ts-subsurface space-y-2 border border-[#D2DDD8]/50">
          <div className="text-[11px] ts-muted-text flex items-center gap-1">
            <Sparkles className="w-3.5 h-3.5 ts-accent-text" /> লাইভ ফন্ট প্রিভিউ ({uiPrefs.uiFont})
          </div>
          <p
            className={`${arabicFont === 'scheherazade' ? 'font-arabic-scheherazade' : 'font-arabic-amiri'} text-right`}
            style={{ fontSize: `${arabicSize}px` }}
          >
            رَبَّنَا آتِنَا فِي الدُّنْيَا حَسَنَةً وَفِي الْآخِرَةِ حَسَنَةً
          </p>
          <p className="text-sm font-medium">
            হে আমাদের রব! আমাদেরকে দুনিয়াতে কল্যাণ দান করুন এবং আখিরাতেও কল্যাণ দান করুন।
          </p>
        </div>
      </section>

      {/* 3. Prayer Times Settings */}
      <section className="ts-bento-card p-5 space-y-4">
        <h2 className="font-serif-bn font-bold text-base flex items-center gap-2">
          <Clock className="w-4 h-4 ts-accent-text" /> নামাজের সময় ও ক্যালকুলেশন সেটিংস (অফলাইন)
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
          <div className="space-y-1">
            <label className="text-xs font-semibold">শহর নির্বাচন</label>
            <select
              value={prayerPrefs.name}
              onChange={(e) => {
                const found = CITY_PRESETS.find((c) => c.name === e.target.value);
                if (found) {
                  updatePrayerPrefs({
                    ...prayerPrefs,
                    name: found.name,
                    lat: found.lat,
                    lng: found.lng,
                    tz: found.tz,
                  });
                }
              }}
              className="w-full px-3 py-2 rounded-xl border border-[#D2DDD8] bg-transparent"
            >
              {CITY_PRESETS.map((c) => (
                <option key={c.name} value={c.name} className="text-black">
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold">ক্যালকুলেশন মেথড</label>
            <select
              value={prayerPrefs.method}
              onChange={(e) => updatePrayerPrefs({ ...prayerPrefs, method: e.target.value as CalculationMethod })}
              className="w-full px-3 py-2 rounded-xl border border-[#D2DDD8] bg-transparent"
            >
              <option value="Karachi" className="text-black">Karachi (বাংলাদেশ / উপমহাদেশ)</option>
              <option value="MWL" className="text-black">Muslim World League (MWL)</option>
              <option value="ISNA" className="text-black">ISNA (উত্তর আমেরিকা)</option>
              <option value="Makkah" className="text-black">Umm al-Qura (মক্কা)</option>
              <option value="Egypt" className="text-black">Egyptian General Authority</option>
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold">আসরের মাযহাব</label>
            <select
              value={prayerPrefs.madhab}
              onChange={(e) => updatePrayerPrefs({ ...prayerPrefs, madhab: e.target.value as AsrMadhab })}
              className="w-full px-3 py-2 rounded-xl border border-[#D2DDD8] bg-transparent"
            >
              <option value="Hanafi" className="text-black">হানাফি (Hanafi)</option>
              <option value="Shafi" className="text-black">শাফিয়ী / জমহুর (Shafi)</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 text-center text-xs">
          {[
            ['ফজর', previewTimes.Fajr],
            ['সূর্যোদয়', previewTimes.Sunrise],
            ['যোহর', previewTimes.Dhuhr],
            ['আসর', previewTimes.Asr],
            ['মাগরিব', previewTimes.Maghrib],
            ['ইশা', previewTimes.Isha],
          ].map(([label, time]) => (
            <div key={label} className="ts-stat-pill">
              <div className="text-[11px] ts-muted-text">{label}</div>
              <div className="font-mono-code font-bold text-sm mt-0.5">{time}</div>
            </div>
          ))}
        </div>
      </section>

      {/* 4. Dashboard Customization */}
      <section className="ts-bento-card p-5 space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h2 className="font-serif-bn font-bold text-base flex items-center gap-2">
            <LayoutGrid className="w-4 h-4 ts-accent-text" /> ড্যাশবোর্ড কাস্টমাইজেশন (কোন কার্ড দেখাবে)
          </h2>
          <button
            type="button"
            onClick={() =>
              onChangeUiPrefs({
                ...uiPrefs,
                dashboardWidgets: DEFAULT_DASHBOARD_WIDGETS,
              })
            }
            className="text-xs ts-accent-text font-semibold hover:underline flex items-center gap-1"
          >
            <RotateCcw className="w-3.5 h-3.5" /> ডিফল্ট ড্যাশবোর্ড
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
          {(
            [
              ['heroPrayer', 'পরবর্তী নামাজ কাউন্টডাউন ও ৫ ওয়াক্ত পিল'],
              ['quickTasbih', 'তাৎক্ষণিক তাসবীহ কাউন্টার কার্ড'],
              ['dailyAmalTodo', 'আজকের আমল ও টু-ডু তালিকা'],
              ['streakSadaqah', 'নামাজ স্ট্রিক ও মোট সদকাহ'],
              ['fastingAndEvent', 'সুন্নাহ রোজা ও আসন্ন ইসলামিক দিবস'],
              ['quickShortcuts', 'পোমোডোরো ও নামাজ/কিবলা শর্টকাট'],
            ] as [keyof DashboardWidgetsPrefs, string][]
          ).map(([key, label]) => {
            const current = { ...DEFAULT_DASHBOARD_WIDGETS, ...(uiPrefs.dashboardWidgets || {}) };
            return (
              <label key={key} className="flex items-center justify-between p-3 ts-subsurface cursor-pointer gap-2">
                <span className="font-semibold">{label}</span>
                <input
                  type="checkbox"
                  checked={current[key]}
                  onChange={(e) =>
                    onChangeUiPrefs({
                      ...uiPrefs,
                      dashboardWidgets: { ...current, [key]: e.target.checked },
                    })
                  }
                  className="w-4 h-4 accent-[#0E5A45] shrink-0"
                />
              </label>
            );
          })}
        </div>
      </section>

      {/* 5. Privacy, Reminders & Backup */}
      <section className="ts-bento-card p-5 space-y-4">
        <h2 className="font-serif-bn font-bold text-base flex items-center gap-2">
          <Shield className="w-4 h-4 ts-accent-text" /> প্রাইভেসি, রিমাইন্ডার ও ডেটা সুরক্ষা
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
          <label className="flex items-center justify-between p-3 ts-subsurface cursor-pointer">
            <span className="flex items-center gap-2 font-semibold">
              <Eye className="w-4 h-4 ts-accent-text" /> প্রাইভেসি ব্লার মোড (সংবেদনশীল তথ্য ঝাপসা)
            </span>
            <input
              type="checkbox"
              checked={privacyBlur}
              onChange={onTogglePrivacyBlur}
              className="w-4 h-4 accent-[#0E5A45]"
            />
          </label>

          <label className="flex items-center justify-between p-3 ts-subsurface cursor-pointer">
            <span className="flex items-center gap-2 font-semibold">
              <Bell className="w-4 h-4 ts-accent-text" /> দৈনিক যিকির ও নামাজের রিমাইন্ডার
            </span>
            <input
              type="checkbox"
              checked={reminders.enabled}
              onChange={(e) => onChangeReminders({ ...reminders, enabled: e.target.checked })}
              className="w-4 h-4 accent-[#0E5A45]"
            />
          </label>
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={onOpenPinModal}
            className="px-4 py-2 rounded-xl border border-[#D2DDD8] text-xs font-semibold flex items-center gap-1.5 hover:bg-[#0E5A45]/10"
          >
            <Lock className="w-4 h-4 ts-accent-text" /> {hasPin ? 'অ্যাপ PIN পরিবর্তন/মুছুন' : 'অ্যাপ PIN লক সেট করুন'}
          </button>
          <button
            type="button"
            onClick={onOpenBackupModal}
            className="px-4 py-2 rounded-xl bg-[#0E5A45] text-white text-xs font-semibold hover:bg-[#0A4736]"
          >
            এনক্রিপ্টেড ব্যাকআপ ও ক্লাউড সিঙ্ক
          </button>
        </div>
      </section>
    </div>
  );
}
