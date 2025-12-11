// frontend/src/App.js
import React, { useEffect, useState } from 'react';
import {
  BrowserRouter as Router,
  Route,
  Routes,
  Navigate,
} from 'react-router-dom';
import Sidebar from './components/Sidebar';
import Login from './pages/Login';
import Channels from './pages/Channels';
import ContentSources from './pages/ContentSources';
import Guide from './pages/Guide';
import Stats from './pages/Stats';
import DVR from './pages/DVR';
import Settings from './pages/Settings';
import PluginsPage from './pages/Plugins';
import Users from './pages/Users';
import LogosPage from './pages/Logos';
import VODsPage from './pages/VODs';
import useAuthStore from './store/auth';
import useLogosStore from './store/logos';
import FloatingVideo from './components/FloatingVideo';
import { WebsocketProvider } from './WebSocket';
import { Box, AppShell, MantineProvider, Burger, Flex, Text, Group, UnstyledButton } from '@mantine/core';
import '@mantine/core/styles.css'; // Ensure Mantine global styles load
import '@mantine/notifications/styles.css';
import '@mantine/dropzone/styles.css';
import '@mantine/dates/styles.css';
import './index.css';
import mantineTheme from './mantineTheme';
import API from './api';
import { Notifications } from '@mantine/notifications';
import M3URefreshNotification from './components/M3URefreshNotification';
import 'allotment/dist/style.css';
import { useResponsive } from './hooks/useResponsive';
import { BottomNav } from './components/BottomNav';
import logo from './images/logo.png';

const drawerWidth = 240;
const miniDrawerWidth = 60;
const defaultRoute = '/channels';

