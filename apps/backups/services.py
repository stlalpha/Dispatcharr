import datetime
import json
import shutil
import subprocess
from pathlib import Path
from zipfile import ZipFile
import logging
import tempfile

from django.conf import settings
from django.db import connection

logger = logging.getLogger(__name__)

# Backup task name constant
BACKUP_TASK_NAME = "apps.backups.tasks.create_scheduled_backup"
BACKUP_PERIODIC_TASK_NAME = "scheduled-backup"


def get_backup_dir() -> Path:
    """Get the backup directory, creating it if necessary."""
    backup_dir = Path(settings.BACKUP_ROOT)
    backup_dir.mkdir(parents=True, exist_ok=True)
    return backup_dir


def get_data_dirs() -> list[Path]:
    """Get list of data directories to include in backups."""
    dirs = getattr(settings, "BACKUP_DATA_DIRS", [])
    return [Path(d) for d in dirs if d and Path(d).exists()]


def _get_db_engine() -> str:
    """Get the database engine type (postgresql or sqlite)."""
    engine = settings.DATABASES["default"]["ENGINE"]
    if "postgresql" in engine:
        return "postgresql"
    elif "sqlite" in engine:
        return "sqlite"
    else:
        raise ValueError(f"Unsupported database engine: {engine}")


def _dump_postgresql() -> str:
    """Create a PostgreSQL database dump using pg_dump."""
    db_settings = settings.DATABASES["default"]

    env = {
        "PGPASSWORD": db_settings.get("PASSWORD", ""),
    }

    cmd = [
        "pg_dump",
        "--host", db_settings.get("HOST", "localhost"),
        "--port", str(db_settings.get("PORT", 5432)),
        "--username", db_settings.get("USER", "postgres"),
        "--dbname", db_settings.get("NAME", "dispatcharr"),
        "--no-owner",
        "--no-acl",
        "--clean",
        "--if-exists",
    ]

    logger.debug(f"Running pg_dump: {' '.join(cmd)}")
    result = subprocess.run(
        cmd,
        env={**subprocess.os.environ, **env},
        capture_output=True,
        text=True,
        check=True,
    )

    return result.stdout


def _dump_sqlite() -> str:
    """Create a SQLite database dump using sqlite3."""
    db_settings = settings.DATABASES["default"]
    db_path = db_settings.get("NAME")

    if not db_path:
        raise ValueError("SQLite database path not configured")

    cmd = ["sqlite3", db_path, ".dump"]

    logger.debug(f"Running sqlite3 dump: {' '.join(cmd)}")
    result = subprocess.run(
        cmd,
        capture_output=True,
        text=True,
        check=True,
    )

    return result.stdout


def create_backup() -> Path:
    """
    Create a backup archive containing database dump and data directories.
    Returns the path to the created backup file.
    """
    backup_dir = get_backup_dir()
    timestamp = datetime.datetime.now(datetime.UTC).strftime("%Y.%m.%d.%H.%M.%S")
    backup_name = f"dispatcharr-backup-{timestamp}.zip"
    backup_file = backup_dir / backup_name

    logger.info(f"Creating backup: {backup_name}")

    # Create database dump
    logger.debug("Dumping database...")
    db_engine = _get_db_engine()

    if db_engine == "postgresql":
        database_dump = _dump_postgresql()
    elif db_engine == "sqlite":
        database_dump = _dump_sqlite()
    else:
        raise ValueError(f"Unsupported database engine: {db_engine}")

    # Create ZIP archive
    with ZipFile(backup_file, "w") as zip_file:
        # Add database dump
        zip_file.writestr("database.sql", database_dump)

        # Add metadata
        metadata = {
            "format": "dispatcharr-backup",
            "version": 2,
            "db_engine": db_engine,
            "created_at": datetime.datetime.now(datetime.UTC).isoformat(),
        }
        zip_file.writestr("metadata.json", json.dumps(metadata, indent=2))

        # Add data directories
        for data_dir in get_data_dirs():
            logger.debug(f"Adding directory: {data_dir}")
            for file_path in data_dir.rglob("*"):
                if file_path.is_file():
                    arcname = f"data/{data_dir.name}/{file_path.relative_to(data_dir)}"
                    zip_file.write(file_path, arcname)

    logger.info(f"Backup created successfully: {backup_file}")
    return backup_file


