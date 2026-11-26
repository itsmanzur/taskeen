import { useState } from 'react';
import { Copy } from 'lucide-react';
import { RefStatus, TaskeenItem } from '../types';
import { DAILY_AMAL_LIST, EMOTIONS, Notify } from '../lib/constants';
import { AudioPlayer } from '../hooks/useAudioPlayer';
import { LibraryFilters } from '../hooks/useLibraryFilters';
import { ReadingPrefs } from '../hooks/useReadingPrefs';
import { REVIEW_STATUS_LABEL, ReviewLedger, ReviewStatusKey, STORY_GRADE_LABEL } from '../hooks/useReviewLedger';
import ReviewPanel from './ReviewPanel';
import { CorrectionsApi } from '../hooks/useCorrections';

type SetState<T> = React.Dispatch<React.SetStateAction<T>>;

interface LibraryViewProps {
  darkMode: boolean;
  items: TaskeenItem[];
  lib: LibraryFilters;
  reading: ReadingPrefs;
  onSelectItem: (item: TaskeenItem) => void;
  favorites: string[];
  setFavorites: SetState<string[]>;
  review: ReviewLedger;
  corrections: CorrectionsApi;
  onExportReview: () => void;
  tadabburNotes: Record<string, string>;
  setTadabburNotes: SetState<Record<string, string>>;
  setCounts: SetState<Record<string, number>>;
  target: number;
  setTarget: (v: number) => void;
  currentCount: number;
  totalCount: number;
  onIncrementTasbih: () => void;
  dailyDone: Record<string, boolean>;
  setDailyDone: SetState<Record<string, boolean>>;
  audio: AudioPlayer;
  onOpenShare: () => void;
  notify: Notify;
}

function copyItem(item: TaskeenItem, notify: Notify) {
  const text = `${item.title_bn}\n\n${item.arabic_uthmani}${item.bangla_pronunciation ? `\n\nউচ্চারণ: ${item.bangla_pronunciation}` : ''}\n\nঅর্থ: ${item.bangla_meaning}\n\nসূত্র: ${item.primary_source} (${item.hadith_grade})`;
  navigator.clipboard?.writeText(text);
  notify('দোয়াটি কপি হয়েছে!');
}

