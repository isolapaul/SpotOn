import { doc, collection, onSnapshot } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '@/lib/firebase';
import { mapAdminDoc } from '@/lib/mapAdminDoc';
import { errorCode } from './userErrors';
import type { LookedUpUser, SetState, StoreGet, UserStore } from './userStoreTypes';

const lookupUserByEmailCallable = httpsCallable<{ email: string }, LookedUpUser>(functions, 'lookupUserByEmail');
const addAdminCallable = httpsCallable<{ email: string }, unknown>(functions, 'addAdmin');
const removeAdminCallable = httpsCallable<{ uid: string }, unknown>(functions, 'removeAdmin');

// Admin identity listeners: own admins/{uid} doc, plus the admins list while admin.
let adminDocUnsub: (() => void) | null = null;
let adminListUnsub: (() => void) | null = null;
let adminListenerUid: string | null = null;

function stopAdminList(set: SetState) {
  if (adminListUnsub) {
    adminListUnsub();
    adminListUnsub = null;
  }
  set({ adminUsers: [] });
}

export function stopAdminListeners(set: SetState) {
  if (adminDocUnsub) {
    adminDocUnsub();
    adminDocUnsub = null;
  }
  adminListenerUid = null;
  stopAdminList(set);
  set({ isAdmin: false, isSuperAdmin: false });
}

export function startAdminListeners(uid: string, set: SetState) {
  if (adminDocUnsub && adminListenerUid === uid) return;
  stopAdminListeners(set);
  adminListenerUid = uid;
  adminDocUnsub = onSnapshot(
    doc(db, 'admins', uid),
    (snap) => {
      const isAdmin = snap.exists();
      const isSuperAdmin = isAdmin && snap.data().role === 'super';
      set({ isAdmin, isSuperAdmin });
      if (!isAdmin) {
        stopAdminList(set);
      } else if (!adminListUnsub) {
        adminListUnsub = onSnapshot(
          collection(db, 'admins'),
          (snapshot) => {
            const adminUsers = snapshot.docs
              .map((d) => mapAdminDoc(d.id, d.data()))
              .filter((a) => a.role !== 'super');
            set({ adminUsers });
          },
          (error) => {
            console.error('Admin list listener error:', error);
            adminListUnsub = null; // dead after an error; allow a restart on the next admin snapshot
            // Admin status is owned by the own-doc listener above; a failed list only empties the list.
            set({ adminUsers: [] });
          },
        );
      }
    },
    (error) => {
      console.error('Admin listener error:', error);
      set({ isAdmin: false, isSuperAdmin: false });
    },
  );
}

/** The super admin's actions on the admins (each enforced by its callable). */
export function createAdminActions(get: StoreGet): Pick<UserStore, 'lookupUserByEmail' | 'addAdmin' | 'removeAdmin'> {
  return {
    // Look up a user by email (super admin only; enforced by the callable)
    lookupUserByEmail: async (email: string) => {
      try {
        const result = await lookupUserByEmailCallable({ email });
        return result.data;
      } catch (error) {
        const code = errorCode(error);
        // invalid-argument: not an email address (e.g. "bob"); shown as "User not found" as before
        if (code === 'functions/not-found' || code === 'functions/invalid-argument') return null;
        throw error;
      }
    },

    // Add a new admin (only Super Admin can do this; enforced by the callable)
    addAdmin: async (email: string) => {
      if (!get().isSuperAdmin) {
        throw new Error('NOT_SUPER_ADMIN');
      }
      try {
        await addAdminCallable({ email });
      } catch (error) {
        if (errorCode(error) === 'functions/already-exists') throw new Error('ALREADY_ADMIN');
        throw error;
      }
    },

    // Remove an admin (only Super Admin can do this; enforced by the callable)
    removeAdmin: async (adminId: string) => {
      if (!get().isSuperAdmin) {
        throw new Error('NOT_SUPER_ADMIN');
      }
      await removeAdminCallable({ uid: adminId });
    },
  };
}
