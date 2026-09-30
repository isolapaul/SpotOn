'use client';

import Image from 'next/image';
import { ArrowRight, X } from 'lucide-react';
import { useLanguage, useT } from '@/hooks/useT';
import { formatDistance, haversineKm } from '@/lib/geo';
import { proposalDiff, type DiffRow, type EditProposal } from '@/lib/moderation';
import { useCategoryLabel } from '@/hooks/useCategory';
import type { Spot } from '@/store/useSpotStore';
import CategoryIcon from '../ui/CategoryIcon';

function Thumb({ url, removed = false }: Readonly<{ url: string; removed?: boolean }>) {
  return (
    <span className="relative w-16 h-16 flex-shrink-0 rounded-[12px] overflow-hidden bg-surface-3">
      <Image src={url} alt="" fill sizes="64px" unoptimized className={`object-cover ${removed ? 'opacity-50' : ''}`} />
      {removed && (
        <span className="absolute inset-0 grid place-items-center">
          <X className="w-7 h-7 text-[#FF6961]" strokeWidth={3} aria-hidden="true" />
        </span>
      )}
    </span>
  );
}

function Label({ children }: Readonly<{ children: React.ReactNode }>) {
  return <p className="text-[12px] font-semibold uppercase tracking-wide text-label-tertiary mb-1">{children}</p>;
}

/** Old → new, the old value struck through. */
function Change({ before, after }: Readonly<{ before: React.ReactNode; after: React.ReactNode }>) {
  return (
    <div className="flex items-center gap-2 text-[15px] flex-wrap">
      <span className="text-label-tertiary line-through decoration-white/30 break-words min-w-0">{before}</span>
      <ArrowRight className="w-4 h-4 text-label-tertiary flex-shrink-0" aria-hidden="true" />
      <span className="text-label break-words min-w-0">{after}</span>
    </div>
  );
}

function Row({ row }: Readonly<{ row: DiffRow }>) {
  const t = useT();
  const language = useLanguage();
  const categoryLabel = useCategoryLabel();
  const category = (id: string) => (
    <span className="inline-flex items-center gap-1.5">
      <CategoryIcon category={id} className="w-4 h-4" />
      {categoryLabel(id)}
    </span>
  );
  switch (row.kind) {
    case 'text':
      return <div><Label>{t(row.field === 'name' ? 'spotName' : 'description')}</Label><Change before={row.before || '–'} after={row.after || '–'} /></div>;
    case 'category':
      return <div><Label>{t('category')}</Label><Change before={category(row.before)} after={category(row.after)} /></div>;
    case 'location': {
      const km = haversineKm(row.before.lat, row.before.lng, row.after.lat, row.after.lng);
      return (
        <div>
          <Label>{t('location')}</Label>
          <p className="text-[15px] text-label tabular-nums">
            {row.after.lat.toFixed(5)}, {row.after.lng.toFixed(5)}
            <span className="text-label-tertiary"> · {formatDistance(km, language)}</span>
          </p>
        </div>
      );
    }
    case 'photosRemoved':
      return (
        <div>
          <Label>{t('diffPhotosRemoved')}</Label>
          <div className="flex gap-2 flex-wrap">{row.urls.map((url) => <Thumb key={url} url={url} removed />)}</div>
        </div>
      );
    case 'primaryPhoto':
      return (
        <div>
          <Label>{t('diffPrimaryPhoto')}</Label>
          <div className="flex items-center gap-2">
            <Thumb url={row.before} />
            <ArrowRight className="w-4 h-4 text-label-tertiary" aria-hidden="true" />
            <Thumb url={row.after} />
          </div>
        </div>
      );
  }
}

/** What an owner's proposal changes, field by field (old → new), for the admin's review (item 4). */
export default function EditDiff({ spot, proposed }: Readonly<{ spot: Spot; proposed: EditProposal }>) {
  const rows = proposalDiff(spot, proposed);
  return (
    <div className="space-y-3">
      {rows.map((row, i) => <Row key={`${row.kind}-${i}`} row={row} />)}
    </div>
  );
}
