// The UI texts (hu/en/de). Hungarian is bundled (the default and the fallback); English and German
// are separate chunks that load when chosen (lib/i18n ensureLanguage), so the first load carries one
// dictionary instead of three. Add every key to all three files: Dictionary makes a missing one a
// type error.
import { hu } from './dictionaries/hu';

export type TranslationKey = keyof typeof hu;
export type Dictionary = Readonly<Record<TranslationKey, string>>;

export { hu };
