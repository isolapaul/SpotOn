import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { createAdminActions } from './userAdmin';
import { createAuthActions } from './userAuthActions';
import { createProfileActions } from './userProfileActions';
import type { UserStore } from './userStoreTypes';

export type { User } from '@/lib/mapUserDoc';
export type { LookedUpUser } from './userStoreTypes';
export { userErrorKey } from './userErrors';

// The store's actions live in userAuthActions (sign-in, sign-out, the auth listener, account
// deletion), userProfileActions (the user's own changes) and userAdmin (admin identity and the
// super admin's actions); userAccount holds the new-user setup they share.
export const useUserStore = create<UserStore>()(
  persist(
    (set, get) => ({
      user: null,
      loading: true,
      needsUsername: false,
      newAccount: null,
      isAdmin: false,
      isSuperAdmin: false,
      adminUsers: [],
      
      setUser: (user) => set({ user, loading: false }),
      setNeedsUsername: (needs) => set({ needsUsername: needs }),

      ...createAuthActions(set, get),
      ...createProfileActions(set, get),
      ...createAdminActions(get),
    }),
    {
      name: 'spoton-user',
      partialize: (state) => ({ user: state.user }),
      // When store rehydrates from localStorage, ensure loading stays true
      // so the app waits for initAuth/onAuthStateChanged to set the real state.
      // This prevents stale cached user data from causing issues on multi-device login.
      onRehydrateStorage: () => {
        return (state) => {
          if (state) {
            state.loading = true;
          }
        };
      },
    }
  )
);
