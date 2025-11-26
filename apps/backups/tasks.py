import logging
import traceback
from celery import shared_task

from . import services

logger = logging.getLogger(__name__)


@shared_task(bind=True)
def create_backup_task(self):
    """Celery task to create a backup asynchronously."""
    try:
        logger.info(f"[BACKUP] Starting backup task {self.request.id}")
        backup_file = services.create_backup()
        logger.info(f"[BACKUP] Task {self.request.id} completed: {backup_file.name}")
        return {
            "status": "completed",
            "filename": backup_file.name,
            "size": backup_file.stat().st_size,
        }
    except Exception as e:
        logger.error(f"[BACKUP] Task {self.request.id} failed: {str(e)}")
        logger.error(f"[BACKUP] Traceback: {traceback.format_exc()}")
        return {
            "status": "failed",
            "error": str(e),
        }


@shared_task(bind=True)
def restore_backup_task(self, filename: str):
    """Celery task to restore a backup asynchronously."""
    try:
        logger.info(f"[RESTORE] Starting restore task {self.request.id} for {filename}")
        backup_dir = services.get_backup_dir()
        backup_file = backup_dir / filename
        logger.info(f"[RESTORE] Backup file path: {backup_file}")
        services.restore_backup(backup_file)
        logger.info(f"[RESTORE] Task {self.request.id} completed successfully")
        return {
            "status": "completed",
            "filename": filename,
        }
    except Exception as e:
        logger.error(f"[RESTORE] Task {self.request.id} failed: {str(e)}")
        logger.error(f"[RESTORE] Traceback: {traceback.format_exc()}")
        return {
            "status": "failed",
            "error": str(e),
        }
