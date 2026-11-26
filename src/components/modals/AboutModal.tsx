import { useState } from 'react';
import { getCryptoStatus } from '../../lib/secureStorage';
import { saveTextFile } from '../../lib/saveFile';
import { Notify } from '../../lib/constants';

export default function AboutModal({
  verifiedTotal,
  itemsCount,
  nativeDbHash,
  nativeDbVerified,
  onClose,
  notify,
}: {
  verifiedTotal: number;
  itemsCount: number;
  nativeDbHash: string;
  nativeDbVerified: boolean | null;
  onClose: () => void;
  notify: Notify;
}) {
  const [fbCat, setFbCat] = useState<string>('হাদীস/তাহকীক সংশোধন');
  const [fbText, setFbText] = useState<string>('');

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white text-[#0F1A17] w-full max-w-md rounded-2xl p-6 space-y-4 text-xs">
            <div className="flex justify-between items-center">
              <h3 className="font-serif-bn font-bold text-base">তাসকীন (Taskeen) — অ্যাপ তথ্য ও ফিডব্যাক</h3>
              <button onClick={() => onClose()}>✕</button>
            </div>
            <div className="p-3 rounded-xl bg-[#F4F7F5] space-y-1 font-mono-code text-[11px]">
              <div>ভার্সন: v0.4.2 (All-in-One Offline Edition)</div>
              <div>তাহকীক এন্ট্রি: {verifiedTotal}/{itemsCount} যাচাইকৃত</div>
              <div>
                SQLite SHA-256: {nativeDbHash || 'Browser Preview'}{' '}
                {nativeDbVerified === true && '✓ যাচাইকৃত'}
                {nativeDbVerified === false && '⚠ বিল্ড-হ্যাশের সাথে মেলেনি'}
              </div>
              <div>
                এনক্রিপশন:{' '}
                {getCryptoStatus().enabled
                  ? '✓ AES-256-GCM (কী: OS কীচেইন)'
                  : `⚠ বন্ধ${getCryptoStatus().error ? ` — ${getCryptoStatus().error}` : ' (ব্রাউজার প্রিভিউ)'}`}
              </div>
              <div>গোপনীয়তা: ১০০% অফলাইন · জিরো অ্যাডস</div>
            </div>
            <div className="space-y-2">
              <p className="font-semibold">টেস্টার ফিডব্যাক / তাহকীক সংশোধন রিপোর্ট</p>
              <select value={fbCat} onChange={(e) => setFbCat(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-[#D2DDD8]">
                <option>হাদীস/তাহকীক সংশোধন</option>
                <option>বাগ বা কারিগরি সমস্যা</option>
                <option>নতুন ফিচারের পরামর্শ</option>
              </select>
              <textarea
                rows={3}
                value={fbText}
                onChange={(e) => setFbText(e.target.value)}
                placeholder="বিস্তারিত লিখুন (যেমন: কোন দোয়ার সূত্র, বানান বা ফিচারের মতামত)..."
                className="w-full px-3 py-2 rounded-lg border border-[#D2DDD8]"
              />
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    const report = `Taskeen Feedback Report\nVersion: v0.4.2\nDB Hash: ${nativeDbHash || 'N/A'}\nCategory: ${fbCat}\nDate: ${new Date().toISOString()}\nDetails:\n${fbText}`;
                    navigator.clipboard?.writeText(report);
                    notify('ফিডব্যাক রিপোর্ট কপি হয়েছে!');
                  }}
                  className="flex-1 py-2 rounded-xl bg-[#0E5A45] text-white font-semibold"
                >
                  রিপোর্ট কপি করুন
                </button>
                <button
                  onClick={async () => {
                    const report = `Taskeen Feedback Report\nVersion: v0.4.2\nDB Hash: ${nativeDbHash || 'N/A'}\nCategory: ${fbCat}\nDate: ${new Date().toISOString()}\nDetails:\n${fbText}`;
                    const res = await saveTextFile(`taskeen-feedback-${Date.now()}.txt`, report, 'text/plain', 'টেক্সট ফাইল', ['txt']).catch((e) => {
                      notify(String(e));
                      return 'error' as const;
                    });
                    if (res !== 'saved') {
                      if (res === 'cancelled') notify('সংরক্ষণ বাতিল করা হয়েছে');
                      return;
                    }
                    setFbText('');
                    notify('ফিডব্যাক ফাইল ডাউনলোড হয়েছে');
                  }}
                  className="flex-1 py-2 rounded-xl border border-[#0E5A45] text-[#0A4736] font-semibold"
                >
                  .txt ডাউনলোড
                </button>
              </div>
            </div>
          </div>
    </div>
  );
}
