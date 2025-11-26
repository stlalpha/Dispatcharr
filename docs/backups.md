# Configuration Backups

Dispatcharr can create automated backups of your configuration data, allowing you to quickly roll back after changes or migrate to new installations. Each backup archive contains:

- **Database dump** - Complete database export using native tools (pg_dump for PostgreSQL, sqlite3 for SQLite)
- **Data directories** - Logos, recordings, uploads, and plugin data (configurable)
- **Metadata** - Version information and backup timestamp

Backups do **not** capture environment files (compose overrides, `.env`, secrets). Keep those backed up separately.

## Backup Settings

Navigate to **Settings → Backup & Restore** to configure automated backups:

### Scheduled Backups

- **Enable Scheduled Backups** - Toggle automatic backup creation
- **Backup Interval** - Choose how often to create backups:
  - Every 6 hours
  - Every 12 hours
  - Daily (24 hours)
  - Every 2 days (48 hours)
  - Every 3 days (72 hours)
  - Weekly (168 hours)

### Retention Policy

- **Retention Count** - Number of backups to keep (0 = unlimited)
- Old backups are automatically deleted after new backups are created
- Keeps the newest backups based on file modification time

## Manual Backups

### Create Backup

1. Click **Create Backup** button in the Backup & Restore page
2. Backup creation runs synchronously and completes within seconds to minutes
3. Download the backup immediately or store it for later

### Upload Backup

1. Click **Upload Backup** button
2. Select a previously downloaded `.zip` backup file
3. Uploaded backups appear in the list and can be restored

## Restore

**⚠️ WARNING: Restore operations are destructive and cannot be undone!**

1. Locate the backup you want to restore in the backup list
2. Click the **Restore** button (circular arrow icon)
3. Confirm the restore operation
4. The database will be replaced with the backup data
5. Data directories will be replaced with backup contents
6. You will be logged out automatically - refresh and log back in

## Download Backups

Click the **Download** icon next to any backup to save it locally. Backup files are named `dispatcharr-backup-YYYY.MM.DD.HH.MM.SS.zip`.

## Delete Backups

Click the **Delete** icon (trash) to remove a backup. This action cannot be undone.

## Backup Format

Backups are ZIP archives containing:

- `database.sql` - Native database dump (PostgreSQL or SQLite)
- `metadata.json` - Backup version and database engine information
- `data/logos/` - Channel logos
- `data/recordings/` - DVR recordings (if included)
- `data/uploads/` - User-uploaded files
- `data/plugins/` - Plugin data

## Environment Configuration

Backup paths are configured via environment variables:

```bash
# Backup storage location (default: /data/backups)
DISPATCHARR_BACKUP_ROOT=/data/backups

# Data directories to include (comma-separated)
DISPATCHARR_BACKUP_DATA_DIRS=/data/logos,/data/recordings,/data/uploads,/data/plugins
```

## Permissions & API

Only admin users can manage backups. API endpoints are available under `/api/backups/`:

- `GET /api/backups/` - List all backups
- `POST /api/backups/create/` - Create a new backup
- `POST /api/backups/upload/` - Upload a backup file
- `GET /api/backups/<filename>/download/` - Download a backup
- `DELETE /api/backups/<filename>/delete/` - Delete a backup
- `POST /api/backups/<filename>/restore/` - Restore from backup
- `GET /api/backups/settings/` - Get backup settings
- `POST /api/backups/settings/update/` - Update backup settings

## Troubleshooting

### Backup Creation Fails

- Ensure the backup path is writable (default: `/data/backups`)
- Check that `pg_dump` (PostgreSQL) or `sqlite3` is available in the container
- Verify database credentials are correct
- Check application logs for detailed error messages

### Scheduled Backups Not Running

- Verify Celery Beat and Celery Worker services are running
- Check Redis connectivity
- Ensure "Enable Scheduled Backups" is toggled on
- Review Celery logs for task execution errors

### Restore Fails

- Ensure the backup was created from a compatible database engine
- Check that the backup file is not corrupted
- Verify sufficient disk space for restoration
- Review application logs for detailed error messages

### Database Engine Mismatch

Backups include metadata about the database engine used. You cannot restore:
- A PostgreSQL backup to a SQLite database
- A SQLite backup to a PostgreSQL database

Always ensure your restore target uses the same database engine as the backup source.

## Legacy Backup Format

Backups created before version 2 used Django's `dumpdata` (JSON format). These legacy backups are still supported for restoration but will use the slower Django loaddata process. New backups use native database dumps for improved performance and reliability.
