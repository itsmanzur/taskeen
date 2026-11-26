import React, { useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { getCryptoStatus } from '../lib/secureStorage';
import { BookOpen, Check, Copy, ExternalLink, HeartHandshake, Info, MessageSquareHeart, ShieldCheck, Sparkles, User } from 'lucide-react';

interface AboutViewProps {
  nativeDbHash: string;
  dbVerified?: boolean | null;
  onOpenFeedbackModal: () => void;
}

export default function AboutView({ nativeDbHash, dbVerified, onOpenFeedbackModal }: AboutViewProps) {
  const [copiedNum, setCopiedNum] = useState(false);

  const donateNumber = '01930478957';

  const handleCopyDonate = async () => {
    try {
      await navigator.clipboard.writeText(donateNumber);
      setCopiedNum(true);
      setTimeout(() => setCopiedNum(false), 2000);
    } catch {}
  };

  const openExternal = (url: string) => {
    invoke('open_external_url', { url }).catch(() => {
      window.open(url, '_blank', 'noopener,noreferrer');
    });
  };

  return (
    <div className="p-6 max-w-5xl mx-auto w-full space-y-6">
      {/* App Identity Hero Card */}
      <div className="ts-hero pattern-hero rounded-2xl p-6 text-white shadow-md flex flex-wrap items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-white/15 border border-white/25 flex items-center justify-center font-serif-bn font-bold text-3xl shadow-inner">
            ت
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="font-serif-bn text-2xl font-bold">তাসকীন (Taskeen)</h1>
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-white/20 font-mono-code font-semibold">
                v0.4.2
              </span>
            </div>
            <p className="text-sm opacity-90">
              ১০০% অফলাইন-ফার্স্ট, বিজ্ঞাপনমুক্ত ও প্রাইভেসি-সুরক্ষিত ইসলামিক ডেস্কটপ কম্প্যানিয়ন
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onOpenFeedbackModal}
          className="px-4 py-2 rounded-xl bg-white/95 text-[#1A2340] text-xs font-bold flex items-center gap-1.5 shadow-sm hover:bg-white transition"
        >
          <MessageSquareHeart className="w-4 h-4" /> ফিডব্যাক / সংশোধনী পাঠান
        </button>
      </div>

      {/* App Overview + Highlights */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="ts-bento-card ts-card-accent-left p-5 space-y-2">
          <div className="flex items-center gap-2 font-serif-bn font-bold text-base">
            <BookOpen className="w-4 h-4 ts-accent-text" /> তাহকীক ও ইলম
          </div>
          <p className="text-xs ts-muted-text leading-relaxed">
            ১৭১+ যাচাইকৃত দোয়া, দরূদ ও ইস্তেগফার — সহীহ/হাসান সনদ, ফযিলত, বাংলা উচ্চারণ ও অফলাইন SQLite FTS5 সার্চসহ।
          </p>
        </div>

        <div className="ts-bento-card ts-card-gold-left p-5 space-y-2">
          <div className="flex items-center gap-2 font-serif-bn font-bold text-base">
            <Sparkles className="w-4 h-4 ts-accent-text" /> দৈনন্দিন আমল ও কুরআন
          </div>
          <p className="text-xs ts-muted-text leading-relaxed">
            অফলাইন নামাজের সময় ও কিবলা, কুরআন খতম প্ল্যানার (৬০৪ পৃষ্ঠা), রুকইয়াহ প্লেয়ার, তাসবীহ, রোজা ও নোটবুক।
          </p>
        </div>

        <div className="ts-bento-card p-5 space-y-2">
          <div className="flex items-center gap-2 font-serif-bn font-bold text-base">
            <ShieldCheck className="w-4 h-4 ts-accent-text" /> প্রাইভেসি ও নিরাপত্তা
          </div>
          <p className="text-xs ts-muted-text leading-relaxed">
            কোনো ট্র্যাকিং বা বিজ্ঞাপন নেই। সব তথ্য আপনার ডিভাইসেই থাকে; সাথে রয়েছে Argon2 পিন লক এবং AES-256-GCM এনক্রিপ্টেড ব্যাকআপ।
          </p>
          <div className="text-[11px] font-mono-code ts-accent-text pt-1">
            {getCryptoStatus().enabled
              ? '✓ ব্যক্তিগত ডেটা এনক্রিপ্টেড (AES-256-GCM, OS কীচেইন)'
              : `⚠ ডেটা এনক্রিপশন বন্ধ${getCryptoStatus().error ? ` — ${getCryptoStatus().error}` : ''}`}
          </div>
          {nativeDbHash && (
            <div className="text-[11px] font-mono-code ts-accent-text pt-1">
              DB SHA-256: {nativeDbHash.slice(0, 14)}...{' '}
              {dbVerified === true && '✓ বিল্ড-হ্যাশের সাথে মিলেছে'}
              {dbVerified === false && '⚠ বিল্ড-হ্যাশের সাথে মেলেনি'}
            </div>
          )}
        </div>
      </div>

      {/* Developer Profile + Donate / Sadaqah Jariyah */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Developer Info */}
        <div className="lg:col-span-6 ts-bento-card p-6 space-y-4">
          <div className="flex items-center gap-2 font-serif-bn font-bold text-lg">
            <User className="w-5 h-5 ts-accent-text" /> ডেভেলপার পরিচিতি
          </div>

          <div className="p-4 ts-subsurface flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-[#0E5A45] text-white flex items-center justify-center font-bold text-lg shrink-0">
              MI
            </div>
            <div>
              <div className="font-bold text-base">Manzurul Islam</div>
              <div className="text-xs ts-muted-text">নির্মাতা ও সফটওয়্যার ডেভেলপার · তাসকীন (Taskeen)</div>
            </div>
          </div>

          <p className="text-xs ts-muted-text leading-relaxed">
            ইসলামিক জ্ঞান ও দৈনন্দিন ইবাদতকে বিজ্ঞাপনমুক্ত, নির্ভুল এবং সম্পূর্ণ অফলাইনে সবার হাতের নাগালে পৌঁছে দেওয়ার লক্ষ্যে তাসকীন তৈরি করা হয়েছে। যেকোনো পরামর্শ, বাগ রিপোর্ট বা হাদীস রেফারেন্স সংশোধনের জন্য যোগাযোগ করতে পারেন:
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <button
              type="button"
              onClick={() => openExternal('https://www.facebook.com/itsmanzur')}
              className="p-3 rounded-xl border border-[#D2DDD8] flex items-center justify-between text-left hover:bg-[#0E5A45]/10 transition"
            >
              <div>
                <div className="text-xs font-bold">Facebook</div>
                <div className="text-[11px] ts-muted-text">/itsmanzur</div>
              </div>
              <ExternalLink className="w-4 h-4 ts-accent-text" />
            </button>

            <button
              type="button"
              onClick={() => openExternal('https://www.linkedin.com/in/md-manzurul-islam-114837150/')}
              className="p-3 rounded-xl border border-[#D2DDD8] flex items-center justify-between text-left hover:bg-[#0E5A45]/10 transition"
            >
              <div>
                <div className="text-xs font-bold">LinkedIn</div>
                <div className="text-[11px] ts-muted-text">md-manzurul-islam</div>
              </div>
              <ExternalLink className="w-4 h-4 ts-accent-text" />
            </button>
          </div>
        </div>

        {/* Donate / Sadaqah Jariyah */}
        <div className="lg:col-span-6 ts-bento-card ts-card-gold-left p-6 flex flex-col justify-between space-y-4">
          <div className="space-y-2.5">
            <div className="flex items-center gap-2 font-serif-bn font-bold text-lg">
              <HeartHandshake className="w-5 h-5 ts-accent-text" /> সাদাকায়ে জারিয়াহ ও ডোনেশন
            </div>
            <p className="text-sm leading-relaxed opacity-90">
              “তাসকীন” সম্পূর্ণ বিনামূল্যে এবং আজীবন বিজ্ঞাপনমুক্ত রাখার অঙ্গীকার নিয়ে তৈরি। অ্যাপটির নিয়মিত আপডেট, নতুন ইসলামিক কনটেন্ট গবেষণা এবং বিনামূল্যে সবার মাঝে ছড়িয়ে দেওয়ার এই যাত্রায় আপনার সামর্থ্য অনুযায়ী সহযোগিতা ও আন্তরিক দোয়া আমাদের বড় অনুপ্রেরণা।
            </p>
          </div>

          <div className="p-4 rounded-xl ts-subsurface border border-[#D2DDD8]/70 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-1 rounded-lg bg-[#E2136E] text-white text-[11px] font-bold">
                  বিকাশ (bKash)
                </span>
                <span className="px-2.5 py-1 rounded-lg bg-[#F7941D] text-white text-[11px] font-bold">
                  নগদ (Nagad)
                </span>
              </div>
              <span className="text-[11px] ts-muted-text">পার্সোনাল নাম্বার</span>
            </div>

            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="font-mono-code text-xl font-bold tracking-wider">{donateNumber}</div>
              <button
                type="button"
                onClick={handleCopyDonate}
                className="px-4 py-2 rounded-xl bg-[#0E5A45] hover:bg-[#0A4736] text-white text-xs font-semibold flex items-center gap-1.5 transition"
              >
                {copiedNum ? (
                  <>
                    <Check className="w-4 h-4" /> নাম্বার কপি হয়েছে
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" /> ডোনেট নাম্বার কপি করুন
                  </>
                )}
              </button>
            </div>
          </div>

          <div className="text-[11px] ts-muted-text flex items-center gap-1.5">
            <Info className="w-3.5 h-3.5 shrink-0" />
            <span>জাযাকুমুল্লাহু খাইরান — আল্লাহ আপনার দান ও নেক আমল কবুল করুন।</span>
          </div>
        </div>
      </div>
    </div>
  );
}
