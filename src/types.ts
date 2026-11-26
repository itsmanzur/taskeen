export type Category = 'dua' | 'durood' | 'istighfar';

export interface TaskeenItem {
  id: string;
  category: Category;
  title_bn: string;
  emotion_tag: string;
  arabic_uthmani: string;
  bangla_pronunciation?: string;
  bangla_meaning: string;
  fazilat_text: string;
  story_title?: string;
  story_context?: string;
  primary_source: string;
  hadith_grade: string;
  recommended_count: number;
  verified: boolean;
  alim_note?: string;
}

export interface ReminderSettings {
  enabled: boolean;
  interval: string;
  silent: boolean;
  fridayDurood: boolean;
}

export type RefStatus = 'match' | 'partial' | 'mismatch' | 'unchecked';

export interface RefCheck {
  status: RefStatus;
  score: number;
  weak?: boolean;
  reason?: string;
  excerpt?: string;
  grades?: { name: string; grade: string }[];
  suggested?: { number: number; score: number };
}

export interface SourceRef {
  kind: 'hadith' | 'quran' | 'other';
  raw: string;
  book_key?: string;
  book_bn?: string;
  book_en?: string;
  number?: number;
  surah?: number;
  surah_name_bn?: string;
  ayah_from?: number;
  ayah_to?: number;
  check: RefCheck;
}

export interface ReferenceInfo {
  refs: SourceRef[];
  overall: RefStatus;
}
