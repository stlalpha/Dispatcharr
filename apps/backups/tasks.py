import logging
from celery import shared_task

from . import services

logger = logging.getLogger(__name__)


@shared_task(bind=True)
def create_backup_task(self):
    """Celery task to create a backup asynchronously."""
    try:
        logger.info(f"Starting backup task {self.request.id}")
        backup_file = services.create_backup()
        logger.info(f"Backup task {self.request.id} completed: {backup_file.name}")
        return {
            "status": "completed",
            "filename": backup_file.name,
            "size": backup_file.stat().st_size,
        }
    except Exception as e:
        logger.error(f"Backup task {self.request.id} failed: {str(e)}")
        return {
            "status": "failed",
            "error": str(e),
        }


@shared_task(bind=True)
def restore_backup_task(self, filename: str):
    """Celery task to restore a backup asynchronously."""
    try:
        logger.info(f"Starting restore task {self.request.id} for {filename}")
        backup_dir = services.get_backup_dir()
        backup_file = backup_dir / filename
        services.restore_backup(backup_file)
        logger.info(f"Restore task {self.request.id} completed")
        return {
            "status": "completed",
            "filename": filename,
        }
    except Exception as e:
        logger.error(f"Restore task {self.request.id} failed: {str(e)}")
        return {
            "status": "failed",
            "error": str(e),
        }
