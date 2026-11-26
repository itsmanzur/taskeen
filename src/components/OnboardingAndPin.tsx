import React, { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Lock, ShieldCheck, Sparkles } from 'lucide-react';
import { AsrMadhab, CITY_PRESETS } from '../lib/prayerTimes';

interface OnboardingProps {
  onComplete: (city: string, madhab: AsrMadhab, target: number) => void;
}

export function OnboardingWizard({ onComplete }: OnboardingProps) {
  const [city, setCity] = useState('ঢাকা');
  const [madhab, setMadhab] = useState<AsrMadhab>('Hanafi');
  const [target, setTarget] = useState<number>(33);

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white text-[#0F1A17] w-full max-w-md rounded-2xl p-6 space-y-5 shadow-xl">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#0E5A45] text-white flex items-center justify-center font-serif-bn font-bold text-xl">ت</div>
          <div>
            <h2 className="font-serif-bn font-bold text-lg">তাসকীনে স্বাগতম!</h2>
            <p className="text-xs opacity-70">৩০ সেকেন্ডে আপনার ব্যক্তিগত সেটিংস ঠিক করে নিন</p>
          </div>
        </div>

        <div className="space-y-3 text-xs">
          <div>
            <label className="font-semibold block mb-1">আপনার শহর (নামাজ ও কিবলার জন্য)</label>
            <select
              value={city}
              onChange={(e) => setCity(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-[#D2DDD8]"
            >
              {CITY_PRESETS.map((c) => (
                <option key={c.name} value={c.name}>{c.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="font-semibold block mb-1">আসর নামাজের মাযহাব</label>
            <div className="grid grid-cols-2 gap-2">
              {(['Hanafi', 'Shafi'] as AsrMadhab[]).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMadhab(m)}
                  className={`py-2 rounded-xl border font-semibold ${
                    madhab === m ? 'bg-[#0E5A45] text-white border-[#0E5A45]' : 'border-[#D2DDD8]'
                  }`}
                >
                  {m === 'Hanafi' ? 'হানাফী' : 'শাফেয়ী / জমহুর'}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="font-semibold block mb-1">দৈনিক তাসবীহ লক্ষ্য</label>
            <div className="grid grid-cols-3 gap-2">
              {[33, 100, 300].map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTarget(t)}
                  className={`py-2 rounded-xl border font-mono-code font-semibold ${
                    target === t ? 'bg-[#0E5A45] text-white border-[#0E5A45]' : 'border-[#D2DDD8]'
                  }`}
                >
                  {t} বার
                </button>
              ))}
            </div>
          </div>
        </div>

        <button
          onClick={() => onComplete(city, madhab, target)}
          className="w-full py-2.5 rounded-xl bg-[#0E5A45] text-white text-xs font-bold flex items-center justify-center gap-1.5"
        >
          <Sparkles className="w-4 h-4" /> বিসমিল্লাহ — শুরু করুন
        </button>
      </div>
    </div>
  );
}

interface PinLockScreenProps {
  expectedPin: string;
  onUnlock: () => void;
}

export function PinLockScreen({ expectedPin, onUnlock }: PinLockScreenProps) {
  const [input, setInput] = useState('');
  const [err, setErr] = useState('');
  const [attempts, setAttempts] = useState(0);
  const [lockUntil, setLockUntil] = useState<number>(0);
  const [nowSec, setNowSec] = useState<number>(() => Math.floor(Date.now() / 1000));

  useEffect(() => {
    if (lockUntil <= nowSec) return;
    const id = window.setInterval(() => setNowSec(Math.floor(Date.now() / 1000)), 1000);
    return () => window.clearInterval(id);
  }, [lockUntil, nowSec]);

  const cooldownLeft = Math.max(0, lockUntil - nowSec);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (cooldownLeft > 0) return;

    let ok = false;
    if (expectedPin.startsWith('$argon2')) {
      try {
        ok = await invoke<boolean>('verify_app_pin', { pin: input, storedHash: expectedPin });
      } catch {
        ok = false;
      }
    } else {
      ok = input === expectedPin;
    }

    if (ok) {
      setErr('');
      setAttempts(0);
      onUnlock();
    } else {
      const nextAttempts = attempts + 1;
      setAttempts(nextAttempts);
      if (nextAttempts >= 5) {
        const waitSecs = Math.min(300, 30 * Math.pow(2, nextAttempts - 5));
        const until = Math.floor(Date.now() / 1000) + waitSecs;
        setLockUntil(until);
        setNowSec(Math.floor(Date.now() / 1000));
        setErr(`অনেকবার ভুল পিন! ${waitSecs} সেকেন্ড অপেক্ষা করুন।`);
      } else {
        setErr(`ভুল পিন! আবার চেষ্টা করুন (${nextAttempts}/5)।`);
      }
      setInput('');
    }
  };

  return (
    <div className="min-h-screen bg-[#0D1613] text-white flex items-center justify-center p-4">
      <form onSubmit={handleSubmit} className="bg-[#121F1B] border border-[#243832] w-full max-w-xs rounded-2xl p-6 space-y-4 text-center">
        <div className="w-12 h-12 rounded-2xl bg-[#0E5A45] mx-auto flex items-center justify-center">
          <Lock className="w-6 h-6 text-white" />
        </div>
        <div>
          <h2 className="font-serif-bn font-bold text-lg">তাসকীন প্রাইভেসি লক</h2>
          <p className="text-xs opacity-70 mt-1">অ্যাপ খুলতে আপনার ৪–৬ ডিজিটের পিন দিন</p>
        </div>
        <input
          type="password"
          inputMode="numeric"
          maxLength={6}
          autoFocus
          disabled={cooldownLeft > 0}
          value={input}
          onChange={(e) => setInput(e.target.value.replace(/\D/g, ''))}
          placeholder="••••"
          className="w-full text-center tracking-[0.5em] text-xl font-mono-code px-3 py-2.5 rounded-xl bg-[#0C1411] border border-[#243832] text-white disabled:opacity-50"
        />
        {err && <p className="text-xs text-red-400">{err}</p>}
        <button
          type="submit"
          disabled={cooldownLeft > 0 || input.length < 4}
          className="w-full py-2.5 rounded-xl bg-[#0E5A45] text-white text-xs font-bold disabled:opacity-50"
        >
          {cooldownLeft > 0 ? `অপেক্ষা করুন (${cooldownLeft}s)` : 'আনলক করুন'}
        </button>
      </form>
    </div>
  );
}

interface PinModalProps {
  hasPin: boolean;
  onSavePin: (pin: string) => void;
  onClose: () => void;
}

export function PinSettingsModal({ hasPin, onSavePin, onClose }: PinModalProps) {
  const [pin, setPin] = useState('');
  const [busy, setBusy] = useState(false);

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white text-[#0F1A17] w-full max-w-sm rounded-2xl p-6 space-y-4 text-xs">
        <div className="flex justify-between items-center">
          <h3 className="font-serif-bn font-bold text-base flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-[#0E5A45]" /> অ্যাপ পিন লক
          </h3>
          <button onClick={onClose}>✕</button>
        </div>
        <p className="opacity-75">
          আপনার ব্যক্তিগত মুহাসাবাহ ও ওসিয়তনামা সুরক্ষিত রাখতে ৪–৬ ডিজিটের পিন সেট করুন (Argon2 দ্বারা সুরক্ষিত)।
        </p>
        <input
          type="password"
          inputMode="numeric"
          maxLength={6}
          value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
          placeholder="নতুন ৪–৬ ডিজিটের পিন (শুধু সংখ্যা)"
          className="w-full px-3 py-2 rounded-xl border border-[#D2DDD8] font-mono-code"
        />
        <div className="flex gap-2">
          {hasPin && (
            <button
              onClick={() => {
                onSavePin('');
                onClose();
              }}
              className="flex-1 py-2 rounded-xl border border-red-400 text-red-700 font-semibold"
            >
              পিন বন্ধ করুন
            </button>
          )}
          <button
            disabled={busy || pin.length < 4}
            onClick={async () => {
              if (!/^\d{4,6}$/.test(pin)) return;
              setBusy(true);
              try {
                const hashed = await invoke<string>('hash_app_pin', { pin });
                onSavePin(hashed);
              } catch {
                onSavePin(pin);
              } finally {
                setBusy(false);
                onClose();
              }
            }}
            className="flex-1 py-2 rounded-xl bg-[#0E5A45] text-white font-semibold disabled:opacity-50"
          >
            {busy ? 'সংরক্ষণ হচ্ছে...' : 'পিন সেভ করুন'}
          </button>
        </div>
      </div>
    </div>
  );
}