const App = () => {
  const [open, setOpen] = useState(true); // Desktop sidebar state
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false); // Mobile drawer state
  const [backgroundLoadingStarted, setBackgroundLoadingStarted] =
    useState(false);
  const { isMobile } = useResponsive();

  useEffect(() => {
    console.log('mobileMenuOpen state changed to:', mobileMenuOpen);
  }, [mobileMenuOpen]);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const setIsAuthenticated = useAuthStore((s) => s.setIsAuthenticated);
  const logout = useAuthStore((s) => s.logout);
  const initData = useAuthStore((s) => s.initData);
  const initializeAuth = useAuthStore((s) => s.initializeAuth);
  const setSuperuserExists = useAuthStore((s) => s.setSuperuserExists);

  const toggleDrawer = () => {
    console.log('toggleDrawer called, isMobile:', isMobile, 'mobileMenuOpen:', mobileMenuOpen);
    if (isMobile) {
      setMobileMenuOpen(!mobileMenuOpen);
      console.log('Setting mobileMenuOpen to:', !mobileMenuOpen);
    } else {
      setOpen(!open);
    }
  };

  const closeMobileMenu = () => {
    console.log('closeMobileMenu called! isMobile:', isMobile);
    if (isMobile) {
      console.log('Closing mobile menu');
      setMobileMenuOpen(false);
    }
  };

  // Check if a superuser exists on first load.
  useEffect(() => {
    async function checkSuperuser() {
      try {
        const response = await API.fetchSuperUser();
        if (!response.superuser_exists) {
          setSuperuserExists(false);
        }
      } catch (error) {
        console.error('Error checking superuser status:', error);
        // If authentication error, redirect to login
        if (error.status === 401) {
          localStorage.removeItem('token');
          localStorage.removeItem('refreshToken');
          window.location.href = '/login';
        }
      }
    }
    checkSuperuser();
  }, []);

  // Authentication check
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const loggedIn = await initializeAuth();
        if (loggedIn) {
          await initData();
          // Start background logo loading after app is fully initialized (only once)
          if (!backgroundLoadingStarted) {
            setBackgroundLoadingStarted(true);
            useLogosStore.getState().startBackgroundLoading();
          }
        } else {
          await logout();
        }
      } catch (error) {
        console.error('Auth check failed:', error);
        await logout();
      }
    };

    checkAuth();
  }, [initializeAuth, initData, logout, backgroundLoadingStarted]);

  return (
    <MantineProvider
      defaultColorScheme="dark"
      theme={mantineTheme}
      withGlobalStyles
      withNormalizeCSS
    >
      <WebsocketProvider>
        <Router>
          <AppShell
            header={{
              height: isMobile ? 60 : 0,
            }}
            navbar={{
              width: isMobile ? '85%' : (open ? drawerWidth : miniDrawerWidth),
              breakpoint: 'sm',
              collapsed: { mobile: !mobileMenuOpen },
            }}
            onNavbarCollapse={(collapsed) => console.log('Navbar collapsed state changed:', collapsed)}
          >
            {/* Mobile Header - always visible on mobile, hamburger only when authenticated */}
            {isMobile && (
              <AppShell.Header
                style={{
                  backgroundColor: '#1A1A1E',
                  borderBottom: '1px solid #2A2A2E',
                  zIndex: 1000,
                }}
              >
                <Flex
                  h={60}
                  px="md"
                  justify="space-between"
                  align="center"
                  style={{ width: '100%' }}
                >
                  {isAuthenticated ? (
                    <Burger
                      opened={mobileMenuOpen}
                      onClick={(e) => {
                        e.stopPropagation();
                        console.log('Hamburger clicked!');
                        toggleDrawer();
                      }}
                      size="sm"
                      style={{
                        position: 'relative',
                        zIndex: 10000,
                        cursor: 'pointer',
                      }}
                    />
                  ) : (
                    <Box style={{ width: 40 }} />
                  )}
                  <Group gap="xs">
                    <img width={24} height={24} src={logo} alt="Dispatcharr" style={{ objectFit: 'contain' }} />
                    <Text fw={600} size="lg" style={{ color: 'white' }}>Dispatcharr</Text>
                  </Group>
                  <Box style={{ width: 40 }} />
                </Flex>
              </AppShell.Header>
            )}

            <Sidebar
              drawerWidth={drawerWidth}
              miniDrawerWidth={miniDrawerWidth}
              collapsed={isMobile ? !mobileMenuOpen : !open}
              toggleDrawer={toggleDrawer}
              isMobile={isMobile}
              closeMobileMenu={closeMobileMenu}
            />

            <AppShell.Main>
              <Box
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  // transition: 'margin-left 0.3s',
                  backgroundColor: '#18181b',
                  minHeight: '100vh',
                  paddingTop: isMobile ? '60px' : 0,
                  paddingBottom: (isMobile && isAuthenticated) ? '60px' : 0, // Account for bottom nav
                  color: 'white',
                }}
              >
                <Box sx={{ p: isMobile ? 1 : 2, flex: 1, overflow: 'auto' }}>
                  <Routes>
                    {isAuthenticated ? (
                      <>
                        <Route path="/channels" element={<Channels />} />
                        <Route path="/sources" element={<ContentSources />} />
                        <Route path="/guide" element={<Guide />} />
                        <Route path="/dvr" element={<DVR />} />
                        <Route path="/stats" element={<Stats />} />
                        <Route path="/plugins" element={<PluginsPage />} />
                        <Route path="/users" element={<Users />} />
                        <Route path="/settings" element={<Settings />} />
                        <Route path="/logos" element={<LogosPage />} />
                        <Route path="/vods" element={<VODsPage />} />
                      </>
                    ) : (
                      <Route path="/login" element={<Login needsSuperuser />} />
                    )}
                    <Route
                      path="*"
                      element={
                        <Navigate
                          to={isAuthenticated ? defaultRoute : '/login'}
                          replace
                        />
                      }
                    />
                  </Routes>
                </Box>
              </Box>
            </AppShell.Main>
          </AppShell>
          <M3URefreshNotification />
          <Notifications containerWidth={350} />
          <BottomNav isAuthenticated={isAuthenticated} />
        </Router>
      </WebsocketProvider>

      <FloatingVideo />
    </MantineProvider>
  );
};

export default App;