export default function LibraryView(props: LibraryViewProps) {
  const {
    darkMode, items, lib, reading, onSelectItem, favorites, setFavorites,
    review, corrections, onExportReview, tadabburNotes, setTadabburNotes, setCounts,
    target, setTarget, currentCount, totalCount, onIncrementTasbih: incrementTasbih,
    dailyDone, setDailyDone, audio, onOpenShare, notify,
  } = props;
  const { filteredItems, selectedItem, category, setCategory, emotion, setEmotion, gradeFilter, setGradeFilter, bookFilter, setBookFilter, reviewFilter, setReviewFilter, refFilter, setRefFilter } = lib;
  const { arabicFont, setArabicFont, arabicSize, setArabicSize, showPronunciation, setShowPronunciation } = reading;
  const {
    playing: audioPlaying, mode: audioMode, progress: audioProgress,
    speed: audioSpeed, setSpeed: setAudioSpeed, toggle: toggleAudio,
  } = audio;

  const nextUnreviewed = () => {
    const start = items.findIndex((i) => i.id === selectedItem?.id);
    const order = [...items.slice(start + 1), ...items.slice(0, Math.max(start, 0))];
    const next = order.find((i) => review.statusOf(i.id) !== 'verified');
    if (next) onSelectItem(next);
    else notify('সব এন্ট্রি যাচাই সম্পন্ন — আলহামদুলিল্লাহ');
  };

  const [activeTab, setActiveTab] = useState<'text' | 'fazilat' | 'story' | 'tahqeeq'>('text');
  const [hifzMode, setHifzMode] = useState<boolean>(false);
  const [hifzHideArabic, setHifzHideArabic] = useState<boolean>(true);
  const [hifzHideMeaning, setHifzHideMeaning] = useState<boolean>(true);
  const [hifzRevealed, setHifzRevealed] = useState<{ arabic: boolean; meaning: boolean }>({ arabic: false, meaning: false });
  const [memorizedIds, setMemorizedIds] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem('taskeen_memorized_v1') || '[]'); } catch { return []; }
  });

  return (
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-12">
          {/* Sidebar */}
          <aside className={`lg:col-span-3 border-r p-4 flex flex-col gap-4 ${darkMode ? 'border-[#243832] bg-[#121F1B]' : 'border-[#DCE3E0] bg-[#F9FBFA]'}`}>
            <nav className="flex lg:flex-col gap-1 overflow-x-auto">
              {[
                ['all', `সবগুলো (${items.length})`],
                ['dua', 'দোয়া ও মুনাজাত'],
                ['durood', 'দরুদ শরীফ'],
                ['istighfar', 'ইস্তেগফার'],
                ['favorites', `প্রিয় তালিকা (${favorites.length})`],
              ].map(([k, label]) => (
                <button
                  key={k}
                  onClick={() => setCategory(k)}
                  className={`text-left px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap ${category === k ? 'bg-[#0E5A45] text-white' : 'hover:bg-[#E6F2EE]/40'}`}
                >
                  {label}
                </button>
              ))}
            </nav>

            <div className="flex flex-wrap gap-1.5">
              <button onClick={() => setEmotion('all')} className={`px-2.5 py-1 rounded-full text-xs border ${emotion === 'all' ? 'border-[#0E5A45] bg-[#E6F2EE] text-[#0A4736]' : 'border-[#D2DDD8]'}`}>সব অবস্থা</button>
              {EMOTIONS.map((em) => (
                <button key={em} onClick={() => setEmotion(em)} className={`px-2.5 py-1 rounded-full text-xs border ${emotion === em ? 'border-[#0E5A45] bg-[#E6F2EE] text-[#0A4736]' : 'border-[#D2DDD8]'}`}>{em}</button>
              ))}
            </div>

            <div className="space-y-1.5">
              <div className="flex justify-between text-[11px] opacity-80">
                <span>তাহকীক অগ্রগতি</span>
                <span className="font-mono-code">{review.counts.verified}/{review.counts.total}</span>
              </div>
              <div className="w-full h-1.5 rounded-full bg-black/10 overflow-hidden">
                <div className="h-full bg-[#0E5A45]" style={{ width: `${review.counts.total ? (review.counts.verified / review.counts.total) * 100 : 0}%` }} />
              </div>
              <button onClick={onExportReview} className="w-full py-1.5 rounded-lg border border-[#0E5A45] text-[#0A4736] text-[11px] font-semibold">
                রিভিউ ও সংশোধনী এক্সপোর্ট{corrections.count ? ` (${corrections.count}টি সংশোধন)` : ''}
              </button>
              <select
                value={reviewFilter}
                onChange={(e) => setReviewFilter(e.target.value as 'all' | ReviewStatusKey)}
                className="w-full px-2 py-1.5 text-xs rounded-lg border border-[#D2DDD8] bg-transparent"
              >
                <option value="all">সব যাচাই-অবস্থা</option>
                <option value="unreviewed">যাচাই বাকি ({review.counts.unreviewed})</option>
                <option value="verified">যাচাইকৃত ({review.counts.verified})</option>
                <option value="needs_fix">সংশোধন দরকার ({review.counts.needs_fix})</option>
                <option value="outdated">পরিবর্তিত ({review.counts.outdated})</option>
              </select>
              <select
                value={refFilter}
                onChange={(e) => setRefFilter(e.target.value as 'all' | RefStatus)}
                className="w-full px-2 py-1.5 text-xs rounded-lg border border-[#D2DDD8] bg-transparent"
              >
                <option value="all">সূত্র-পরীক্ষা: সব</option>
                <option value="mismatch">সূত্র মেলেনি (আগে দেখুন)</option>
                <option value="partial">সূত্র আংশিক মিল</option>
                <option value="match">সূত্র মিলেছে</option>
                <option value="unchecked">তুলনা সম্ভব হয়নি</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-1.5">
              <select
                value={gradeFilter}
                onChange={(e) => setGradeFilter(e.target.value)}
                className="px-2 py-1.5 text-xs rounded-lg border border-[#D2DDD8] bg-transparent"
              >
                <option value="all">সব মান (Grade)</option>
                <option value="Sahih">Sahih (সহীহ)</option>
                <option value="Hasan">Hasan (হাসান)</option>
                <option value="Quran">Quran (কুরআন)</option>
              </select>
              <select
                value={bookFilter}
                onChange={(e) => setBookFilter(e.target.value)}
                className="px-2 py-1.5 text-xs rounded-lg border border-[#D2DDD8] bg-transparent"
              >
                <option value="all">সব কিতাব</option>
                <option value="বুখারী">সহীহ বুখারী</option>
                <option value="মুসলিম">সহীহ মুসলিম</option>
                <option value="আবু দাউদ">আবু দাউদ</option>
                <option value="তিরমিযী">তিরমিযী</option>
                <option value="নাসায়ী">নাসায়ী</option>
                <option value="ইবনে মাজাহ">ইবনে মাজাহ</option>
                <option value="মুসনাদে আহমাদ">মুসনাদে আহমাদ</option>
                <option value="সূরা">আল-কুরআন</option>
              </select>
            </div>

            <div className="flex-1 overflow-y-auto max-h-[380px] border-t border-[#DCE3E0] pt-3 space-y-1.5">
              {filteredItems.map((it) => (
                <button
                  key={it.id}
                  onClick={() => onSelectItem(it)}
                  className={`w-full text-left px-3 py-2 rounded-lg text-xs border ${selectedItem?.id === it.id ? 'bg-[#E6F2EE] text-[#0A4736] border-[#0E5A45] font-semibold' : 'border-transparent hover:bg-[#EEF3F0]/50'}`}
                >
                  <div className="truncate">{it.title_bn}</div>
                  <div className="text-[11px] opacity-75 font-mono-code mt-0.5">{it.primary_source}</div>
                </button>
              ))}
            </div>
          </aside>

          {/* Main Reading Canvas */}
          <main className="lg:col-span-6 p-6 flex flex-col justify-between">
            {selectedItem && (
              <div>
                <div className="flex flex-wrap items-center justify-between gap-2 pb-4 border-b border-[#DCE3E0]">
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-0.5 text-xs font-mono-code rounded-full bg-[#E6F2EE] text-[#0A4736]">{selectedItem.hadith_grade}</span>
                    <span className="px-2.5 py-0.5 text-xs rounded-full bg-[#FDF3E7] text-[#7A4404]">{REVIEW_STATUS_LABEL[review.statusOf(selectedItem.id)]}</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <select value={arabicFont} onChange={(e) => setArabicFont(e.target.value as 'amiri' | 'scheherazade')} className="px-2 py-1 text-xs rounded border border-[#D2DDD8] bg-transparent">
                      <option value="amiri">নাসখ (Noto Naskh)</option>
                      <option value="scheherazade">লাতিফ (Lateef)</option>
                    </select>
                    <button onClick={() => setShowPronunciation(!showPronunciation)} className="px-2 py-1 rounded border border-[#D2DDD8] text-xs">উচ্চারণ</button>
                    <button onClick={() => setArabicSize((s) => Math.max(20, s - 2))} className="w-7 h-7 rounded border border-[#D2DDD8] text-xs font-bold">A-</button>
                    <button onClick={() => setArabicSize((s) => Math.min(42, s + 2))} className="w-7 h-7 rounded border border-[#D2DDD8] text-xs font-bold">A+</button>
                    <button onClick={() => onOpenShare()} className="px-2 py-1 rounded border border-[#0E5A45] text-[#0A4736] text-xs font-medium">কার্ড শেয়ার</button>
                    <button
                      onClick={() => copyItem(selectedItem, notify)}
                      className="px-2 py-1 rounded border border-[#D2DDD8] text-xs flex items-center gap-1"
                    >
                      <Copy className="w-3 h-3" /> কপি
                    </button>
                    <button
                      onClick={() => setFavorites((prev) => prev.includes(selectedItem.id) ? prev.filter((x) => x !== selectedItem.id) : [...prev, selectedItem.id])}
                      className="px-2.5 py-1 rounded border border-[#D2DDD8] text-xs"
                    >
                      {favorites.includes(selectedItem.id) ? '★ প্রিয়তে' : '☆ প্রিয়'}
                    </button>
                  </div>
                </div>

                <h1 className="font-serif-bn text-2xl font-bold mt-4 mb-1">{selectedItem.title_bn}</h1>
                <p className="text-xs opacity-70 font-mono-code mb-3">{selectedItem.primary_source}</p>

                {/* Audio Bar */}
                <div className={`mb-4 px-3.5 py-2.5 rounded-xl border flex flex-wrap items-center justify-between gap-3 ${darkMode ? 'border-[#243832] bg-[#121F1B]' : 'border-[#DCE3E0] bg-[#F7FAF8]'}`}>
                  <div className="flex items-center gap-2">
                    <button onClick={toggleAudio} className="px-3 py-1.5 rounded-lg bg-[#0E5A45] text-white text-xs font-semibold">
                      {audioPlaying ? '⏸ থামুন' : '▶ অডিও শুনুন'}
                    </button>
                    {audioMode !== 'idle' && (
                      <span className="text-[11px] opacity-70">
                        {audioMode === 'pack' ? 'অফলাইন অডিও প্যাক ✓' : 'ভয়েস সিন্থেসিস (ফলব্যাক)'}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-28 h-1.5 bg-[#DCE3E0] rounded-full overflow-hidden">
                      <div className="h-full bg-[#0E5A45] transition-all" style={{ width: `${audioProgress}%` }} />
                    </div>
                    <select value={audioSpeed} onChange={(e) => setAudioSpeed(Number(e.target.value))} className="px-2 py-1 text-xs rounded border border-[#D2DDD8] bg-transparent">
                      <option value={0.75}>0.75x</option>
                      <option value={1}>1.0x</option>
                      <option value={1.25}>1.25x</option>
                      <option value={1.5}>1.5x</option>
                    </select>
                  </div>
                </div>

                {/* Tabs */}
                <div className="flex gap-2 border-b border-[#DCE3E0] mb-4">
                  {[
                    ['text', 'মূল পাঠ ও অর্থ'],
                    ['fazilat', 'ফজিলত ও গুরুত্ব'],
                    ['story', 'প্রামাণিক ঘটনা'],
                    ['tahqeeq', 'তাহকীক ও সনদ'],
                  ].map(([k, lbl]) => (
                    <button
                      key={k}
                      onClick={() => setActiveTab(k as typeof activeTab)}
                      className={`px-3 py-2 text-sm border-b-2 ${activeTab === k ? 'border-[#0E5A45] text-[#0A4736] font-semibold' : 'border-transparent opacity-70'}`}
                    >
                      {lbl}
                    </button>
                  ))}
                </div>

                {activeTab === 'text' && (
                  <div className="space-y-4">
                    {/* Hifz / Memorization Mode Bar */}
                    <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-xl ts-subsurface text-xs">
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setHifzMode((v) => !v);
                            setHifzRevealed({ arabic: false, meaning: false });
                          }}
                          className={`px-3 py-1 rounded-lg font-semibold transition ${
                            hifzMode ? 'bg-[#0E5A45] text-white' : 'border border-[#D2DDD8]'
                          }`}
                        >
                          {hifzMode ? 'মুখস্থ মোড চালু ✓' : 'মুখস্থ মোড (Hifz)'}
                        </button>
                        {hifzMode && (
                          <>
                            <label className="flex items-center gap-1 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={hifzHideArabic}
                                onChange={(e) => setHifzHideArabic(e.target.checked)}
                                className="accent-[#0E5A45]"
                              />
                              <span>আরবি লুকান</span>
                            </label>
                            <label className="flex items-center gap-1 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={hifzHideMeaning}
                                onChange={(e) => setHifzHideMeaning(e.target.checked)}
                                className="accent-[#0E5A45]"
                              />
                              <span>অর্থ লুকান</span>
                            </label>
                            <button
                              type="button"
                              onClick={() =>
                                setHifzRevealed((r) =>
                                  r.arabic && r.meaning ? { arabic: false, meaning: false } : { arabic: true, meaning: true }
                                )
                              }
                              className="px-2 py-0.5 rounded border border-[#D2DDD8] font-semibold"
                            >
                              {hifzRevealed.arabic && hifzRevealed.meaning ? 'আবার লুকান' : 'সব দেখুন'}
                            </button>
                          </>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          setMemorizedIds((prev) => {
                            const exists = prev.includes(selectedItem.id);
                            const next = exists ? prev.filter((x) => x !== selectedItem.id) : [...prev, selectedItem.id];
                            localStorage.setItem('taskeen_memorized_v1', JSON.stringify(next));
                            notify(exists ? 'মুখস্থ তালিকা থেকে সরানো হয়েছে' : 'মাশাআল্লাহ! মুখস্থ হিসেবে মার্ক হয়েছে ✓');
                            return next;
                          });
                        }}
                        className={`px-2.5 py-1 rounded-lg font-semibold ${
                          memorizedIds.includes(selectedItem.id)
                            ? 'bg-[#0E5A45]/15 ts-accent-text'
                            : 'border border-[#D2DDD8]'
                        }`}
                      >
                        {memorizedIds.includes(selectedItem.id) ? 'মুখস্থ হয়েছে ✓' : 'মুখস্থ মার্ক করুন'}
                      </button>
                    </div>

                    <div
                      onClick={() => hifzMode && setHifzRevealed((r) => ({ ...r, arabic: !r.arabic }))}
                      title={hifzMode ? 'ক্লিক করে আরবি দেখুন/লুকান' : undefined}
                      className={`p-5 rounded-xl border ${darkMode ? 'bg-[#16211E] border-[#263833]' : 'bg-[#F4F7F5] border-[#DCE3E0]'} ${
                        hifzMode ? 'cursor-pointer' : ''
                      }`}
                    >
                      <p
                        className={`${arabicFont === 'scheherazade' ? 'font-arabic-scheherazade' : 'font-arabic-amiri'} text-right transition ${
                          hifzMode && hifzHideArabic && !hifzRevealed.arabic ? 'blur-md select-none' : ''
                        }`}
                        style={{ fontSize: `${arabicSize}px` }}
                      >
                        {selectedItem.arabic_uthmani}
                      </p>
                    </div>
                    {showPronunciation && selectedItem.bangla_pronunciation && (
                      <p
                        className={`text-sm italic opacity-85 transition ${
                          hifzMode && hifzHideArabic && !hifzRevealed.arabic ? 'blur-sm select-none' : ''
                        }`}
                      >
                        {selectedItem.bangla_pronunciation}
                      </p>
                    )}
                    <p
                      onClick={() => hifzMode && setHifzRevealed((r) => ({ ...r, meaning: !r.meaning }))}
                      title={hifzMode ? 'ক্লিক করে অর্থ দেখুন/লুকান' : undefined}
                      className={`text-base leading-relaxed transition ${
                        hifzMode ? 'cursor-pointer' : ''
                      } ${hifzMode && hifzHideMeaning && !hifzRevealed.meaning ? 'blur-md select-none' : ''}`}
                    >
                      {selectedItem.bangla_meaning}
                    </p>
                  </div>
                )}

                {activeTab === 'fazilat' && (
                  <div className="p-5 rounded-xl border border-[#DCE3E0]">
                    <p className="text-base leading-relaxed">{selectedItem.fazilat_text}</p>
                  </div>
                )}

                {activeTab === 'story' && (
                  <div className="p-5 rounded-xl border border-[#DCE3E0]">
                    <span className="inline-block mb-2 px-2.5 py-0.5 text-[11px] rounded-full bg-[#FDF3E7] text-[#7A4404]">
                      ঘটনার মান: {STORY_GRADE_LABEL[review.latestStoryGrade(selectedItem.id)]}
                    </span>
                    <h3 className="font-serif-bn font-bold text-lg mb-2">{selectedItem.story_title}</h3>
                    <p className="text-base leading-relaxed">{selectedItem.story_context}</p>
                  </div>
                )}

                {activeTab === 'tahqeeq' && (
                  <ReviewPanel item={selectedItem} api={review} corrections={corrections} notify={notify} onNextUnreviewed={nextUnreviewed} />
                )}

                {/* Tadabbur Note */}
                <div className="mt-5 pt-4 border-t border-[#DCE3E0] sensitive-data">
                  <label className="block text-xs font-semibold opacity-75 mb-1">ব্যক্তিগত তাদাব্বুর ও আমল নোট</label>
                  <textarea
                    rows={2}
                    value={tadabburNotes[selectedItem.id] || ''}
                    onChange={(e) => setTadabburNotes((p) => ({ ...p, [selectedItem.id]: e.target.value }))}
                    placeholder="আপনার ব্যক্তিগত উপলব্ধি বা আমলের নোট লিখুন..."
                    className="w-full px-3 py-2 text-xs rounded-xl border border-[#D2DDD8] bg-transparent"
                  />
                </div>
              </div>
            )}
          </main>

          {/* Right Panel: Tasbih & Checklist */}
          <aside className={`lg:col-span-3 border-l p-5 flex flex-col justify-between gap-5 ${darkMode ? 'border-[#243832] bg-[#121F1B]' : 'border-[#DCE3E0] bg-[#F9FBFA]'}`}>
            <div>
              <p className="text-xs font-semibold opacity-75 mb-1">ইন্টারঅ্যাক্টিভ তাসবীহ</p>
              <h2 className="font-serif-bn font-bold text-base mb-3">{selectedItem?.title_bn}</h2>
              <div className="flex gap-1.5 mb-3">
                {[1, 33, 100].map((t) => (
                  <button key={t} onClick={() => setTarget(t)} className={`px-2 py-1 text-xs rounded border ${target === t ? 'bg-[#0E5A45] text-white border-[#0E5A45]' : 'border-[#D2DDD8]'}`}>{t}</button>
                ))}
              </div>
              <button onClick={incrementTasbih} className="w-full py-7 rounded-2xl bg-[#0E5A45] hover:bg-[#0A4736] text-white flex flex-col items-center justify-center shadow-md">
                <span className="font-mono-code text-5xl font-medium">{currentCount}</span>
                <span className="text-xs opacity-80 mt-2">লক্ষ্য: {target} বার (ক্লিক বা Space)</span>
              </button>
              <div className="flex justify-between items-center mt-2 text-xs">
                <span className="text-[#0A4736] font-medium">{currentCount >= target ? 'মাশাআল্লাহ! লক্ষ্য পূর্ণ।' : ''}</span>
                <button onClick={() => selectedItem && setCounts((p) => ({ ...p, [selectedItem.id]: 0 }))} className="underline opacity-75">রিসেট</button>
              </div>
            </div>

            <div className="border-t border-[#DCE3E0] pt-4">
              <p className="text-xs font-semibold opacity-75 mb-2">দৈনিক আমল চেকলিস্ট</p>
              <div className="space-y-1.5 text-xs">
                {DAILY_AMAL_LIST.map((a) => (
                  <label key={a.id} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={!!dailyDone[a.id]}
                      onChange={(e) => setDailyDone((p) => ({ ...p, [a.id]: e.target.checked }))}
                      className="accent-[#0E5A45]"
                    />
                    <span className={dailyDone[a.id] ? 'line-through opacity-60' : ''}>{a.label}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="border-t border-[#DCE3E0] pt-3 flex justify-between items-baseline">
              <span className="text-xs opacity-75">আজকের সর্বমোট পাঠ</span>
              <span className="font-mono-code text-xl font-bold text-[#0A4736]">{totalCount}</span>
            </div>
          </aside>
        </div>
  );
}
