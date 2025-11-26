import hashlib
import hmac
from pathlib import Path

from celery.result import AsyncResult
from django.conf import settings
from django.http import FileResponse, Http404
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes, parser_classes
from rest_framework.permissions import IsAdminUser, AllowAny
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework.response import Response

from . import services
from .tasks import create_backup_task, restore_backup_task


def _generate_task_token(task_id: str) -> str:
    """Generate a signed token for task status access without auth."""
    secret = settings.SECRET_KEY.encode()
    return hmac.new(secret, task_id.encode(), hashlib.sha256).hexdigest()[:32]


def _verify_task_token(task_id: str, token: str) -> bool:
    """Verify a task token is valid."""
    expected = _generate_task_token(task_id)
    return hmac.compare_digest(expected, token)


@api_view(["GET"])
@permission_classes([IsAdminUser])
def list_backups(request):
    """List all available backup files."""
    try:
        backups = services.list_backups()
        return Response(backups, status=status.HTTP_200_OK)
    except Exception as e:
        return Response(
            {"detail": f"Failed to list backups: {str(e)}"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )


@api_view(["POST"])
@permission_classes([IsAdminUser])
def create_backup(request):
    """Create a new backup (async via Celery)."""
    try:
        task = create_backup_task.delay()
        return Response(
            {
                "detail": "Backup started",
                "task_id": task.id,
                "task_token": _generate_task_token(task.id),
            },
            status=status.HTTP_202_ACCEPTED,
        )
    except Exception as e:
        return Response(
            {"detail": f"Failed to start backup: {str(e)}"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )


@api_view(["GET"])
@permission_classes([AllowAny])
def backup_status(request, task_id):
    """Check the status of a backup/restore task.

    Requires either:
    - Valid admin authentication, OR
    - Valid task_token query parameter
    """
    # Check for token-based auth (for restore when session is invalidated)
    token = request.query_params.get("token")
    if token:
        if not _verify_task_token(task_id, token):
            return Response(
                {"detail": "Invalid task token"},
                status=status.HTTP_403_FORBIDDEN,
            )
    else:
        # Fall back to admin auth check
        if not request.user.is_authenticated or not request.user.is_staff:
            return Response(
                {"detail": "Authentication required"},
                status=status.HTTP_401_UNAUTHORIZED,
            )

    try:
        result = AsyncResult(task_id)

        if result.ready():
            task_result = result.get()
            if task_result.get("status") == "completed":
                return Response({
                    "state": "completed",
                    "result": task_result,
                })
            else:
                return Response({
                    "state": "failed",
                    "error": task_result.get("error", "Unknown error"),
                })
        elif result.failed():
            return Response({
                "state": "failed",
                "error": str(result.result),
            })
        else:
            return Response({
                "state": result.state.lower(),
            })
    except Exception as e:
        return Response(
            {"detail": f"Failed to get task status: {str(e)}"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )


@api_view(["GET"])
@permission_classes([IsAdminUser])
def download_backup(request, filename):
    """Download a backup file."""
    try:
        backup_dir = services.get_backup_dir()
        backup_file = backup_dir / filename

        if not backup_file.exists() or not backup_file.is_file():
            raise Http404("Backup file not found")

        response = FileResponse(
            open(backup_file, "rb"),
            as_attachment=True,
            filename=filename,
        )
        return response
    except Http404:
        raise
    except Exception as e:
        return Response(
            {"detail": f"Download failed: {str(e)}"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )


@api_view(["DELETE"])
@permission_classes([IsAdminUser])
def delete_backup(request, filename):
    """Delete a backup file."""
    try:
        services.delete_backup(filename)
        return Response(
            {"detail": "Backup deleted successfully"},
            status=status.HTTP_204_NO_CONTENT,
        )
    except FileNotFoundError:
        raise Http404("Backup file not found")
    except Exception as e:
        return Response(
            {"detail": f"Delete failed: {str(e)}"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )


@api_view(["POST"])
@permission_classes([IsAdminUser])
@parser_classes([MultiPartParser, FormParser])
def upload_backup(request):
    """Upload a backup file for restoration."""
    uploaded = request.FILES.get("file")
    if not uploaded:
        return Response(
            {"detail": "No file uploaded"},
            status=status.HTTP_400_BAD_REQUEST,
        )

    try:
        backup_dir = services.get_backup_dir()
        filename = uploaded.name or "uploaded-backup.zip"

        # Ensure unique filename
        backup_file = backup_dir / filename
        counter = 1
        while backup_file.exists():
            name_parts = filename.rsplit(".", 1)
            if len(name_parts) == 2:
                backup_file = backup_dir / f"{name_parts[0]}-{counter}.{name_parts[1]}"
            else:
                backup_file = backup_dir / f"{filename}-{counter}"
            counter += 1

        # Save uploaded file
        with backup_file.open("wb") as f:
            for chunk in uploaded.chunks():
                f.write(chunk)

        return Response(
            {
                "detail": "Backup uploaded successfully",
                "filename": backup_file.name,
            },
            status=status.HTTP_201_CREATED,
        )
    except Exception as e:
        return Response(
            {"detail": f"Upload failed: {str(e)}"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )


@api_view(["POST"])
@permission_classes([IsAdminUser])
def restore_backup(request, filename):
    """Restore from a backup file (async via Celery). WARNING: This will flush the database!"""
    try:
        backup_dir = services.get_backup_dir()
        backup_file = backup_dir / filename

        if not backup_file.exists():
            raise Http404("Backup file not found")

        task = restore_backup_task.delay(filename)
        return Response(
            {
                "detail": "Restore started",
                "task_id": task.id,
                "task_token": _generate_task_token(task.id),
            },
            status=status.HTTP_202_ACCEPTED,
        )
    except Http404:
        raise
    except Exception as e:
        return Response(
            {"detail": f"Failed to start restore: {str(e)}"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )
