import React from 'react';
import { Moon, Sun } from 'lucide-react';
import { ViewId } from '../../lib/constants';

export interface NavItem { id: ViewId; label: string; icon: React.ReactNode }

export default function AppSidebar({
  navItems,
  activeView,
  onSelectView,
  dailyScorePct,
  nativeDbHash,
  darkMode,
  onToggleDark,
  onOpenAbout,
}: {
  navItems: NavItem[];
  activeView: ViewId;
  onSelectView: (v: ViewId) => void;
  dailyScorePct: number;
  nativeDbHash: string;
  darkMode: boolean;
  onToggleDark: () => void;
  onOpenAbout: () => void;
}) {
  return (
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
                onClick={() => onSelectView(n.id)}
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
            <button onClick={() => onOpenAbout()} className="font-mono-code underline hover:opacity-100">
              {nativeDbHash ? `SQLite ✓ ${nativeDbHash.slice(0, 6)}` : 'তথ্য ও ফিডব্যাক'}
            </button>
            <button onClick={() => onToggleDark()} className="flex items-center gap-1 px-2 py-1 rounded-lg border border-white/20">
              {darkMode ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
              <span>{darkMode ? 'আলো' : 'রাত'}</span>
            </button>
          </div>
          <button
            onClick={() => onOpenAbout()}
            className="w-full py-1.5 rounded-lg border border-white/15 text-[11px] font-medium hover:bg-white/10"
          >
            অ্যাপ সম্পর্কে ও টেস্টার ফিডব্যাক
          </button>
        </div>
      </aside>
  );
}
