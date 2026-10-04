import { create } from 'zustand';
import {
  ONBOARDING_STORAGE_KEY,
  PENDING_USERNAME_STORAGE_KEY,
  completionRecord,
  isCompletionCurrent,
  isOnboardingDue,
  parseCompletion,
  sanitizeUsernameInput,
  type LocationChoice,
} from '@/lib/onboarding';
import { spotIdFromPath } from '@/lib/spotLinks';

// First-run onboarding state. The completion record and the pending username persist in
// localStorage (every access in try/catch: private mode can throw); without storage the tour shows
// once per page load at most, because completion is also kept in memory. Everything else is session
// state. Small on purpose: it is in the main bundle, the tour itself is lazy (components/onboarding).

/** Chromium's install offer (`beforeinstallprompt`), kept until the install step uses it. */
export interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export type InstallOutcome = 'accepted' | 'dismissed' | 'unavailable';

function read(key: string): string | null {
  try {
    return globalThis.localStorage?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

function write(key: string, value: string | null) {
  try {
    if (value === null) globalThis.localStorage?.removeItem(key);
    else globalThis.localStorage?.setItem(key, value);
  } catch {
    // Storage unavailable: the in-memory state still holds for this page load.
  }
}

/** The page opened on a shared spot link (read once, before useSpotLink rewrites the address to "/"). */
function openedOnSharedLink(): boolean {
  try {
    return spotIdFromPath(globalThis.location?.pathname) !== null;
  } catch {
    return false;
  }
}

function storedPendingUsername(): string | null {
  const raw = read(PENDING_USERNAME_STORAGE_KEY);
  const name = raw ? sanitizeUsernameInput(raw) : '';
  return name || null;
}

interface OnboardingStore {
  /** The current tour version was completed on this device (or in this page load). */
  completed: boolean;
  /** This page load started on /spot/<id>: the shared spot opens, the tour waits for the next visit. */
  sharedLink: boolean;
  /** The tour (or its closing line) is on screen. */
  running: boolean;
  /** The answer on the location step in this session. */
  locationChoice: LocationChoice | null;
  /** The name chosen in the tour, until sign-up claims it (persisted: Google may redirect away). */
  pendingUsername: string | null;
  /** A claim of the pending name is running (the username modal waits for it). */
  claiming: boolean;
  installPrompt: InstallPromptEvent | null;
  start: () => void;
  /** Records completion (persisted with the current version); the tour stays until close(). */
  complete: () => void;
  close: () => void;
  setLocationChoice: (choice: LocationChoice) => void;
  setPendingUsername: (name: string | null) => void;
  setClaiming: (claiming: boolean) => void;
  setInstallPrompt: (event: InstallPromptEvent | null) => void;
  /** Shows the browser's install dialog once (Chromium); 'unavailable' without an offer. */
  promptInstall: () => Promise<InstallOutcome>;
}

export const useOnboardingStore = create<OnboardingStore>((set, get) => ({
  completed: isCompletionCurrent(parseCompletion(read(ONBOARDING_STORAGE_KEY))),
  sharedLink: openedOnSharedLink(),
  running: false,
  locationChoice: null,
  pendingUsername: storedPendingUsername(),
  claiming: false,
  installPrompt: null,

  start: () => set({ running: true }),
  complete: () => {
    write(ONBOARDING_STORAGE_KEY, JSON.stringify(completionRecord(new Date())));
    set({ completed: true });
  },
  close: () => set({ running: false }),
  setLocationChoice: (locationChoice) => set({ locationChoice }),
  setPendingUsername: (name) => {
    const pendingUsername = name ? sanitizeUsernameInput(name) || null : null;
    write(PENDING_USERNAME_STORAGE_KEY, pendingUsername);
    set({ pendingUsername });
  },
  setClaiming: (claiming) => set({ claiming }),
  setInstallPrompt: (installPrompt) => set({ installPrompt }),
  promptInstall: async () => {
    const event = get().installPrompt;
    if (!event) return 'unavailable';
    // An offer can be used once.
    set({ installPrompt: null });
    try {
      await event.prompt();
      return (await event.userChoice).outcome;
    } catch {
      return 'unavailable';
    }
  },
}));

/** The tour is due or on screen: other first-run prompts and the automatic location request wait. */
export function selectTourBlocking(s: Pick<OnboardingStore, 'completed' | 'sharedLink' | 'running'>): boolean {
  return s.running || isOnboardingDue({ completed: s.completed, sharedLink: s.sharedLink });
}
