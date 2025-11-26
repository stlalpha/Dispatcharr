import { useEffect, useState } from 'react';
import {
  Alert,
  Badge,
  Button,
  FileInput,
  Group,
  Loader,
  Modal,
  Stack,
  Table,
  Text,
  Tooltip,
} from '@mantine/core';
import {
  Download,
  PlayCircle,
  RefreshCcw,
  UploadCloud,
  Trash2,
} from 'lucide-react';
import { notifications } from '@mantine/notifications';

import API from '../../api';
import ConfirmationDialog from '../ConfirmationDialog';

function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
}

function formatDate(dateString) {
  const date = new Date(dateString);
  return date.toLocaleString();
}

export default function BackupManager() {
  const [backups, setBackups] = useState([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [uploadFile, setUploadFile] = useState(null);
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [restoreConfirmOpen, setRestoreConfirmOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [selectedBackup, setSelectedBackup] = useState(null);

  const loadBackups = async () => {
    setLoading(true);
    try {
      const backupList = await API.listBackups();
      setBackups(backupList);
    } catch (error) {
      notifications.show({
        title: 'Error',
        message: error?.message || 'Failed to load backups',
        color: 'red',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBackups();
  }, []);

  const handleCreateBackup = async () => {
    setCreating(true);
    try {
      await API.createBackup();
      notifications.show({
        title: 'Success',
        message: 'Backup created successfully',
        color: 'green',
      });
      await loadBackups();
    } catch (error) {
      notifications.show({
        title: 'Error',
        message: error?.message || 'Failed to create backup',
        color: 'red',
      });
    } finally {
      setCreating(false);
    }
  };

  const handleDownload = async (filename) => {
    try {
      const { blob } = await API.downloadBackup(filename);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      notifications.show({
        title: 'Error',
        message: error?.message || 'Failed to download backup',
        color: 'red',
      });
    }
  };

  const handleDeleteClick = (backup) => {
    setSelectedBackup(backup);
    setDeleteConfirmOpen(true);
  };

  const handleDeleteConfirm = async () => {
    try {
      await API.deleteBackup(selectedBackup.name);
      notifications.show({
        title: 'Success',
        message: 'Backup deleted successfully',
        color: 'green',
      });
      await loadBackups();
    } catch (error) {
      notifications.show({
        title: 'Error',
        message: error?.message || 'Failed to delete backup',
        color: 'red',
      });
    } finally {
      setDeleteConfirmOpen(false);
      setSelectedBackup(null);
    }
  };

  const handleRestoreClick = (backup) => {
    setSelectedBackup(backup);
    setRestoreConfirmOpen(true);
  };

  const handleRestoreConfirm = async () => {
    try {
      await API.restoreBackup(selectedBackup.name);
      notifications.show({
        title: 'Success',
        message: 'Backup restored successfully. You may need to refresh the page.',
        color: 'green',
      });
      setTimeout(() => window.location.reload(), 2000);
    } catch (error) {
      notifications.show({
        title: 'Error',
        message: error?.message || 'Failed to restore backup',
        color: 'red',
      });
    } finally {
      setRestoreConfirmOpen(false);
      setSelectedBackup(null);
    }
  };

  const handleUploadSubmit = async () => {
    if (!uploadFile) return;

    try {
      await API.uploadBackup(uploadFile);
      notifications.show({
        title: 'Success',
        message: 'Backup uploaded successfully',
        color: 'green',
      });
      setUploadModalOpen(false);
      setUploadFile(null);
      await loadBackups();
    } catch (error) {
      notifications.show({
        title: 'Error',
        message: error?.message || 'Failed to upload backup',
        color: 'red',
      });
    }
  };

  return (
    <Stack spacing="md">
      <Alert color="blue" title="Backup Information">
        Backups include your database and configured data directories. Use the
        create button to generate a new backup, or upload an existing backup to
        restore.
      </Alert>

      <Group position="apart">
        <Text size="xl" weight={700}>
          Backups
        </Text>
        <Group>
          <Button
            leftIcon={<UploadCloud size={16} />}
            onClick={() => setUploadModalOpen(true)}
          >
            Upload Backup
          </Button>
          <Button
            leftIcon={<RefreshCcw size={16} />}
            onClick={loadBackups}
            loading={loading}
            variant="light"
          >
            Refresh
          </Button>
          <Button
            leftIcon={<PlayCircle size={16} />}
            onClick={handleCreateBackup}
            loading={creating}
          >
            Create Backup
          </Button>
        </Group>
      </Group>

      {loading ? (
        <Group position="center" p="xl">
          <Loader />
        </Group>
      ) : backups.length === 0 ? (
        <Alert color="gray">No backups found. Create one to get started!</Alert>
      ) : (
        <Table striped highlightOnHover>
          <thead>
            <tr>
              <th>Filename</th>
              <th>Size</th>
              <th>Created</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {backups.map((backup) => (
              <tr key={backup.name}>
                <td>
                  <Text size="sm" weight={500}>
                    {backup.name}
                  </Text>
                </td>
                <td>
                  <Text size="sm">{formatBytes(backup.size)}</Text>
                </td>
                <td>
                  <Text size="sm">{formatDate(backup.created)}</Text>
                </td>
                <td>
                  <Group spacing="xs">
                    <Tooltip label="Download">
                      <Button
                        size="xs"
                        variant="light"
                        onClick={() => handleDownload(backup.name)}
                      >
                        <Download size={16} />
                      </Button>
                    </Tooltip>
                    <Tooltip label="Restore">
                      <Button
                        size="xs"
                        variant="light"
                        color="orange"
                        onClick={() => handleRestoreClick(backup)}
                      >
                        <PlayCircle size={16} />
                      </Button>
                    </Tooltip>
                    <Tooltip label="Delete">
                      <Button
                        size="xs"
                        variant="light"
                        color="red"
                        onClick={() => handleDeleteClick(backup)}
                      >
                        <Trash2 size={16} />
                      </Button>
                    </Tooltip>
                  </Group>
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}

      <Modal
        opened={uploadModalOpen}
        onClose={() => {
          setUploadModalOpen(false);
          setUploadFile(null);
        }}
        title="Upload Backup"
      >
        <Stack>
          <FileInput
            label="Select backup file"
            placeholder="Choose a .zip file"
            accept=".zip"
            value={uploadFile}
            onChange={setUploadFile}
          />
          <Group position="right">
            <Button
              variant="light"
              onClick={() => {
                setUploadModalOpen(false);
                setUploadFile(null);
              }}
            >
              Cancel
            </Button>
            <Button onClick={handleUploadSubmit} disabled={!uploadFile}>
              Upload
            </Button>
          </Group>
        </Stack>
      </Modal>

      <ConfirmationDialog
        opened={restoreConfirmOpen}
        onClose={() => {
          setRestoreConfirmOpen(false);
          setSelectedBackup(null);
        }}
        onConfirm={handleRestoreConfirm}
        title="Restore Backup"
        message={`Are you sure you want to restore from "${selectedBackup?.name}"? This will replace all current data with the backup data. This action cannot be undone.`}
        confirmLabel="Restore"
        cancelLabel="Cancel"
        color="orange"
      />

      <ConfirmationDialog
        opened={deleteConfirmOpen}
        onClose={() => {
          setDeleteConfirmOpen(false);
          setSelectedBackup(null);
        }}
        onConfirm={handleDeleteConfirm}
        title="Delete Backup"
        message={`Are you sure you want to delete "${selectedBackup?.name}"? This action cannot be undone.`}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        color="red"
      />
    </Stack>
  );
}
