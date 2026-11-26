import { RefObject } from 'react';
import { Eye, EyeOff, Lock } from 'lucide-react';
import { getHijriLabel } from '../DashboardView';

export default function TopBar({
  searchInputRef,
  search,
  onSearchChange,
  darkMode,
  privacyBlur,
  onTogglePrivacy,
  hasPin,
  onLock,
  onToggleMini,
  onOpenBackup,
  onOpenPin,
  onOpenReminders,
  onOpenAdd,
}: {
  searchInputRef: RefObject<HTMLInputElement>;
  search: string;
  onSearchChange: (v: string) => void;
  darkMode: boolean;
  privacyBlur: boolean;
  onTogglePrivacy: () => void;
  hasPin: boolean;
  onLock: () => void;
  onToggleMini: () => void;
  onOpenBackup: () => void;
  onOpenPin: () => void;
  onOpenReminders: () => void;
  onOpenAdd: () => void;
}) {
  return (
        <header className="ts-card min-h-14 px-5 py-2.5 border-b flex flex-wrap items-center justify-between gap-3">
          <input
            ref={searchInputRef}
            type="search"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="যেকোনো দোয়া, উচ্চারণ, কিতাব বা হাদিস খুঁজুন (Ctrl+K)..."
            className={`flex-1 min-w-[200px] max-w-md px-3.5 py-1.5 text-sm rounded-xl border ${darkMode ? 'bg-[#0F1916] border-[#243832] text-white' : 'bg-[#F7FAF8] border-[#D2DDD8]'}`}
          />

          <div className="flex flex-wrap items-center gap-2">
            <span className="hidden lg:inline-block px-3 py-1.5 text-xs rounded-xl border border-[#DCE3E0] opacity-85">
              📅 {getHijriLabel()}
            </span>
            <button onClick={onToggleMini} title="Ctrl+Shift+T" className="px-3 py-1.5 text-xs rounded-xl border border-[#0E5A45] text-[#0A4736] font-semibold">
              মিনি তাসবীহ
            </button>
            <button onClick={() => onOpenBackup()} className="px-3 py-1.5 text-xs rounded-xl border border-[#D2DDD8]">ব্যাকআপ</button>
            <button
              onClick={onTogglePrivacy}
              title="সংবেদনশীল নোট ও হিসাব ঝাপসা করুন"
              className={`px-2.5 py-1.5 text-xs rounded-xl border flex items-center gap-1 ${
                privacyBlur ? 'bg-[#0E5A45] text-white border-[#0E5A45]' : 'border-[#D2DDD8]'
              }`}
            >
              {privacyBlur ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              <span>প্রাইভেসি</span>
            </button>
            <button onClick={() => onOpenPin()} title="পিন লক সেটিংস" className="px-2.5 py-1.5 text-xs rounded-xl border border-[#D2DDD8] flex items-center gap-1">
              <Lock className="w-3.5 h-3.5" /> {hasPin ? 'পিন ✓' : 'পিন'}
            </button>
            {hasPin && (
              <button onClick={() => onLock()} className="px-2.5 py-1.5 text-xs rounded-xl border border-[#D2DDD8]">লক</button>
            )}
            <button onClick={() => onOpenReminders()} className="px-3 py-1.5 text-xs rounded-xl border border-[#D2DDD8]">রিমাইন্ডার</button>
            <button onClick={() => onOpenAdd()} className="px-3 py-1.5 text-xs font-semibold rounded-xl bg-[#0E5A45] text-white">+ নতুন দোয়া</button>
          </div>
        </header>
  );
}
