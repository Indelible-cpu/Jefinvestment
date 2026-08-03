# Installation Guide

## Prerequisites
- Node.js v20+
- PostgreSQL 15+
- Docker & Docker Compose (Optional for local DB setup)

## Local Setup

### 1. Database Configuration
If using Docker, start the PostgreSQL container:
```bash
docker-compose up -d db
```

### 2. Backend Setup
```bash
cd backend
npm install
cp .env.example .env # Ensure DATABASE_URL is correct
npx prisma generate
npx prisma db push
npm run build
npm start
```

### 3. Frontend Setup
```bash
cd frontend
npm install
cp .env.example .env
npm run dev
```

The frontend will run on `http://localhost:5173` and backend on `http://localhost:5000`.
