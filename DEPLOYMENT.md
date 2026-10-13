# Deployment Guide — GitHub Actions & Firebase Hosting

**MsikaFlo** is continuously built and automatically deployed to **Firebase Hosting** using **GitHub Actions**.

> **Developer:** Indelible Technologies — [indelibletechnologiesmw@gmail.com](mailto:indelibletechnologiesmw@gmail.com)  
> **Repository:** [github.com/Indelible-cpu/Jefinvestment](https://github.com/Indelible-cpu/Jefinvestment)  
> **Last updated:** October 2026

---

## 1. Automated CI/CD Pipeline (GitHub Actions)

Continuous Integration & Deployment is configured in `.github/workflows/deploy.yml`.

### Workflow Pipeline:
1. **Trigger:** Push to the `main` branch.
2. **Virtual Environment:** Ubuntu runner (`ubuntu-latest`) configured with Node.js 24 LTS.
3. **Dependency Installation:** `npm ci` inside `frontend/`.
4. **Type Checking:** Runs `npx tsc --noEmit` to verify strict TypeScript safety across all components and stores.
5. **Production Build:** Executes `npm run build` (Vite 6 + Tailwind CSS 4 + Workbox PWA service worker injection).
6. **Deploy to Firebase:** Deploys production artefacts in `frontend/dist/` to **Firebase Hosting**.

---

## 2. GitHub Repository Secrets

The following GitHub Repository Secrets must be configured in **Settings → Secrets and variables → Actions** on GitHub:

| Secret Name | Purpose |
|---|---|
| `VITE_FIREBASE_API_KEY` | Firebase Web API Key |
| `VITE_FIREBASE_AUTH_DOMAIN` | Firebase Authentication domain |
| `VITE_FIREBASE_PROJECT_ID` | Google Cloud / Firestore Project ID |
| `VITE_FIREBASE_STORAGE_BUCKET` | Firebase Cloud Storage bucket |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | FCM Messaging sender ID |
| `VITE_FIREBASE_APP_ID` | Firebase Web App ID |
| `VITE_FIREBASE_MEASUREMENT_ID` | Optional Google Analytics Measurement ID |
| `FIREBASE_SERVICE_ACCOUNT` | GCP Service Account JSON key with Hosting deployer permissions |

---

## 3. Manual Deployment (CLI Fallback)

If deployment via GitHub Actions is unavailable, deploy directly via the terminal:

### Step 1: Install Firebase CLI
```bash
npm install -g firebase-tools
```

### Step 2: Authenticate with Firebase
```bash
firebase login
```

### Step 3: Build the Production Frontend
```bash
cd frontend
npm run build
```

### Step 4: Deploy Hosting & Security Rules
```bash
firebase deploy --only hosting
firebase deploy --only firestore:rules
```

---

## 4. Deploying Firestore Security Rules

To ensure access controls match latest roles and collection structures:
```bash
firebase deploy --only firestore:rules
```

Alternatively, copy the exact contents of [firestore.rules](file:///c:/MsikaFlo/firestore.rules) into the **Rules** tab of your **Firebase Console** and click **Publish**.

---

## 5. Post-Deployment Verification Checklist

After a new release is deployed:
1. Open the production URL in Google Chrome on mobile and desktop.
2. Verify the PWA installs cleanly and registers the service worker (`sw.js`).
3. Ensure the transparent cosmic login screen displays crisp assets with the pre-cached `cosmic-bg.webp`.
4. Perform an end-to-end POS test sale and check offline queuing by toggling Airplane mode.
5. Verify live synchronization resumes once network connectivity is restored.
