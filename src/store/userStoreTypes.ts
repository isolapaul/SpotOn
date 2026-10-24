import type { NotificationSettings, User } from '@/lib/mapUserDoc';
import type { AdminUser } from '@/lib/mapAdminDoc';

export interface LookedUpUser {
  uid: string;
  email: string;
  username: string;
  photoURL: string;
}

export interface UserStore {
  user: User | null;
  loading: boolean;
  needsUsername: boolean;
  /**
   * This session created the signed-in account: 'generated' when it got a generated username (Google,
   * or a missing user doc), 'chosen' for an e-mail sign-up with the typed one; null otherwise. Not
   * persisted. The onboarding's chosen name is claimed only for 'generated' (usePendingUsernameClaim).
   */
  newAccount: 'generated' | 'chosen' | null;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  adminUsers: AdminUser[];
  setUser: (user: User | null) => void;
  signInWithGoogle: () => Promise<void>;
  /** Sign in with Apple (same flow as Google: pop-up, redirect fallback, generated username). */
  signInWithApple: () => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signUpWithEmail: (email: string, password: string, username: string) => Promise<void>;
  signOut: () => Promise<void>;
  initAuth: () => Promise<void>;
  toggleFavorite: (spotId: string) => Promise<void>;
  addAdmin: (email: string) => Promise<void>;
  removeAdmin: (adminId: string) => Promise<void>;
  lookupUserByEmail: (email: string) => Promise<LookedUpUser | null>;
  checkUsernameAvailable: (username: string) => Promise<boolean>;
  updateUsername: (username: string) => Promise<void>;
  updateProfilePicture: (file: File) => Promise<void>;
  updateProfileBanner: (file: File) => Promise<void>;
  setNeedsUsername: (needs: boolean) => void;
  highlightSpot: (spotId: string) => Promise<void>;
  /**
   * Deletes the account on the server (deleteAccount callable, A2), then signs out locally only
   * (the user doc is gone, so no token cleanup write). Throws the callable error.
   */
  deleteAccount: (confirmUsername: string) => Promise<void>;
  /** Records that an existing user accepted the current terms (A1, TermsPrompt). Throws on failure. */
  acceptTerms: () => Promise<void>;
  unhighlightSpot: (spotId: string) => Promise<void>;
  updateCustomNameColor: (color: string) => Promise<void>;
  /** Item 8: the bio, a private profile, saved spots shown on the profile. */
  updateProfileFields: (fields: Partial<Pick<User, 'bio' | 'profilePrivate' | 'showSaved'>>) => Promise<void>;
  /** Level 4+: the special icon on all own spots' pins, or null for the category icons (item 6). */
  updatePinIcon: (icon: string | null) => Promise<void>;
  updateCustomNameFont: (font: string) => Promise<void>;
  updateNotificationSettings: (settings: NotificationSettings) => Promise<void>;
  getIdToken: () => Promise<string | null>;
}

/** A partial update of the store (the helpers outside the store creator only replace fields). */
export type SetState = (partial: Partial<UserStore>) => void;
/** The store's own set, also with an updater function. */
export type StoreSet = (partial: Partial<UserStore> | ((state: UserStore) => Partial<UserStore>)) => void;
export type StoreGet = () => UserStore;
