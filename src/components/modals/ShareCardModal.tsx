import { useEffect, useRef, useState } from 'react';
import { TaskeenItem } from '../../types';
import { savePngDataUrl } from '../../lib/saveFile';
import { Notify } from '../../lib/constants';

export default function ShareCardModal({ item, onClose, notify }: { item: TaskeenItem; onClose: () => void; notify: Notify }) {
  const [cardTheme, setCardTheme] = useState<'emerald' | 'ivory' | 'night'>('emerald');
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const drawShareCard = () => {
  const canvas = canvasRef.current;
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const w = canvas.width;
  const h = canvas.height;
  const themes = {
    emerald: { bg: '#0E5A45', border: '#2D8A6E', title: '#FFFFFF', arabic: '#F4F7F5', body: '#DCE8E3', meta: '#A7D0C2' },
    ivory: { bg: '#F7FAF8', border: '#0E5A45', title: '#0A4736', arabic: '#0F1A17', body: '#243630', meta: '#4A5B55' },
    night: { bg: '#0D1412', border: '#2D8A6E', title: '#8CE0C3', arabic: '#FFFFFF', body: '#CFE0D9', meta: '#8FA89E' },
  };
  const t = themes[cardTheme];
  ctx.fillStyle = t.bg;
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = t.border;
  ctx.lineWidth = 4;
  ctx.strokeRect(24, 24, w - 48, h - 48);

  ctx.fillStyle = t.meta;
  ctx.font = '600 18px "Hind Siliguri", sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('তাসকীন (Taskeen) · প্রামাণিক আমল কার্ড', 54, 68);

  ctx.fillStyle = t.title;
  ctx.font = '700 26px "Noto Serif Bengali", serif';
  ctx.fillText(item.title_bn, 54, 110);

  ctx.fillStyle = t.arabic;
  ctx.font = '700 30px "Noto Naskh Arabic", serif';
  ctx.textAlign = 'right';
  const arWords = item.arabic_uthmani.split(' ');
  const arLines: string[] = [];
  let cur = '';
  for (const word of arWords) {
    const test = cur ? `${cur} ${word}` : word;
    if (ctx.measureText(test).width > w - 120) { arLines.push(cur); cur = word; }
    else cur = test;
  }
  if (cur) arLines.push(cur);
  let y = 175;
  for (const line of arLines.slice(0, 3)) { ctx.fillText(line, w - 54, y); y += 50; }

  ctx.textAlign = 'left';
  ctx.fillStyle = t.body;
  ctx.font = '400 18px "Hind Siliguri", sans-serif';
  const bnWords = item.bangla_meaning.split(' ');
  const bnLines: string[] = [];
  let bCur = '';
  for (const word of bnWords) {
    const test = bCur ? `${bCur} ${word}` : word;
    if (ctx.measureText(test).width > w - 110) { bnLines.push(bCur); bCur = word; }
    else bCur = test;
  }
  if (bCur) bnLines.push(bCur);
  let by = Math.max(y + 24, 345);
  for (const line of bnLines.slice(0, 3)) { ctx.fillText(line, 54, by); by += 28; }

  ctx.fillStyle = t.meta;
  ctx.font = '500 15px "Google Sans Code", monospace';
  ctx.fillText(`সূত্র: ${item.primary_source} (${item.hadith_grade})`, 54, h - 48);
  };

  useEffect(() => {
    drawShareCard();
  }, [cardTheme, item]);

  return (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white text-[#0F1A17] w-full max-w-2xl rounded-2xl p-6 space-y-3">
            <div className="flex justify-between items-center">
              <h3 className="font-serif-bn font-bold text-lg">কার্ড শেয়ার ও ডাউনলোড</h3>
              <button onClick={() => onClose()}>✕</button>
            </div>
            <div className="flex justify-between items-center">
              <div className="flex gap-2 text-xs">
                {(['emerald', 'ivory', 'night'] as const).map((th) => (
                  <button key={th} onClick={() => setCardTheme(th)} className={`px-2.5 py-1 rounded border ${cardTheme === th ? 'bg-[#0E5A45] text-white' : ''}`}>{th}</button>
                ))}
              </div>
              <button
                onClick={async () => {
                  const c = canvasRef.current;
                  if (!c) return;
                  const res = await savePngDataUrl(`taskeen-${item.id}.png`, c.toDataURL('image/png')).catch((e) => {
                    notify(String(e));
                    return 'error' as const;
                  });
                  if (res !== 'saved') {
                    if (res === 'cancelled') notify('সংরক্ষণ বাতিল করা হয়েছে');
                    return;
                  }
                  notify('কার্ড PNG ডাউনলোড হয়েছে');
                }}
                className="px-3 py-1.5 rounded-lg bg-[#0E5A45] text-white text-xs font-semibold"
              >
                PNG ডাউনলোড
              </button>
            </div>
            <canvas ref={canvasRef} width={900} height={520} className="w-full h-auto rounded-xl border" />
          </div>
        </div>
  );
}
