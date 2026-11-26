import React, { useMemo, useState } from 'react';
import { Check, Copy, Edit3, FolderPlus, NotebookPen, Pin, Plus, Search, Trash2, X } from 'lucide-react';

export interface NoteCategory {
  id: string;
  name: string;
  color: string;
}

export interface UserNote {
  id: string;
  title: string;
  category: string;
  content: string;
  pinned?: boolean;
  createdAt: string;
  updatedAt: string;
}

export const DEFAULT_NOTE_CATEGORIES: NoteCategory[] = [
  { id: 'cat_general', name: 'সাধারণ', color: '#A6603A' },
  { id: 'cat_tafsir', name: 'তাফসীর ও কুরআন', color: '#3D5E36' },
  { id: 'cat_hadith', name: 'দরস ও হাদীস', color: '#4A9FCC' },
  { id: 'cat_amal', name: 'ব্যক্তিগত আমল', color: '#C4883A' },
];

const CATEGORY_COLORS = ['#A6603A', '#3D5E36', '#4A9FCC', '#C4883A', '#8B5CF6', '#D946EF', '#0E7490'];

interface NotesViewProps {
  notes: UserNote[];
  categories: NoteCategory[];
  onSaveNotes: (next: UserNote[]) => void;
  onSaveCategories: (next: NoteCategory[]) => void;
}

