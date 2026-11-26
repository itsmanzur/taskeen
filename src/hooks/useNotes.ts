import { useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { DEFAULT_NOTE_CATEGORIES, NoteCategory, UserNote } from '../components/NotesView';

export function useNotes() {
  const [notes, setNotes] = useState<UserNote[]>(() => {
    try {
      const saved = localStorage.getItem('taskeen_notes_v1');
      if (saved) return JSON.parse(saved);
    } catch {}
    return [];
  });
  const [noteCategories, setNoteCategories] = useState<NoteCategory[]>(() => {
    try {
      const saved = localStorage.getItem('taskeen_note_categories_v1');
      if (saved) return JSON.parse(saved);
    } catch {}
    return DEFAULT_NOTE_CATEGORIES;
  });

  const saveNotes = (next: UserNote[]) => {
    setNotes(next);
    try {
      localStorage.setItem('taskeen_notes_v1', JSON.stringify(next));
      invoke('upsert_user_kv', { key: 'taskeen_notes_v1', value: JSON.stringify(next) }).catch(() => {});
    } catch {}
  };

  const saveNoteCategories = (next: NoteCategory[]) => {
    setNoteCategories(next);
    try {
      localStorage.setItem('taskeen_note_categories_v1', JSON.stringify(next));
      invoke('upsert_user_kv', { key: 'taskeen_note_categories_v1', value: JSON.stringify(next) }).catch(() => {});
    } catch {}
  };
  return { notes, noteCategories, saveNotes, saveNoteCategories };
}
