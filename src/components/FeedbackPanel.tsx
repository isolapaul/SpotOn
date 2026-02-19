"use client";

import React, { useState, useRef } from 'react';
import { X, Camera, Send } from 'lucide-react';
import imageCompression from 'browser-image-compression';
import { useLanguageStore } from '@/store/useLanguageStore';

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function FeedbackPanel({ open, onClose }: Props) {
  const { t } = useLanguageStore();
  const [message, setMessage] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [sending, setSending] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);

  if (!open) return null;

  const handleFiles = async (selected: FileList | null) => {
    if (!selected) return;
    const arr: File[] = Array.from(selected).slice(0, 6); // limit
    setFiles((prev) => [...prev, ...arr]);
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
          const compressed = await imageCompression(f, { maxSizeMB: 1, maxWidthOrHeight: 1600 });
          const dataUrl = await readFileAsDataUrl(compressed as File);
          return {
            filename: f.name,
            mime: f.type,
            dataUrl,
          };
        })
      );

      const payload = { message, attachments };

      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error('Failed to send feedback');
      setMessage('');
      setFiles([]);
      onClose();
      // optionally show a toast elsewhere
    } catch (e) {
      console.error(e);
      alert(t('feedbackSendError') || 'Failed sending feedback.');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[2000] flex items-start justify-center p-4 animate-fade-in">
      <button
        type="button"
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
        aria-label="Close feedback"
      />

      <div className="relative bg-slate-900 w-[92%] max-w-2xl rounded-3xl shadow-2xl border-2 border-white/20 overflow-hidden animate-scale-in max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-white/10 bg-slate-800/50 backdrop-blur-xl">
          <div className="flex items-center gap-3">
            <Camera className="w-5 h-5 text-white" />
            <h3 className="text-white font-semibold text-lg">{t('feedback') || 'Visszajelzések'}</h3>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                const el = fileRef.current;
                el?.click();
              }}
              className="px-3 py-2 text-sm text-white/80 bg-white/5 rounded-lg hover:bg-white/10"
            >
              {t('attachImages') || 'Képek hozzáadása'}
            </button>

            <button
              onClick={onClose}
              className="p-2 hover:bg-white/10 rounded-xl transition-colors touch-manipulation min-w-[44px] min-h-[44px]"
              aria-label="Close"
            >
              <X className="w-5 h-5 text-white" />
            </button>
          </div>
        </div>

        <div className="p-4 overflow-y-auto flex-1">
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder={t('feedbackPlaceholder') || 'Írd le részletesen a visszajelzésed...'}
            className="w-full min-h-[180px] bg-transparent border border-white/10 rounded-xl p-3 text-white resize-none focus:outline-none"
          />

          <div className="mt-4">
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => handleFiles(e.target.files)}
            />

            {files.length > 0 && (
              <div className="grid grid-cols-3 gap-3">
                {files.map((f, i) => (
                  <div key={i} className="relative bg-white/5 rounded-xl overflow-hidden">
                    <img
                      src={URL.createObjectURL(f)}
                      alt={f.name}
                      className="object-cover w-full h-28"
                    />
                    <button
                      onClick={() => removeFile(i)}
                      className="absolute top-1 right-1 bg-black/40 p-1 rounded-full"
                    >
                      <X className="w-4 h-4 text-white" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="mt-6 bg-slate-800/30 p-3 rounded-xl">
            <h4 className="text-white font-semibold mb-2">{t('patchNotes') || 'Patch Notes'}</h4>
            <div className="text-white/70 text-sm whitespace-pre-wrap max-h-40 overflow-y-auto">
              {/* Fetch and render patch-notes from public/patch-notes.md */}
              {/* Simple fetch on first render would be overkill for client-only component; keep it simple by fetching on demand. */}
              <PatchNotesPreview />
            </div>
          </div>
        </div>

        <div className="p-4 border-t border-white/10 flex items-center justify-end gap-3 bg-slate-800/40">
          <button
            onClick={handleSubmit}
            disabled={sending || (!message && files.length === 0)}
            className="flex items-center gap-2 bg-gradient-to-r from-indigo-500 to-purple-500 text-white px-4 py-2 rounded-2xl hover:opacity-95 disabled:opacity-50"
          >
            <Send className="w-4 h-4" />
            {sending ? (t('sending') || 'Küldés...') : (t('sendFeedback') || 'Küldés')}
          </button>
        </div>
      </div>
    </div>
  );
}

function PatchNotesPreview() {
  const [text, setText] = useState<string>('Betöltés...');

  React.useEffect(() => {
    let mounted = true;
    fetch('/patch-notes.md')
      .then((r) => r.text())
      .then((t) => mounted && setText(t))
      .catch(() => mounted && setText('No patch notes yet.'));
    return () => {
      mounted = false;
    };
  }, []);

  return <div className="text-sm">{text}</div>;
}
