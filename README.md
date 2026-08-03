# Jef Investment ERP

A complete, production-ready custom ERP system designed for Jef Investment to replace MsikaPOS.

## Features
- **Offline-First Point of Sale (POS):** Works completely offline using IndexedDB, queues transactions, and synchronizes in the background when the internet returns.
- **Inventory & Stationery Management:** Full tracking of products, stationery, variants, reorder levels, and branch transfers.
- **Service Modules:** Dedicated workflows for Print Shop (Stationery Services) and Phone Tech Solutions.
- **Advanced ERP:** Expenses, Accounting (General Ledger, Journal Entries), and Staff/HR Management.
- **Multi-Branch Support:** Consolidated head office reporting and branch-specific inventory.

## Architecture
- **Frontend:** React, TypeScript, Vite, Tailwind CSS, shadcn/ui, Zustand, TanStack Query, Vite PWA.
- **Backend:** Node.js, Express, TypeScript, Prisma.
- **Database:** PostgreSQL.
- **Security:** JWT, bcrypt, Helmet, Zod validation, Rate Limiting.

## Getting Started
Please see `INSTALLATION.md` for local setup and development instructions.

## Documentation
- [Installation Guide](INSTALLATION.md)
- [User Manual](USER_MANUAL.md)
- [API Documentation](API_DOCS.md)
- [Database Schema](DATABASE_SCHEMA.md)
- [Offline Sync Architecture](OFFLINE_SYNC.md)
- [Deployment Guide](DEPLOYMENT.md)
- [Security Features](SECURITY.md)
- [Backup & Recovery](BACKUP_RECOVERY.md)
