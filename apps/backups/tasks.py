import logging
from celery import shared_task
from core.models import CoreSettings
from . import services

logger = logging.getLogger(__name__)


@shared_task(name="apps.backups.tasks.create_scheduled_backup")
def create_scheduled_backup():
    """
    Celery task to create a scheduled backup.
    This task is triggered by Celery Beat according to the configured schedule.
    """
    try:
        logger.info("Starting scheduled backup...")

        # Create the backup
        backup_file = services.create_backup()
        logger.info(f"Scheduled backup created: {backup_file.name}")

        # Enforce retention policy
        retention_count = CoreSettings.get_backup_retention_count()
        logger.info(f"Enforcing retention policy (keeping {retention_count} backups)...")
        services.enforce_retention_policy(retention_count)

        logger.info("Scheduled backup completed successfully")
        return {"status": "success", "filename": backup_file.name}

    except Exception as e:
        logger.error(f"Scheduled backup failed: {e}", exc_info=True)
        raise
