export const translations = {
  hu: {
    // Navigation
    explore: 'Felfedezés',
    navigate: 'Navigáció',
    search: 'Keresés',
    add: 'Hozzáadás',
    favorites: 'Kedvencek',
    profile: 'Profil',
    
    // Auth
    signIn: 'Bejelentkezés',
    signOut: 'Kijelentkezés',
    signInWithGoogle: 'Bejelentkezés Google-lel',
    welcomeBack: 'Üdv újra!',
    pleaseSignIn: 'Jelentkezz be a folytatáshoz',
    
    // Add Spot
    addNewSpot: 'Új Hely Hozzáadása',
    shareLocation: 'Oszd meg a kedvenc helyedet',
    spotName: 'Hely Neve',
    spotNamePlaceholder: 'pl., Napnyugta Kilátó',
    category: 'Kategória',
    scenicView: 'Festői Kilátás',
    smokeSpot: 'Pihenőhely',
    viewpoint: 'Kilátópont',
    other: 'Egyéb',
    description: 'Leírás',
    descriptionPlaceholder: 'Írd le, mi teszi különlegessé ezt a helyet...',
    photo: 'Fotó',
    photoOptional: 'Fotó (opcionális)',
    clickToUpload: 'Kattints a feltöltéshez',
    maxSize: 'Max 5MB',
    submit: 'Küldés',
    submitSpot: 'Hely Beküldése',
    compressing: 'Tömörítés és feltöltés...',
    location: 'Helyszín',
    clickMapToSelect: '📍 Kattints a térképre a helyszín kiválasztásához',
    cancel: 'Mégse',
    spotUploaded: 'Hely feltöltve! Jóváhagyásra vár.',
    spotUploadFailed: 'Hiba a hely hozzáadásakor. Próbáld újra.',
    reviewMessage: 'A helyed ellenőrzésre kerül, mielőtt megjelenik a térképen',
    
    // Profile
    mySpots: 'Helyeim',
    noSpotsYet: 'Még nem adtál hozzá helyeket',
    startExploring: 'Kezdd el felfedezni és oszd meg kedvenc helyeidet!',
    noFavoritesYet: 'Még nincs kedvenc helyed',
    startSaving: 'Kezdd el felfedezni és mentsd el kedvenceidet!',
    spots: 'Hely',
    approved: 'Jóváhagyva',
    pending: 'Jóváhagyás alatt',
    rejected: 'Elutasítva',
    
    // Spot Details
    viewDetails: 'Részletek Megtekintése',
    getDirections: 'Útvonal Tervezése',
    share: 'Megosztás',
    addedOn: 'Hozzáadva',
    by: 'Feltöltő',
    anonymous: 'Névtelen',
    reviews: 'Értékelések',
    noReviews: 'Még nincsenek értékelések',
    beFirstToReview: 'Légy az első, aki értékeli ezt a helyet!',
    openInMaps: 'Megnyitás Térképen',
    
    // Empty States
    noSpotsFound: '🗺️ Még nincsenek helyek. Légy az első, aki hozzáad egyet!',
    
    // Errors
    mustBeLoggedIn: 'Be kell jelentkezned a hely hozzáadásához',
    pleaseSelectLocation: 'Válassz helyszínt a térképen',
    pleaseUploadImage: 'Tölts fel egy képet',
    pleaseEnterName: 'Add meg a hely nevét',
    imageTooLarge: 'A kép maximum 5MB lehet',
    
    // Actions
    close: 'Bezárás',
    save: 'Mentés',
    delete: 'Törlés',
    edit: 'Szerkesztés',
  },
  en: {
    // Navigation
    explore: 'Explore',
    navigate: 'Navigate',
    search: 'Search',
    add: 'Add',
    favorites: 'Favorites',
    profile: 'Profile',
    
    // Auth
    signIn: 'Sign In',
    signOut: 'Sign Out',
    signInWithGoogle: 'Sign In with Google',
    welcomeBack: 'Welcome Back',
    pleaseSignIn: 'Please sign in to continue',
    
    // Add Spot
    addNewSpot: 'Add New Spot',
    shareLocation: 'Share a scenic location',
    spotName: 'Spot Name',
    spotNamePlaceholder: 'e.g., Sunset Point',
    category: 'Category',
    scenicView: 'Scenic View',
    smokeSpot: 'Smoke Spot',
    viewpoint: 'Viewpoint',
    other: 'Other',
    description: 'Description',
    descriptionPlaceholder: 'Describe what makes this spot special...',
    photo: 'Photo',
    photoOptional: 'Photo (Optional)',
    clickToUpload: 'Click to upload image',
    maxSize: 'Max 5MB',
    submit: 'Submit',
    submitSpot: 'Submit Spot',
    compressing: 'Compressing & Uploading...',
    location: 'Location',
    clickMapToSelect: '📍 Click on the map to select location',
    cancel: 'Cancel',
    spotUploaded: 'Spot uploaded! Waiting for approval.',
    spotUploadFailed: 'Failed to add spot. Please try again.',
    reviewMessage: 'Your spot will be reviewed before appearing on the map',
    
    // Profile
    mySpots: 'My Spots',
    noSpotsYet: 'You haven\'t added any spots yet',
    startExploring: 'Start exploring and share your favorite places!',
    noFavoritesYet: 'No favorite spots yet',
    startSaving: 'Start exploring and save your favorites!',
    spots: 'Spots',
    approved: 'Approved',
    pending: 'Pending',
    rejected: 'Rejected',
    
    // Spot Details
    viewDetails: 'View Details',
    getDirections: 'Get Directions',
    share: 'Share',
    addedOn: 'Added',
    by: 'By',
    anonymous: 'Anonymous',
    reviews: 'Reviews',
    noReviews: 'No reviews yet',
    beFirstToReview: 'Be the first to review this spot!',
    openInMaps: 'Open in Maps',
    
    // Empty States
    noSpotsFound: '🗺️ No spots found yet. Be the first to add one!',
    
    // Errors
    mustBeLoggedIn: 'You must be logged in to add a spot',
    pleaseSelectLocation: 'Please select a location on the map',
    pleaseUploadImage: 'Please upload an image',
    pleaseEnterName: 'Please enter a name for the spot',
    imageTooLarge: 'Image must be less than 5MB',
    
    // Actions
    close: 'Close',
    save: 'Save',
    delete: 'Delete',
    edit: 'Edit',
  },
};

export type TranslationKey = keyof typeof translations.hu;
