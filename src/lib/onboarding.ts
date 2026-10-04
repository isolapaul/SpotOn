// First-run onboarding (the tour over the demo map scene). Pure rules: which steps a visitor sees,
// the versioned completion record, the name step's username hint, and what the app does with the
// name chosen before signing up. No React, Firebase or DOM; the store and hooks apply them.
import { USERNAME_RE } from './username';
import type { TranslationKey } from './translations';

/**
 * Bump to show the tour again to everyone (also those who completed an earlier version). The
 * record lives under ONBOARDING_STORAGE_KEY as `{ version, completedAt }`.
 */
export const ONBOARDING_VERSION = 1;
export const ONBOARDING_STORAGE_KEY = 'spoton-onboarding';
/** The name chosen in the tour, kept until sign-up claims it (or the account keeps another one). */
export const PENDING_USERNAME_STORAGE_KEY = 'spoton-pending-username';

export type OnboardingStep = 'welcome' | 'name' | 'discover' | 'add' | 'levels' | 'location' | 'install' | 'signup';

export interface OnboardingContext {
  /** Signed in when the tour starts: the returning-user variant, without the name and sign-up steps. */
  signedIn: boolean;
  /** Running as the installed app (display-mode standalone, iOS navigator.standalone, TWA referrer). */
  standalone: boolean;
  /** The old (Vercel) domain: installing there would install the wrong origin (T19). */
  movedDomain: boolean;
}

/** The tour for a visitor, in order. */
export function onboardingSteps(ctx: OnboardingContext): OnboardingStep[] {
  const steps: OnboardingStep[] = ['welcome'];
  if (!ctx.signedIn) steps.push('name');
  steps.push('discover', 'add', 'levels', 'location');
  if (!ctx.standalone && !ctx.movedDomain) steps.push('install');
  if (!ctx.signedIn) steps.push('signup');
  return steps;
}

/** How the install step helps: the browser's own install dialog when it offers one, else instructions. */
export type InstallMode = 'prompt' | 'ios' | 'android';

export function installMode(canPrompt: boolean, userAgent: string, maxTouchPoints = 0): InstallMode {
  if (canPrompt) return 'prompt';
  // iPadOS reports a Mac user agent; its touch points give it away.
  const ios = /iPhone|iPad|iPod/i.test(userAgent) || (/Macintosh/.test(userAgent) && maxTouchPoints > 1);
  return ios ? 'ios' : 'android';
}

/** True for an installed app: display-mode standalone, iOS home screen, or a TWA (android-app:// referrer). */
export function isStandaloneLaunch(v: { displayStandalone: boolean; iosStandalone: boolean; referrer: string }): boolean {
  return v.displayStandalone || v.iosStandalone || v.referrer.startsWith('android-app://');
}

// ---- Completion record ------------------------------------------------------------------------

export interface OnboardingCompletion {
  version: number;
  completedAt: string;
}

/** The stored record, or null when missing or malformed. */
export function parseCompletion(raw: string | null): OnboardingCompletion | null {
  if (!raw) return null;
  try {
    const v: unknown = JSON.parse(raw);
    if (typeof v !== 'object' || v === null) return null;
    const { version, completedAt } = v as Record<string, unknown>;
    if (typeof version !== 'number' || !Number.isInteger(version) || typeof completedAt !== 'string') return null;
    return { version, completedAt };
  } catch {
    return null;
  }
}

/** Completed the current version (or a later one: a rollback must not show it again). */
export function isCompletionCurrent(c: OnboardingCompletion | null, current = ONBOARDING_VERSION): boolean {
  return c !== null && c.version >= current;
}

export function completionRecord(now: Date, version = ONBOARDING_VERSION): OnboardingCompletion {
  return { version, completedAt: now.toISOString() };
}

/**
 * The tour is due on this page load: not completed, and the page did not open on a shared spot link
 * (share links open their spot; the tour starts on the next visit instead).
 */
export function isOnboardingDue(v: { completed: boolean; sharedLink: boolean }): boolean {
  return !v.completed && !v.sharedLink;
}

// ---- Location -----------------------------------------------------------------------------------

/** The answer on the location step: allowed, "not now", or the browser refused (or has no geolocation). */
export type LocationChoice = 'allowed' | 'skipped' | 'denied';

export function locationChoiceOf(result: 'granted' | 'denied' | 'unsupported'): LocationChoice {
  return result === 'granted' ? 'allowed' : 'denied';
}

/**
 * Whether the map's one automatic location request may run: never while the tour is due or open
 * (the location step asks instead), and not again in this session after "not now".
 */
export function shouldAutoRequestLocation(v: { tourBlocking: boolean; choice: LocationChoice | null }): boolean {
  return !v.tourBlocking && v.choice !== 'skipped';
}

export const LOCATION_RESULT_KEY: Readonly<Record<LocationChoice, TranslationKey>> = {
  allowed: 'onboardingLocationAllowed',
  skipped: 'onboardingLocationSkipped',
  denied: 'onboardingLocationDenied',
};

// ---- Name step ----------------------------------------------------------------------------------

export const USERNAME_MAX_LENGTH = 20;

/**
 * What the name field keeps of the typed text: lowercase a–z, 0–9 and _ (accents dropped, so
 * "Ádám" becomes "adam"), at most 20 characters. The result follows lib/username's rules.
 */
