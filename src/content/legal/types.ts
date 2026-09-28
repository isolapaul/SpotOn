// Legal documents (A1) as plain data, rendered by components/legal/LegalPage (no innerHTML).
// Texts may contain {controller} and {email}, filled from NEXT_PUBLIC_CONTROLLER_NAME and
// NEXT_PUBLIC_CONTACT_EMAIL at build time. Hungarian only for now (Paul, 2026-09-28).

/** A paragraph, or a bullet list. */
export type LegalBlock = string | readonly string[];

export interface LegalSection {
  heading: string;
  blocks: readonly LegalBlock[];
}

export interface LegalDocument {
  title: string;
  /** Shown under the title. */
  updated: string;
  intro: readonly LegalBlock[];
  sections: readonly LegalSection[];
}
