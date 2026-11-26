import { TaskeenItem } from '../../types';

export default function MiniMode({
  item,
  darkMode,
  currentCount,
  target,
  onIncrement,
  onExit,
}: {
  item: TaskeenItem;
  darkMode: boolean;
  currentCount: number;
  target: number;
  onIncrement: () => void;
  onExit: () => void;
}) {
  return (
      <div className={`${darkMode ? 'bg-[#080D0B] text-[#E7EFEA]' : 'bg-[#F7FAF8] text-[#0F1A17]'} min-h-screen p-4 flex flex-col justify-between`}>
        <div className="flex items-center justify-between gap-2 pb-2 border-b border-[#DCE3E0]">
          <span className="font-serif-bn font-bold text-sm truncate">{item.title_bn}</span>
          <button onClick={onExit} className="px-2 py-1 text-[11px] rounded border border-[#0E5A45] text-[#0A4736] shrink-0">বড় মোড</button>
        </div>
        <div className="my-3 p-3 rounded-xl border border-[#DCE3E0] bg-white/70 dark:bg-[#121F1B]">
          <p className="font-arabic-amiri text-right text-xl leading-loose">{item.arabic_uthmani}</p>
          <p className="text-xs opacity-80 mt-2 line-clamp-2">{item.bangla_meaning}</p>
        </div>
        <button onClick={onIncrement} className="w-full py-5 rounded-2xl bg-[#0E5A45] hover:bg-[#0A4736] text-white flex flex-col items-center justify-center shadow">
          <span className="font-mono-code text-4xl font-semibold">{currentCount}</span>
          <span className="text-[11px] opacity-80 mt-1">লক্ষ্য: {target} (ক্লিক / Space · Ctrl+Shift+T)</span>
        </button>
      </div>
  );
}
