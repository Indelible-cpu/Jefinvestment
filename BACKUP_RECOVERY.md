# Backup & Disaster Recovery Guide

This document outlines backup strategies, data retention policies, and recovery procedures for **Jef Investment ERP**.

---

## 1. Automated Cloud Backups (Google Cloud Firestore)

Since all ERP data is stored in **Firebase / Google Cloud Firestore**:
- Firestore provides automatic multi-region data replication across Google data centers.
- **Scheduled Backups:** Automated daily backups can be configured in Google Cloud Console using `gcloud firestore export`.

### Manual Firestore Export Command:
```bash
gcloud firestore export gs://[YOUR_BACKUP_BUCKET_NAME]
```

---

## 2. Emergency JSON Data Export

Admins can export critical data directly from the system or browser cache:
1. **Sales & Reports:** Navigate to **Reports → Sales Summary**, filter by date range, and click **Export CSV / Report**.
2. **Products & Inventory:** Go to **Inventory**, click **Export Catalog** to download the product list.

---

## 3. Local Offline Cache Recovery

If a device suffers an internet outage while holding un-synced transactions:
- **Do NOT clear browser cache or local storage.**
- Once reconnected, the system will automatically upload queued items.
- If a device cannot be reconnected, data can be inspected directly in Chrome DevTools under **Application → Local Storage / IndexedDB**.

---

## 4. Account Recovery Procedures

- If an Admin or Manager account becomes inaccessible, another Admin can log into **Settings → User Management** and issue a password reset or adjust roles.
