"use client";

import React, { useState, useRef } from 'react';
import Image from 'next/image';
import { X, Camera, Send, MessageSquareText } from 'lucide-react';
import Button, { CloseButton } from './ui/Button';
import { compressImage } from '@/lib/imageCompression';
import { useT } from '@/hooks/useT';
import { useUserStore } from '@/store/useUserStore';
import { FEEDBACK_LIMITS } from '@/lib/feedback/validate';
import ModalShell from './ui/ModalShell';

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function FeedbackPanel({ open, onClose }: Props) {
  const t = useT();
  const getIdToken = useUserStore((s) => s.getIdToken);
  const [message, setMessage] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [sending, setSending] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);

  if (!open) return null;

  const handleFiles = async (selected: FileList | null) => {
    if (!selected) return;
    setFiles((prev) => [...prev, ...Array.from(selected)].slice(0, FEEDBACK_LIMITS.maxAttachments));
  };

  const removeFile = (idx: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== idx));
  };

  const readFileAsDataUrl = (file: File) =>
    new Promise<string>((res, rej) => {
      const reader = new FileReader();
      reader.onload = () => res(reader.result as string);
      reader.onerror = rej;
      reader.readAsDataURL(file);
    });

  const handleSubmit = async () => {
    if (sending) return;
    setSending(true);

    try {
      // compress images and convert to data URLs
      const attachments = await Promise.all(
        files.map(async (f) => {
          const compressed = await compressImage(f, 'feedback');
          const dataUrl = await readFileAsDataUrl(compressed as File);
          return { filename: f.name, dataUrl };
        })
      );

      const payload = { message, attachments };

      // The server takes the sender identity only from a verified ID token; signed out = anonymous.
      const token = await getIdToken();
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers.Authorization = `Bearer ${token}`;

      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        alert(
          res.status === 413
            ? t('feedbackTooLarge')
            : res.status === 429
              ? t('feedbackRateLimited')
              : t('feedbackSendError'),
        );
        return;
      }
      setMessage('');
      setFiles([]);
      onClose();
      // optionally show a toast elsewhere
    } catch (e) {
      console.error(e);
      alert(t('feedbackSendError'));
    } finally {
      setSending(false);
    }
  };

  return (
    <ModalShell
      variant="slate"
      z="modal"
      onBackdropClick={onClose}
      backdropLabel="Close feedback"
      align="start"
      outerClassName=""
      outerStyle={{
        paddingTop: 'calc(1rem + env(safe-area-inset-top))',
        paddingLeft: 'max(1rem, env(safe-area-inset-left))',
        paddingRight: 'max(1rem, env(safe-area-inset-right))',
        paddingBottom: 'calc(1rem + env(safe-area-inset-bottom))'
      }}
      backdropClassName="absolute inset-0 bg-black/50 backdrop-blur-sm"
      panelClassName="w-[92%] max-w-2xl max-h-[90vh]"
    >
        <div className="flex items-center justify-between pl-5 pr-2 pt-3 pb-2">
          <div className="flex items-center gap-3">
            <span className="w-9 h-9 rounded-[12px] grid place-items-center bg-brand-500/15">
              <MessageSquareText className="w-5 h-5 text-brand-400" />
            </span>
            <h3 className="text-label font-bold text-[20px]">{t('feedback')}</h3>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                const el = fileRef.current;
                el?.click();
              }}
              disabled={files.length >= FEEDBACK_LIMITS.maxAttachments}
              className="no-min-size h-8 px-3 inline-flex items-center gap-1.5 text-[13px] font-semibold text-brand-300 bg-brand-500/15 rounded-full active:bg-brand-500/25 disabled:opacity-40"
            >
              <Camera className="w-4 h-4" aria-hidden="true" />
              {t('attachImages')}
            </button>

            <CloseButton label="Close" onClick={onClose} />
          </div>
        </div>

        <div className="px-4 pb-4 overflow-y-auto flex-1">
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            maxLength={FEEDBACK_LIMITS.maxMessageChars}
            placeholder={t('feedbackPlaceholder')}
            className="w-full min-h-[180px] bg-surface-3 rounded-[14px] p-3.5 text-label placeholder-white/40 resize-none focus:outline-none focus:ring-2 focus:ring-brand-500/60"
          />

          <div className="mt-4">
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              className="hidden"
              onChange={(e) => handleFiles(e.target.files)}
            />

            {files.length > 0 && (
              <div className="grid grid-cols-3 gap-3">
                {files.map((f, i) => (
                  <div key={i} className="relative h-28 bg-surface-3 rounded-[14px] overflow-hidden motion-safe:animate-item-in">
                    {/* A local blob: URL preview: nothing to optimise */}
                    <Image
                      src={URL.createObjectURL(f)}
                      alt={f.name}
                      fill
                      unoptimized
                      sizes="33vw"
                      className="object-cover"
                    />
                    <button
                      onClick={() => removeFile(i)}
                      className="no-min-size absolute top-1.5 right-1.5 w-7 h-7 grid place-items-center bg-black/45 backdrop-blur-md rounded-full"
                    >
                      <X className="w-4 h-4 text-white" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <p className="text-white/50 text-xs mt-2">{t('feedbackImageLimit')}</p>
          </div>

          <div className="mt-6 bg-surface-1 p-4 rounded-[18px]">
            <h4 className="text-white font-semibold mb-2">{t('patchNotes')}</h4>
            <div className="text-white/70 text-sm whitespace-pre-wrap max-h-40 overflow-y-auto">
              {/* Fetch and render patch-notes from public/patch-notes.md */}
              {/* Simple fetch on first render would be overkill for client-only component; keep it simple by fetching on demand. */}
              <PatchNotesPreview />
            </div>
          </div>
        </div>

        <div className="p-4 pt-3 border-t border-white/[.06]">
          <Button block onClick={handleSubmit} disabled={sending || message.trim().length === 0}>
            <Send className="w-4 h-4" />
            {sending ? t('sending') : t('sendFeedback')}
          </Button>
        </div>
    </ModalShell>
  );
}

function PatchNotesPreview() {
  const t = useT();
  // null = still loading, false = failed; the texts are translated at render time.
  const [text, setText] = useState<string | null | false>(null);

  React.useEffect(() => {
    let mounted = true;
    fetch('/patch-notes.md')
      .then((r) => r.text())
      .then((body) => mounted && setText(body))
      .catch(() => mounted && setText(false));
    return () => {
      mounted = false;
    };
  }, []);

  const shown = text === null ? t('loading') : text === false ? t('noPatchNotes') : text;
  return <div className="text-sm">{shown}</div>;
}
