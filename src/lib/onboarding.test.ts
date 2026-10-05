import { describe, expect, it } from 'vitest';
import {
  ONBOARDING_VERSION,
  canAdvanceByGesture,
  canContinueWithName,
  completionRecord,
  doneMessage,
  initialUsernameHint,
  installMode,
  isCompletionCurrent,
  isOnboardingDue,
  isStandaloneLaunch,
  locationChoiceOf,
  onboardingSteps,
  parseCompletion,
  pendingClaimAction,
  resolvedUsernameHint,
  sanitizeUsernameInput,
  shouldAutoRequestLocation,
  stepCopy,
} from './onboarding';
import { translations } from './translations';

describe('onboardingSteps', () => {
  const ctx = { signedIn: false, standalone: false, movedDomain: false };

  it('a new visitor in a browser tab gets every step', () => {
    expect(onboardingSteps(ctx)).toEqual(['welcome', 'name', 'discover', 'add', 'levels', 'location', 'install', 'signup']);
  });

  it('a signed-in user gets the returning tour without the name and sign-up steps', () => {
    expect(onboardingSteps({ ...ctx, signedIn: true })).toEqual(['welcome', 'discover', 'add', 'levels', 'location', 'install']);
  });

  it('drops the install step in the installed app and on the old domain', () => {
    expect(onboardingSteps({ ...ctx, standalone: true })).not.toContain('install');
    expect(onboardingSteps({ ...ctx, movedDomain: true })).not.toContain('install');
    expect(onboardingSteps({ signedIn: true, standalone: true, movedDomain: false })).toEqual(['welcome', 'discover', 'add', 'levels', 'location']);
  });

  it('has a heading for every step in every variant, in all languages', () => {
    for (const step of onboardingSteps(ctx)) {
      for (const returning of [false, true]) {
        for (const hasName of [false, true]) {
          const copy = stepCopy(step, { returning, hasName });
          for (const key of [copy.eyebrow, copy.title, copy.body].filter((k) => k !== undefined)) {
            for (const lang of ['hu', 'en', 'de'] as const) expect(translations[lang][key], `${lang}.${key}`).toBeTruthy();
          }
        }
      }
    }
    expect(stepCopy('signup', { returning: false, hasName: true }).title).toBe('onboardingSignupTitle');
    expect(stepCopy('signup', { returning: false, hasName: false }).title).toBe('onboardingSignupTitleNoName');
    expect(stepCopy('welcome', { returning: true, hasName: true }).eyebrow).toBe('onboardingWelcomeBackEyebrow');
    expect(stepCopy('welcome', { returning: true, hasName: false }).eyebrow).toBe('onboardingWelcomeBackEyebrowNoName');
  });
});

