import json
import tempfile
from io import BytesIO
from pathlib import Path
from zipfile import ZipFile
from unittest.mock import patch, MagicMock

from django.test import TestCase, Client
from django.contrib.auth import get_user_model
from django.conf import settings
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from . import services

User = get_user_model()


class BackupServicesTestCase(TestCase):
    """Test cases for backup services"""

    def setUp(self):
        self.temp_backup_dir = tempfile.mkdtemp()
        self.temp_data_dir = tempfile.mkdtemp()

    def tearDown(self):
        import shutil
        if Path(self.temp_backup_dir).exists():
            shutil.rmtree(self.temp_backup_dir)
        if Path(self.temp_data_dir).exists():
            shutil.rmtree(self.temp_data_dir)

    @patch('apps.backups.services.settings.BACKUP_ROOT')
    def test_get_backup_dir_creates_directory(self, mock_backup_root):
        """Test that get_backup_dir creates the directory if it doesn't exist"""
        mock_backup_root.__str__ = lambda x: self.temp_backup_dir
        mock_backup_root.return_value = self.temp_backup_dir

        with patch('apps.backups.services.Path') as mock_path:
            mock_path_instance = MagicMock()
            mock_path_instance.mkdir = MagicMock()
            mock_path.return_value = mock_path_instance

            services.get_backup_dir()
            mock_path_instance.mkdir.assert_called_once_with(parents=True, exist_ok=True)

    @patch('apps.backups.services.settings.BACKUP_DATA_DIRS', [])
    def test_get_data_dirs_with_empty_config(self):
        """Test that get_data_dirs returns empty list when no dirs configured"""
        result = services.get_data_dirs()
        self.assertEqual(result, [])

    @patch('apps.backups.services.settings.BACKUP_DATA_DIRS')
    def test_get_data_dirs_filters_nonexistent(self, mock_data_dirs):
        """Test that get_data_dirs filters out non-existent directories"""
        nonexistent_dir = '/tmp/does-not-exist-12345'
        mock_data_dirs.__iter__ = lambda x: iter([self.temp_data_dir, nonexistent_dir])

        result = services.get_data_dirs()
        self.assertEqual(len(result), 1)
        self.assertEqual(str(result[0]), self.temp_data_dir)

    @patch('apps.backups.services.get_backup_dir')
    @patch('apps.backups.services.get_data_dirs')
    @patch('apps.backups.services.call_command')
    def test_create_backup_success(self, mock_call_command, mock_get_data_dirs, mock_get_backup_dir):
        """Test successful backup creation"""
        mock_get_backup_dir.return_value = Path(self.temp_backup_dir)
        mock_get_data_dirs.return_value = []

        # Mock dumpdata output
        def mock_dumpdata(*args, **kwargs):
            stdout = kwargs.get('stdout')
            if stdout:
                stdout.write('[]')

        mock_call_command.side_effect = mock_dumpdata

        result = services.create_backup()

        self.assertIsInstance(result, Path)
        self.assertTrue(result.exists())
        self.assertTrue(result.name.startswith('dispatcharr-backup-'))
        self.assertTrue(result.name.endswith('.zip'))

    @patch('apps.backups.services.get_backup_dir')
    def test_list_backups_empty(self, mock_get_backup_dir):
        """Test listing backups when none exist"""
        mock_get_backup_dir.return_value = Path(self.temp_backup_dir)

        result = services.list_backups()

        self.assertEqual(result, [])

    @patch('apps.backups.services.get_backup_dir')
    def test_list_backups_with_files(self, mock_get_backup_dir):
        """Test listing backups with existing backup files"""
        backup_dir = Path(self.temp_backup_dir)
        mock_get_backup_dir.return_value = backup_dir

        # Create a fake backup file
        test_backup = backup_dir / "dispatcharr-backup-2025.01.01.12.00.00.zip"
        test_backup.write_text("fake backup content")

        result = services.list_backups()

        self.assertEqual(len(result), 1)
        self.assertEqual(result[0]['name'], test_backup.name)
        self.assertIn('size', result[0])
        self.assertIn('created', result[0])

    @patch('apps.backups.services.get_backup_dir')
    def test_delete_backup_success(self, mock_get_backup_dir):
        """Test successful backup deletion"""
        backup_dir = Path(self.temp_backup_dir)
        mock_get_backup_dir.return_value = backup_dir

        # Create a fake backup file
        test_backup = backup_dir / "dispatcharr-backup-test.zip"
        test_backup.write_text("fake backup content")

        self.assertTrue(test_backup.exists())

        services.delete_backup(test_backup.name)

        self.assertFalse(test_backup.exists())

    @patch('apps.backups.services.get_backup_dir')
    def test_delete_backup_not_found(self, mock_get_backup_dir):
        """Test deleting a non-existent backup raises error"""
        mock_get_backup_dir.return_value = Path(self.temp_backup_dir)

        with self.assertRaises(FileNotFoundError):
            services.delete_backup("nonexistent-backup.zip")

    @patch('apps.backups.services.get_backup_dir')
    @patch('apps.backups.services.get_data_dirs')
    @patch('apps.backups.services.call_command')
    def test_restore_backup_success(self, mock_call_command, mock_get_data_dirs, mock_get_backup_dir):
        """Test successful backup restoration"""
        backup_dir = Path(self.temp_backup_dir)
        mock_get_backup_dir.return_value = backup_dir
        mock_get_data_dirs.return_value = []

        # Create a minimal valid backup file
        backup_file = backup_dir / "test-backup.zip"
        with ZipFile(backup_file, 'w') as zf:
            zf.writestr('database.json', '[]')
            zf.writestr('metadata.json', '{"version": 1}')

        # Mock call_command to prevent actual database operations
        mock_call_command.return_value = None

        services.restore_backup(backup_file)

        # Verify flush and loaddata were called
        self.assertTrue(any('flush' in str(call) for call in mock_call_command.call_args_list))
        self.assertTrue(any('loaddata' in str(call) for call in mock_call_command.call_args_list))

    def test_restore_backup_not_found(self):
        """Test restoring from non-existent backup file"""
        fake_path = Path("/tmp/nonexistent-backup-12345.zip")

        with self.assertRaises(FileNotFoundError):
            services.restore_backup(fake_path)

    @patch('apps.backups.services.get_backup_dir')
    def test_restore_backup_invalid_archive(self, mock_get_backup_dir):
        """Test restoring from invalid backup archive"""
        backup_dir = Path(self.temp_backup_dir)
        mock_get_backup_dir.return_value = backup_dir

        # Create an invalid backup file (missing database.json)
        backup_file = backup_dir / "invalid-backup.zip"
        with ZipFile(backup_file, 'w') as zf:
            zf.writestr('metadata.json', '{"version": 1}')

        with self.assertRaises(ValueError) as context:
            services.restore_backup(backup_file)

        self.assertIn('database.json', str(context.exception))


