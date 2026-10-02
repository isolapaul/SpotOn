'use client';

import { useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, Plus } from 'lucide-react';
import { useT } from '@/hooks/useT';
import { useListStore } from '@/store/useListStore';
import { useToastStore } from '@/store/useToastStore';
import { MAX_LIST_NAME, MAX_LISTS, MAX_LIST_SPOTS } from '@/lib/lists';
import ModalShell from '../ui/ModalShell';
import Button from '../ui/Button';

/** Adds a spot to the user's lists or removes it (a checkmark per list), or puts it in a new list. */
export default function ListPicker({ spotId, onClose }: Readonly<{ spotId: string; onClose: () => void }>) {
  const t = useT();
  const { lists, create, toggleSpot } = useListStore();
  const showToast = useToastStore((s) => s.showToast);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState<string | null>(null);

  const run = async (key: string, action: () => Promise<void>) => {
    setBusy(key);
    try {
      await action();
    } catch (error) {
      console.error('List action failed:', error);
      showToast(t('genericError'), 'error');
    } finally {
      setBusy(null);
    }
  };

  return createPortal(
    <ModalShell variant="slate" z="modal" onBackdropClick={onClose} backdropLabel="Close" panelClassName="w-[92%] max-w-md p-5">
      <div role="dialog" aria-modal="true" aria-labelledby="list-picker-title">
        <h3 id="list-picker-title" className="text-label text-[20px] font-bold mb-3">{t('saveToList')}</h3>
        {lists.length > 0 && (
          <ul className="rounded-r2 bg-white/6 divide-y divide-white/6 overflow-hidden max-h-[45vh] overflow-y-auto">
            {lists.map((l) => {
              const inList = l.spotIds.includes(spotId);
              const full = !inList && l.spotIds.length >= MAX_LIST_SPOTS;
              return (
                <li key={l.id}>
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={inList}
                    disabled={busy !== null || full}
                    onClick={() => run(l.id, () => toggleSpot(l.id, spotId, !inList))}
                    className="no-min-size w-full flex items-center gap-3 px-4 h-12 text-left active:bg-white/6 disabled:opacity-50"
                  >
                    <span className={`w-5 h-5 rounded-md grid place-items-center border ${inList ? 'bg-brand-600 border-brand-600' : 'border-white/30'}`}>
                      {inList && <Check className="w-3.5 h-3.5 text-white" aria-hidden="true" />}
                    </span>
                    <span className="flex-1 min-w-0 truncate text-label text-[15px]">{l.name}</span>
                    <span className="text-label-tertiary text-[13px] tabular-nums">{l.spotIds.length}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        {lists.length < MAX_LISTS && (
          <div className="mt-3 flex gap-2">
            <input
              type="text"
              aria-label={t('newListName')}
              placeholder={t('newListName')}
              value={name}
              maxLength={MAX_LIST_NAME}
              onChange={(e) => setName(e.target.value)}
              className="flex-1 min-w-0 px-4 h-11 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-white/40 focus:outline-hidden focus:border-white/30"
            />
            <button
              type="button"
              aria-label={t('createList')}
              disabled={!name.trim() || busy !== null}
              onClick={() => run('new', async () => {
                await create(name, spotId);
                setName('');
                showToast(t('listCreated'), 'success');
              })}
              className="no-min-size w-11 h-11 rounded-xl grid place-items-center bg-brand-600 text-white disabled:opacity-40"
            >
              <Plus className="w-5 h-5" aria-hidden="true" />
            </button>
          </div>
        )}
        <Button variant="gray" size="md" block onClick={onClose} className="mt-4">{t('done')}</Button>
      </div>
    </ModalShell>,
    document.body,
  );
}
