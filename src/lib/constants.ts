import rawEntries from '../data/entries.json';
import { TaskeenItem } from '../types';

export const DEFAULT_ITEMS = rawEntries as TaskeenItem[];

export const DAILY_AMAL_LIST = [
  { id: 'amal_morning', label: 'সকালের মাসনুন যিকির ও সুরক্ষা' },
  { id: 'amal_istighfar', label: 'দৈনিক ১০০ বার ইস্তেগফার' },
  { id: 'amal_durood', label: 'নবীজি ﷺ-এর ওপর দরূদ শরীফ' },
  { id: 'amal_evening', label: 'সন্ধ্যার যিকির ও সাইয়িদুল ইস্তেগফার' },
];

export const EMOTIONS = [
  'ক্ষমা ও তাওবা',
  'ভালোবাসা ও দরুদ',
  'দুশ্চিন্তা ও ঋণ',
  'বিপদ ও সংকট',
  'রিজিক ও হালাল',
  'সকাল-সন্ধ্যা ও সুরক্ষা',
];

export type ViewId = 'dashboard' | 'library' | 'quran' | 'salah' | 'amal' | 'life' | 'notes' | 'reports' | 'settings' | 'about';
export type ThemeId = 'andalusia' | 'sandstone' | 'midnight' | 'subhe-sadiq';
export type Notify = (msg: string, ms?: number) => void;
