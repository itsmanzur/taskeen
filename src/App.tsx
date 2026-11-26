import { useEffect, useRef, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { ReminderSettings, TaskeenItem } from './types';
import AppSidebar from './components/shell/AppSidebar';
import MobileNav from './components/shell/MobileNav';
import { NAV_ITEMS } from './components/shell/navItems';
import TopBar from './components/shell/TopBar';
import MiniMode from './components/shell/MiniMode';
import ShareCardModal from './components/modals/ShareCardModal';
import StatsModal from './components/modals/StatsModal';
import ReminderModal from './components/modals/ReminderModal';
import BackupModal from './components/modals/BackupModal';
import AddEntryModal from './components/modals/AddEntryModal';
import AboutModal from './components/modals/AboutModal';
import { OnboardingWizard, PinLockScreen, PinSettingsModal } from './components/OnboardingAndPin';
import { CITY_PRESETS } from './lib/prayerTimes';
import { getCryptoStatus } from './lib/secureStorage';
import { saveTextFile } from './lib/saveFile';
import { getLocalDateKey } from './lib/date';
import { playSoftChime } from './lib/chime';
import { DAILY_AMAL_LIST, DEFAULT_ITEMS, ThemeId, ViewId } from './lib/constants';
import { useAudioPlayer } from './hooks/useAudioPlayer';
import { useReminderAlerts } from './hooks/useReminderAlerts';
import { useUiPrefs } from './hooks/useUiPrefs';
import { useUserDataSync } from './hooks/useUserDataSync';
import { useCorrections } from './hooks/useCorrections';
import { useReviewLedger } from './hooks/useReviewLedger';
import { useReadingPrefs } from './hooks/useReadingPrefs';
import { useLibraryFilters } from './hooks/useLibraryFilters';
import { useAmalifyState } from './hooks/useAmalifyState';
import { useNotes } from './hooks/useNotes';
import ViewRouter from './components/ViewRouter';

export default function App() {
  const [items, setItems] = useState<TaskeenItem[]>(() => {
    try {
      const saved = localStorage.getItem('taskeen_local_v1');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed.customItems)) {
          return [...parsed.customItems, ...DEFAULT_ITEMS];
        }
      }
    } catch {}
    return DEFAULT_ITEMS;
  });
  const [theme, setTheme] = useState<ThemeId>(() => {
    const saved = localStorage.getItem('taskeen_theme_v1');
    if (saved === 'andalusia' || saved === 'sandstone' || saved === 'midnight' || saved === 'subhe-sadiq') return saved;
    return 'andalusia';
  });
  const darkMode = theme === 'midnight' || theme === 'subhe-sadiq';
  const changeTheme = (t: ThemeId) => {
    setTheme(t);
    localStorage.setItem('taskeen_theme_v1', t);
  };
  const [favorites, setFavorites] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('taskeen_local_v1') || '{}').favorites || [];
    } catch { return []; }
  });
  const [counts, setCounts] = useState<Record<string, number>>(() => {
    try {
      return JSON.parse(localStorage.getItem('taskeen_local_v1') || '{}').counts || {};
    } catch { return {}; }
  });
  const [dailyDone, setDailyDone] = useState<Record<string, boolean>>(() => {
    try {
      return JSON.parse(localStorage.getItem('taskeen_local_v1') || '{}').dailyDone || {};
    } catch { return {}; }
  });
  const [tadabburNotes, setTadabburNotes] = useState<Record<string, string>>(() => {
    try {
      return JSON.parse(localStorage.getItem('taskeen_local_v1') || '{}').tadabburNotes || {};
    } catch { return {}; }
  });
  const [reminders, setReminders] = useState<ReminderSettings>({
    enabled: true,
    interval: '60',
    silent: true,
    fridayDurood: true,
  });

  const [target, setTarget] = useState<number>(100);
  const [streakFreeze, setStreakFreeze] = useState<boolean>(true);
  const [toast, setToast] = useState<string>('');
  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [showRemModal, setShowRemModal] = useState<boolean>(false);
  const [showStatsModal, setShowStatsModal] = useState<boolean>(false);
  const [showShareModal, setShowShareModal] = useState<boolean>(false);
  const [nativeDbHash, setNativeDbHash] = useState<string>('');
  const [nativeDbVerified, setNativeDbVerified] = useState<boolean | null>(null);
  const [miniMode, setMiniMode] = useState<boolean>(false);
  const [showBackupModal, setShowBackupModal] = useState<boolean>(false);
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  const [activeView, setActiveView] = useState<ViewId>('dashboard');
  const { uiPrefs, updateUiPrefs } = useUiPrefs();
  const corrections = useCorrections(items);
  const displayItems = corrections.displayItems;
  const review = useReviewLedger(displayItems);
  const reading = useReadingPrefs();
  const library = useLibraryFilters(displayItems, favorites, review.statusOf);
  const { search, setSearch, setSelectedId, selectedItem } = library;
  const amal = useAmalifyState();
  const notesApi = useNotes();

  const [onboardingDone, setOnboardingDone] = useState<boolean>(() => {
    return localStorage.getItem('taskeen_onboarding_done') === '1';
  });
  const [appPin, setAppPin] = useState<string>(() => localStorage.getItem('taskeen_app_pin') || '');
  const [isLocked, setIsLocked] = useState<boolean>(() => Boolean(localStorage.getItem('taskeen_app_pin')));
  const [showPinModal, setShowPinModal] = useState<boolean>(false);
  const [showAboutModal, setShowAboutModal] = useState<boolean>(false);
  const [privacyBlur, setPrivacyBlur] = useState<boolean>(false);
  const notify = (msg: string, ms = 2600) => {
    setToast(msg);
    window.setTimeout(() => setToast(''), ms);
  };
  useEffect(() => {
    const c = getCryptoStatus();
    if (c.recovered) {
      notify('নিরাপত্তা কী পাওয়া যায়নি, তাই পুরনো ডেটা ফাইল আলাদা করে রাখা হয়েছে। এনক্রিপ্টেড ব্যাকআপ থেকে রিস্টোর করুন।', 9000);
    } else if (c.error) {
      notify(`ডেটা এনক্রিপশন সক্রিয় নয়: ${c.error}`, 9000);
    }
  }, []);
  const toggleMiniMode = () => {
    setMiniMode((prev) => {
      const next = !prev;
      invoke('set_mini_mode', { mini: next }).catch(() => {});
      return next;
    });
  };

  useEffect(() => {
    let unlisten: (() => void) | undefined;
    listen('toggle-mini-mode', () => {
      toggleMiniMode();
    })
      .then((fn) => { unlisten = fn; })
      .catch(() => {});
    return () => { if (unlisten) unlisten(); };
  }, []);
  const { reloadAllUserData: reloadAllUserDataFromSqlite } = useUserDataSync({
    items, setItems, setSelectedId, setNativeDbHash, setNativeDbVerified,
    counts, setCounts, favorites, setFavorites, dailyDone, setDailyDone,
    tadabburNotes, setTadabburNotes, reminders, setReminders, selectedItem, ...amal,
  });
  useReminderAlerts(reminders, notify);
  const audio = useAudioPlayer(selectedItem, notify);

  const incrementTasbih = () => {
    if (!selectedItem) return;
    const nextVal = (counts[selectedItem.id] || 0) + 1;
    setCounts((prev) => ({ ...prev, [selectedItem.id]: nextVal }));
    if (nextVal === target) {
      playSoftChime();
      notify(`মাশাআল্লাহ! ${target} বার তাসবীহ পূর্ণ হয়েছে।`);
    }
  };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowAddModal(false);
        setShowRemModal(false);
        setShowStatsModal(false);
        setShowShareModal(false);
        setShowBackupModal(false);
        setShowPinModal(false);
        setShowAboutModal(false);
        return;
      }
      if (e.ctrlKey && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
        return;
      }
      if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 't') {
        e.preventDefault();
        toggleMiniMode();
        return;
      }
      const tag = (document.activeElement?.tagName || '').toUpperCase();
      if (e.code === 'Space' && !['INPUT', 'TEXTAREA', 'SELECT'].includes(tag)) {
        e.preventDefault();
        incrementTasbih();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });
  const exportReview = async () => {
    const bundle = {
      format: 'taskeen-review-export',
      version: 1,
      exported_at: new Date().toISOString(),
      reviewer: review.reviewerName,
      corrections: corrections.corrections,
      reviews: review.ledger,
    };
    const res = await saveTextFile(`taskeen-review-${getLocalDateKey()}.json`, JSON.stringify(bundle, null, 2), 'application/json', 'JSON', ['json']).catch((e) => {
      notify(String(e));
      return 'error' as const;
    });
    if (res === 'saved') notify('রিভিউ ও সংশোধনী এক্সপোর্ট হয়েছে');
    else if (res === 'cancelled') notify('সংরক্ষণ বাতিল করা হয়েছে');
  };

  const exportJson = async () => {
    const payload = displayItems.map((i) => ({ ...i, verified: undefined, tahqeeq_status: review.statusOf(i.id), tahqeeq_reviews: review.historyOf(i.id) }));
    const res = await saveTextFile('taskeen_tahqeeq_export.json', JSON.stringify(payload, null, 2), 'application/json', 'JSON', ['json']).catch((e) => {
      notify(String(e));
      return 'error' as const;
    });
    if (res !== 'saved') {
      if (res === 'cancelled') notify('সংরক্ষণ বাতিল করা হয়েছে');
      return;
    }
    notify('JSON ফাইল এক্সপোর্ট হয়েছে');
  };

  const totalCount = Object.values(counts).reduce((a, b) => a + b, 0);
  const verifiedTotal = review.counts.verified;
  const currentCount = selectedItem ? counts[selectedItem.id] || 0 : 0;

  if (isLocked && appPin) {
    return (
      <PinLockScreen
        expectedPin={appPin}
        onUnlock={(upgradedHash) => {
          if (upgradedHash) {
            setAppPin(upgradedHash);
            try { localStorage.setItem('taskeen_app_pin', upgradedHash); } catch {}
          }
          setIsLocked(false);
        }}
      />
    );
  }

  if (miniMode && selectedItem) {
    return (
      <MiniMode
        item={selectedItem}
        darkMode={darkMode}
        currentCount={currentCount}
        target={target}
        onIncrement={incrementTasbih}
        onExit={toggleMiniMode}
      />
    );
  }

  const dailyCompletedCount = DAILY_AMAL_LIST.filter((a) => dailyDone[a.id]).length;
  const dailyScorePct = Math.round((dailyCompletedCount / DAILY_AMAL_LIST.length) * 100);

  return (
    <div
      data-theme={theme}
      data-pattern={uiPrefs.patternEnabled ? 'on' : 'off'}
      className={`ts-shell ${privacyBlur ? 'privacy-blur-active' : ''} h-screen overflow-hidden flex`}
    >
      <AppSidebar
        navItems={NAV_ITEMS}
        activeView={activeView}
        onSelectView={setActiveView}
        dailyScorePct={dailyScorePct}
        nativeDbHash={nativeDbHash}
        darkMode={darkMode}
        onToggleDark={() => changeTheme(darkMode ? 'andalusia' : 'midnight')}
        onOpenAbout={() => setShowAboutModal(true)}
      />

      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden ts-shell">
        <TopBar
          searchInputRef={searchInputRef}
          search={search}
          onSearchChange={(v) => {
            setSearch(v);
            if (v.trim() && activeView !== 'library') setActiveView('library');
          }}
          darkMode={darkMode}
          privacyBlur={privacyBlur}
          onTogglePrivacy={() => {
            const next = !privacyBlur;
            setPrivacyBlur(next);
            notify(next ? 'প্রাইভেসি ব্লার চালু হয়েছে' : 'প্রাইভেসি ব্লার বন্ধ হয়েছে');
          }}
          hasPin={Boolean(appPin)}
          onLock={() => setIsLocked(true)}
          onToggleMini={toggleMiniMode}
          onOpenBackup={() => setShowBackupModal(true)}
          onOpenPin={() => setShowPinModal(true)}
          onOpenReminders={() => setShowRemModal(true)}
          onOpenAdd={() => setShowAddModal(true)}
        />

        <MobileNav navItems={NAV_ITEMS} activeView={activeView} darkMode={darkMode} onSelectView={setActiveView} />

        <div className="flex-1 overflow-y-auto ts-scroll-area flex flex-col">
        <ViewRouter
          {...{ activeView, setActiveView, darkMode, theme, changeTheme, uiPrefs, updateUiPrefs, notify, items: displayItems, library, reading, amal, notesApi, favorites, setFavorites, review, corrections, exportReview, tadabburNotes, setTadabburNotes, setCounts, dailyDone, setDailyDone, reminders, setReminders, target, setTarget, currentCount, totalCount, incrementTasbih, audio, privacyBlur, setPrivacyBlur, nativeDbHash, nativeDbVerified, exportJson }}
          hasPin={Boolean(appPin)}
          onSelectItem={(it) => {
            audio.stop();
            setSelectedId(it.id);
            setTarget(it.recommended_count || 33);
          }}
          onOpenShare={() => setShowShareModal(true)}
          onOpenPin={() => setShowPinModal(true)}
          onOpenBackup={() => setShowBackupModal(true)}
          onOpenAbout={() => setShowAboutModal(true)}
          onOpenStats={() => setShowStatsModal(true)}
        />
        </div>
      </div>

      {showShareModal && selectedItem && (
        <ShareCardModal item={selectedItem} onClose={() => setShowShareModal(false)} notify={notify} />
      )}

      {showStatsModal && (
        <StatsModal
          totalCount={totalCount}
          streakFreeze={streakFreeze}
          onToggleFreeze={() => setStreakFreeze((v) => !v)}
          onClose={() => setShowStatsModal(false)}
        />
      )}

      {showRemModal && (
        <ReminderModal reminders={reminders} setReminders={setReminders} onClose={() => setShowRemModal(false)} notify={notify} />
      )}

      {showBackupModal && (
        <BackupModal onClose={() => setShowBackupModal(false)} notify={notify} reloadAllUserData={reloadAllUserDataFromSqlite} />
      )}

      {showAddModal && (
        <AddEntryModal
          onAdd={(item) => {
            setItems([item, ...items]);
            setSelectedId(item.id);
            setShowAddModal(false);
            notify('নতুন এন্ট্রি যুক্ত হয়েছে');
          }}
          onClose={() => setShowAddModal(false)}
        />
      )}

      {!onboardingDone && (
        <OnboardingWizard
          onComplete={(cityName, madhab, defaultTarget) => {
            const found = CITY_PRESETS.find((c) => c.name === cityName) || CITY_PRESETS[0];
            localStorage.setItem(
              'taskeen_prayer_prefs_v1',
              JSON.stringify({
                name: found.name,
                lat: found.lat,
                lng: found.lng,
                tz: found.tz,
                method: 'Karachi',
                madhab,
              })
            );
            localStorage.setItem('taskeen_onboarding_done', '1');
            setTarget(defaultTarget);
            setOnboardingDone(true);
            notify('সেটিংস সেভ হয়েছে! তাসকীনে স্বাগতম।');
          }}
        />
      )}

      {showPinModal && (
        <PinSettingsModal
          hasPin={Boolean(appPin)}
          onSavePin={(newPin) => {
            setAppPin(newPin);
            if (newPin) {
              localStorage.setItem('taskeen_app_pin', newPin);
              notify('অ্যাপ পিন লক সক্রিয় হয়েছে');
            } else {
              localStorage.removeItem('taskeen_app_pin');
              notify('অ্যাপ পিন লক বন্ধ করা হয়েছে');
            }
          }}
          onClose={() => setShowPinModal(false)}
        />
      )}

      {showAboutModal && (
        <AboutModal
          verifiedTotal={verifiedTotal}
          itemsCount={displayItems.length}
          nativeDbHash={nativeDbHash}
          nativeDbVerified={nativeDbVerified}
          onClose={() => setShowAboutModal(false)}
          notify={notify}
        />
      )}

      {toast && <div className="fixed bottom-5 right-5 z-50 px-4 py-2 rounded-xl bg-[#0E5A45] text-white text-xs shadow-lg">{toast}</div>}
    </div>
  );
}