import { useEffect, useMemo, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { TaskeenItem } from '../types';
import { DEFAULT_ITEMS } from '../lib/constants';
import { ReviewStatusKey } from './useReviewLedger';
import { RefStatus } from '../types';
import { loadReferences } from '../lib/references';

/** Category/emotion/grade/book filters, FTS search and the currently selected item. */
export function useLibraryFilters(items: TaskeenItem[], favorites: string[], statusOf: (id: string) => ReviewStatusKey) {

  const [category, setCategory] = useState<string>('all');
  const [emotion, setEmotion] = useState<string>('all');
  const [gradeFilter, setGradeFilter] = useState<string>('all');
  const [refFilter, setRefFilter] = useState<'all' | RefStatus>('all');
  const [refOverall, setRefOverall] = useState<Record<string, RefStatus>>({});
  useEffect(() => {
    loadReferences()
      .then((all) => setRefOverall(Object.fromEntries(Object.entries(all).map(([k, v]) => [k, v.overall]))))
      .catch(() => {});
  }, []);
  const [reviewFilter, setReviewFilter] = useState<'all' | ReviewStatusKey>('all');
  const [bookFilter, setBookFilter] = useState<string>('all');
  const [search, setSearch] = useState<string>('');
  const [ftsIds, setFtsIds] = useState<Set<string> | null>(null);
  const [selectedId, setSelectedId] = useState<string>(DEFAULT_ITEMS[0]?.id || '');

  useEffect(() => {
    const q = search.trim();
    if (!q) {
      setFtsIds(null);
      return;
    }
    let cancelled = false;
    const timer = window.setTimeout(() => {
      invoke<TaskeenItem[]>('search_items', { query: q })
        .then((res) => {
          if (!cancelled && Array.isArray(res)) {
            setFtsIds(new Set(res.map((r) => r.id)));
          }
        })
        .catch(() => {
          if (!cancelled) setFtsIds(null);
        });
    }, 200);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [search]);

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      if (category === 'favorites' && !favorites.includes(item.id)) return false;
      if (category !== 'all' && category !== 'favorites' && item.category !== category) return false;
      if (emotion !== 'all' && item.emotion_tag !== emotion) return false;
      if (gradeFilter !== 'all' && !item.hadith_grade.toLowerCase().includes(gradeFilter.toLowerCase())) return false;
      if (reviewFilter !== 'all' && statusOf(item.id) !== reviewFilter) return false;
      if (refFilter !== 'all' && (refOverall[item.id] || 'unchecked') !== refFilter) return false;
      if (bookFilter !== 'all' && !item.primary_source.includes(bookFilter)) return false;
      if (search.trim()) {
        if (ftsIds) return ftsIds.has(item.id);
        const q = search.trim().toLowerCase();
        const hay = `${item.title_bn} ${item.bangla_pronunciation || ''} ${item.bangla_meaning} ${item.primary_source} ${item.fazilat_text} ${item.hadith_grade}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [items, category, emotion, gradeFilter, bookFilter, search, ftsIds, favorites, reviewFilter, statusOf, refFilter, refOverall]);

  const selectedItem = useMemo(() => {
    return filteredItems.find((i) => i.id === selectedId) || filteredItems[0] || items[0];
  }, [filteredItems, selectedId, items]);

  return {
    category, setCategory, emotion, setEmotion, gradeFilter, setGradeFilter, bookFilter, setBookFilter, reviewFilter, setReviewFilter, refFilter, setRefFilter,
    search, setSearch, selectedId, setSelectedId, filteredItems, selectedItem,
  };
}

export type LibraryFilters = ReturnType<typeof useLibraryFilters>;
