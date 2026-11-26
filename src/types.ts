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
