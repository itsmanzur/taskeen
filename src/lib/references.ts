import { ReferenceInfo, SourceRef } from '../types';

let cache: Promise<Record<string, ReferenceInfo>> | null = null;

/** Loaded lazily: ~200 KB of generated cross-check data that is only needed in the review panel. */
export function loadReferences(): Promise<Record<string, ReferenceInfo>> {
  if (!cache) {
    cache = import('../data/references.json').then((m) => (m.default as { entries: Record<string, ReferenceInfo> }).entries);
  }
  return cache;
}

export function referenceUrl(r: SourceRef): string | null {
  if (r.kind === 'quran' && r.surah && r.ayah_from) return `https://quran.com/${r.surah}/${r.ayah_from}`;
  if (r.kind === 'hadith' && r.number && r.book_key && r.book_key !== 'malik') return `https://sunnah.com/${r.book_key}:${r.number}`;
  return null;
}
