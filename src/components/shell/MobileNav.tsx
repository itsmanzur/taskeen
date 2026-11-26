import { ViewId } from '../../lib/constants';
import { NavItem } from './AppSidebar';

export default function MobileNav({
  navItems,
  activeView,
  darkMode,
  onSelectView,
}: {
  navItems: NavItem[];
  activeView: ViewId;
  darkMode: boolean;
  onSelectView: (v: ViewId) => void;
}) {
  return (
    <nav className={`md:hidden px-4 py-2 border-b flex gap-1.5 overflow-x-auto ${darkMode ? 'border-[#243832] bg-[#0F1916]' : 'border-[#DCE3E0] bg-white'}`}>
      {navItems.map((n) => (
        <button
          key={n.id}
          onClick={() => onSelectView(n.id)}
          className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap ${
            activeView === n.id ? 'bg-[#0E5A45] text-white' : 'opacity-75'
          }`}
        >
          {n.label}
        </button>
      ))}
    </nav>
  );
}
