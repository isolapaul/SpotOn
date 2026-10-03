import { create } from 'zustand';
import { deleteDoc, doc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '@/lib/firebase';

const editReviewCallable = httpsCallable<{ spotId: string; reviewId: string; rating: number; comment: string }, unknown>(functions, 'editReview');
const deleteReviewCallable = httpsCallable<{ spotId: string; reviewId: string }, unknown>(functions, 'deleteReview');
const addReplyCallable = httpsCallable<{ spotId: string; reviewId: string; text: string }, { id: string }>(functions, 'addReply');

export const MAX_REPLY_LENGTH = 500;

interface ReviewStore {
  /** The author's own review: new rating and comment (the callable checks the author). */
  editReview: (spotId: string, reviewId: string, rating: number, comment: string) => Promise<void>;
  deleteReview: (spotId: string, reviewId: string) => Promise<void>;
  /** Replies (questions and answers) to a review: added by the addReply callable, edited and deleted by their author (rules). */
  addReply: (spotId: string, reviewId: string, text: string) => Promise<void>;
  editReply: (spotId: string, replyId: string, text: string) => Promise<void>;
  deleteReply: (spotId: string, replyId: string) => Promise<void>;
}

export const useReviewStore = create<ReviewStore>(() => ({
  editReview: async (spotId, reviewId, rating, comment) => {
    await editReviewCallable({ spotId, reviewId, rating, comment });
  },
  deleteReview: async (spotId, reviewId) => {
    await deleteReviewCallable({ spotId, reviewId });
  },
  addReply: async (spotId, reviewId, text) => {
    await addReplyCallable({ spotId, reviewId, text: text.trim() });
  },
  editReply: async (spotId, replyId, text) => {
    await updateDoc(doc(db, 'spots', spotId, 'replies', replyId), { text: text.trim(), editedAt: serverTimestamp() });
  },
  deleteReply: async (spotId, replyId) => {
    await deleteDoc(doc(db, 'spots', spotId, 'replies', replyId));
  },
}));
