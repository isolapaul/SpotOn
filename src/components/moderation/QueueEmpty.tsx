'use client';

import { CheckCircle2 } from 'lucide-react';

/** An empty review queue: a calm "all done". */
export default function QueueEmpty({ text }: Readonly<{ text: string }>) {
  return (
    <div className="rounded-[18px] bg-surface-1 px-6 py-10 text-center motion-safe:animate-item-in">
      <span className="mx-auto mb-3 w-14 h-14 rounded-2xl grid place-items-center bg-brand-500/15 text-brand-400">
        <CheckCircle2 className="w-7 h-7" aria-hidden="true" />
      </span>
      <p className="text-[15px] text-label-secondary">{text}</p>
    </div>
  );
}
