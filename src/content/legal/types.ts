// Legal documents (A1) as plain data, rendered by components/legal/LegalPage (no innerHTML).
// Texts may contain {controller} and {email}, filled from NEXT_PUBLIC_CONTROLLER_NAME and
// NEXT_PUBLIC_CONTACT_EMAIL at build time. Hungarian (authoritative) and an English translation
// (item 9); German UI users get the English one.

/** A paragraph, or a bullet list. */
export type LegalBlock = string | readonly string[];

export interface LegalSection {
  heading: string;
  blocks: readonly LegalBlock[];
}

export interface LegalDocument {
  /** The document's language (defaults to Hungarian). */
  lang?: 'hu' | 'en';
  title: string;
  /** Shown under the title. */
  updated: string;
  intro: readonly LegalBlock[];
  sections: readonly LegalSection[];
}
