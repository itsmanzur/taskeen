import { BarChart3, BookMarked, BookOpen, Compass, Home, Info, NotebookPen, Settings, Sparkles, Timer } from 'lucide-react';
import { NavItem } from './AppSidebar';

export const NAV_ITEMS: NavItem[] = [
  { id: 'dashboard', label: 'হোম ড্যাশবোর্ড', icon: <Home className="w-4 h-4" /> },
  { id: 'library', label: 'দোয়া ও তাহকীক', icon: <BookOpen className="w-4 h-4" /> },
  { id: 'quran', label: 'কুরআন ও খতম', icon: <BookMarked className="w-4 h-4" /> },
  { id: 'salah', label: 'নামাজ ও কিবলা', icon: <Compass className="w-4 h-4" /> },
  { id: 'amal', label: 'আমল ও মুহাসাবাহ', icon: <Sparkles className="w-4 h-4" /> },
  { id: 'life', label: 'ফোকাস, যাকাত ও ওসিয়ত', icon: <Timer className="w-4 h-4" /> },
  { id: 'notes', label: 'নোটবুক', icon: <NotebookPen className="w-4 h-4" /> },
  { id: 'reports', label: 'টু-ডু, রিপোর্ট ও ব্যাকআপ', icon: <BarChart3 className="w-4 h-4" /> },
  { id: 'settings', label: 'সেটিংস ও ফন্ট স্টুডিও', icon: <Settings className="w-4 h-4" /> },
  { id: 'about', label: 'পরিচিতি ও ডোনেট', icon: <Info className="w-4 h-4" /> },
];
