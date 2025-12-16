import { describe, test, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useScrollSync } from '../useScrollSync';

describe('useScrollSync', () => {
  let primaryRef;
  let secondaryRef;

  beforeEach(() => {
    // Create mock refs with DOM-like scroll properties
    primaryRef = {
      current: {
        scrollLeft: 0,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        scrollTo: vi.fn((options) => {
          primaryRef.current.scrollLeft = options.left;
        }),
      },
    };

    secondaryRef = {
      current: {
        scrollLeft: 0,
        scrollTo: vi.fn((options) => {
          secondaryRef.current.scrollLeft = options.left;
        }),
      },
    };
  });

  test('attaches scroll listener to primary container', () => {
    renderHook(() => useScrollSync(primaryRef, secondaryRef));

    expect(primaryRef.current.addEventListener).toHaveBeenCalledWith(
      'scroll',
      expect.any(Function),
      { passive: true }
    );
  });

  test('syncs secondary container when primary scrolls', () => {
    renderHook(() => useScrollSync(primaryRef, secondaryRef));

    // Get the scroll handler that was attached
    const scrollHandler = primaryRef.current.addEventListener.mock.calls[0][1];

    // Simulate scroll on primary
    act(() => {
      primaryRef.current.scrollLeft = 500;
      scrollHandler();
    });

    // Secondary should be synced
    expect(secondaryRef.current.scrollLeft).toBe(500);
  });

  test('prevents circular updates with position comparison', () => {
    renderHook(() => useScrollSync(primaryRef, secondaryRef));

    const scrollHandler = primaryRef.current.addEventListener.mock.calls[0][1];

    // Set both to same position
    primaryRef.current.scrollLeft = 100;
    secondaryRef.current.scrollLeft = 100;

    // Reset mocks to track new calls
    vi.clearAllMocks();

    // Trigger scroll handler
    act(() => {
      scrollHandler();
    });

    // Secondary should NOT be updated (position unchanged)
    expect(secondaryRef.current.scrollLeft).toBe(100);
  });

  test('updateScroll function syncs both containers programmatically', () => {
    const { result } = renderHook(() => useScrollSync(primaryRef, secondaryRef));

    act(() => {
      result.current.updateScroll(750, 'smooth');
    });

    expect(primaryRef.current.scrollTo).toHaveBeenCalledWith({
      left: 750,
      behavior: 'smooth',
    });
    expect(secondaryRef.current.scrollTo).toHaveBeenCalledWith({
      left: 750,
      behavior: 'smooth',
    });
  });

  test('handles multiple rapid scroll events correctly', () => {
    renderHook(() => useScrollSync(primaryRef, secondaryRef));

    const scrollHandler = primaryRef.current.addEventListener.mock.calls[0][1];

    // Simulate rapid scrolling (like momentum scroll)
    const scrollPositions = [100, 150, 200, 250, 300];

    act(() => {
      scrollPositions.forEach((pos) => {
        primaryRef.current.scrollLeft = pos;
        scrollHandler();
      });
    });

    // Should end at final position
    expect(secondaryRef.current.scrollLeft).toBe(300);
  });

  test('cleans up event listener on unmount', () => {
    const { unmount } = renderHook(() => useScrollSync(primaryRef, secondaryRef));

    const scrollHandler = primaryRef.current.addEventListener.mock.calls[0][1];

    unmount();

    expect(primaryRef.current.removeEventListener).toHaveBeenCalledWith(
      'scroll',
      scrollHandler
    );
  });

  test('handles missing primaryRef gracefully', () => {
    const nullRef = { current: null };

    // Should not throw
    expect(() => {
      renderHook(() => useScrollSync(nullRef, secondaryRef));
    }).not.toThrow();
  });

  test('handles missing secondaryRef gracefully', () => {
    const nullRef = { current: null };

    renderHook(() => useScrollSync(primaryRef, nullRef));

    const scrollHandler = primaryRef.current.addEventListener.mock.calls[0][1];

    // Should not throw when syncing
    expect(() => {
      act(() => {
        primaryRef.current.scrollLeft = 500;
        scrollHandler();
      });
    }).not.toThrow();
  });
});
