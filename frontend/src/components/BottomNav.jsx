import { useState } from 'react';
import { Box, UnstyledButton, Text, Stack } from '@mantine/core';
import { Link, useLocation } from 'react-router-dom';
import { ListOrdered, LayoutGrid, ChartLine, Settings } from 'lucide-react';
import { useResponsive } from '../hooks/useResponsive';
import { useRipple } from '../hooks/useRipple';

const BottomNavItem = ({ link, active, Icon, createRipple }) => {
  const [isPressed, setIsPressed] = useState(false);

  return (
    <UnstyledButton
      component={Link}
      to={link.path}
      onPointerDown={(e) => {
        setIsPressed(true);
        createRipple(e);
      }}
      onPointerUp={() => setIsPressed(false)}
      onPointerLeave={() => setIsPressed(false)}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        padding: '12px 16px',
        minWidth: '64px',
        minHeight: '48px',
        position: 'relative',
        overflow: 'hidden',
        textDecoration: 'none',
        color: active ? '#FFFFFF' : '#D4D4D8',
        transform: isPressed ? 'scale(0.92)' : 'scale(1)',
        transition: 'transform var(--duration-quick) var(--spring-snappy), color var(--duration-quick) ease',
      }}
    >
      <Icon
        size={22}
        strokeWidth={active ? 2.5 : 2}
        style={{
          transition: 'all var(--duration-quick) ease',
          filter: active ? 'drop-shadow(0 0 8px rgba(20, 145, 126, 0.6))' : 'none',
          animation: active ? 'pulseGlow 2s ease-in-out infinite' : 'none',
        }}
      />
      <Text
        size="xs"
        fw={active ? 600 : 400}
        style={{
          fontFamily: 'var(--font-body)',
          letterSpacing: '-0.01em',
          textShadow: active ? '0 0 8px rgba(20, 145, 126, 0.4)' : 'none',
        }}
      >
        {link.label}
      </Text>
      {active && (
        <Box
          style={{
            position: 'absolute',
            bottom: 4,
            width: '4px',
            height: '4px',
            borderRadius: '50%',
            background: '#14917E',
            boxShadow: '0 0 8px rgba(20, 145, 126, 0.8)',
          }}
        />
      )}
    </UnstyledButton>
  );
};

/**
 * Bottom Navigation Bar for Mobile
 * Shows quick links to 4 primary pages on mobile devices only
 * Only visible when user is authenticated
 * Features signature "liquid glow" interaction on tap
 */
export const BottomNav = ({ isAuthenticated = false }) => {
  const { isMobile } = useResponsive();
  const location = useLocation();
  const createRipple = useRipple();

  // Only show on mobile (< 768px) and when authenticated
  if (!isMobile || !isAuthenticated) return null;

  const quickLinks = [
    { path: '/channels', icon: ListOrdered, label: 'Channels' },
    { path: '/guide', icon: LayoutGrid, label: 'Guide' },
    { path: '/stats', icon: ChartLine, label: 'Stats' },
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
        height: '64px',
        background: 'linear-gradient(180deg, rgba(20, 145, 126, 0.03) 0%, #1A1A1E 100%)',
        borderTop: '1px solid rgba(255, 255, 255, 0.06)',
        boxShadow: '0 -4px 12px rgba(0, 0, 0, 0.3), 0 0 0 1px rgba(255, 255, 255, 0.04)',
        backdropFilter: 'blur(10px)',
        display: 'flex',
        justifyContent: 'space-around',
        alignItems: 'center',
        zIndex: 9999,
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}
    >
      {quickLinks.map((link) => {
        const Icon = link.icon;
        const active = isActive(link.path);

        return (
          <BottomNavItem
            key={link.path}
            link={link}
            active={active}
            Icon={Icon}
            createRipple={createRipple}
          />
        );
      })}
    </Box>
  );
};
