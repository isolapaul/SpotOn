# SpotOn - Firebase Cloud Functions Setup

## 🚀 Gyors Deploy Lépések

### 1. Dependency-k telepítése
```bash
cd functions
npm install
```

### 2. Build ellenőrzés
```bash
npm run build
```

### 3. Deploy
```bash
firebase deploy --only functions
```

---

## 📦 Mi lett létrehozva?

```
functions/
├── src/
│   └── index.ts          ✅ Fő functions kód (4 trigger)
├── package.json          ✅ Dependencies
├── tsconfig.json         ✅ TypeScript config
├── .eslintrc.js          ✅ Linting
└── .gitignore            ✅ Git ignore
```

---

## 🔔 Triggerek Összefoglalója

| Trigger | Event | Címzett | Üzenet (HU) |
|---------|-------|---------|-------------|
| `onSpotApproved` | Spot jóváhagyva | Creator | "Jóváhagyták a helyedet! 🥳" |
| `onReviewAdded` | Új értékelés | Creator | "Új értékelés érkezett! ⭐" |
| `onSpotFavorited` | Kedvencnek jelölve | Creator | "Valaki kedvelte a helyedet ❤️" |
| `onNewPendingSpot` | Új pending spot | Minden admin | "Új hely vár jóváhagyásra 🛡️" |

---

## 🧪 Tesztelés

1. **Engedélyezd az értesítéseket** a frontend-en
2. **Adj hozzá új helyet** (nem admin userrel) → Admin kap értesítést
3. **Hagyj jóvá egy helyet** (admin userrel) → Creator kap értesítést
4. **Értékelj egy helyet** → Creator kap értesítést
5. **Jelölj kedvencnek egy helyet** → Creator kap értesítést

---

## ℹ️ További részletek

Lásd: `FIREBASE_FUNCTIONS_SETUP.md`