class BackupAPITestCase(TestCase):
    """Test cases for backup API endpoints"""

    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            username='testuser',
            email='test@example.com',
            password='testpass123'
        )
        self.admin_user = User.objects.create_superuser(
            username='admin',
            email='admin@example.com',
            password='adminpass123'
        )
        self.temp_backup_dir = tempfile.mkdtemp()

    def get_auth_header(self, user):
        """Helper method to get JWT auth header for a user"""
        refresh = RefreshToken.for_user(user)
        return f'Bearer {str(refresh.access_token)}'

    def tearDown(self):
        import shutil
        if Path(self.temp_backup_dir).exists():
            shutil.rmtree(self.temp_backup_dir)

    def test_list_backups_requires_admin(self):
        """Test that listing backups requires admin privileges"""
        url = '/api/backups/'

        # Unauthenticated request
        response = self.client.get(url)
        self.assertIn(response.status_code, [401, 403])

        # Regular user request
        response = self.client.get(url, HTTP_AUTHORIZATION=self.get_auth_header(self.user))
        self.assertIn(response.status_code, [401, 403])

    @patch('apps.backups.services.list_backups')
    def test_list_backups_success(self, mock_list_backups):
        """Test successful backup listing"""
        mock_list_backups.return_value = [
            {
                'name': 'backup-test.zip',
                'size': 1024,
                'created': '2025-01-01T12:00:00'
            }
        ]

        auth_header = self.get_auth_header(self.admin_user)
        url = '/api/backups/'
        response = self.client.get(url, HTTP_AUTHORIZATION=auth_header)

        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(len(data), 1)
        self.assertEqual(data[0]['name'], 'backup-test.zip')

    def test_create_backup_requires_admin(self):
        """Test that creating backups requires admin privileges"""
        url = '/api/backups/create/'

        # Unauthenticated request
        response = self.client.post(url)
        self.assertIn(response.status_code, [401, 403])

        # Regular user request
        response = self.client.post(url, HTTP_AUTHORIZATION=self.get_auth_header(self.user))
        self.assertIn(response.status_code, [401, 403])

    @patch('apps.backups.services.create_backup')
    def test_create_backup_success(self, mock_create_backup):
        """Test successful backup creation via API"""
        backup_path = Path(self.temp_backup_dir) / "test-backup.zip"
        backup_path.write_text("fake backup")
        mock_create_backup.return_value = backup_path

        auth_header = self.get_auth_header(self.admin_user)
        url = '/api/backups/create/'
        response = self.client.post(url, HTTP_AUTHORIZATION=auth_header)

        self.assertEqual(response.status_code, 201)
        data = response.json()
        self.assertIn('filename', data)
        self.assertIn('size', data)

    @patch('apps.backups.services.create_backup')
    def test_create_backup_failure(self, mock_create_backup):
        """Test backup creation failure handling"""
        mock_create_backup.side_effect = Exception("Backup failed")

        auth_header = self.get_auth_header(self.admin_user)
        url = '/api/backups/create/'
        response = self.client.post(url, HTTP_AUTHORIZATION=auth_header)

        self.assertEqual(response.status_code, 500)
        data = response.json()
        self.assertIn('detail', data)

    @patch('apps.backups.services.get_backup_dir')
    def test_download_backup_success(self, mock_get_backup_dir):
        """Test successful backup download"""
        backup_dir = Path(self.temp_backup_dir)
        mock_get_backup_dir.return_value = backup_dir

        # Create a test backup file
        backup_file = backup_dir / "test-backup.zip"
        backup_file.write_text("test backup content")

        auth_header = self.get_auth_header(self.admin_user)
        url = '/api/backups/test-backup.zip/download/'
        response = self.client.get(url, HTTP_AUTHORIZATION=auth_header)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response['Content-Type'], 'application/zip')

    @patch('apps.backups.services.get_backup_dir')
    def test_download_backup_not_found(self, mock_get_backup_dir):
        """Test downloading non-existent backup"""
        mock_get_backup_dir.return_value = Path(self.temp_backup_dir)

        auth_header = self.get_auth_header(self.admin_user)
        url = '/api/backups/nonexistent.zip/download/'
        response = self.client.get(url, HTTP_AUTHORIZATION=auth_header)

        self.assertEqual(response.status_code, 404)

    @patch('apps.backups.services.delete_backup')
    def test_delete_backup_success(self, mock_delete_backup):
        """Test successful backup deletion via API"""
        mock_delete_backup.return_value = None

        auth_header = self.get_auth_header(self.admin_user)
        url = '/api/backups/test-backup.zip/delete/'
        response = self.client.delete(url, HTTP_AUTHORIZATION=auth_header)

        self.assertEqual(response.status_code, 204)
        mock_delete_backup.assert_called_once_with('test-backup.zip')

    @patch('apps.backups.services.delete_backup')
    def test_delete_backup_not_found(self, mock_delete_backup):
        """Test deleting non-existent backup via API"""
        mock_delete_backup.side_effect = FileNotFoundError("Not found")

        auth_header = self.get_auth_header(self.admin_user)
        url = '/api/backups/nonexistent.zip/delete/'
        response = self.client.delete(url, HTTP_AUTHORIZATION=auth_header)

        self.assertEqual(response.status_code, 404)

    def test_upload_backup_requires_file(self):
        """Test that upload requires a file"""
        auth_header = self.get_auth_header(self.admin_user)
        url = '/api/backups/upload/'
        response = self.client.post(url, HTTP_AUTHORIZATION=auth_header)

        self.assertEqual(response.status_code, 400)
        data = response.json()
        self.assertIn('No file uploaded', data['detail'])

    @patch('apps.backups.services.get_backup_dir')
    def test_upload_backup_success(self, mock_get_backup_dir):
        """Test successful backup upload"""
        mock_get_backup_dir.return_value = Path(self.temp_backup_dir)

        # Create a fake backup file
        fake_backup = BytesIO(b"fake backup content")
        fake_backup.name = 'uploaded-backup.zip'

        auth_header = self.get_auth_header(self.admin_user)
        url = '/api/backups/upload/'
        response = self.client.post(url, {'file': fake_backup}, HTTP_AUTHORIZATION=auth_header)

        self.assertEqual(response.status_code, 201)
        data = response.json()
        self.assertIn('filename', data)

    @patch('apps.backups.services.get_backup_dir')
    @patch('apps.backups.services.restore_backup')
    def test_restore_backup_success(self, mock_restore_backup, mock_get_backup_dir):
        """Test successful backup restoration via API"""
        backup_dir = Path(self.temp_backup_dir)
        mock_get_backup_dir.return_value = backup_dir
        mock_restore_backup.return_value = None

        # Create a test backup file
        backup_file = backup_dir / "test-backup.zip"
        backup_file.write_text("test backup content")

        auth_header = self.get_auth_header(self.admin_user)
        url = '/api/backups/test-backup.zip/restore/'
        response = self.client.post(url, HTTP_AUTHORIZATION=auth_header)

        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIn('restored successfully', data['detail'])

    @patch('apps.backups.services.get_backup_dir')
    def test_restore_backup_not_found(self, mock_get_backup_dir):
        """Test restoring from non-existent backup via API"""
        mock_get_backup_dir.return_value = Path(self.temp_backup_dir)

        auth_header = self.get_auth_header(self.admin_user)
        url = '/api/backups/nonexistent.zip/restore/'
        response = self.client.post(url, HTTP_AUTHORIZATION=auth_header)

        self.assertEqual(response.status_code, 404)

    @patch('apps.backups.services.get_backup_dir')
    @patch('apps.backups.services.restore_backup')
    def test_restore_backup_invalid_archive(self, mock_restore_backup, mock_get_backup_dir):
        """Test restoring from invalid backup archive via API"""
        backup_dir = Path(self.temp_backup_dir)
        mock_get_backup_dir.return_value = backup_dir
        mock_restore_backup.side_effect = ValueError("Invalid backup")

        # Create a test backup file
        backup_file = backup_dir / "invalid-backup.zip"
        backup_file.write_text("invalid content")

        auth_header = self.get_auth_header(self.admin_user)
        url = '/api/backups/invalid-backup.zip/restore/'
        response = self.client.post(url, HTTP_AUTHORIZATION=auth_header)

        self.assertEqual(response.status_code, 400)
        data = response.json()
        self.assertIn('Invalid backup', data['detail'])
