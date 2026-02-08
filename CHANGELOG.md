# Changelog

## v1.0.0 - Initial Production Release

### Features
- **Map Exploration**: Interactive Google Maps integration with spot markers, clustering, and geolocation
- **User Profiles**: Google and email authentication, customizable profiles with avatars and banners
- **Spot Uploads with Compression**: Upload scenic locations with images automatically compressed via browser-image-compression
- **Admin System**: Role-based admin panel for spot approval, user management, and category control
- **Multi-language Support**: Full localization for Hungarian (HU), English (EN), and German (DE)
- **iOS-style UI**: Glassmorphism design, smooth animations, and native-feeling touch interactions
- **Discovery Panel**: Browse and filter spots by category, distance, and rating
- **Reviews & Ratings**: Community-driven spot ratings and review system
- **Favorites**: Save and manage favorite spots
- **Push Notifications**: Firebase Cloud Messaging integration for real-time updates
- **PWA Support**: Installable progressive web app with offline capabilities

### Security
- Content Security Policy headers configured for all routes
- X-Content-Type-Options, X-Frame-Options, X-XSS-Protection, Referrer-Policy, and Strict-Transport-Security headers
- All API keys and secrets managed via environment variables
- No hardcoded credentials in source code

### Performance
- Touch-optimized mobile experience with manipulation touch-action
- Image compression for all uploads (spots and profile images)
- Dynamic imports and code splitting for map components
- Minimum 44px touch targets for accessibility
