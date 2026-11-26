import { Dispatch, SetStateAction } from 'react';
import { ReminderSettings, TaskeenItem } from '../types';
import DashboardView from './DashboardView';
import MuhasabahNiyyahView from './MuhasabahNiyyahView';
import ToolsView from './ToolsView';
import TodoQiblaReportsView from './TodoQiblaReportsView';
import SalahQiblaView from './SalahQiblaView';
import QuranView from './QuranView';
import NotesView from './NotesView';
import SettingsView, { DEFAULT_DASHBOARD_WIDGETS, UiPrefs } from './SettingsView';
import AboutView from './AboutView';
import LibraryView from './LibraryView';
import { DAILY_AMAL_LIST, Notify, ThemeId, ViewId } from '../lib/constants';
import { getLocalDateKey } from '../lib/date';
import { AmalifyState } from '../hooks/useAmalifyState';
import { AudioPlayer } from '../hooks/useAudioPlayer';
import { LibraryFilters } from '../hooks/useLibraryFilters';
import { ReadingPrefs } from '../hooks/useReadingPrefs';
import { useNotes } from '../hooks/useNotes';
import { ReviewLedger } from '../hooks/useReviewLedger';
import { CorrectionsApi } from '../hooks/useCorrections';

type SetState<T> = Dispatch<SetStateAction<T>>;

export interface ViewRouterProps {
  activeView: ViewId;
  setActiveView: (v: ViewId) => void;
  darkMode: boolean;
  theme: ThemeId;
  changeTheme: (t: ThemeId) => void;
  uiPrefs: UiPrefs;
  updateUiPrefs: (p: UiPrefs) => void;
  notify: Notify;
  items: TaskeenItem[];
  library: LibraryFilters;
  reading: ReadingPrefs;
  amal: AmalifyState;
  notesApi: ReturnType<typeof useNotes>;
  favorites: string[];
  setFavorites: SetState<string[]>;
  review: ReviewLedger;
  corrections: CorrectionsApi;
  exportReview: () => void;
  tadabburNotes: Record<string, string>;
  setTadabburNotes: SetState<Record<string, string>>;
  setCounts: SetState<Record<string, number>>;
  dailyDone: Record<string, boolean>;
  setDailyDone: SetState<Record<string, boolean>>;
  reminders: ReminderSettings;
  setReminders: SetState<ReminderSettings>;
  target: number;
  setTarget: (v: number) => void;
  currentCount: number;
  totalCount: number;
  incrementTasbih: () => void;
  audio: AudioPlayer;
  privacyBlur: boolean;
  setPrivacyBlur: SetState<boolean>;
  hasPin: boolean;
  nativeDbHash: string;
  nativeDbVerified: boolean | null;
  exportJson: () => void;
  onSelectItem: (item: TaskeenItem) => void;
  onOpenShare: () => void;
  onOpenPin: () => void;
  onOpenBackup: () => void;
  onOpenAbout: () => void;
  onOpenStats: () => void;
}

