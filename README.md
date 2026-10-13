# MsikaFlo — Business Management System

A complete, production-ready, custom Enterprise Resource Planning (ERP) and Point of Sale (POS) system designed and built by **Indelible Technologies** for **MsikaFlo**. The system replaces legacy manual sales processes with a powerful, cloud-connected, offline-first digital platform.

---

## 🌟 Key Features

- **Cinematic Premium Login:** Dark cosmic-themed login screen with transparent Android status bar, PWA-native edge-to-edge UI, Firebase-powered authentication, and self-service password reset via email.
- **Offline-First Point of Sale (POS):** Works 100% offline using local browser storage, queues transactions, and automatically synchronizes with Firebase Firestore when the internet returns.
- **Inventory & Stock Management:** Complete tracking of physical goods, SKUs, cost prices, selling prices, stock levels, reorder thresholds, and low-stock alerts.
- **Stationery & Print Shop Module:** Specialized unit-costing system (labor, electricity, overheads) with automated raw material deduction upon sale completion.
- **Phone Tech Solutions:** Service tracking for phone repairs, accessories, and technical solutions.
- **Financial & Expense Tracking:** Real-time expense logging, daily net profit calculations, customer credit tracking, and repayment recording.
- **Staff & HR Management:** Directory of employees, attendance status (`PRESENT`, `ABSENT`, `LEAVE`), salary advance tracking, payslips, and emergency contact records.
- **Multi-Branch Management:** Branches module for managing multiple business locations from a single admin account.
- **Online Storefront (WhatsApp Commerce):** Public-facing product catalog and storefront accessible at `/store` and `/shop` for customer self-ordering.
- **Online Orders Management:** Dedicated module for managing customer orders received via the online storefront.
- **Multi-Role Security (RBAC):** Granular permissions for Cashier, Manager, and Admin roles.
- **System Locks & Audit Trails:** Automatic business-hours lock, configurable idle timeout lock, and full real-time Audit Logging.
- **Progressive Web App (PWA):** Installable on Android and iOS home screens. Supports offline use, background sync, and push notifications via Firebase Cloud Messaging (FCM).

---

## 🛠️ Technology Stack

- **Frontend:** React 19, TypeScript 5, Vite 6, Tailwind CSS 4, Lucide Icons, Sonner Toasts
- **State Management:** Zustand 5 (with local persistence and offline credential caching)
- **Database & Auth:** Firebase Auth 12, Firebase Firestore (offline-first persistent local cache), Firebase Storage, Firebase Analytics
- **AI Features:** TensorFlow.js + MobileNet (AI-powered product image recognition in Product Finder)
- **PWA:** Vite Plugin PWA, Workbox service worker with precaching (57 entries, ~5 MB offline bundle)
- **Background Asset Delivery:** 52 KB WebP cosmic background with `<head>` high-priority preloading
- **Deployment:** Progressive Web App deployed via GitHub Actions CI/CD pipeline to Firebase Hosting

---

## 📚 Documentation Index

- 📖 **[User Manual](USER_MANUAL.md)** — Complete guide for Cashiers, Managers, and Admins.
- ⚙️ **[Installation Guide](INSTALLATION.md)** — Local setup, environment variables, and dev server launch.
- 🔐 **[Security Features](SECURITY.md)** — Authentication, RBAC, Firestore security rules, audit logging, and offline credential caching.
- 🌐 **[Offline Sync Architecture](OFFLINE_SYNC.md)** — Queue mechanism, Zustand storage, PWA caching, and conflict resolution.
- 🗄️ **[Database Schema](DATABASE_SCHEMA.md)** — Overview of Firestore collections and document structures.
- 🚀 **[Deployment Guide](DEPLOYMENT.md)** — CI/CD pipelines, GitHub Actions workflow, and Firebase Hosting configuration.
- 🔄 **[Backup & Recovery](BACKUP_RECOVERY.md)** — Data retention policies and export procedures.
- 🔌 **[API & Data Architecture](API_DOCS.md)** — Firestore real-time subscriptions, store integrations, and service calls.

---

## 📞 Contact & Support

Built and maintained by **Indelible Technologies**.
📧 [indelibletechnologiesmw@gmail.com](mailto:indelibletechnologiesmw@gmail.com)
