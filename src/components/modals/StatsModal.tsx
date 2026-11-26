export default function StatsModal({
  totalCount,
  streakFreeze,
  onToggleFreeze,
  onClose,
}: {
  totalCount: number;
  streakFreeze: boolean;
  onToggleFreeze: () => void;
  onClose: () => void;
}) {
  return (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white text-[#0F1A17] w-full max-w-md rounded-2xl p-6 space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="font-serif-bn font-bold text-lg">পরিসংখ্যান ও স্ট্রিক</h3>
              <button onClick={() => onClose()}>✕</button>
            </div>
            <div className="grid grid-cols-2 gap-3 text-center">
              <div className="p-3 rounded-xl bg-[#F4F7F5]"><span className="text-xs block">মোট পাঠ</span><strong className="text-2xl font-mono-code">{totalCount}</strong></div>
              <div className="p-3 rounded-xl bg-[#FDF3E7]">
                <span className="text-xs block">স্ট্রিক ফ্রিজ</span>
                <button onClick={() => onToggleFreeze()} className="mt-1 px-2 py-0.5 rounded bg-[#B4690E] text-white text-xs">{streakFreeze ? 'সক্রিয় ✓' : 'বন্ধ'}</button>
              </div>
            </div>
            <button onClick={() => onClose()} className="w-full py-2 rounded-lg bg-[#0E5A45] text-white text-xs font-semibold">বন্ধ করুন</button>
          </div>
        </div>
  );
}
