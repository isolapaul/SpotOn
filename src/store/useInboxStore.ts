import { create } from 'zustand';
import { collection, deleteDoc, doc, limit, onSnapshot, orderBy, query, updateDoc, type Unsubscribe } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { parseInboxItem, type InboxItem } from '@/lib/inbox';
import { playSound } from './useSoundStore';

/** The same cap the server keeps (functions/src/lib/inbox.ts INBOX_LIMIT). */
const INBOX_LIMIT = 50;
/** An added notice older than this is a sync catching up, not news (no banner). */
const FRESH_MS = 2 * 60_000;

interface InboxStore {
  /** Newest first; empty while signed out. */
  items: InboxItem[];
  /** An unread item that arrived while the app was open (the live banner); null when none. */
  fresh: InboxItem | null;
  dismissFresh: () => void;
  /** Listens to the signed-in user's inbox (null stops). */
  sync: (uid: string | null) => void;
  markRead: (id: string) => Promise<void>;
  markAllRead: () => Promise<void>;
  clearAll: () => Promise<void>;
}

let listening: { uid: string; unsubscribe: Unsubscribe } | null = null;

const itemRef = (uid: string, id: string) => doc(db, 'users', uid, 'inbox', id);

/**
 * The in-app inbox: notices written by Cloud Functions (moderation decisions and removals, follow
 * news, replies), kept on the server so a reason stays readable after the push and on every device. The notification centre shows it
 * next to the local notifications (hooks/useNotificationFeed).
 */
export const useInboxStore = create<InboxStore>((set, get) => ({
  items: [],
  fresh: null,
  dismissFresh: () => set({ fresh: null }),
  sync: (uid) => {
    if (listening?.uid === uid) return;
    listening?.unsubscribe();
    listening = null;
    set({ items: [], fresh: null });
    let first = true;
    if (!uid) return;
    const q = query(collection(db, 'users', uid, 'inbox'), orderBy('createdAt', 'desc'), limit(INBOX_LIMIT));
    const unsubscribe = onSnapshot(
      q,
      (snap) => {
        const now = Date.now();
        const items = snap.docs
          .map((d) => parseInboxItem(d.id, d.data(), now))
          .filter((item): item is InboxItem => item !== null);
        // New unread notices after the first snapshot arrived live: a banner and a chime.
        const arrived = first ? [] : snap.docChanges().filter((c) => c.type === 'added').map((c) => c.doc.id);
        first = false;
        const fresh = items.find((i) => arrived.includes(i.id) && !i.read && now - i.createdAt < FRESH_MS);
        set(fresh ? { items, fresh } : { items });
        if (fresh) playSound('notification');
      },
      (error) => console.error('Inbox listener failed:', error),
    );
    listening = { uid, unsubscribe };
  },
  markRead: async (id) => {
    const uid = listening?.uid;
    const item = get().items.find((i) => i.id === id);
    if (!uid || !item || item.read) return;
    await updateDoc(itemRef(uid, id), { read: true });
  },
  markAllRead: async () => {
    const uid = listening?.uid;
    if (!uid) return;
    await Promise.all(get().items.filter((i) => !i.read).map((i) => updateDoc(itemRef(uid, i.id), { read: true })));
  },
  clearAll: async () => {
    const uid = listening?.uid;
    if (!uid) return;
    await Promise.all(get().items.map((i) => deleteDoc(itemRef(uid, i.id))));
  },
}));
