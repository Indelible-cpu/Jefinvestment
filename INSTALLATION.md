# Installation & Development Guide

This document covers local setup, environment configuration, and development commands for **MsikaFlo**.

> **Developer:** Indelible Technologies — [indelibletechnologiesmw@gmail.com](mailto:indelibletechnologiesmw@gmail.com)  
> **Repository:** [github.com/Indelible-cpu/Jefinvestment](https://github.com/Indelible-cpu/Jefinvestment)  
> **Last updated:** October 2026

---

## Prerequisites

| Requirement | Version | Notes |
|---|---|---|
| **Node.js** | 24.x (LTS) | CI/CD pipeline uses Node 24; do not use Node < 18 |
| **npm** | 10.x+ | Bundled with Node 24 |
| **Firebase CLI** | Latest | `npm install -g firebase-tools` (only needed for rule deployment) |
| **Git** | Any recent | For cloning and version control |

> **Note:** The GitHub Actions CI runner uses Node 24. Using the same version locally avoids dependency resolution differences.

---

## 1. Clone the Repository

```bash
git clone https://github.com/Indelible-cpu/Jefinvestment.git
cd Jefinvestment
```

---

## 2. Install Dependencies

```bash
cd frontend
npm install
```

This installs the full dependency tree including:
- React 19, TypeScript 5, Vite 6
- Tailwind CSS 4
- Firebase 12 (Auth, Firestore, Storage, Messaging)
- Zustand 5
- TensorFlow.js + MobileNet (AI Product Finder)
- `vite-plugin-pwa` + Workbox (PWA + offline support)
- Lucide React (icons)

---

## 3. Configure Environment Variables

Create a `.env` file inside `frontend/`:

```env
VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_auth_domain
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_storage_bucket
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
VITE_FIREBASE_MEASUREMENT_ID=your_measurement_id
```

> Copy `frontend/.env.example` as a starting template.

| Variable | Description |
|---|---|
| `VITE_FIREBASE_API_KEY` | Firebase Web API Key |
| `VITE_FIREBASE_AUTH_DOMAIN` | Firebase Auth domain |
| `VITE_FIREBASE_PROJECT_ID` | Firestore project ID |
| `VITE_FIREBASE_STORAGE_BUCKET` | Firebase Storage bucket |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | FCM sender ID (push notifications) |
| `VITE_FIREBASE_APP_ID` | Firebase App ID |
| `VITE_FIREBASE_MEASUREMENT_ID` | Google Analytics Measurement ID _(optional)_ |

> **Never commit `.env` to version control.** It is listed in `.gitignore` by default.

---

## 4. Start the Development Server

```bash
npm run dev
```

- Launches Vite dev server at `http://localhost:5173`
- Hot Module Replacement (HMR) enabled
- PWA Service Worker active in development mode (Workbox injects)
- All Firebase services connect live (ensure `.env` is configured)

---

## 5. TypeScript Type Check

Run the TypeScript compiler in no-emit mode:

```bash
npx tsc -b
```

This checks for type errors without producing output files. The CI pipeline runs this check automatically on every push to `main`.

---

## 6. Production Build

```bash
npm run build
```

Outputs an optimised production bundle to `frontend/dist/`:
- JS and CSS are minified and code-split
- Workbox generates `sw.js` with 57 pre-cached assets (including `cosmic-bg.webp`)
- PWA manifest is injected
- Build artefacts are ready for Firebase Hosting deployment

---

## 7. Preview the Production Build Locally

```bash
npm run preview
```

Serves the `dist/` folder locally at `http://localhost:4173` — useful for verifying the production build before deployment.

---

## 8. Deploy Firestore Security Rules

To publish `firestore.rules` to Firebase:

```bash
firebase deploy --only firestore:rules
```

Alternatively, paste the contents of `firestore.rules` directly into the **Rules** tab of the [Firebase Console](https://console.firebase.google.com) and click **Publish**.

---

## 9. Key Source Files

| Path | Description |
|---|---|
| `frontend/src/main.tsx` | Application entry point |
| `frontend/src/App.tsx` | Root component, router, auth guard |
| `frontend/src/pages/Login.tsx` | Login page (premium cosmic UI) |
| `frontend/src/stores/authStore.ts` | Firebase Auth + offline credential caching |
| `frontend/src/stores/cartStore.ts` | POS cart, products, barcode scanner |
| `frontend/src/stores/dataStore.ts` | Sales, expenses, employees, branches, orders |
| `frontend/src/stores/settingsStore.ts` | Global settings, company info |
| `frontend/vite.config.ts` | Vite + PWA + Workbox configuration |
| `frontend/public/cosmic-bg.webp` | Login page background (52 KB optimised WebP) |
| `firestore.rules` | Firestore security rules |
| `.github/workflows/deploy.yml` | CI/CD pipeline (GitHub Actions) |

---

## 10. Troubleshooting

| Problem | Solution |
|---|---|
| `firebase: command not found` | Run `npm install -g firebase-tools` |
| `vite: command not found` | Run `npm install` inside `frontend/` |
| Build fails on TypeScript errors | Run `npx tsc -b` to see full error list |
| PWA not updating on device | Hard-refresh (Ctrl+Shift+R) or clear site data in Chrome |
| Firebase auth errors | Verify `.env` variables are set correctly |
| `VITE_FIREBASE_MEASUREMENT_ID` missing | Add to `.env`; optional but prevents console warnings |
