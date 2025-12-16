import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useResponsive, useBreakpoint } from './useResponsive';

// Helper to create matchMedia mock for specific viewport width
function createMatchMediaMock(width) {
  return (query) => ({
    matches: matchMediaQuery(query, width),
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => true,
  });
}

// Parse media query and determine if it matches given width
function matchMediaQuery(query, width) {
  // Convert width to em (assuming 16px base font size)
  const widthInEm = width / 16;

  let hasConstraints = false;
  let allConstraintsMet = true;

  // Check max-width constraint
  const maxWidthMatch = query.match(/max-width:\s*([\d.]+)em/);
  if (maxWidthMatch) {
    hasConstraints = true;
    const maxWidth = parseFloat(maxWidthMatch[1]);
    if (widthInEm > maxWidth) {
      allConstraintsMet = false;
    }
  }

  // Check min-width constraint
  const minWidthMatch = query.match(/min-width:\s*([\d.]+)em/);
  if (minWidthMatch) {
    hasConstraints = true;
    const minWidth = parseFloat(minWidthMatch[1]);
    if (widthInEm < minWidth) {
      allConstraintsMet = false;
    }
  }

  // Query matches if it has constraints and all are met
  return hasConstraints && allConstraintsMet;
}

describe('useResponsive', () => {
  let originalMatchMedia;

  beforeEach(() => {
    originalMatchMedia = window.matchMedia;
  });

  afterEach(() => {
    window.matchMedia = originalMatchMedia;
  });

  it('should return isMobile=true when viewport is < 768px', () => {
    window.matchMedia = createMatchMediaMock(400); // 400px mobile viewport

    const { result } = renderHook(() => useResponsive());

    expect(result.current.isMobile).toBe(true);
    expect(result.current.isTablet).toBe(false);
    expect(result.current.isDesktop).toBe(false);
    expect(result.current.isSmallMobile).toBe(true);
    expect(result.current.isMobileOrTablet).toBe(true);
  });

  it('should return isDesktop=true when viewport is >= 1024px', () => {
    window.matchMedia = createMatchMediaMock(1400); // 1400px desktop viewport

    const { result } = renderHook(() => useResponsive());

    expect(result.current.isMobile).toBe(false);
    expect(result.current.isTablet).toBe(false);
    expect(result.current.isDesktop).toBe(true);
    expect(result.current.isMobileOrTablet).toBe(false);
  });

  it('should return isTablet=true when viewport is 768-1024px', () => {
    window.matchMedia = createMatchMediaMock(900); // 900px tablet viewport

    const { result } = renderHook(() => useResponsive());

    expect(result.current.isMobile).toBe(false);
    expect(result.current.isTablet).toBe(true);
    expect(result.current.isDesktop).toBe(false);
    expect(result.current.isMobileOrTablet).toBe(true);
  });

  it('should return isSmallMobile=true for viewport < 576px', () => {
    window.matchMedia = createMatchMediaMock(375); // 375px small mobile (iPhone SE)

    const { result } = renderHook(() => useResponsive());

    expect(result.current.isSmallMobile).toBe(true);
    expect(result.current.isMobile).toBe(true);
  });

  it('should handle edge cases at breakpoint boundaries', () => {
    // Test at 768px boundary (should be tablet, not mobile)
    window.matchMedia = createMatchMediaMock(768);
    const { result: result768 } = renderHook(() => useResponsive());
    expect(result768.current.isMobile).toBe(false);
    expect(result768.current.isTablet).toBe(true);
    expect(result768.current.isDesktop).toBe(false);

    // Test at 1024px boundary (should be desktop, >= 1024px)
    window.matchMedia = createMatchMediaMock(1024);
    const { result: result1024 } = renderHook(() => useResponsive());
    expect(result1024.current.isTablet).toBe(false);
    expect(result1024.current.isDesktop).toBe(true);
    expect(result1024.current.isMobile).toBe(false);

    // Test just below boundaries
    window.matchMedia = createMatchMediaMock(767);
    const { result: result767 } = renderHook(() => useResponsive());
    expect(result767.current.isMobile).toBe(true);

    window.matchMedia = createMatchMediaMock(1023);
    const { result: result1023 } = renderHook(() => useResponsive());
    expect(result1023.current.isTablet).toBe(true);
    expect(result1023.current.isDesktop).toBe(false);
  });
});

describe('useBreakpoint', () => {
  let originalMatchMedia;

  beforeEach(() => {
    originalMatchMedia = window.matchMedia;
  });

  afterEach(() => {
    window.matchMedia = originalMatchMedia;
  });

  it('should return "xs" for viewport < 576px', () => {
    window.matchMedia = createMatchMediaMock(375);

    const { result } = renderHook(() => useBreakpoint());

    expect(result.current).toBe('xs');
  });

  it('should return "sm" for viewport 576-767px', () => {
    window.matchMedia = createMatchMediaMock(650);

    const { result } = renderHook(() => useBreakpoint());

    expect(result.current).toBe('sm');
  });

  it('should return "md" for viewport 768-991px', () => {
    window.matchMedia = createMatchMediaMock(850);

    const { result } = renderHook(() => useBreakpoint());

    expect(result.current).toBe('md');
  });

  it('should return "lg" for viewport 992-1199px', () => {
    window.matchMedia = createMatchMediaMock(1100);

    const { result } = renderHook(() => useBreakpoint());

    expect(result.current).toBe('lg');
  });

  it('should return "xl" for viewport >= 1200px', () => {
    window.matchMedia = createMatchMediaMock(1920);

    const { result } = renderHook(() => useBreakpoint());

    expect(result.current).toBe('xl');
  });
});