export default function ViewRouter(props: ViewRouterProps) {
  const {
    activeView, setActiveView, darkMode, theme, changeTheme, uiPrefs, updateUiPrefs, notify, items,
    library, reading, amal, notesApi, favorites, setFavorites, review, corrections, exportReview,
    tadabburNotes, setTadabburNotes, setCounts, dailyDone, setDailyDone, reminders, setReminders,
    target, setTarget, currentCount, totalCount, incrementTasbih, audio, privacyBlur, setPrivacyBlur,
    hasPin, nativeDbHash, nativeDbVerified, exportJson, onSelectItem, onOpenShare, onOpenPin,
    onOpenBackup, onOpenAbout, onOpenStats,
  } = props;
  const {
    prayers, cyclePrayer, todos, setTodos, fastingDays, setFastingDays, sadaqahList, setSadaqahList,
    quranState, setQuranState, muhasabahEntries, setMuhasabahEntries, niyyahGoals, setNiyyahGoals,
    zakatWealth, setZakatWealth, wasiyyah, setWasiyyah,
  } = amal;
  const { notes, noteCategories, saveNotes, saveNoteCategories } = notesApi;
  const selectedItem = library.selectedItem;

  return (
    <>
        {activeView === 'dashboard' && (
          <DashboardView
            darkMode={darkMode}
            selectedItem={selectedItem}
            currentCount={currentCount}
            target={target}
            onIncrementTasbih={incrementTasbih}
            prayers={prayers}
            onCyclePrayer={cyclePrayer}
            dailyAmalList={DAILY_AMAL_LIST}
            dailyDone={dailyDone}
            onToggleDaily={(id, checked) => setDailyDone((p) => ({ ...p, [id]: checked }))}
            todos={todos}
            onToggleTodo={(id) =>
              setTodos((prev) => prev.map((t) => (t.id === id ? { ...t, completed: !t.completed } : t)))
            }
            sadaqahList={sadaqahList}
            fastingDays={fastingDays}
            onToggleFasting={() => {
              const todayKey = getLocalDateKey();
              setFastingDays((p) => {
                const next = !p[todayKey];
                notify(next ? 'মাশাআল্লাহ! আজকের রোজা লগ হয়েছে।' : 'আজকের রোজা সরানো হয়েছে।');
                return { ...p, [todayKey]: next };
              });
            }}
            onNavigate={(v) => setActiveView(v)}
            widgets={{ ...DEFAULT_DASHBOARD_WIDGETS, ...(uiPrefs.dashboardWidgets || {}) }}
          />
        )}

        {activeView === 'quran' && (
          <QuranView
            darkMode={darkMode}
            quranState={quranState}
            onChangeQuran={setQuranState}
            onNotify={notify}
          />
        )}

        {activeView === 'salah' && (
          <SalahQiblaView
            darkMode={darkMode}
            prayers={prayers}
            onCyclePrayer={cyclePrayer}
            onNotify={notify}
          />
        )}

        {activeView === 'amal' && (
          <MuhasabahNiyyahView
            darkMode={darkMode}
            entries={muhasabahEntries}
            onAddEntry={(entry) => setMuhasabahEntries((p) => [entry, ...p])}
            goals={niyyahGoals}
            onUpdateGoals={setNiyyahGoals}
            onNotify={notify}
          />
        )}

        {activeView === 'life' && (
          <ToolsView
            darkMode={darkMode}
            sadaqahList={sadaqahList}
            onAddSadaqah={(s) => setSadaqahList((p) => [s, ...p])}
            zakatWealth={zakatWealth}
            onChangeZakatWealth={setZakatWealth}
            wasiyyah={wasiyyah}
            onSaveWasiyyah={setWasiyyah}
            onNotify={notify}
          />
        )}

        {activeView === 'notes' && (
          <NotesView
            notes={notes}
            categories={noteCategories}
            onSaveNotes={saveNotes}
            onSaveCategories={saveNoteCategories}
          />
        )}

        {activeView === 'settings' && (
          <SettingsView
            theme={theme}
            onChangeTheme={changeTheme}
            uiPrefs={uiPrefs}
            onChangeUiPrefs={updateUiPrefs}
            arabicFont={reading.arabicFont}
            onChangeArabicFont={reading.setArabicFont}
            arabicSize={reading.arabicSize}
            onChangeArabicSize={reading.setArabicSize}
            privacyBlur={privacyBlur}
            onTogglePrivacyBlur={() => setPrivacyBlur((v) => !v)}
            hasPin={hasPin}
            onOpenPinModal={() => onOpenPin()}
            onOpenBackupModal={() => onOpenBackup()}
            reminders={reminders}
            onChangeReminders={setReminders}
          />
        )}

        {activeView === 'about' && (
          <AboutView
            nativeDbHash={nativeDbHash}
            dbVerified={nativeDbVerified}
            onOpenFeedbackModal={() => onOpenAbout()}
          />
        )}

        {activeView === 'reports' && (
          <div className="space-y-2">
            <div className="px-6 pt-5 max-w-6xl mx-auto w-full flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs opacity-75">রিপোর্ট, টু-ডু ও নিরাপদ ব্যাকআপ</span>
              <div className="flex gap-2">
                <button onClick={() => onOpenBackup()} className="px-3 py-1.5 rounded-xl bg-[#0E5A45] text-white text-xs font-semibold">
                  এনক্রিপ্টেড ব্যাকআপ / রিস্টোর
                </button>
                <button onClick={exportJson} className="px-3 py-1.5 rounded-xl border border-[#D2DDD8] text-xs">
                  তাহকীক JSON এক্সপোর্ট
                </button>
                <button onClick={() => onOpenStats()} className="px-3 py-1.5 rounded-xl border border-[#D2DDD8] text-xs">
                  স্ট্রিক ও পরিসংখ্যান
                </button>
              </div>
            </div>
            <TodoQiblaReportsView
              darkMode={darkMode}
              todos={todos}
              onUpdateTodos={setTodos}
              prayers={prayers}
              totalTasbihCount={totalCount}
              sadaqahList={sadaqahList}
              muhasabahEntries={muhasabahEntries}
              onNotify={notify}
            />
          </div>
        )}

        {activeView === 'library' && (
          <LibraryView
            darkMode={darkMode}
            items={items}
            lib={library}
            reading={reading}
            onSelectItem={onSelectItem}
            favorites={favorites}
            setFavorites={setFavorites}
            review={review}
            corrections={corrections}
            onExportReview={exportReview}
            tadabburNotes={tadabburNotes}
            setTadabburNotes={setTadabburNotes}
            setCounts={setCounts}
            target={target}
            setTarget={setTarget}
            currentCount={currentCount}
            totalCount={totalCount}
            onIncrementTasbih={incrementTasbih}
            dailyDone={dailyDone}
            setDailyDone={setDailyDone}
            audio={audio}
            onOpenShare={onOpenShare}
            notify={notify}
          />
        )}
    </>
  );
}
