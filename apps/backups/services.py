import datetime
import json
import shutil
from pathlib import Path
from zipfile import ZipFile
import logging

from django.conf import settings
from django.core.management import call_command

logger = logging.getLogger(__name__)

EXCLUDED_MODELS = [
    "contenttypes",
    "auth.permission",
    "admin.logentry",
    "sessions.session",
    "backups",  # Don't backup the backup jobs themselves
]


def get_backup_dir() -> Path:
    """Get the backup directory, creating it if necessary."""
    backup_dir = Path(settings.BACKUP_ROOT)
    backup_dir.mkdir(parents=True, exist_ok=True)
    return backup_dir


def get_data_dirs() -> list[Path]:
    """Get list of data directories to include in backups."""
    dirs = getattr(settings, "BACKUP_DATA_DIRS", [])
    return [Path(d) for d in dirs if d and Path(d).exists()]


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
    database_data = []
    from io import StringIO
    buffer = StringIO()

    call_command(
        "dumpdata",
        use_natural_foreign_keys=True,
        use_natural_primary_keys=True,
        indent=2,
        exclude=EXCLUDED_MODELS,
        stdout=buffer,
    )
    database_json = buffer.getvalue()

    # Create ZIP archive
    with ZipFile(backup_file, "w") as zip_file:
        # Add database dump
        zip_file.writestr("database.json", database_json)

        # Add metadata
        metadata = {
            "format": "dispatcharr-backup",
            "version": 1,
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


def restore_backup(backup_file: Path) -> None:
    """
    Restore from a backup archive.
    WARNING: This will flush the database and restore from backup!
    """
    if not backup_file.exists():
        raise FileNotFoundError(f"Backup file not found: {backup_file}")

    logger.info(f"Restoring from backup: {backup_file}")

    import tempfile
    with tempfile.TemporaryDirectory(prefix="dispatcharr-restore-") as temp_dir:
        temp_path = Path(temp_dir)

        # Extract backup
        logger.debug("Extracting backup archive...")
        with ZipFile(backup_file, "r") as zip_file:
            zip_file.extractall(temp_path)

        # Validate backup
        database_file = temp_path / "database.json"
        if not database_file.exists():
            raise ValueError("Invalid backup: missing database.json")

        # Flush database
        logger.warning("Flushing database...")
        call_command("flush", verbosity=0, interactive=False)

        # Restore database
        logger.info("Restoring database...")
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
