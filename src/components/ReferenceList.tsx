import { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { ReferenceInfo, RefStatus, SourceRef } from '../types';
import { loadReferences, referenceUrl } from '../lib/references';

const STATUS_UI: Record<RefStatus, { label: string; cls: string }> = {
  match: { label: '✓ টেক্সট মিলেছে', cls: 'bg-[#E6F2EE] text-[#0A4736]' },
  partial: { label: '≈ আংশিক মিল', cls: 'bg-[#FDF3E7] text-[#7A4404]' },
  mismatch: { label: '✗ মেলেনি', cls: 'bg-[#FBE9E7] text-[#8A2A1B]' },
  unchecked: { label: '◻ স্বয়ংক্রিয় তুলনা নেই', cls: 'bg-black/10' },
};

const toBn = (s: string | number) => String(s).replace(/\d/g, (d) => '০১২৩৪৫৬৭৮৯'[Number(d)]);

function label(r: SourceRef): string {
  if (r.kind === 'quran') {
    const range = r.ayah_to && r.ayah_to !== r.ayah_from ? `${r.ayah_from}-${r.ayah_to}` : `${r.ayah_from}`;
    return `সূরা ${r.surah_name_bn} (${toBn(r.surah ?? '?')}) : ${toBn(range)}`;
  }
  return toBn(r.raw);
}

function openUrl(url: string) {
  invoke('open_external_url', { url }).catch(() => {
    try { window.open(url, '_blank', 'noopener,noreferrer'); } catch {}
  });
}

export default function ReferenceList({ itemId, corrected = false }: { itemId: string; corrected?: boolean }) {
  const [info, setInfo] = useState<ReferenceInfo | null | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    setInfo(undefined);
    loadReferences().then((all) => { if (!cancelled) setInfo(all[itemId] || null); }).catch(() => { if (!cancelled) setInfo(null); });
    return () => { cancelled = true; };
  }, [itemId]);

  if (info === undefined) return <p className="text-xs opacity-60">সূত্র-তালিকা লোড হচ্ছে…</p>;
  if (!info) return <p className="text-xs opacity-60">এই এন্ট্রির জন্য কাঠামোবদ্ধ সূত্র-তথ্য নেই।</p>;

  return (
    <div className="space-y-2 text-xs">
      <p className="font-semibold">কাঠামোবদ্ধ সূত্র ও স্বয়ংক্রিয় মিল-পরীক্ষা</p>
      {corrected && (
        <p className="p-2 rounded-lg bg-[#FDF3E7] text-[#7A4404]">
          সূত্র সংশোধিত হয়েছে। নিচের মিল-পরীক্ষা আগের (মূল) সূত্রের — সংশোধনী এক্সপোর্ট করে ডেটায় প্রয়োগ ও `check_references.py` চালালে নতুন সূত্রের ফল আসবে।
        </p>
      )}
      {info.refs.map((r, i) => {
        const ui = STATUS_UI[r.check.status];
        const url = referenceUrl(r);
        return (
          <div key={i} className="p-2.5 rounded-lg border border-[#DCE3E0] space-y-1.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-semibold">{label(r)}{r.book_en ? <span className="opacity-60 font-normal"> · {r.book_en}</span> : null}</span>
              <span className={`px-2 py-0.5 rounded-full ${ui.cls}`}>
                {ui.label}{r.check.status !== 'unchecked' ? ` (${toBn(Math.round(r.check.score * 100))}%)` : ''}
              </span>
            </div>
            {r.check.weak && <p className="opacity-75">ছোট বাক্য — মিল-প্রমাণ দুর্বল, নিজে মূল কিতাবে দেখুন।</p>}
            {r.check.reason && <p className="opacity-75">{r.check.reason}</p>}
            {r.check.suggested && (
              <p className="text-[#8A2A1B]">
                ডেটাসেটে এই টেক্সট নম্বর {toBn(r.check.suggested.number)}-এ পাওয়া গেছে ({toBn(Math.round(r.check.suggested.score * 100))}% মিল)।
                নম্বরিং পদ্ধতির পার্থক্যও হতে পারে — মূল কিতাবে মিলিয়ে নিন।
              </p>
            )}
            {r.check.grades && r.check.grades.length > 0 && (
              <p className="opacity-80">মুহাদ্দিসদের হুকুম: {r.check.grades.map((g) => `${g.name} — ${g.grade}`).join(' · ')}</p>
            )}
            {r.check.excerpt && (
              <details>
                <summary className="cursor-pointer opacity-80">উৎসের মিলে-যাওয়া অংশ দেখুন</summary>
                <p dir="rtl" className="font-arabic-amiri text-base leading-loose mt-1">{r.check.excerpt}</p>
              </details>
            )}
            {url && <button onClick={() => openUrl(url)} className="underline opacity-80 hover:opacity-100">মূল উৎসে খুলুন ↗</button>}
          </div>
        );
      })}
      <p className="opacity-60">
        এটি স্বয়ংক্রিয় টেক্সট-মিল (Sunnah.com/Quran ডেটাসেটের সাথে)। এটি তাহকীক নয় — চূড়ান্ত সিদ্ধান্ত রিভিউয়ারের।
      </p>
    </div>
  );
}
