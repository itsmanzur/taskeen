import { useCallback, useEffect, useMemo, useState } from 'react';
import { TaskeenItem } from '../types';
import { hashItem } from '../lib/contentHash';

export type StoryGrade = 'sahih' | 'hasan' | 'daif' | 'popular' | 'unknown';
export const STORY_GRADE_LABEL: Record<StoryGrade, string> = {
  sahih: 'সহীহ সনদে প্রমাণিত',
  hasan: 'হাসান সনদে প্রমাণিত',
  daif: 'দুর্বল সনদ',
  popular: 'প্রচলিত — সনদ যাচাই হয়নি',
  unknown: 'এখনও নির্ধারিত নয়',
};

export interface ReviewChecks {
  arabic: boolean;
  meaning: boolean;
  reference: boolean;
  grade: boolean;
  story: boolean;
}

export interface ReviewRecord {
  id: string;
  reviewer: string;
  at: string; // ISO
  status: 'approved' | 'needs_fix';
  checks: ReviewChecks;
  story_grade: StoryGrade;
  note: string;
  content_hash: string;
}

export type ReviewStatusKey = 'unreviewed' | 'verified' | 'needs_fix' | 'outdated';
export const REVIEW_STATUS_LABEL: Record<ReviewStatusKey, string> = {
  unreviewed: '⏳ যাচাই বাকি',
  verified: '✓ আলেম-যাচাইকৃত',
  needs_fix: '⚠ সংশোধন দরকার',
  outdated: '↻ পরিবর্তিত — আবার যাচাই করুন',
};

const LEDGER_KEY = 'taskeen_review_ledger_v1';
const REVIEWER_KEY = 'taskeen_reviewer_name_v1';

type Ledger = Record<string, ReviewRecord[]>;

/**
 * Local tahqeeq ledger. Every review is bound to a SHA-256 of the reviewed fields, so a later
 * content change can never silently keep a "verified" badge. Stored via the encrypted localStorage shim.
 */
export function useReviewLedger(items: TaskeenItem[]) {
  const [ledger, setLedger] = useState<Ledger>(() => {
    try { return JSON.parse(localStorage.getItem(LEDGER_KEY) || '{}'); } catch { return {}; }
  });
  const [reviewerName, setReviewerNameState] = useState<string>(() => localStorage.getItem(REVIEWER_KEY) || '');
  const [hashes, setHashes] = useState<Record<string, string>>({});

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const next: Record<string, string> = {};
      for (const it of items) next[it.id] = await hashItem(it);
      if (!cancelled) setHashes(next);
    })().catch(() => {});
    return () => { cancelled = true; };
  }, [items]);

  const setReviewerName = (v: string) => {
    setReviewerNameState(v);
    try { localStorage.setItem(REVIEWER_KEY, v); } catch {}
  };

  const historyOf = useCallback(
    (id: string): ReviewRecord[] => [...(ledger[id] || [])].sort((a, b) => b.at.localeCompare(a.at)),
    [ledger]
  );

  const statusOf = useCallback(
    (id: string): ReviewStatusKey => {
      const list = ledger[id];
      if (!list || list.length === 0) return 'unreviewed';
      const latest = [...list].sort((a, b) => b.at.localeCompare(a.at))[0];
      if (hashes[id] && latest.content_hash !== hashes[id]) return 'outdated';
      return latest.status === 'approved' ? 'verified' : 'needs_fix';
    },
    [ledger, hashes]
  );

  const addReview = async (
    item: TaskeenItem,
    input: Pick<ReviewRecord, 'status' | 'checks' | 'story_grade' | 'note'>
  ): Promise<void> => {
    const content_hash = hashes[item.id] || (await hashItem(item));
    const record: ReviewRecord = {
      id: `rv-${Date.now()}`,
      reviewer: reviewerName.trim() || 'অজ্ঞাত',
      at: new Date().toISOString(),
      content_hash,
      ...input,
    };
    setLedger((prev) => {
      const next = { ...prev, [item.id]: [...(prev[item.id] || []), record] };
      try { localStorage.setItem(LEDGER_KEY, JSON.stringify(next)); } catch {}
      return next;
    });
  };

  const counts = useMemo(() => {
    const c = { verified: 0, needs_fix: 0, outdated: 0, unreviewed: 0, total: items.length };
    for (const it of items) c[statusOf(it.id)] += 1;
    return c;
  }, [items, statusOf]);

  const latestStoryGrade = (id: string): StoryGrade => {
    const h = historyOf(id).find((r) => r.story_grade !== 'unknown');
    return h ? h.story_grade : 'unknown';
  };

  return { ledger, reviewerName, setReviewerName, statusOf, historyOf, addReview, counts, latestStoryGrade };
}

export type ReviewLedger = ReturnType<typeof useReviewLedger>;
