import { TaskeenItem } from '../types';

/** Fields a reviewer actually checks. A change in any of them makes older reviews "outdated". */
export function reviewedFields(item: TaskeenItem) {
  return {
    arabic: item.arabic_uthmani,
    meaning: item.bangla_meaning,
    fazilat: item.fazilat_text,
    story: item.story_context || '',
    source: item.primary_source,
    grade: item.hadith_grade,
  };
}

export async function hashItem(item: TaskeenItem): Promise<string> {
  const data = new TextEncoder().encode(JSON.stringify(reviewedFields(item)));
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
}
