// All three dictionaries at once, for tests only (the app loads English and German on demand).
import { hu } from './dictionaries/hu';
import { en } from './dictionaries/en';
import { de } from './dictionaries/de';

export const translations = { hu, en, de } as const;
