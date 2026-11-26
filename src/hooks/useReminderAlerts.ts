import { useEffect, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { ReminderSettings } from '../types';
import { computeOfflinePrayerTimes } from '../lib/prayerTimes';
import { getLocalDateKey } from '../lib/date';
import { Notify } from '../lib/constants';

/** Periodic zikr reminders + prayer-time alerts + tray "next prayer" label. */
export function useReminderAlerts(reminders: ReminderSettings, notify: Notify) {
  useEffect(() => {
    if (!reminders.enabled || reminders.silent) return;
    const mins = Math.max(15, Number(reminders.interval) || 60);
    const id = window.setInterval(() => {
      const isFriday = new Date().getDay() === 5;
      const title = isFriday && reminders.fridayDurood
        ? 'জুমআর দরূদ শরীফ স্মরণ'
        : 'তাসকীন — যিকির ও দোয়া স্মরণ';
      const body = isFriday && reminders.fridayDurood
        ? 'আজ জুমআর দিন। নবীজি ﷺ-এর ওপর বেশি বেশি দরূদ শরীফ পাঠ করুন।'
        : 'কাজের ফাঁকে কিছুক্ষণ আল্লাহর যিকির ও ইস্তেগফার করে নিন।';
      invoke('send_reminder_notification', { title, body }).catch(() => {});
    }, mins * 60 * 1000);
    return () => window.clearInterval(id);
  }, [reminders]);

  const lastPrayerAlertRef = useRef<string>('');
  useEffect(() => {
    const checkPrayerAlertAndTray = () => {
      try {
        const now = new Date();
        const nowMins = now.getHours() * 60 + now.getMinutes();
        const hhmm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
        const dateKey = getLocalDateKey(now);
        let prefs = { lat: 23.8103, lng: 90.4125, tz: 6, method: 'Karachi' as const, madhab: 'Hanafi' as const };
        try {
          const saved = localStorage.getItem('taskeen_prayer_prefs_v1');
          if (saved) prefs = { ...prefs, ...JSON.parse(saved) };
        } catch {}
        const times = computeOfflinePrayerTimes(now, prefs.lat, prefs.lng, prefs.tz, prefs.method, prefs.madhab);
        const waqts: [string, string][] = [
          [times.Fajr, 'ফজর'],
          [times.Dhuhr, 'যোহর'],
          [times.Asr, 'আসর'],
          [times.Maghrib, 'মাগরিব'],
          [times.Isha, 'ইশা'],
        ];

        // Update Windows System Tray next prayer label
        let nextLabel = `পরবর্তী: ফজর (${times.Fajr})`;
        for (const [tStr, bnName] of waqts) {
          const m = tStr.match(/(\d{1,2}):(\d{2})/);
          if (!m) continue;
          const pMins = parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
          if (pMins > nowMins) {
            const diff = pMins - nowMins;
            const dh = Math.floor(diff / 60);
            const dm = diff % 60;
            const rem = dh > 0 ? `${dh}ঘ ${dm}মি বাকি` : `${dm}মি বাকি`;
            nextLabel = `পরবর্তী: ${bnName} (${tStr}) · ${rem}`;
            break;
          }
        }
        invoke('update_tray_next_prayer', { label: nextLabel }).catch(() => {});

        if (!reminders.enabled || reminders.silent) return;
        for (const [tStr, bnName] of waqts) {
          const alertKey = `${dateKey}-${bnName}`;
          if (tStr === hhmm && lastPrayerAlertRef.current !== alertKey) {
            lastPrayerAlertRef.current = alertKey;
            notify(`নামাজের সময় হয়েছে: ${bnName} (${tStr})`);
            invoke('send_reminder_notification', {
              title: `নামাজের সময় হয়েছে: ${bnName}`,
              body: `এখন ${bnName} ওয়াক্তের সময় (${tStr})। ওযু করে নামাজের প্রস্তুতি নিন।`,
            }).catch(() => {});
          }
        }
      } catch {}
    };
    checkPrayerAlertAndTray();
    const id = window.setInterval(checkPrayerAlertAndTray, 30000);
    return () => window.clearInterval(id);
  }, [reminders]);
}
