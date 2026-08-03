# Deployment Guide

The Jef Investment ERP is designed for a cloud-native deployment.

## Frontend (Firebase Hosting or Cloudflare Pages)

1. Build the Vite application:
   ```bash
   cd frontend
   npm run build
   ```
2. The output will be in `frontend/dist`.
3. Deploy to Firebase:
   ```bash
   npm install -g firebase-tools
   firebase login
   firebase init hosting # select the dist folder
   firebase deploy
   ```

## Backend (Google Cloud Run or Render)

1. The backend provides a `Dockerfile` for containerization.
2. If using Cloud Run:
   ```bash
   gcloud builds submit --tag gcr.io/[PROJECT_ID]/jef-erp-backend
   gcloud run deploy jef-erp-backend --image gcr.io/[PROJECT_ID]/jef-erp-backend --platform managed
   ```
3. Ensure Environment Variables (e.g., `DATABASE_URL`, `JWT_SECRET`) are configured in the Cloud Run service settings.

## Database (PostgreSQL)
We recommend a managed PostgreSQL instance (e.g., Supabase, Neon, AWS RDS, Google Cloud SQL) for production.
Ensure the `DATABASE_URL` is set correctly in the backend environment to point to this managed instance.
