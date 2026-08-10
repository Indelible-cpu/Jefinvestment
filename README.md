# Jef Investment ERP

A complete, production-ready, custom Enterprise Resource Planning (ERP) & Point of Sale (POS) system designed for **Jef Investment Limited** to replace legacy sales systems.

---

## 🌟 Key Features

- **Offline-First Point of Sale (POS):** Works 100% offline using local browser storage, queues transactions, and automatically synchronizes with Firebase Firestore when the internet returns.
- **Inventory & Stock Management:** Complete tracking of physical goods, SKUs, cost prices, selling prices, stock levels, reorder thresholds, and low-stock alerts.
- **Stationery & Print Shop Module:** Specialized unit-costing system (labor, electricity, overheads) with automated raw material deduction upon sale.
- **Phone Tech Solutions:** Service tracking for phone repairs, accessories, and technical solutions.
- **Financial & Expense Tracking:** Real-time expense logging, daily net profit calculations, customer credit tracking, and repayment recording.
- **Staff & HR Management:** Directory of employees, attendance status (`PRESENT`, `ABSENT`, `LEAVE`), and salary advance tracking.
- **Multi-Role Security (RBAC):** Granular permissions for Cashier, Manager, and Admin roles.
- **System Locks & Audit Trails:** Automatic business-hours lock, configurable idle timeout lock, and full real-time Audit Logging.

---

## 🛠️ Technology Stack

- **Frontend:** React 18, TypeScript, Vite, Tailwind CSS, Lucide Icons, Sonner Toasts
- **State Management:** Zustand (with local persistence)
- **Database & Auth:** Firebase Auth, Firebase Firestore (Realtime database)
- **Deployment:** Progressive Web App (PWA) / Single Page Application deployed via GitHub Actions & Firebase Hosting

---

## 📚 Documentation Index

- 📖 **[User Manual](USER_MANUAL.md)** — Complete guide for Cashiers, Managers, and Admins.
- ⚙️ **[Installation Guide](INSTALLATION.md)** — Local setup, environment variables, and dev server launch.
- 🔐 **[Security Features](SECURITY.md)** — Authentication, RBAC, Firestore security rules, and audit logging.
- 🌐 **[Offline Sync Architecture](OFFLINE_SYNC.md)** — Queue mechanism, IndexedDB/Zustand storage, and conflict resolution.
- 🗄️ **[Database Schema](DATABASE_SCHEMA.md)** — Overview of Firestore collections (`sales`, `products`, `users`, `expenses`, `auditLogs`, `settings`).
- 🚀 **[Deployment Guide](DEPLOYMENT.md)** — CI/CD pipelines, GitHub Actions workflow, and Firebase Hosting configuration.
- 🔄 **[Backup & Recovery](BACKUP_RECOVERY.md)** — Data retention policies and export procedures.
