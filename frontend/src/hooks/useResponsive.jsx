import { useMediaQuery } from '@mantine/hooks';
import { em } from '@mantine/core';

/**
 * Hook for responsive design utilities
 * Returns boolean flags for different device categories
 *
 * Breakpoints:
 * - Mobile: < 768px
 * - Tablet: 768-1024px
 * - Desktop: >= 1024px
 */
export function useResponsive() {
  const isMobile = useMediaQuery(`(max-width: ${em(767.99)})`);
  const isTablet = useMediaQuery(`(min-width: ${em(768)}) and (max-width: ${em(1023.99)})`);
  const isDesktop = useMediaQuery(`(min-width: ${em(1024)})`);
  const isSmallMobile = useMediaQuery(`(max-width: ${em(575.99)})`);

  return {
    isMobile,           // < 768px
    isTablet,           // 768-1024px
    isDesktop,          // >= 1024px
    isSmallMobile,      // < 576px
    isMobileOrTablet: isMobile || isTablet,
  };
}

/**
 * Hook that returns the current breakpoint name
 * Returns: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
 *
 * Breakpoints match Mantine defaults:
 * - xs: < 576px
 * - sm: 576-767px
 * - md: 768-991px
 * - lg: 992-1199px
 * - xl: >= 1200px
 */
export function useBreakpoint() {
  const isXs = useMediaQuery(`(max-width: ${em(575.99)})`);
  const isSm = useMediaQuery(`(min-width: ${em(576)}) and (max-width: ${em(767.99)})`);
  const isMd = useMediaQuery(`(min-width: ${em(768)}) and (max-width: ${em(991.99)})`);
  const isLg = useMediaQuery(`(min-width: ${em(992)}) and (max-width: ${em(1199.99)})`);
  const isXl = useMediaQuery(`(min-width: ${em(1200)})`);

  if (isXl) return 'xl';
  if (isLg) return 'lg';
  if (isMd) return 'md';
  if (isSm) return 'sm';
  return 'xs';
}
