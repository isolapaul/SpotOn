'use client';

import { useState } from 'react';
import Image from 'next/image';
import { MessageCircle, Pencil, Trash2 } from 'lucide-react';
import type { Review } from '@/store/useSpotStore';
import { useUserStore } from '@/store/useUserStore';
import { useToastStore } from '@/store/useToastStore';
import { useReviewStore, MAX_REPLY_LENGTH } from '@/store/useReviewStore';
import { useLanguage, useT } from '@/hooks/useT';
import { usePublicProfile, type PublicProfileResult } from '@/hooks/usePublicProfile';
import { useOpenProfile } from '@/hooks/useOpenProfile';
import type { Reply } from '@/hooks/useReplies';
import { dateLocale } from '@/lib/dates';
import StarRating from '../ui/StarRating';
import ReviewerBadge from './ReviewerBadge';
import ReportButton from '../safety/ReportButton';

const MAX_COMMENT = 1000;

interface ReviewCardProps {
  review: Review & { editedAt?: unknown };
  profile: PublicProfileResult;
  spotId: string;
  /** Approved spot: replies and reports are possible. */
  open: boolean;
  replies: Reply[];
}

function shortDate(ms: number, language: string): string {
  return new Date(ms).toLocaleDateString(dateLocale(language as never), { month: 'short', day: 'numeric' });
}

