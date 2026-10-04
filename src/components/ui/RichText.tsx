import { Fragment } from 'react';
import { splitBold } from '@/lib/i18n';

/** A translation whose `**…**` parts are bold, as text nodes and `<strong>` (no innerHTML). */
export default function RichText({ text, strongClassName = 'font-semibold text-label' }: Readonly<{ text: string; strongClassName?: string }>) {
  return (
    <>
      {splitBold(text).map((p, i) =>
        p.bold ? (
          <strong key={i} className={strongClassName}>
            {p.text}
          </strong>
        ) : (
          <Fragment key={i}>{p.text}</Fragment>
        ),
      )}
    </>
  );
}
