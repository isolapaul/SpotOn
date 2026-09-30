import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import type { LegalBlock, LegalDocument } from '@/content/legal/types';
import { fillLegalText } from '@/lib/legal';

// Build-time public values (A1); the same for everyone, so no secret is involved.
const VALUES = {
  controller: process.env.NEXT_PUBLIC_CONTROLLER_NAME,
  email: process.env.NEXT_PUBLIC_CONTACT_EMAIL,
};

function Block({ block }: Readonly<{ block: LegalBlock }>) {
  if (typeof block === 'string') {
    return <p className="leading-relaxed">{fillLegalText(block, VALUES)}</p>;
  }
  return (
    <ul className="list-disc pl-5 space-y-1.5 leading-relaxed">
      {block.map((item) => (
        <li key={item}>{fillLegalText(item, VALUES)}</li>
      ))}
    </ul>
  );
}

/** A legal document page (privacy policy, terms). The body is fixed for the map, so this scrolls itself. */
/** `other`: the same document in the other language (Hungarian is authoritative, item 9). */
export default function LegalPage({ doc, other }: Readonly<{ doc: LegalDocument; other?: { href: string; label: string } }>) {
  return (
    <div className="fixed inset-0 overflow-y-auto bg-slate-950 text-white/80">
      <article lang={doc.lang ?? 'hu'} className="max-w-2xl mx-auto px-5 py-8" style={{ paddingTop: 'calc(2rem + env(safe-area-inset-top))' }}>
        <div className="flex items-center justify-between mb-6">
          <Link href="/" className="inline-flex items-center gap-2 text-sky-400 hover:text-sky-300 text-sm font-medium">
            <ArrowLeft className="w-4 h-4" />
            SpotOn
          </Link>
          {other && (
            <Link href={other.href} hrefLang={other.href.endsWith('/en') ? 'en' : 'hu'} className="text-sky-400 hover:text-sky-300 text-sm font-medium">
              {other.label}
            </Link>
          )}
        </div>
        <h1 className="text-white text-3xl font-bold tracking-tight mb-1">{doc.title}</h1>
        <p className="text-white/50 text-sm mb-6">{doc.updated}</p>
        <div className="space-y-3 mb-8">
          {doc.intro.map((block, i) => <Block key={i} block={block} />)}
        </div>
        {doc.sections.map((section) => (
          <section key={section.heading} className="mb-8 space-y-3">
            <h2 className="text-white text-xl font-semibold">{section.heading}</h2>
            {section.blocks.map((block, i) => <Block key={i} block={block} />)}
          </section>
        ))}
      </article>
    </div>
  );
}
