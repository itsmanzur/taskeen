import { useState } from 'react';
import { CorrectionsApi } from '../hooks/useCorrections';
import { TaskeenItem } from '../types';
import { Notify } from '../lib/constants';
import ReferenceList from './ReferenceList';
import { REVIEW_STATUS_LABEL, ReviewChecks, ReviewLedger, STORY_GRADE_LABEL, StoryGrade } from '../hooks/useReviewLedger';

const CHECK_LABELS: [keyof ReviewChecks, string][] = [
  ['arabic', 'আরবি পাঠ (হরকতসহ) মূল উৎসের সাথে মিলিয়েছি'],
  ['meaning', 'বাংলা অনুবাদ সঠিক'],
  ['reference', 'কিতাব ও হাদীস নম্বর মিলিয়েছি'],
  ['grade', 'হাদীসের মান (হুকুম) যাচাই করেছি'],
  ['story', 'ঘটনা/ফজিলতের সনদ যাচাই করেছি'],
];

export default function ReviewPanel({
  item,
  api,
  corrections,
  notify,
  onNextUnreviewed,
}: {
  item: TaskeenItem;
  api: ReviewLedger;
  corrections: CorrectionsApi;
  notify: Notify;
  onNextUnreviewed: () => void;
}) {
  const [checks, setChecks] = useState<ReviewChecks>({ arabic: false, meaning: false, reference: false, grade: false, story: false });
  const [storyGrade, setStoryGrade] = useState<StoryGrade>(api.latestStoryGrade(item.id));
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [srcDraft, setSrcDraft] = useState<string | null>(null);
  const [gradeDraft, setGradeDraft] = useState<string | null>(null);
  const correction = corrections.corrections[item.id];
  const base = corrections.baseOf(item.id);
  const GRADES = ['Sahih', 'Hasan', 'Daif', 'Quran', 'Quran & Sahih', 'Unknown'];
  const gradeValue = gradeDraft ?? item.hadith_grade;
  const gradeOptions = GRADES.includes(gradeValue) ? GRADES : [gradeValue, ...GRADES];

  const saveCorrection = () => {
    corrections.save(item.id, { primary_source: srcDraft ?? item.primary_source, hadith_grade: gradeValue }, api.reviewerName);
    setSrcDraft(null);
    setGradeDraft(null);
    notify('সংশোধন সংরক্ষিত — এখন নতুন তথ্যের ওপর যাচাই অনুমোদন দিন');
  };

  const status = api.statusOf(item.id);
  const history = api.historyOf(item.id);
  const allChecked = Object.values(checks).every(Boolean);

  const submit = async (decision: 'approved' | 'needs_fix') => {
    if (decision === 'approved' && !allChecked) {
      notify('অনুমোদনের আগে সবগুলো যাচাই-ঘর টিক দিন');
      return;
    }
    if (decision === 'needs_fix' && !note.trim()) {
      notify('কী সংশোধন দরকার তা নোটে লিখুন');
      return;
    }
    setBusy(true);
    try {
      await api.addReview(item, { status: decision, checks, story_grade: storyGrade, note: note.trim() });
      setNote('');
      setChecks({ arabic: false, meaning: false, reference: false, grade: false, story: false });
      notify(decision === 'approved' ? 'যাচাই লেজারে সংরক্ষিত হয়েছে ✓' : 'সংশোধনের নোট সংরক্ষিত হয়েছে');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="p-5 rounded-xl border border-[#DCE3E0] space-y-3 text-sm">
      <div className="flex justify-between"><span>সূত্র:</span><span className="font-mono-code">{item.primary_source}</span></div>
      <div className="flex justify-between"><span>মান:</span><span className="font-mono-code">{item.hadith_grade}</span></div>
      {item.alim_note && <p className="text-sm opacity-80">{item.alim_note}</p>}
      <div className="pt-2 border-t border-[#DCE3E0]"><ReferenceList itemId={item.id} corrected={Boolean(correction?.primary_source)} /></div>

      <details className="pt-2 border-t border-[#DCE3E0] text-xs" open={Boolean(correction)}>
        <summary className="cursor-pointer font-semibold">সূত্র / মান সংশোধন {correction ? '(সংশোধিত)' : ''}</summary>
        <div className="mt-2 space-y-1.5">
          {correction && base && (
            <p className="opacity-75">
              মূল ডেটা: {base.primary_source} · {base.hadith_grade}
            </p>
          )}
          <input
            value={srcDraft ?? item.primary_source}
            onChange={(e) => setSrcDraft(e.target.value)}
            placeholder="সূত্র, যেমন: সহীহ বুখারী: ৬৩০৬"
            className="w-full px-2.5 py-1.5 rounded border border-[#D2DDD8] bg-transparent"
          />
          <select value={gradeValue} onChange={(e) => setGradeDraft(e.target.value)} className="w-full px-2 py-1.5 rounded border border-[#D2DDD8] bg-transparent">
            {gradeOptions.map((g) => <option key={g} value={g}>{g}</option>)}
          </select>
          <div className="flex gap-2">
            <button onClick={saveCorrection} className="px-3 py-1.5 rounded-lg font-semibold border border-[#0E5A45] text-[#0A4736]">সংশোধন সংরক্ষণ</button>
            {correction && (
              <button onClick={() => { corrections.revert(item.id); setSrcDraft(null); setGradeDraft(null); notify('মূল ডেটায় ফেরানো হয়েছে'); }} className="px-3 py-1.5 rounded-lg border border-[#D2DDD8]">মূলে ফেরান</button>
            )}
          </div>
          <p className="opacity-60">সংশোধনের পর এই এন্ট্রির আগের অনুমোদন "পরিবর্তিত" হয়ে যাবে — নতুন তথ্য দেখে আবার অনুমোদন দিন।</p>
        </div>
      </details>

      <div className="flex items-center justify-between pt-2 border-t border-[#DCE3E0]">
        <span className="font-semibold">বর্তমান অবস্থা</span>
        <span className="px-2.5 py-0.5 text-xs rounded-full bg-[#FDF3E7] text-[#7A4404]">{REVIEW_STATUS_LABEL[status]}</span>
      </div>

      <div className="space-y-1.5 text-xs">
        <label className="flex items-center gap-2">
          <span className="w-24 shrink-0 opacity-75">রিভিউয়ারের নাম</span>
          <input
            value={api.reviewerName}
            onChange={(e) => api.setReviewerName(e.target.value)}
            placeholder="যেমন: মুফতী/হাফেজ ..."
            className="flex-1 px-2.5 py-1.5 rounded border border-[#D2DDD8] bg-transparent"
          />
        </label>
        {CHECK_LABELS.map(([k, label]) => (
          <label key={k} className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" className="accent-[#0E5A45]" checked={checks[k]} onChange={(e) => setChecks((c) => ({ ...c, [k]: e.target.checked }))} />
            <span>{label}</span>
          </label>
        ))}
        <label className="flex items-center gap-2">
          <span className="w-24 shrink-0 opacity-75">ঘটনার মান</span>
          <select value={storyGrade} onChange={(e) => setStoryGrade(e.target.value as StoryGrade)} className="flex-1 px-2 py-1.5 rounded border border-[#D2DDD8] bg-transparent">
            {(Object.keys(STORY_GRADE_LABEL) as StoryGrade[]).map((g) => (
              <option key={g} value={g}>{STORY_GRADE_LABEL[g]}</option>
            ))}
          </select>
        </label>
        <textarea
          rows={2}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="নোট / সংশোধনের বিবরণ (যেমন: তাহকীকের উৎস, সঠিক নম্বর)..."
          className="w-full px-3 py-2 rounded border border-[#D2DDD8] bg-transparent"
        />
        <div className="flex flex-wrap gap-2">
          <button disabled={busy} onClick={() => submit('approved')} className="px-3 py-1.5 rounded-lg font-semibold bg-[#0E5A45] text-white disabled:opacity-50">যাচাই অনুমোদন</button>
          <button disabled={busy} onClick={() => submit('needs_fix')} className="px-3 py-1.5 rounded-lg font-semibold border border-[#B4690E] text-[#7A4404] disabled:opacity-50">সংশোধন দরকার</button>
          <button onClick={onNextUnreviewed} className="px-3 py-1.5 rounded-lg border border-[#D2DDD8]">পরবর্তী অযাচাইকৃত →</button>
        </div>
      </div>

      {history.length > 0 && (
        <div className="pt-2 border-t border-[#DCE3E0] space-y-1.5 text-xs">
          <p className="font-semibold">যাচাইয়ের ইতিহাস</p>
          {history.map((r) => (
            <div key={r.id} className="p-2 rounded-lg bg-black/5">
              <div className="flex justify-between gap-2">
                <span>{r.status === 'approved' ? '✓ অনুমোদিত' : '⚠ সংশোধন দরকার'} · {r.reviewer}</span>
                <span className="font-mono-code opacity-70">{new Date(r.at).toLocaleDateString('bn-BD')}</span>
              </div>
              {r.note && <p className="mt-1 opacity-80">{r.note}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
