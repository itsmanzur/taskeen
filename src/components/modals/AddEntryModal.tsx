import { TaskeenItem } from '../../types';

export default function AddEntryModal({ onAdd, onClose }: { onAdd: (item: TaskeenItem) => void; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              const item: TaskeenItem = {
                id: 'custom-' + Date.now(),
                category: (fd.get('category') as TaskeenItem['category']) || 'dua',
                title_bn: String(fd.get('title') || ''),
                emotion_tag: String(fd.get('emotion') || 'ক্ষমা ও তাওবা'),
                arabic_uthmani: String(fd.get('arabic') || ''),
                bangla_meaning: String(fd.get('bangla') || ''),
                fazilat_text: String(fd.get('fazilat') || ''),
                story_title: String(fd.get('storyTitle') || 'প্রামাণিক ঘটনা'),
                story_context: String(fd.get('story') || ''),
                primary_source: String(fd.get('source') || ''),
                hadith_grade: String(fd.get('grade') || 'Unknown'),
                recommended_count: 33,
                verified: false,
                alim_note: 'ব্যক্তিগতভাবে যুক্ত (অযাচাইকৃত)',
              };
              onAdd(item);
            }}
            className="bg-white text-[#0F1A17] w-full max-w-lg rounded-2xl p-6 space-y-2.5 text-xs max-h-[90vh] overflow-y-auto"
          >
            <div className="flex justify-between items-center mb-2"><h3 className="font-serif-bn font-bold text-base">নতুন এন্ট্রি যোগ করুন</h3><button type="button" onClick={() => onClose()}>✕</button></div>
            <input name="title" required placeholder="শিরোনাম (বাংলায়)" className="w-full px-3 py-2 rounded border" />
            <div className="grid grid-cols-2 gap-2">
              <select name="category" className="w-full px-3 py-2 rounded border"><option value="dua">দোয়া</option><option value="durood">দরুদ</option><option value="istighfar">ইস্তেগফার</option></select>
              <select name="grade" defaultValue="Unknown" className="w-full px-3 py-2 rounded border"><option value="Unknown">হাদীসের মান: অযাচাইকৃত</option><option value="Sahih">সহীহ (Sahih)</option><option value="Hasan">হাসান (Hasan)</option><option value="Daif">যঈফ (Daif)</option></select>
            </div>
            <textarea name="arabic" required rows={2} dir="rtl" placeholder="আরবি পাঠ" className="w-full px-3 py-2 rounded border font-arabic-amiri text-base" />
            <textarea name="bangla" required rows={2} placeholder="বাংলা অনুবাদ" className="w-full px-3 py-2 rounded border" />
            <textarea name="fazilat" required rows={2} placeholder="ফজিলত" className="w-full px-3 py-2 rounded border" />
            <input name="source" required placeholder="রেফারেন্স (যেমন: সহীহ মুসলিম: ২৭২৬)" className="w-full px-3 py-2 rounded border" />
            <textarea name="story" rows={2} placeholder="প্রামাণিক ঘটনা" className="w-full px-3 py-2 rounded border" />
            <button type="submit" className="w-full py-2 rounded-lg bg-[#0E5A45] text-white font-semibold">সংরক্ষণ করুন</button>
          </form>
    </div>
  );
}
