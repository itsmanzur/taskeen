import { useState } from 'react';

export function useReadingPrefs() {
  const [arabicSize, setArabicSize] = useState<number>(28);
  const [arabicFont, setArabicFont] = useState<'amiri' | 'scheherazade'>('amiri');
  const [showPronunciation, setShowPronunciation] = useState<boolean>(true);
  return { arabicSize, setArabicSize, arabicFont, setArabicFont, showPronunciation, setShowPronunciation };
}

export type ReadingPrefs = ReturnType<typeof useReadingPrefs>;
