# Installation & Development Guide

This document covers local setup, environment configuration, and development commands for **Jef Investment ERP**.

---

## Prerequisites

- **Node.js**: v18.x or v20.x+
- **Package Manager**: `npm` (v9+)
- **Firebase CLI**: `npm install -g firebase-tools` (Optional, for deploying rules)

---

## Environment Setup

1. Clone the repository:
   ```bash
   git clone https://github.com/Indelible-cpu/Jefinvestment.git
   cd Jefinvestment
   ```

2. Change to the frontend directory:
   ```bash
   cd frontend
   ```

3. Install dependencies:
   ```bash
   npm install
   ```

4. Create your `.env` file inside `frontend/`:
   ```env
   VITE_FIREBASE_API_KEY=your_api_key
   VITE_FIREBASE_AUTH_DOMAIN=your_auth_domain
   VITE_FIREBASE_PROJECT_ID=your_project_id
   VITE_FIREBASE_STORAGE_BUCKET=your_storage_bucket
   VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
   VITE_FIREBASE_APP_ID=your_app_id
   ```

---

## Local Development

Start the Vite development server:
```bash
npm run dev
```

The application will launch at `http://localhost:5173` with full PWA and offline-first capabilities enabled.

---

## TypeScript Verification & Build

Run the TypeScript compiler and production build check:
```bash
npm run build
```

---

## Deploying Firestore Security Rules

To publish security rule updates to Firebase manually or via CLI:
```bash
firebase deploy --only firestore:rules
```
Or paste the contents of `firestore.rules` directly into the **Rules** tab of your **Firebase Console**.
