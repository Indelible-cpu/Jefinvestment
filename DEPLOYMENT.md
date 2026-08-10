# Deployment Guide — GitHub Actions & Firebase Hosting

The **Jef Investment ERP** is automatically built and deployed to **Firebase Hosting** using **GitHub Actions**.

---

## 1. Automated CI/CD Pipeline (GitHub Actions)

Continuous Integration & Deployment is configured in `.github/workflows/deploy.yml`:

### Workflow Steps:
1. **Trigger:** Push to the `main` branch.
2. **Setup:** Runs on Ubuntu runner with Node.js 24 environment.
3. **Build Verification:** Executes `npx tsc --noEmit` and `npm run build` inside `frontend/`.
4. **Deploy to Firebase:** Deploys static assets to **Firebase Hosting**.

---

## 2. Environment Variables in GitHub Secrets

Ensure the following GitHub Repository Secrets are set in **Settings → Secrets and variables → Actions**:
- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_APP_ID`
- `FIREBASE_SERVICE_ACCOUNT` (Service account JSON key for deployment)

---

## 3. Manual Deployment (Alternative)

To deploy manually from your terminal:

1. Install Firebase CLI:
   ```bash
   npm install -g firebase-tools
   ```
2. Log into Firebase:
   ```bash
   firebase login
   ```
3. Build the frontend:
   ```bash
   cd frontend
   npm run build
   ```
4. Deploy Hosting & Rules:
   ```bash
   firebase deploy --only hosting
   firebase deploy --only firestore:rules
   ```

---

## 4. Manual Firestore Rules Deployment

If deploying rules via CLI is unavailable, copy the exact contents of `firestore.rules` and paste them into the **Rules** tab of your **Firebase Console**, then click **Publish**.
