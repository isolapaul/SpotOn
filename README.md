# 🌍 SpotOn - Discover & Share Hidden Gems

> **Live Demo:** [https://spot-on-rho.vercel.app/](https://spot-on-rho.vercel.app/)

SpotOn is a Progressive Web App (PWA) that enables users to discover and share their favorite locations on an interactive map. Features Google Maps integration, real-time data synchronization with Firebase, and modern glassmorphism design.

---

## ✨ Key Features

### 🗺️ **Map Display**
- Google Maps integration with custom category-based markers (🌅🏔️💨🌳)
- GPS-based location detection
- Real-time spot updates from Firebase Firestore
- Status-based marker coloring (green=approved, yellow=pending)

### 🔍 **Filtering & Discovery**
- Distance-based filtering (1-50 km radius)
- Category filtering (Scenic View, Hidden Spot, Viewpoint, Park)
- Random location generator with distance selection
- Admin/user-based visibility

### 📍 **Spot Management**
- Add new locations with image upload (automatic compression)
- Optional photo support
- Category selection (scenic, smoke-spot, viewpoint, other)
- Auto-approval for admins, pending approval for users

### ⭐ **Rating System**
- 5-star rating
- Comments with photo and name
- Average rating calculation
- Real-time synchronization

### 👤 **User Accounts**
- Google Sign-in with Firebase Auth
- Profile photo and name display
- List your own spots by status (approved/pending)
- Favorites management (coming soon)

### 🌐 **Multilingual Support**
- Hungarian 🇭🇺
- English 🇬🇧
- German 🇩🇪
- Language selector on first launch

### 👨‍💼 **Admin System**
- Email-based admin permissions
- Approve pending locations
- View all spots (approved + pending)
- Status badges and admin controls

### 📱 **PWA Features**
- Installable on mobile and desktop
- Offline functionality (service worker)
- iOS safe area support
- Platform-specific navigation (Google Maps/Apple Maps)
- Push notification support (coming soon)

---

## 🛠️ Tech Stack

- **Framework:** Next.js 14+ (App Router)
- **Language:** TypeScript
- **Styling:** Tailwind CSS + Custom Glassmorphism
- **Maps:** Google Maps API (@react-google-maps/api)
- **Backend:** Firebase (Auth, Firestore, Storage)
- **State Management:** Zustand
- **Image Processing:** browser-image-compression
- **Icons:** Lucide React
- **Deployment:** Vercel

---

## 🚀 Installation & Setup

### 1. **Clone Repository**
```bash
git clone https://github.com/yourusername/SpotOn.git
cd SpotOn
```

### 2. **Install Dependencies**
```bash
npm install
```

### 3. **Environment Variables Setup**
Create a `.env.local` file in the project root:

```env
# Firebase Config
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_auth_domain
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_storage_bucket
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id

# Google Maps API Key
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=your_google_maps_key
```

### 4. **Create Firebase Project**
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Create a new project
3. Enable the following:
   - **Authentication** → Google Sign-in
   - **Firestore Database** → Production mode
   - **Storage** → Default rules
4. Copy the config values to `.env.local`

### 5. **Get Google Maps API Key**
1. Visit [Google Cloud Console](https://console.cloud.google.com/)
2. Enable Maps JavaScript API
3. Generate API key and copy to `.env.local`

### 6. **Set Admin Email**
Open `src/store/useSpotStore.ts` and add your admin email:
```typescript
const ADMIN_EMAILS = ['your-email@gmail.com'];
```

### 7. **Start Development Server**
```bash
npm run dev
```
Open browser: [http://localhost:3000](http://localhost:3000)

### 8. **Production Build**
```bash
npm run build
npm start
```

---

## 📂 Project Structure

```
SpotOn/
├── src/
│   ├── app/                 # Next.js App Router pages
│   ├── components/          # React components
│   │   ├── AddSpotModal.tsx
│   │   ├── BottomNavigation.tsx
│   │   ├── FilterPanel.tsx
│   │   ├── MapView.tsx
│   │   ├── SpotDetailsPanel.tsx
│   │   └── ...
│   ├── store/               # Zustand state management
│   │   ├── useSpotStore.ts
│   │   ├── useUserStore.ts
│   │   └── ...
│   ├── lib/                 # Utilities & Firebase config
│   │   ├── firebase.ts
│   │   └── translations.ts
│   └── hooks/               # Custom React hooks
├── public/                  # Static assets
│   ├── manifest.json
│   └── icons/
└── README.md
```

---

## 🎨 Design System

### Glassmorphism Components
- `.glass` - Basic glass effect
- `.glass-card` - Cards with glass effect
- `.glass-button` - Interactive buttons
- `.glass-nav` - Navigation bar
- Custom animations (slide-up, slide-left, fade-in)

### Color Palette
- **Primary:** Blue-purple gradient (#3b82f6 → #8b5cf6)
- **Success:** Green (#10b981)
- **Warning:** Yellow (#eab308)
- **Error:** Red (#ef4444)
- **Dark Glass:** Transparent dark (#000000/40)

---

## 📱 PWA Installation

### iOS (Safari)
1. Open the website in Safari
2. Tap the "Share" button
3. "Add to Home Screen"
4. The app will appear on your home screen

### Android (Chrome)
1. Open the website in Chrome
2. "Add to Home screen" prompt
3. Or: Menu → "Install app"

### Desktop (Chrome/Edge)
1. "Install" icon in address bar
2. Or: Menu → "Install SpotOn"

---

## 🔐 Security Considerations

- Configure Firebase Security Rules
- Store API keys in environment variables
- Admin permissions based on email
- Image upload size limit (5MB)
- HTTPS required in production (handled automatically by Vercel)

---

## 🚧 Future Development

- [ ] Implement favorites functionality
- [ ] Full offline mode support
- [ ] Push notifications for new spots
- [ ] Spot deletion/editing feature
- [ ] Image gallery with multiple photos
- [ ] Social sharing (Facebook, Instagram)
- [ ] Gamification (badges, achievements)
- [ ] Dark/Light mode toggle

---

## 📄 License

MIT License - Free to use and modify

---

## 👨‍💻 Created By

**Isola Paul Luka**

🌐 Live: [SpotOn](https://spot-on-rho.vercel.app/)
