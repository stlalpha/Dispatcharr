from pathlib import Path

from django.http import FileResponse, Http404
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes, parser_classes
from rest_framework.permissions import IsAdminUser
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework.response import Response

from core.models import CoreSettings
from . import services


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
    """Create a new backup."""
    try:
        backup_file = services.create_backup()
        return Response(
            {
                "detail": "Backup created successfully",
                "filename": backup_file.name,
                "size": backup_file.stat().st_size,
            },
            status=status.HTTP_201_CREATED,
        )
    except Exception as e:
        return Response(
            {"detail": f"Backup failed: {str(e)}"},
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
    """Restore from a backup file. WARNING: This will flush the database!"""
    try:
        backup_dir = services.get_backup_dir()
        backup_file = backup_dir / filename

        if not backup_file.exists():
            raise Http404("Backup file not found")

        services.restore_backup(backup_file)

        return Response(
            {"detail": "Backup restored successfully"},
            status=status.HTTP_200_OK,
        )
    except Http404:
        raise
    except ValueError as e:
        return Response(
            {"detail": str(e)},
            status=status.HTTP_400_BAD_REQUEST,
        )
    except Exception as e:
        return Response(
            {"detail": f"Restore failed: {str(e)}"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )


@api_view(["GET"])
@permission_classes([IsAdminUser])
def get_backup_settings(request):
    """Get backup schedule and retention settings."""
    try:
        # Get retention count
        retention_count = CoreSettings.get_backup_retention_count()

        # Get schedule status
        schedule_status = services.get_backup_schedule_status()

        return Response(
            {
                "retention_count": retention_count,
                "schedule_enabled": schedule_status["enabled"],
                "interval_hours": schedule_status["interval_hours"],
                "next_run": schedule_status["next_run"],
            },
            status=status.HTTP_200_OK,
        )
    except Exception as e:
        return Response(
            {"detail": f"Failed to get backup settings: {str(e)}"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )


@api_view(["POST"])
@permission_classes([IsAdminUser])
def update_backup_settings(request):
    """Update backup schedule and retention settings."""
    try:
        data = request.data

        # Update retention count if provided
        if "retention_count" in data:
            retention_count = int(data["retention_count"])
            if retention_count < 0:
                return Response(
                    {"detail": "Retention count must be >= 0"},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            CoreSettings.set_backup_retention_count(retention_count)

        # Update schedule if provided
        if "schedule_enabled" in data or "interval_hours" in data:
            schedule_enabled = data.get("schedule_enabled", False)
            interval_hours = int(data.get("interval_hours", 24))

            if interval_hours < 1:
                return Response(
                    {"detail": "Interval hours must be >= 1"},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            services.update_backup_schedule(schedule_enabled, interval_hours)

        return Response(
            {"detail": "Backup settings updated successfully"},
            status=status.HTTP_200_OK,
        )
    except ValueError as e:
        return Response(
            {"detail": f"Invalid value: {str(e)}"},
            status=status.HTTP_400_BAD_REQUEST,
        )
    except Exception as e:
        return Response(
            {"detail": f"Failed to update backup settings: {str(e)}"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )
