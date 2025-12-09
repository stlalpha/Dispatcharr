import { Box, UnstyledButton, Text, Stack } from '@mantine/core';
import { Link, useLocation } from 'react-router-dom';
import { ListOrdered, LayoutGrid, Video, Settings } from 'lucide-react';
import { useResponsive } from '../hooks/useResponsive';

/**
 * Bottom Navigation Bar for Mobile
 * Shows quick links to 4 primary pages on mobile devices only
 * 2025 production pattern: Drawer for all nav, bottom bar for quick access
 */
export const BottomNav = () => {
  const { isMobile } = useResponsive();
  const location = useLocation();

  // Only show on mobile (< 768px)
  if (!isMobile) return null;

  const quickLinks = [
    { path: '/channels', icon: ListOrdered, label: 'Channels' },
    { path: '/guide', icon: LayoutGrid, label: 'Guide' },
    { path: '/vods', icon: Video, label: 'VODs' },
    { path: '/settings', icon: Settings, label: 'Settings' },
  ];

  const isActive = (path) => location.pathname === path;

  return (
    <Box
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        height: '60px',
        backgroundColor: '#1A1A1E',
        borderTop: '1px solid #2A2A2E',
        display: 'flex',
        justifyContent: 'space-around',
        alignItems: 'center',
        zIndex: 100,
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}
    >
      {quickLinks.map((link) => {
        const Icon = link.icon;
        const active = isActive(link.path);

        return (
          <UnstyledButton
            key={link.path}
            component={Link}
            to={link.path}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 4,
              padding: '8px 12px',
              color: active ? '#14917E' : '#D4D4D8',
              minWidth: '60px',
              minHeight: '44px',
              textDecoration: 'none',
              transition: 'color 0.2s ease',
            }}
          >
            <Stack align="center" gap={4}>
              <Icon size={20} strokeWidth={active ? 2.5 : 2} />
              <Text size="xs" fw={active ? 600 : 400}>
                {link.label}
              </Text>
            </Stack>
          </UnstyledButton>
        );
      })}
    </Box>
  );
};
