# SpotOn - Discover & Share Hidden Gems

> **Live Demo:** [https://spot-on-rho.vercel.app/](https://spot-on-rho.vercel.app/)

SpotOn is a Progressive Web App (PWA) that enables users to discover and share their favorite locations on an interactive map. Features OpenStreetMap integration, real-time data synchronization with Firebase, and modern glassmorphism design.

---

## Key Features

### Map Display
- OpenStreetMap integration with custom category-based emoji markers
- GPS-based location detection
- Real-time spot updates from Firebase Firestore
- Status-based marker coloring (green=approved, yellow=pending)
- 5 map themes (Standard, Light, Dark, Silver, Satellite)

### Filtering & Discovery
- Distance-based filtering (1-50 km radius)
- Category filtering (Scenic, Smoke Spot, Viewpoint, Hiking, Park, Date Spot, Random, Other)
- Random location generator with distance selection
- Admin/user-based visibility

### Spot Management
- Add new locations with image upload (automatic compression)
- Category selection with 9 types
- Auto-approval for admins, pending approval for regular users

### Rating System
- 5-star rating
- Text comments with user photo and name
- Average rating calculation
- Real-time synchronization

### User Accounts
- Google Sign-in with Firebase Auth
- Profile photo, banner, and username
- List your own spots by status (approved/pending)
- Favorites management
- Level system based on spots created (levels 1-5)

### Multilingual Support
- Hungarian
- English
- German
- Language selector on first launch

### Admin System
- Email-based admin permissions stored in Firestore
- Approve pending locations
- View all spots (approved + pending)
- Status badges and admin controls

### PWA Features
- Installable on mobile and desktop
- Service worker support
- iOS safe area support
- Platform-specific navigation (Google Maps / Apple Maps)
- Push notification support

---

## Tech Stack

- **Framework:** Next.js 16 (App Router)
- **Language:** TypeScript
- **Styling:** Tailwind CSS + Custom Glassmorphism
- **Maps:** OpenStreetMap via react-leaflet
- **Backend:** Firebase (Auth, Firestore, Storage, Cloud Functions, FCM)
- **State Management:** Zustand
- **Image Processing:** browser-image-compression
- **Icons:** Lucide React
- **Deployment:** Vercel

---

## Installation & Setup

### 1. Clone Repository
```bash
git clone https://github.com/yourusername/SpotOn.git
cd SpotOn
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Environment Variables Setup
Create a `.env.local` file in the project root:

```env
# Firebase Config
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_auth_domain
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_storage_bucket
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
NEXT_PUBLIC_FIREBASE_VAPID_KEY=your_vapid_key

# Admin email (the account that gets admin privileges)
NEXT_PUBLIC_ADMIN_EMAIL=your_email@gmail.com

# Email sending (for feedback form)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_USER=your_smtp_user@gmail.com
SMTP_PASS=your_app_password
```

### 4. Create Firebase Project
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Create a new project
3. Enable the following:
   - **Authentication** — Google Sign-in
   - **Firestore Database** — Production mode
   - **Storage** — Default rules
   - **Cloud Functions** — for highlight and notification features
4. Copy the config values to `.env.local`

### 5. Start Development Server
```bash
npm run dev
```
Open browser: [http://localhost:3000](http://localhost:3000)

### 6. Production Build
```bash
npm run build
npm start
```

---

## Project Structure

```
SpotOn/
├── src/
│   ├── app/                 # Next.js App Router pages and API routes
│   ├── components/          # React components
│   │   ├── MapView.tsx
│   │   ├── SpotDetailsPanel.tsx
│   │   ├── ProfilePanel.tsx
│   │   ├── DiscoveryPanel.tsx
│   │   └── ...
│   ├── store/               # Zustand state management
│   │   ├── useSpotStore.ts
│   │   ├── useUserStore.ts
│   │   └── ...
│   ├── lib/                 # Utilities and Firebase config
│   │   ├── firebase.ts
│   │   ├── translations.ts
│   │   └── spotUtils.ts
│   ├── hooks/               # Custom React hooks
│   └── types/               # TypeScript type definitions
├── functions/               # Firebase Cloud Functions
├── public/                  # Static assets
│   ├── manifest.json
│   └── icons/
└── README.md
```

---

## Design System

### Glassmorphism Components
- `.glass` - Basic glass effect
- `.glass-card` - Cards with glass effect
- `.glass-button` - Interactive buttons
- `.glass-nav` - Navigation bar
- Custom animations: slide-up, slide-left, fade-in, scale-in

### Color Palette
- **Primary:** Blue-purple gradient (#3b82f6 to #8b5cf6)
- **Success:** Green (#10b981)
- **Warning:** Yellow (#eab308)
- **Error:** Red (#ef4444)
- **Dark Glass:** Transparent dark (#000000/40)

---

## PWA Installation

### iOS (Safari)
1. Open the website in Safari
2. Tap the "Share" button
3. Select "Add to Home Screen"

### Android (Chrome)
1. Open the website in Chrome
2. Accept the "Add to Home screen" prompt, or use Menu > "Install app"

### Desktop (Chrome/Edge)
1. Click the "Install" icon in the address bar, or use Menu > "Install SpotOn"

---

## Security Considerations

- Configure Firebase Security Rules for Firestore and Storage
- Store all API keys in environment variables, never in source code
- Admin permissions are email-based and stored in Firestore
- Image uploads are limited and compressed client-side
- HTTPS enforced in production via Vercel

---

## License

MIT License - Free to use and modify

---

## Created By

**Isola Paul Luka**

Live: [SpotOn](https://spot-on-rho.vercel.app/)