export default function NotesView({
  notes,
  categories,
  onSaveNotes,
  onSaveCategories,
}: NotesViewProps) {
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState(categories[0]?.name || 'সাধারণ');
  const [content, setContent] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);

  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const [newCatName, setNewCatName] = useState('');
  const [newCatColor, setNewCatColor] = useState(CATEGORY_COLORS[0]);
  const [showCatCreator, setShowCatCreator] = useState(false);

  const handleSaveNote = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanTitle = title.trim();
    const cleanContent = content.trim();
    if (!cleanTitle || !cleanContent) return;

    const now = new Date().toISOString();
    if (editingId) {
      const next = notes.map((n) =>
        n.id === editingId
          ? { ...n, title: cleanTitle, category, content: cleanContent, updatedAt: now }
          : n
      );
      onSaveNotes(next);
      setEditingId(null);
    } else {
      const created: UserNote = {
        id: `note_${Date.now()}`,
        title: cleanTitle,
        category,
        content: cleanContent,
        pinned: false,
        createdAt: now,
        updatedAt: now,
      };
      onSaveNotes([created, ...notes]);
    }
    setTitle('');
    setContent('');
  };

  const handleStartEdit = (note: UserNote) => {
    setEditingId(note.id);
    setTitle(note.title);
    setCategory(note.category);
    setContent(note.content);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setTitle('');
    setContent('');
  };

  const handleDeleteNote = (id: string) => {
    if (!window.confirm('এই নোটটি কি স্থায়ীভাবে মুছে ফেলতে চান?')) return;
    onSaveNotes(notes.filter((n) => n.id !== id));
    if (editingId === id) handleCancelEdit();
  };

  const handleTogglePin = (id: string) => {
    onSaveNotes(notes.map((n) => (n.id === id ? { ...n, pinned: !n.pinned } : n)));
  };

  const handleCopyNote = async (note: UserNote) => {
    const formatted = `${note.title}\n[ক্যাটাগরি: ${note.category}]\n\n${note.content}`;
    try {
      await navigator.clipboard.writeText(formatted);
      setCopiedId(note.id);
      setTimeout(() => setCopiedId((prev) => (prev === note.id ? null : prev)), 1800);
    } catch {}
  };

  const handleCreateCategory = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newCatName.trim();
    if (!trimmed) return;
    if (categories.some((c) => c.name.toLowerCase() === trimmed.toLowerCase())) {
      setCategory(trimmed);
      setNewCatName('');
      setShowCatCreator(false);
      return;
    }
    const nextCat: NoteCategory = {
      id: `cat_${Date.now()}`,
      name: trimmed,
      color: newCatColor,
    };
    onSaveCategories([...categories, nextCat]);
    setCategory(trimmed);
    setNewCatName('');
    setShowCatCreator(false);
  };

  const handleRemoveCategory = (catId: string, catName: string) => {
    if (categories.length <= 1) return;
    if (!window.confirm(`"${catName}" ক্যাটাগরিটি রিমুভ করবেন? (এই ক্যাটাগরির নোটগুলো মুছবে না)`)) return;
    const next = categories.filter((c) => c.id !== catId);
    onSaveCategories(next);
    if (category === catName) setCategory(next[0].name);
    if (filterCategory === catName) setFilterCategory('all');
  };

  const filteredNotes = useMemo(() => {
    const q = search.trim().toLowerCase();
    return [...notes]
      .filter((n) => (filterCategory === 'all' ? true : n.category === filterCategory))
      .filter((n) =>
        q ? n.title.toLowerCase().includes(q) || n.content.toLowerCase().includes(q) || n.category.toLowerCase().includes(q) : true
      )
      .sort((a, b) => Number(!!b.pinned) - Number(!!a.pinned));
  }, [notes, filterCategory, search]);

  const getCategoryColor = (catName: string) =>
    categories.find((c) => c.name === catName)?.color || 'var(--ts-accent)';

  return (
    <div className="p-6 max-w-6xl mx-auto w-full space-y-6 animate-view">
      {/* Header */}
      <div className="ts-bento-card ts-card-accent-left p-5 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-serif-bn text-xl font-bold flex items-center gap-2">
            <NotebookPen className="w-5 h-5 ts-accent-text" /> পার্সোনাল নোটবুক
          </h1>
          <p className="text-xs ts-muted-text mt-1">
            দরস, তাফসীর, বইয়ের উদ্ধৃতি ও ব্যক্তিগত নোট ক্যাটাগরি অনুযায়ী সেভ, কপি, এডিট ও সংরক্ষণ করুন।
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowCatCreator((v) => !v)}
            className="px-3.5 py-2 rounded-xl border border-[#D2DDD8] text-xs font-semibold flex items-center gap-1.5 hover:bg-[#0E5A45]/10 transition"
          >
            <FolderPlus className="w-4 h-4 ts-accent-text" /> নতুন ক্যাটাগরি
          </button>
          <span className="text-xs px-3 py-2 rounded-xl ts-accent-soft ts-accent-text font-semibold">
            মোট নোট: {notes.length}
          </span>
        </div>
      </div>

      {/* Category Creator Drawer */}
      {showCatCreator && (
        <form onSubmit={handleCreateCategory} className="ts-bento-card p-4 flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[200px] space-y-1">
            <label className="text-xs font-semibold">নতুন ক্যাটাগরির নাম</label>
            <input
              type="text"
              value={newCatName}
              onChange={(e) => setNewCatName(e.target.value)}
              placeholder="যেমন: সিরাত নোট, ফিকহ, বইয়ের সারাংশ..."
              className="w-full px-3 py-2 text-sm rounded-xl border border-[#D2DDD8] bg-transparent"
              required
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-semibold block">রঙ</label>
            <div className="flex items-center gap-1.5">
              {CATEGORY_COLORS.map((clr) => (
                <button
                  key={clr}
                  type="button"
                  onClick={() => setNewCatColor(clr)}
                  className={`w-6 h-6 rounded-full border-2 transition ${
                    newCatColor === clr ? 'border-current scale-110' : 'border-transparent opacity-75'
                  }`}
                  style={{ backgroundColor: clr }}
                />
              ))}
            </div>
          </div>
          <button type="submit" className="px-4 py-2 rounded-xl bg-[#0E5A45] text-white text-xs font-semibold">
            তৈরি করুন
          </button>
          <button
            type="button"
            onClick={() => setShowCatCreator(false)}
            className="px-3 py-2 rounded-xl border border-[#D2DDD8] text-xs"
          >
            বন্ধ
          </button>
        </form>
      )}

      {/* Create / Edit Note + Notes List Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Note Editor */}
        <form onSubmit={handleSaveNote} className="lg:col-span-5 ts-bento-card p-5 space-y-4 h-fit">
          <div className="flex items-center justify-between">
            <h2 className="font-serif-bn font-bold text-base flex items-center gap-1.5">
              {editingId ? <Edit3 className="w-4 h-4 ts-accent-text" /> : <Plus className="w-4 h-4 ts-accent-text" />}
              {editingId ? 'নোট এডিট করুন' : 'নতুন নোট লিখুন'}
            </h2>
            {editingId && (
              <button
                type="button"
                onClick={handleCancelEdit}
                className="text-xs ts-muted-text hover:underline flex items-center gap-1"
              >
                <X className="w-3.5 h-3.5" /> বাতিল
              </button>
            )}
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold">টাইটেল</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="নোটের শিরোনাম লিখুন..."
              className="w-full px-3 py-2 text-sm rounded-xl border border-[#D2DDD8] bg-transparent"
              required
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold">ক্যাটাগরি</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-xl border border-[#D2DDD8] bg-transparent"
            >
              {categories.map((c) => (
                <option key={c.id} value={c.name} className="text-black">
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold">মূল লেখা</label>
            <textarea
              rows={7}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="আপনার নোট, রেফারেন্স বা শিক্ষণীয় পয়েন্ট লিখুন..."
              className="w-full px-3 py-2 text-sm rounded-xl border border-[#D2DDD8] bg-transparent leading-relaxed"
              required
            />
          </div>

          <button
            type="submit"
            className="w-full py-2.5 rounded-xl bg-[#0E5A45] hover:bg-[#0A4736] text-white text-sm font-semibold transition"
          >
            {editingId ? 'পরিবর্তন সেভ করুন' : 'নোট সেভ করুন'}
          </button>
        </form>

        {/* Right: Filter & Saved Notes */}
        <div className="lg:col-span-7 space-y-4">
          {/* Search + Category Filter Pills */}
          <div className="ts-bento-card p-4 space-y-3">
            <div className="relative">
              <Search className="w-4 h-4 ts-muted-text absolute left-3 top-2.5" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="টাইটেল, লেখা বা ক্যাটাগরি দিয়ে নোট খুঁজুন..."
                className="w-full pl-9 pr-3 py-2 text-sm rounded-xl border border-[#D2DDD8] bg-transparent"
              />
            </div>

            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => setFilterCategory('all')}
                className={`px-3 py-1 rounded-full text-xs font-semibold transition ${
                  filterCategory === 'all' ? 'bg-[#0E5A45] text-white' : 'ts-subsurface'
                }`}
              >
                সবগুলো ({notes.length})
              </button>
              {categories.map((c) => {
                const count = notes.filter((n) => n.category === c.name).length;
                const active = filterCategory === c.name;
                return (
                  <div key={c.id} className="inline-flex items-center gap-0.5">
                    <button
                      type="button"
                      onClick={() => setFilterCategory(c.name)}
                      className={`px-3 py-1 rounded-full text-xs font-semibold transition flex items-center gap-1.5 ${
                        active ? 'bg-[#0E5A45] text-white' : 'ts-subsurface'
                      }`}
                    >
                      <span
                        className="w-2 h-2 rounded-full inline-block"
                        style={{ backgroundColor: active ? '#FFFFFF' : c.color }}
                      />
                      {c.name} ({count})
                    </button>
                    {categories.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveCategory(c.id, c.name)}
                        title="ক্যাটাগরি রিমুভ করুন"
                        className="p-0.5 rounded-full opacity-50 hover:opacity-100"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Notes List */}
          {filteredNotes.length === 0 ? (
            <div className="ts-bento-card p-10 text-center space-y-2">
              <NotebookPen className="w-8 h-8 mx-auto opacity-40" />
              <div className="font-semibold text-sm">এখনো কোনো নোট নেই</div>
              <p className="text-xs ts-muted-text">বাঁ পাশের ফর্ম থেকে আপনার প্রথম নোট সেভ করুন।</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredNotes.map((note) => {
                const catColor = getCategoryColor(note.category);
                return (
                  <div key={note.id} className="ts-bento-card p-4 space-y-3">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span
                            className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full text-white"
                            style={{ backgroundColor: catColor }}
                          >
                            {note.category}
                          </span>
                          {note.pinned && (
                            <span className="text-[11px] px-2 py-0.5 rounded-full ts-accent-soft ts-accent-text font-semibold">
                              পিন করা
                            </span>
                          )}
                          <span className="text-[11px] ts-muted-text">
                            {new Date(note.updatedAt).toLocaleDateString('bn-BD')}
                          </span>
                        </div>
                        <h3 className="font-serif-bn font-bold text-base">{note.title}</h3>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleTogglePin(note.id)}
                          title={note.pinned ? 'আনপিন করুন' : 'উপরে পিন করুন'}
                          className={`p-1.5 rounded-lg border border-[#D2DDD8] text-xs transition ${
                            note.pinned ? 'bg-[#0E5A45] text-white' : 'hover:bg-[#0E5A45]/10'
                          }`}
                        >
                          <Pin className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleCopyNote(note)}
                          className="px-2.5 py-1.5 rounded-lg border border-[#D2DDD8] text-xs font-semibold flex items-center gap-1 hover:bg-[#0E5A45]/10 transition"
                        >
                          {copiedId === note.id ? (
                            <>
                              <Check className="w-3.5 h-3.5 text-emerald-600" /> কপি হয়েছে
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5" /> কপি
                            </>
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleStartEdit(note)}
                          className="px-2.5 py-1.5 rounded-lg border border-[#D2DDD8] text-xs font-semibold flex items-center gap-1 hover:bg-[#0E5A45]/10 transition"
                        >
                          <Edit3 className="w-3.5 h-3.5" /> এডিট
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteNote(note.id)}
                          className="p-1.5 rounded-lg border border-red-300/60 text-red-600 hover:bg-red-500/10 transition"
                          title="নোট ডিলিট করুন"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <p className="text-sm whitespace-pre-wrap leading-relaxed opacity-90">{note.content}</p>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
