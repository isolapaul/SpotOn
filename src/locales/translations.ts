export const translations = {
  en: {
    // Language Selector
    selectLanguage: 'Select Your Language',
    selectLanguageDesc: 'Choose your preferred language to continue',
    english: 'English',
    hungarian: 'Hungarian',
    continue: 'Continue',
    
    // Navigation
    explore: 'Explore',
    navigate: 'Navigate',
    add: 'Add',
    favorites: 'Favorites',
    profile: 'Profile',
    
    // Map
    youAreHere: 'You are here',
    currentLocation: 'Current location',
    sampleSpot: 'Sample Spot',
    sampleSpotDesc: 'This is a demo spot. Real spots will appear here in Phase 2.',
    viewDetails: 'View Details',
    loadingMap: 'Loading map...',
    
    // Common
    welcome: 'Welcome to SpotOn',
    discover: 'Discover scenic locations near you',
  },
  hu: {
    // Language Selector
    selectLanguage: 'Válaszd ki a nyelvet',
    selectLanguageDesc: 'Válaszd ki a nyelvet a folytatáshoz',
    english: 'Angol',
    hungarian: 'Magyar',
    continue: 'Folytatás',
    
    // Navigation
    explore: 'Felfedezés',
    navigate: 'Navigáció',
    add: 'Hozzáadás',
    favorites: 'Kedvencek',
    profile: 'Profil',
    
    // Map
    youAreHere: 'Itt vagy',
    currentLocation: 'Jelenlegi helyzet',
    sampleSpot: 'Minta helyszín',
    sampleSpotDesc: 'Ez egy demó helyszín. Valódi helyszínek a 2. fázisban jelennek meg.',
    viewDetails: 'Részletek',
    loadingMap: 'Térkép betöltése...',
    
    // Common
    welcome: 'Üdvözöl a SpotOn',
    discover: 'Fedezd fel a környező festői helyeket',
  },
};

export type Language = keyof typeof translations;
export type TranslationKey = keyof typeof translations.en;
