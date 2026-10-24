import { doc, getDoc, updateDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { httpsCallable } from 'firebase/functions';
import { db, functions, storage } from '@/lib/firebase';
import type { NotificationSettings } from '@/lib/mapUserDoc';
import { normalizeUsername } from '@/lib/username';
import { extForMime } from '@/lib/spotImages';
import { compressImage } from '@/lib/imageCompression';
import { claimUsernameCallable } from './userAccount';
import { errorCode, usernameValidationError } from './userErrors';
import type { StoreGet, StoreSet, UserStore } from './userStoreTypes';

// Compress profile images before upload (max 1920px, ~1MB). Output types the Storage rules
// do not accept (e.g. GIF) are re-encoded as JPEG.
async function compressProfileImage(file: File): Promise<File> {
  const compressed = await compressImage(file, 'profileStore');
  if (extForMime(compressed.type)) return compressed;
  return compressImage(file, 'profileStore', 'image/jpeg');
}

const updateNameStyleCallable = httpsCallable<{ color?: string; font?: string }, unknown>(functions, 'updateNameStyle');
const updatePinIconCallable = httpsCallable<{ icon: string | null }, unknown>(functions, 'updatePinIcon');
// T10: highlights are written server-side only.
const highlightSpotCallable = httpsCallable<{ spotId: string }, unknown>(functions, 'highlightSpot');
const unhighlightSpotCallable = httpsCallable<{ spotId: string }, unknown>(functions, 'unhighlightSpot');

type ProfileActions = Pick<
  UserStore,
  | 'toggleFavorite'
  | 'checkUsernameAvailable'
  | 'updateUsername'
  | 'updateProfilePicture'
  | 'updateProfileBanner'
  | 'highlightSpot'
  | 'unhighlightSpot'
  | 'updateCustomNameColor'
  | 'updateCustomNameFont'
  | 'updateProfileFields'
  | 'updatePinIcon'
  | 'updateNotificationSettings'
>;

/** The signed-in user's own changes: favourites, username, images, highlights, name style, settings. */
export function createProfileActions(set: StoreSet, get: StoreGet): ProfileActions {
  return {
    toggleFavorite: async (spotId: string) => {
      const { user } = get();
      if (!user) return;

      try {
        const userRef = doc(db, 'users', user.uid);
        const isFavorite = user.savedSpots.includes(spotId);

        if (isFavorite) {
          // Remove from favorites
          await updateDoc(userRef, {
            savedSpots: arrayRemove(spotId),
          });
          // From the current state: another toggle may have finished meanwhile (lost update).
          set((s) => (s.user ? { user: { ...s.user, savedSpots: s.user.savedSpots.filter((id) => id !== spotId) } } : {}));
        } else {
          // Add to favorites
          await updateDoc(userRef, {
            savedSpots: arrayUnion(spotId),
          });
          set((s) => (s.user ? { user: { ...s.user, savedSpots: [...new Set([...s.user.savedSpots, spotId])] } } : {}));
        }
      } catch (error) {
        throw error;
      }
    },


    // Check if a username is available (usernames/{name} registry)
    checkUsernameAvailable: async (username: string) => {
      const snap = await getDoc(doc(db, 'usernames', normalizeUsername(username)));
      if (!snap.exists()) return true;
      // Allow if it's the user's own current username
      return snap.data().uid === get().user?.uid;
    },

    // Update the user's username (claimed server-side, transactional)
    updateUsername: async (username: string) => {
      const { user } = get();
      if (!user) throw new Error('NOT_AUTHENTICATED');

      const trimmed = normalizeUsername(username);
      const validationError = usernameValidationError(trimmed);
      if (validationError) {
        throw new Error(validationError);
      }

      let claimed: string;
      try {
        const result = await claimUsernameCallable({ username: trimmed });
        claimed = result.data.username;
      } catch (error) {
        const code = errorCode(error);
        if (code === 'functions/already-exists') {
          throw new Error('USERNAME_TAKEN');
        }
        if (code === 'functions/invalid-argument') {
          throw new Error(
            usernameValidationError(trimmed) ?? 'USERNAME_INVALID_CHARS',
          );
        }
        throw error;
      }

      set({ user: { ...user, username: claimed }, needsUsername: false });
    },

    // Upload and update profile picture with compression
    updateProfilePicture: async (file: File) => {
      const { user } = get();
      if (!user) throw new Error('NOT_AUTHENTICATED');

      try {
        const compressed = await compressProfileImage(file);
        const timestamp = Date.now();
        const fileName = `${timestamp}_${file.name}`;
        const imageRef = ref(storage, `profile-pictures/${user.uid}/${fileName}`);
        
        await uploadBytes(imageRef, compressed, { contentType: compressed.type });
        const downloadURL = await getDownloadURL(imageRef);
        
        const userRef = doc(db, 'users', user.uid);
        await updateDoc(userRef, { 
          profilePictureURL: downloadURL,
          photoURL: downloadURL,
        });
        
        set({ 
          user: { 
            ...user, 
            profilePictureURL: downloadURL,
            photoURL: downloadURL,
          } 
        });
      } catch (error) {
        throw error;
      }
    },

    // Upload and update profile banner with compression
    updateProfileBanner: async (file: File) => {
      const { user } = get();
      if (!user) throw new Error('NOT_AUTHENTICATED');

      try {
        const compressed = await compressProfileImage(file);
        const timestamp = Date.now();
        const fileName = `${timestamp}_${file.name}`;
        const imageRef = ref(storage, `profile-banners/${user.uid}/${fileName}`);
        
        await uploadBytes(imageRef, compressed, { contentType: compressed.type });
        const downloadURL = await getDownloadURL(imageRef);
        
        const userRef = doc(db, 'users', user.uid);
        await updateDoc(userRef, { profileBannerURL: downloadURL });
        
        set({ user: { ...user, profileBannerURL: downloadURL } });
      } catch (error) {
        throw error;
      }
    },
    
    // Highlight a spot (level 3+; allowance, expiry and writes are enforced by the callable)
    highlightSpot: async (spotId: string) => {
      const { user } = get();
      if (!user) throw new Error('NOT_AUTHENTICATED');

      await highlightSpotCallable({ spotId });

      const current = get().user ?? user;
      set({
        user: {
          ...current,
          highlightedSpots: [...new Set([...(current.highlightedSpots ?? []), spotId])],
        },
      });
    },

    // Unhighlight a spot (server-side)
    unhighlightSpot: async (spotId: string) => {
      const { user } = get();
      if (!user) throw new Error('NOT_AUTHENTICATED');

      await unhighlightSpotCallable({ spotId });

      const current = get().user ?? user;
      set({
        user: {
          ...current,
          highlightedSpots: (current.highlightedSpots ?? []).filter((id) => id !== spotId),
        },
      });
    },

    // Update custom name color (level 5 only; enforced by the callable)
    updateCustomNameColor: async (color: string) => {
      const { user } = get();
      if (!user) throw new Error('NOT_AUTHENTICATED');

      await updateNameStyleCallable({ color });
      set({ user: { ...user, customNameColor: color } });
    },
    
    // Update custom name font (level 5 only; enforced by the callable)
    updateCustomNameFont: async (font: string) => {
      const { user } = get();
      if (!user) throw new Error('NOT_AUTHENTICATED');

      await updateNameStyleCallable({ font });
      set({ user: { ...user, customNameFont: font } });
    },

    // Profile fields (item 8; validated by the users rules)
    updateProfileFields: async (fields) => {
      const { user, setUser } = get();
      if (!user) throw new Error('NOT_AUTHENTICATED');
      const patch = { ...fields, ...(fields.bio !== undefined ? { bio: fields.bio.trim() } : {}) };
      await updateDoc(doc(db, 'users', user.uid), patch);
      setUser({ ...user, ...patch });
    },

    // Pin icon (level 4+; enforced by the callable, which also updates the spots)
    updatePinIcon: async (icon) => {
      const { user } = get();
      if (!user) throw new Error('NOT_AUTHENTICATED');

      await updatePinIconCallable({ icon });
      const next = { ...user };
      if (icon) next.pinIcon = icon;
      else delete next.pinIcon;
      set({ user: next });
    },

    // Per-type push preferences (users/{uid}.notificationSettings, validated by the users rules)
    updateNotificationSettings: async (settings: NotificationSettings) => {
      const { user, setUser } = get();
      if (!user) throw new Error('NOT_AUTHENTICATED');

      await updateDoc(doc(db, 'users', user.uid), { notificationSettings: settings });
      setUser({ ...user, notificationSettings: settings });
    },
  };
}