describe('installMode and isStandaloneLaunch', () => {
  it('prefers the browser install dialog, else the platform guide', () => {
    expect(installMode(true, 'iPhone')).toBe('prompt');
    expect(installMode(false, 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)')).toBe('ios');
    expect(installMode(false, 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', 5)).toBe('ios');
    expect(installMode(false, 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', 0)).toBe('android');
    expect(installMode(false, 'Mozilla/5.0 (Linux; Android 15)')).toBe('android');
  });

  it('detects the installed app three ways', () => {
    const tab = { displayStandalone: false, iosStandalone: false, referrer: 'https://example.com/' };
    expect(isStandaloneLaunch(tab)).toBe(false);
    expect(isStandaloneLaunch({ ...tab, displayStandalone: true })).toBe(true);
    expect(isStandaloneLaunch({ ...tab, iosStandalone: true })).toBe(true);
    expect(isStandaloneLaunch({ ...tab, referrer: 'android-app://hu.isolapaul.spoton/' })).toBe(true);
  });
});

describe('completion record', () => {
  it('round-trips and is versioned', () => {
    const record = completionRecord(new Date('2026-10-04T10:00:00Z'));
    expect(record).toEqual({ version: ONBOARDING_VERSION, completedAt: '2026-10-04T10:00:00.000Z' });
    expect(isCompletionCurrent(parseCompletion(JSON.stringify(record)))).toBe(true);
  });

  it('an older version shows the tour again; a newer one (rollback) does not', () => {
    expect(isCompletionCurrent({ version: 1, completedAt: 'x' }, 2)).toBe(false);
    expect(isCompletionCurrent({ version: 3, completedAt: 'x' }, 2)).toBe(true);
  });

  it('treats missing or malformed records as not completed', () => {
    for (const raw of [null, '', 'true', '1', '{', '[]', '{"version":"1","completedAt":"x"}', '{"version":1.5,"completedAt":"x"}', '{"version":1}']) {
      expect(isCompletionCurrent(parseCompletion(raw)), String(raw)).toBe(false);
    }
  });

  it('is due unless completed or opened on a shared spot link', () => {
    expect(isOnboardingDue({ completed: false, sharedLink: false })).toBe(true);
    expect(isOnboardingDue({ completed: true, sharedLink: false })).toBe(false);
    expect(isOnboardingDue({ completed: false, sharedLink: true })).toBe(false);
  });
});

describe('location', () => {
  it('holds the automatic request during the tour and after "not now"', () => {
    expect(shouldAutoRequestLocation({ tourBlocking: true, choice: null })).toBe(false);
    expect(shouldAutoRequestLocation({ tourBlocking: true, choice: 'allowed' })).toBe(false);
    expect(shouldAutoRequestLocation({ tourBlocking: false, choice: 'skipped' })).toBe(false);
    expect(shouldAutoRequestLocation({ tourBlocking: false, choice: null })).toBe(true);
    expect(shouldAutoRequestLocation({ tourBlocking: false, choice: 'allowed' })).toBe(true);
    expect(shouldAutoRequestLocation({ tourBlocking: false, choice: 'denied' })).toBe(true);
  });

  it('maps the request result', () => {
    expect(locationChoiceOf('granted')).toBe('allowed');
    expect(locationChoiceOf('denied')).toBe('denied');
    expect(locationChoiceOf('unsupported')).toBe('denied');
  });
});

describe('name step', () => {
  it('keeps only username characters, accents folded, 20 at most', () => {
    expect(sanitizeUsernameInput('Ádám Kovács')).toBe('adamkovacs');
    expect(sanitizeUsernameInput('  Anna_99! ')).toBe('anna_99');
    expect(sanitizeUsernameInput('Őrség-Ügyelet')).toBe('orsegugyelet');
    expect(sanitizeUsernameInput('a'.repeat(30))).toHaveLength(20);
    expect(sanitizeUsernameInput('日本')).toBe('');
  });

  it('runs empty → invalid → checking → available/taken/failed', () => {
    expect(initialUsernameHint('')).toBe('empty');
    expect(initialUsernameHint('an')).toBe('invalid');
    expect(initialUsernameHint('anna')).toBe('checking');
    expect(resolvedUsernameHint(true)).toBe('available');
    expect(resolvedUsernameHint(false)).toBe('taken');
    expect(resolvedUsernameHint(null)).toBe('failed');
  });

  it('continues with an available name, or when the check failed; never with a taken one', () => {
    expect(canContinueWithName('anna', 'available')).toBe(true);
    expect(canContinueWithName('anna', 'failed')).toBe(true);
    expect(canContinueWithName('anna', 'taken')).toBe(false);
    expect(canContinueWithName('anna', 'checking')).toBe(false);
    expect(canContinueWithName('an', 'available')).toBe(false);
  });
});

describe('navigation', () => {
  it('gestures pass the name and location steps only once answered, and never the last step', () => {
    const open = { nameReady: false, locationAnswered: false };
    expect(canAdvanceByGesture('discover', open)).toBe(true);
    expect(canAdvanceByGesture('name', open)).toBe(false);
    expect(canAdvanceByGesture('name', { ...open, nameReady: true })).toBe(true);
    expect(canAdvanceByGesture('location', open)).toBe(false);
    expect(canAdvanceByGesture('location', { ...open, locationAnswered: true })).toBe(true);
    expect(canAdvanceByGesture('signup', { nameReady: true, locationAnswered: true })).toBe(false);
  });
});

describe('doneMessage', () => {
  it('greets by name, by @username when returning, or without a name', () => {
    expect(doneMessage({ returning: false, name: 'anna' })).toEqual({ key: 'onboardingDoneTitle', vars: { name: 'anna' } });
    expect(doneMessage({ returning: true, name: 'anna' })).toEqual({ key: 'onboardingDoneBack', vars: { username: 'anna' } });
    expect(doneMessage({ returning: false, name: null })).toEqual({ key: 'onboardingDoneTitleNoName' });
    expect(doneMessage({ returning: true, name: null })).toEqual({ key: 'onboardingDoneTitleNoName' });
  });
});

describe('pendingClaimAction', () => {
  const base = {
    pending: 'anna',
    loading: false,
    signedIn: true,
    username: 'anna123456' as string | null,
    newAccount: 'generated' as 'generated' | 'chosen' | null,
    attempted: false,
    claiming: false,
    needsUsername: true,
  };

  it('does nothing without a pending name or while a claim runs', () => {
    expect(pendingClaimAction({ ...base, pending: null })).toBe('none');
    expect(pendingClaimAction({ ...base, claiming: true })).toBe('none');
  });

  it('waits for auth and for an account', () => {
    expect(pendingClaimAction({ ...base, loading: true })).toBe('wait');
    expect(pendingClaimAction({ ...base, signedIn: false })).toBe('wait');
  });

  it('claims once for a new account with a generated name (Google)', () => {
    expect(pendingClaimAction(base)).toBe('claim');
    // Redirect sign-in: no username modal flag, still a generated name.
    expect(pendingClaimAction({ ...base, needsUsername: false })).toBe('claim');
  });

  it('clears when the account has the name, or must keep its own', () => {
    expect(pendingClaimAction({ ...base, username: 'anna' })).toBe('clear');
    expect(pendingClaimAction({ ...base, newAccount: null })).toBe('clear');
    expect(pendingClaimAction({ ...base, newAccount: 'chosen' })).toBe('clear');
  });

  it('after a failed claim leaves it to the username modal, then clears', () => {
    expect(pendingClaimAction({ ...base, attempted: true, needsUsername: true })).toBe('none');
    expect(pendingClaimAction({ ...base, attempted: true, needsUsername: false })).toBe('clear');
  });
});

describe('worldTransform', () => {
  it('centres the camera point and lifts it on short screens', async () => {
    const { CAMERAS, worldTransform } = await import('./onboardingScene');
    const c = CAMERAS.discover;
    expect(worldTransform(c, 390, 844)).toBe(`translate3d(${(195 - c.cx * c.s).toFixed(1)}px, ${(844 * c.fy - c.cy * c.s).toFixed(1)}px, 0) scale(${c.s})`);
    expect(worldTransform(c, 320, 568)).toContain(`${(568 * (c.fyShort ?? 0) - c.cy * c.s).toFixed(1)}px`);
  });
});
