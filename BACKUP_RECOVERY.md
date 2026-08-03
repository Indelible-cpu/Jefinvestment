# Backup and Recovery

## Database Backups (PostgreSQL)

If using a managed provider like Supabase or AWS RDS, automated daily backups are provided out-of-the-box. We highly recommend configuring Point-in-Time Recovery (PITR).

### Manual Backup (pg_dump)
To manually export the database:
```bash
pg_dump -U postgres -h localhost -d jef_erp -F c -b -v -f /path/to/backup/jef_erp.backup
```

### Manual Restore (pg_restore)
```bash
pg_restore -U postgres -h localhost -d jef_erp -v /path/to/backup/jef_erp.backup
```

## Offline Sync Recovery
If a device permanently loses connectivity but holds pending sales in IndexedDB:
1. Do not clear browser cache/storage.
2. In Chrome DevTools (Application > IndexedDB > jef-erp-db), you can manually export the `sync_queue` records as JSON if the device cannot be brought back online.
