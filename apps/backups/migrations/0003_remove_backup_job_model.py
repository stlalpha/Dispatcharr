# Generated migration to remove the BackupJob model
# This simplifies the backup system to match Mealie's approach

from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('backups', '0002_add_celery_task_id'),
    ]

    operations = [
        migrations.DeleteModel(
            name='BackupJob',
        ),
    ]