def _restore_postgresql(dump_file: Path) -> None:
    """Restore a PostgreSQL database from a SQL dump using psql."""
    db_settings = settings.DATABASES["default"]

    env = {
        "PGPASSWORD": db_settings.get("PASSWORD", ""),
    }

    cmd = [
        "psql",
        "--host", db_settings.get("HOST", "localhost"),
        "--port", str(db_settings.get("PORT", 5432)),
        "--username", db_settings.get("USER", "postgres"),
        "--dbname", db_settings.get("NAME", "dispatcharr"),
        "--file", str(dump_file),
        "--quiet",
    ]

    logger.debug(f"Running psql restore: {' '.join(cmd)}")
    result = subprocess.run(
        cmd,
        env={**subprocess.os.environ, **env},
        capture_output=True,
        text=True,
        check=True,
    )

    if result.stderr:
        logger.warning(f"psql warnings/errors: {result.stderr}")


def _restore_sqlite(dump_file: Path) -> None:
    """Restore a SQLite database from a SQL dump."""
    db_settings = settings.DATABASES["default"]
    db_path = db_settings.get("NAME")

    if not db_path:
        raise ValueError("SQLite database path not configured")

    # Close all database connections before restore
    connection.close()

    # Read the dump file
    with open(dump_file, "r") as f:
        dump_sql = f.read()

    cmd = ["sqlite3", db_path]

    logger.debug(f"Running sqlite3 restore: {' '.join(cmd)}")
    result = subprocess.run(
        cmd,
        input=dump_sql,
        capture_output=True,
        text=True,
        check=True,
    )

    if result.stderr:
        logger.warning(f"sqlite3 warnings/errors: {result.stderr}")


def restore_backup(backup_file: Path) -> None:
    """
    Restore from a backup archive.
    WARNING: This will replace the database and data directories from backup!
    """
    if not backup_file.exists():
        raise FileNotFoundError(f"Backup file not found: {backup_file}")

    logger.info(f"Restoring from backup: {backup_file}")

    with tempfile.TemporaryDirectory(prefix="dispatcharr-restore-") as temp_dir:
        temp_path = Path(temp_dir)

        # Extract backup
        logger.debug("Extracting backup archive...")
        with ZipFile(backup_file, "r") as zip_file:
            zip_file.extractall(temp_path)

        # Read and validate metadata
        metadata_file = temp_path / "metadata.json"
        if metadata_file.exists():
            with open(metadata_file, "r") as f:
                metadata = json.load(f)
            logger.info(f"Backup metadata: {metadata}")
            backup_version = metadata.get("version", 1)
            backup_db_engine = metadata.get("db_engine")
        else:
            # Legacy backup without metadata
            backup_version = 1
            backup_db_engine = None

        # Determine database file
        if backup_version >= 2:
            # New format uses database.sql
            database_file = temp_path / "database.sql"
            if not database_file.exists():
                raise ValueError("Invalid backup: missing database.sql")
        else:
            # Legacy format uses database.json
            database_file = temp_path / "database.json"
            if not database_file.exists():
                raise ValueError("Invalid backup: missing database.json")

        # Get current database engine
        current_db_engine = _get_db_engine()

        # Verify compatibility
        if backup_db_engine and backup_db_engine != current_db_engine:
            raise ValueError(
                f"Database engine mismatch: backup is {backup_db_engine}, "
                f"current is {current_db_engine}"
            )

        # Restore database
        logger.info("Restoring database...")
        if backup_version >= 2:
            # New format: use native database restore
            if current_db_engine == "postgresql":
                _restore_postgresql(database_file)
            elif current_db_engine == "sqlite":
                _restore_sqlite(database_file)
            else:
                raise ValueError(f"Unsupported database engine: {current_db_engine}")
        else:
            # Legacy format: use Django loaddata
            from django.core.management import call_command
            logger.warning("Restoring from legacy backup format using loaddata")
            call_command("flush", verbosity=0, interactive=False)
            call_command("loaddata", str(database_file))

        # Restore data directories
        data_root = temp_path / "data"
        if data_root.exists():
            logger.info("Restoring data directories...")
            for extracted_dir in data_root.iterdir():
                if not extracted_dir.is_dir():
                    continue

                # Find matching data directory
                target_name = extracted_dir.name
                data_dirs = get_data_dirs()
                matching = [d for d in data_dirs if d.name == target_name]

                if not matching:
                    logger.warning(f"No configured directory for {target_name}, skipping")
                    continue

                target = matching[0]
                logger.debug(f"Restoring {target_name} to {target}")

                # Remove existing and copy from backup
                if target.exists():
                    shutil.rmtree(target)
                shutil.copytree(extracted_dir, target)

    logger.info("Restore completed successfully")


def list_backups() -> list[dict]:
    """List all available backup files with metadata."""
    backup_dir = get_backup_dir()
    backups = []

    for backup_file in sorted(backup_dir.glob("dispatcharr-backup-*.zip"), reverse=True):
        backups.append({
            "name": backup_file.name,
            "size": backup_file.stat().st_size,
            "created": datetime.datetime.fromtimestamp(backup_file.stat().st_mtime).isoformat(),
        })

    return backups


def delete_backup(filename: str) -> None:
    """Delete a backup file."""
    backup_dir = get_backup_dir()
    backup_file = backup_dir / filename

    if not backup_file.exists():
        raise FileNotFoundError(f"Backup file not found: {filename}")

    if not backup_file.is_file():
        raise ValueError(f"Invalid backup file: {filename}")

    backup_file.unlink()
    logger.info(f"Deleted backup: {filename}")


def enforce_retention_policy(retention_count: int) -> None:
    """
    Enforce backup retention policy by deleting old backups.
    Keeps the newest 'retention_count' backups and deletes older ones.
    """
    if retention_count <= 0:
        logger.debug("Retention policy disabled (count <= 0)")
        return

    backup_dir = get_backup_dir()
    backups = sorted(
        backup_dir.glob("dispatcharr-backup-*.zip"),
        key=lambda p: p.stat().st_mtime,
        reverse=True,  # Newest first
    )

    if len(backups) <= retention_count:
        logger.debug(f"Retention policy: {len(backups)} backups, keeping all (limit: {retention_count})")
        return

    backups_to_delete = backups[retention_count:]
    logger.info(f"Retention policy: deleting {len(backups_to_delete)} old backups (keeping {retention_count} newest)")

    for backup_file in backups_to_delete:
        try:
            backup_file.unlink()
            logger.debug(f"Deleted old backup: {backup_file.name}")
        except Exception as e:
            logger.error(f"Failed to delete backup {backup_file.name}: {e}")


def update_backup_schedule(enabled: bool, interval_hours: int) -> None:
    """
    Update or create the Celery Beat periodic task for scheduled backups.

    Args:
        enabled: Whether scheduled backups are enabled
        interval_hours: Backup interval in hours
    """
    try:
        from django_celery_beat.models import PeriodicTask, IntervalSchedule

        # Get or create interval schedule
        schedule, _ = IntervalSchedule.objects.get_or_create(
            every=interval_hours,
            period=IntervalSchedule.HOURS,
        )

        # Get or create the periodic task
        task, created = PeriodicTask.objects.get_or_create(
            name=BACKUP_PERIODIC_TASK_NAME,
            defaults={
                "task": BACKUP_TASK_NAME,
                "interval": schedule,
                "enabled": enabled,
            },
        )

        # Update if it already existed
        if not created:
            task.task = BACKUP_TASK_NAME
            task.interval = schedule
            task.enabled = enabled
            task.save()

        action = "created" if created else "updated"
        status = "enabled" if enabled else "disabled"
        logger.info(
            f"Backup schedule {action}: {status}, "
            f"running every {interval_hours} hour(s)"
        )

    except ImportError:
        logger.error("django_celery_beat not installed, cannot schedule backups")
        raise
    except Exception as e:
        logger.error(f"Failed to update backup schedule: {e}")
        raise


def get_backup_schedule_status() -> dict:
    """
    Get the current backup schedule status.

    Returns:
        dict with keys: enabled, interval_hours, next_run
    """
    try:
        from django_celery_beat.models import PeriodicTask

        try:
            task = PeriodicTask.objects.get(name=BACKUP_PERIODIC_TASK_NAME)
            return {
                "enabled": task.enabled,
                "interval_hours": task.interval.every if task.interval else 0,
                "next_run": task.last_run_at.isoformat() if task.last_run_at else None,
            }
        except PeriodicTask.DoesNotExist:
            return {
                "enabled": False,
                "interval_hours": 0,
                "next_run": None,
            }

    except ImportError:
        logger.warning("django_celery_beat not installed")
        return {
            "enabled": False,
            "interval_hours": 0,
            "next_run": None,
        }
