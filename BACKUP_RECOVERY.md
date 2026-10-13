# Backup & Disaster Recovery Guide

This document outlines backup strategies, data-retention policies, and recovery procedures for **MsikaFlo**.

> **Developer:** Indelible Technologies — [indelibletechnologiesmw@gmail.com](mailto:indelibletechnologiesmw@gmail.com)  
> **Jurisdiction:** Republic of Malawi  
> **Last updated:** 13 October 2026

---

## 1. Automated Cloud Backups (Google Cloud Firestore)

All MsikaFlo business data is stored in **Google Cloud Firestore**, which provides:

- **Multi-region replication:** Data is automatically replicated across multiple Google data centres. No single point of failure.
- **Scheduled automated exports:** Configure daily backups in Google Cloud Console using the Firestore managed export service.

### Manual Firestore Export Command:
```bash
gcloud firestore export gs://[YOUR_BACKUP_BUCKET_NAME]
```

### Restore from Export:
```bash
gcloud firestore import gs://[YOUR_BACKUP_BUCKET_NAME]/[EXPORT_PREFIX]
```

> Schedule exports via Cloud Scheduler for fully automated daily backups.

---

## 2. Emergency Data Export (In-App)

Admins and Managers can export critical business data directly from MsikaFlo without needing CLI access:

| Data | Location | Action |
|---|---|---|
| Sales & revenue | **Reports → Sales Summary** | Filter by date range → **Export CSV** |
| Inventory | **Inventory → Products** | **Export Catalog** → downloads product list |
| Employee list | **HR → Employees** | Print or export from the employee table |
| Payslips | **HR → Payslips** | Download individual payslip PDFs |

---

## 3. Local Offline Cache Recovery

If a device suffers an internet outage while holding un-synced transactions:

1. **Do NOT clear browser cache, localStorage, or IndexedDB** — pending transactions are stored there.
2. Keep the device powered and reconnect it to the internet.
3. MsikaFlo will automatically detect connectivity restoration and flush all queued transactions to Firestore.
4. The **Pending Syncs** counter on the Dashboard will return to zero when all transactions have uploaded.

### Manual Inspection (if needed):
Open Chrome DevTools → **Application** tab → **Local Storage** or **IndexedDB** to inspect pending transaction queues directly.

---

## 4. Account Recovery Procedures

### 4a. Self-Service Password Reset (Users)

MsikaFlo supports self-service password recovery via email:

1. On the Login screen, tap **Forgot password?**
2. Enter the registered email address.
3. Firebase sends an official password reset email (via Firebase Authentication's `sendPasswordResetEmail`).
4. Follow the link in the email to set a new password.
5. Return to MsikaFlo and sign in with the new credentials.

> This process does not require Admin intervention and works for any registered email address.

### 4b. Admin-Initiated Password Reset

If a user cannot access their email:

1. The user or Admin navigates to **Settings → Password Reset Requests**.
2. The user submits a reset request with a brief reason.
3. The Admin reviews the request in **Settings → User Management → Password Requests**.
4. The Admin can issue a Firebase password reset email directly to the user from the Admin panel.

### 4c. Role & Access Recovery

If an Admin account becomes inaccessible:

1. Another active Admin logs in and navigates to **Settings → User Management**.
2. The Admin can modify roles, reset passwords, and reactivate accounts.
3. If no Admin accounts are accessible, contact Indelible Technologies at [indelibletechnologiesmw@gmail.com](mailto:indelibletechnologiesmw@gmail.com) for emergency account recovery.

---

## 5. Firebase Storage Recovery

Employee photos, ID scans, and product images are stored in **Firebase Storage**:

- Firebase Storage has built-in versioning and replication.
- Deleted files can be recovered within 30 days using the Firebase Console.
- To list and download files: **Firebase Console → Storage → Browse files**.

---

## 6. Application Recovery (PWA)

If the installed PWA becomes corrupted or stops responding:

1. Open Chrome → **Settings → Apps → MsikaFlo → Remove**.
2. Clear Chrome site data for the MsikaFlo domain.
3. Re-visit the MsikaFlo URL and reinstall the PWA.
4. All data is cloud-backed and will sync automatically on first login.

> **No business data is lost** by reinstalling the PWA — all data lives in Firestore, not the app bundle.

---

## 7. Disaster Recovery Timeline

| Scenario | Recovery Method | Expected Time |
|---|---|---|
| User forgets password | Self-service Forgot Password | < 5 minutes |
| Device offline with pending sales | Automatic sync on reconnect | < 1 minute |
| PWA corrupted on device | Reinstall PWA | < 3 minutes |
| Accidental data deletion | Firestore export restore | 30–60 minutes |
| Firebase outage (Google-side) | Multi-region failover (automatic) | Minutes (Google SLA) |
| All Admin accounts locked | Contact Indelible Technologies | < 24 hours |