/** One review: author, stars, comment; the author edits or deletes it; anyone signed in replies (questions too). */
export default function ReviewCard({ review, profile, spotId, open, replies }: Readonly<ReviewCardProps>) {
  const t = useT();
  const language = useLanguage({ fallback: 'en' });
  const me = useUserStore((s) => s.user?.uid);
  const { editReview, deleteReview, addReply } = useReviewStore();
  const showToast = useToastStore((s) => s.showToast);
  const [editing, setEditing] = useState(false);
  const [rating, setRating] = useState(review.rating);
  const [comment, setComment] = useState(review.comment);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [replying, setReplying] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [busy, setBusy] = useState(false);
  const mine = !!me && review.userId === me;
  const created = review.createdAt?.toDate ? review.createdAt.toDate().getTime() : null;

  const run = async (action: () => Promise<void>, done: string, after: () => void) => {
    setBusy(true);
    try {
      await action();
      showToast(done, 'success');
      after();
    } catch (error) {
      console.error('Review action failed:', error);
      showToast(t('genericError'), 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <article className="rounded-[18px] bg-surface-1 p-4 motion-safe:animate-item-in">
      <div className="flex items-start gap-3">
        {review.userPhoto && (
          <div className="relative w-10 h-10 rounded-full overflow-hidden flex-shrink-0">
            <Image src={review.userPhoto} alt={review.userName} fill sizes="40px" className="object-cover" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-1 gap-2">
            <ReviewerBadge profile={profile} review={review} />
            <span className="text-white/40 text-xs flex-shrink-0">
              {created ? shortDate(created, language) : ''}
              {review.editedAt ? ` · ${t('edited')}` : ''}
            </span>
          </div>

          {editing ? (
            <div className="space-y-2 motion-safe:animate-fade-in">
              <StarRating rating={rating} size="md" emptyTone="dim" onSelect={setRating} />
              <textarea
                aria-label={t('comment')}
                value={comment}
                maxLength={MAX_COMMENT}
                rows={3}
                onChange={(e) => setComment(e.target.value)}
                className="w-full rounded-xl bg-white/[.06] border border-white/10 focus:border-white/30 focus:outline-none px-3 py-2 text-label text-sm resize-none"
              />
              <div className="flex gap-2 justify-end">
                <button type="button" onClick={() => setEditing(false)} className="px-4 h-9 rounded-lg bg-white/[.08] text-label text-sm">{t('cancel')}</button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => run(() => editReview(spotId, review.id, rating, comment), t('reviewSaved'), () => setEditing(false))}
                  className="px-4 h-9 rounded-lg bg-brand-600 text-white text-sm font-semibold disabled:opacity-50"
                >
                  {t('save')}
                </button>
              </div>
            </div>
          ) : (
            <>
              <StarRating rating={review.rating} size="sm" emptyTone="dim" />
              {review.comment && <p className="text-white/80 text-sm mt-2 whitespace-pre-line break-words">{review.comment}</p>}
            </>
          )}

          {!editing && (
            <div className="mt-2 flex items-center gap-4 text-[13px] text-label-tertiary">
              {open && me && (
                <button type="button" onClick={() => setReplying((r) => !r)} className="no-min-size inline-flex items-center gap-1.5 active:text-label-secondary">
                  <MessageCircle className="w-4 h-4" aria-hidden="true" />
                  {t('reply')}
                </button>
              )}
              {mine && (
                <>
                  <button type="button" onClick={() => setEditing(true)} className="no-min-size inline-flex items-center gap-1.5 active:text-label-secondary">
                    <Pencil className="w-4 h-4" aria-hidden="true" />
                    {t('edit')}
                  </button>
                  <button type="button" onClick={() => setConfirmDelete(true)} className="no-min-size inline-flex items-center gap-1.5 active:text-label-secondary">
                    <Trash2 className="w-4 h-4" aria-hidden="true" />
                    {t('delete')}
                  </button>
                </>
              )}
              {open && !mine && <ReportButton variant="icon" target={{ kind: 'review', spotId, targetId: review.id }} className="ml-auto -mr-2" />}
            </div>
          )}

          {confirmDelete && (
            <div className="mt-3 rounded-xl bg-white/[.04] p-3 motion-safe:animate-fade-in">
              <p className="text-label text-sm">{t('deleteReviewConfirm')}</p>
              <div className="flex gap-2 justify-end mt-2">
                <button type="button" onClick={() => setConfirmDelete(false)} className="px-4 h-9 rounded-lg bg-white/[.08] text-label text-sm">{t('cancel')}</button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => run(() => deleteReview(spotId, review.id), t('reviewDeleted'), () => setConfirmDelete(false))}
                  className="px-4 h-9 rounded-lg bg-red-500/20 text-red-300 text-sm font-semibold disabled:opacity-50"
                >
                  {t('delete')}
                </button>
              </div>
            </div>
          )}

          {replies.length > 0 && (
            <ul className="mt-3 space-y-2 border-l-2 border-white/10 pl-3">
              {replies.map((r) => <ReplyRow key={r.id} reply={r} spotId={spotId} open={open} />)}
            </ul>
          )}

          {replying && (
            <div className="mt-3 flex items-end gap-2 motion-safe:animate-fade-in">
              <textarea
                aria-label={t('writeReply')}
                placeholder={t('writeReply')}
                value={replyText}
                maxLength={MAX_REPLY_LENGTH}
                rows={2}
                autoFocus
                onChange={(e) => setReplyText(e.target.value)}
                className="flex-1 rounded-xl bg-white/[.06] border border-white/10 focus:border-white/30 focus:outline-none px-3 py-2 text-label text-sm resize-none"
              />
              <button
                type="button"
                disabled={busy || !replyText.trim() || !me}
                onClick={() => me && run(() => addReply(spotId, review.id, me, replyText), t('replySent'), () => { setReplyText(''); setReplying(false); })}
                className="px-4 h-10 rounded-xl bg-brand-600 text-white text-sm font-semibold disabled:opacity-50"
              >
                {t('send')}
              </button>
            </div>
          )}
        </div>
      </div>
    </article>
  );
}

function ReplyRow({ reply, spotId, open }: Readonly<{ reply: Reply; spotId: string; open: boolean }>) {
  const t = useT();
  const language = useLanguage({ fallback: 'en' });
  const me = useUserStore((s) => s.user?.uid);
  const profile = usePublicProfile(reply.userId);
  const openProfile = useOpenProfile();
  const { editReply, deleteReply } = useReviewStore();
  const showToast = useToastStore((s) => s.showToast);
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(reply.text);
  const mine = me === reply.userId;

  const act = async (action: () => Promise<void>, after?: () => void) => {
    try {
      await action();
      after?.();
    } catch (error) {
      console.error('Reply action failed:', error);
      showToast(t('genericError'), 'error');
    }
  };

  return (
    <li className="text-sm motion-safe:animate-item-in">
      <div className="flex items-center gap-2">
        <button type="button" onClick={() => openProfile(reply.userId)} className="no-min-size font-semibold text-label truncate">
          {profile?.username ?? '…'}
        </button>
        <span className="text-white/40 text-xs">{shortDate(reply.createdAt, language)}{reply.edited ? ` · ${t('edited')}` : ''}</span>
        <span className="ml-auto flex items-center gap-1">
          {mine && !editing && (
            <>
              <button type="button" aria-label={t('edit')} onClick={() => setEditing(true)} className="no-min-size w-7 h-7 grid place-items-center text-label-tertiary">
                <Pencil className="w-3.5 h-3.5" aria-hidden="true" />
              </button>
              <button type="button" aria-label={t('delete')} onClick={() => act(() => deleteReply(spotId, reply.id))} className="no-min-size w-7 h-7 grid place-items-center text-label-tertiary">
                <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
              </button>
            </>
          )}
          {open && !mine && me && <ReportButton variant="icon" target={{ kind: 'reply', spotId, targetId: reply.id }} />}
        </span>
      </div>
      {editing ? (
        <div className="mt-1 flex items-end gap-2">
          <textarea
            aria-label={t('writeReply')}
            value={text}
            maxLength={MAX_REPLY_LENGTH}
            rows={2}
            onChange={(e) => setText(e.target.value)}
            className="flex-1 rounded-xl bg-white/[.06] border border-white/10 px-3 py-2 text-label text-sm resize-none focus:outline-none"
          />
          <button type="button" disabled={!text.trim()} onClick={() => act(() => editReply(spotId, reply.id, text), () => setEditing(false))}
            className="px-3 h-9 rounded-lg bg-brand-600 text-white text-sm font-semibold disabled:opacity-50">
            {t('save')}
          </button>
        </div>
      ) : (
        <p className="text-white/75 whitespace-pre-line break-words">{reply.text}</p>
      )}
    </li>
  );
}
