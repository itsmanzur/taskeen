import { invoke } from '@tauri-apps/api/core';
import { ReminderSettings } from '../../types';
import { Notify } from '../../lib/constants';

export default function ReminderModal({
  reminders,
  setReminders,
  onClose,
  notify,
}: {
  reminders: ReminderSettings;
  setReminders: (r: ReminderSettings) => void;
  onClose: () => void;
  notify: Notify;
}) {
  return (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white text-[#0F1A17] w-full max-w-md rounded-2xl p-6 space-y-3 text-sm">
            <div className="flex justify-between items-center">
              <h3 className="font-serif-bn font-bold text-lg">রিমাইন্ডার সেটিংস</h3>
              <button onClick={() => onClose()}>✕</button>
            </div>
            <label className="flex justify-between"><span>রিমাইন্ডার চালু</span><input type="checkbox" checked={reminders.enabled} onChange={(e) => setReminders({ ...reminders, enabled: e.target.checked })} /></label>
            <label className="flex justify-between items-center">
              <span>বিরতি (মিনিট)</span>
              <select value={reminders.interval} onChange={(e) => setReminders({ ...reminders, interval: e.target.value })} className="px-2 py-1 rounded border text-xs">
                <option value="30">৩০ মিনিট</option>
                <option value="60">১ ঘণ্টা</option>
                <option value="120">২ ঘণ্টা</option>
              </select>
            </label>
            <label className="flex justify-between"><span>সাইলেন্ট / মিটিং মোড</span><input type="checkbox" checked={reminders.silent} onChange={(e) => setReminders({ ...reminders, silent: e.target.checked })} /></label>
            <label className="flex justify-between"><span>জুমআর দরূদ স্মরণ</span><input type="checkbox" checked={reminders.fridayDurood} onChange={(e) => setReminders({ ...reminders, fridayDurood: e.target.checked })} /></label>
            <div className="flex gap-2 pt-1">
              <button
                onClick={() => {
                  invoke('send_reminder_notification', {
                    title: 'তাসকীন — টেস্ট নোটিফিকেশন',
                    body: 'আলহামদুলিল্লাহ! ডেস্কটপ নোটিফিকেশন সঠিকভাবে কাজ করছে।',
                  })
                    .then(() => notify('নোটিফিকেশন পাঠানো হয়েছে'))
                    .catch(() => notify('ডেস্কটপ অ্যাপ মোডে নোটিফিকেশন কাজ করে'));
                }}
                className="flex-1 py-2 rounded-lg border border-[#0E5A45] text-[#0A4736] text-xs font-semibold"
              >
                টেস্ট নোটিফিকেশন
              </button>
              <button onClick={() => { onClose(); notify('রিমাইন্ডার সেভ হয়েছে'); }} className="flex-1 py-2 rounded-lg bg-[#0E5A45] text-white text-xs font-semibold">সেভ করুন</button>
            </div>
          </div>
        </div>
  );
}
