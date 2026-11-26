import { useCallback, useMemo, useState } from 'react';
import { TaskeenItem } from '../types';

export interface CorrectionRecord {
  primary_source?: string;
  hadith_grade?: string;
  /** The values in the bundled data when the correction was made (used to detect conflicts later). */
  original: { primary_source: string; hadith_grade: string };
  reviewer: string;
  at: string;
}

const KEY = 'taskeen_corrections_v1';

/**
 * Reviewer corrections to a reference/grade. They overlay the bundled data immediately, are stored
 * encrypted, and can be exported and written back into the canonical entries.json (scripts/apply_review.mjs).
 */
export function useCorrections(items: TaskeenItem[]) {
  const [corrections, setCorrections] = useState<Record<string, CorrectionRecord>>(() => {
    try { return JSON.parse(localStorage.getItem(KEY) || '{}'); } catch { return {}; }
  });

  const persist = (next: Record<string, CorrectionRecord>) => {
    setCorrections(next);
    try { localStorage.setItem(KEY, JSON.stringify(next)); } catch {}
  };

  const displayItems = useMemo(
    () =>
      items.map((it) => {
        const c = corrections[it.id];
        if (!c) return it;
        return {
          ...it,
          primary_source: c.primary_source ?? it.primary_source,
          hadith_grade: c.hadith_grade ?? it.hadith_grade,
        };
      }),
    [items, corrections]
  );

  const baseOf = useCallback((id: string) => items.find((i) => i.id === id), [items]);

  const save = (id: string, fields: { primary_source: string; hadith_grade: string }, reviewer: string) => {
    const base = baseOf(id);
    if (!base) return;
    const changedSource = fields.primary_source.trim() !== base.primary_source;
    const changedGrade = fields.hadith_grade.trim() !== base.hadith_grade;
    if (!changedSource && !changedGrade) {
      const { [id]: _removed, ...rest } = corrections;
      persist(rest);
      return;
    }
    persist({
      ...corrections,
      [id]: {
        ...(changedSource ? { primary_source: fields.primary_source.trim() } : {}),
        ...(changedGrade ? { hadith_grade: fields.hadith_grade.trim() } : {}),
        original: { primary_source: base.primary_source, hadith_grade: base.hadith_grade },
        reviewer: reviewer.trim() || 'অজ্ঞাত',
        at: new Date().toISOString(),
      },
    });
  };

  const revert = (id: string) => {
    const { [id]: _removed, ...rest } = corrections;
    persist(rest);
  };

  return { corrections, displayItems, baseOf, save, revert, count: Object.keys(corrections).length };
}

export type CorrectionsApi = ReturnType<typeof useCorrections>;