export function sanitizeUsernameInput(raw: string): string {
  return raw
    .normalize('NFD')
    .replaceAll(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replaceAll(/[^a-z0-9_]/g, '')
    .slice(0, USERNAME_MAX_LENGTH);
}

/** The name step's hint (a hint only: nothing is reserved until sign-up). */
export type UsernameHint = 'empty' | 'invalid' | 'checking' | 'available' | 'taken' | 'failed';

/** The hint before the registry answers: empty, invalid, or checking (a valid name is looked up). */
export function initialUsernameHint(name: string): UsernameHint {
  if (name === '') return 'empty';
  return USERNAME_RE.test(name) ? 'checking' : 'invalid';
}

/** The hint once the lookup for `name` finished: `available` true/false, or null when it failed. */
export function resolvedUsernameHint(available: boolean | null): UsernameHint {
  if (available === null) return 'failed';
  return available ? 'available' : 'taken';
}

/** Next with this name: a valid name nobody is known to hold (a failed check does not block). */
export function canContinueWithName(name: string, hint: UsernameHint): boolean {
  return USERNAME_RE.test(name) && (hint === 'available' || hint === 'failed');
}

/** Debounce of the availability lookup while typing. */
export const USERNAME_CHECK_DEBOUNCE_MS = 400;

// ---- Navigation ---------------------------------------------------------------------------------

/**
 * Steps a swipe or the arrow key may not leave forwards: each needs an answer from its own
 * buttons (name: Next or "I'll choose later"; location: allow or not now; sign-up: the last step).
 */
export function canAdvanceByGesture(step: OnboardingStep, v: { nameReady: boolean; locationAnswered: boolean }): boolean {
  if (step === 'name') return v.nameReady;
  if (step === 'location') return v.locationAnswered;
  return step !== 'signup';
}

/** Horizontal drag (px) that changes the step, and how much more horizontal than vertical it must be. */
export const SWIPE_STEP = { distance: 60, ratio: 1.4 } as const;

// ---- Greetings ----------------------------------------------------------------------------------

/** The closing line on the map: by name, by @username for a returning user, or without a name. */
export function doneMessage(v: { returning: boolean; name: string | null }): { key: TranslationKey; vars?: Record<string, string> } {
  if (v.returning && v.name) return { key: 'onboardingDoneBack', vars: { username: v.name } };
  if (v.name) return { key: 'onboardingDoneTitle', vars: { name: v.name } };
  return { key: 'onboardingDoneTitleNoName' };
}

// ---- The name after sign-up ---------------------------------------------------------------------

export type PendingClaimAction = 'none' | 'wait' | 'claim' | 'clear';

/**
 * What to do with the name chosen in the tour (`pending`) once an account exists:
 * - wait while auth is unresolved or nobody is signed in;
 * - clear it when the account already has it, when the account is not new (never rename an existing
 *   account that signed in from the tour), or when an e-mail sign-up chose its name in the form;
 * - claim it once for a new account with a generated name (Google);
 * - after a failed claim the username modal asks (prefilled); clear once it is answered.
 */
export function pendingClaimAction(v: {
  pending: string | null;
  loading: boolean;
  signedIn: boolean;
  username: string | null;
  /** How this session's new account got its username (null: not created in this session). */
  newAccount: 'generated' | 'chosen' | null;
  attempted: boolean;
  /** A claim is running: wait for its answer. */
  claiming: boolean;
  needsUsername: boolean;
}): PendingClaimAction {
  if (!v.pending || v.claiming) return 'none';
  if (v.loading || !v.signedIn) return 'wait';
  if (v.username === v.pending) return 'clear';
  if (v.attempted) return v.needsUsername ? 'none' : 'clear';
  // An existing account keeps its name; an e-mail sign-up already used (or changed) the prefilled one.
  if (v.newAccount !== 'generated') return 'clear';
  return 'claim';
}

// ---- Copy per step ------------------------------------------------------------------------------

export interface StepCopy {
  eyebrow?: TranslationKey;
  title: TranslationKey;
  body: TranslationKey;
}

/** The heading copy of a step (the card and the screen-reader announcement share it). */
export function stepCopy(step: OnboardingStep, v: { returning: boolean; hasName: boolean }): StepCopy {
  switch (step) {
    case 'welcome':
      return v.returning
        ? { eyebrow: v.hasName ? 'onboardingWelcomeBackEyebrow' : 'onboardingWelcomeBackEyebrowNoName', title: 'onboardingWelcomeBackTitle', body: 'onboardingWelcomeBackBody' }
        : { eyebrow: 'onboardingWelcomeEyebrow', title: 'onboardingWelcomeTitle', body: 'onboardingWelcomeBody' };
    case 'name':
      return { title: 'onboardingNameTitle', body: 'onboardingNameBody' };
    case 'discover':
      return { eyebrow: 'onboardingDiscoverEyebrow', title: 'onboardingDiscoverTitle', body: 'onboardingDiscoverBody' };
    case 'add':
      return { eyebrow: 'onboardingAddEyebrow', title: 'onboardingAddTitle', body: 'onboardingAddBody' };
    case 'levels':
      return { eyebrow: 'onboardingLevelsEyebrow', title: 'onboardingLevelsTitle', body: 'onboardingLevelsBody' };
    case 'location':
      return { eyebrow: 'locationHeader', title: 'onboardingLocationTitle', body: 'onboardingLocationBody' };
    case 'install':
      return { title: 'onboardingInstallTitle', body: 'onboardingInstallBody' };
    case 'signup':
      return { title: v.hasName ? 'onboardingSignupTitle' : 'onboardingSignupTitleNoName', body: 'onboardingSignupBody' };
  }
}
