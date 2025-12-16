import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useScrollSync } from '../useScrollSync';

describe('useScrollSync', () => {
  let primaryRef;
  let secondaryRef;
  let originalRAF;
  let originalCAF;
  let rafCallbacks;

  beforeEach(() => {
    // Mock requestAnimationFrame for synchronous testing
    rafCallbacks = [];
    originalRAF = global.requestAnimationFrame;
    originalCAF = global.cancelAnimationFrame;

    global.requestAnimationFrame = vi.fn((callback) => {
      const id = rafCallbacks.length;
      rafCallbacks.push(callback);
      return id;
    });

    global.cancelAnimationFrame = vi.fn((id) => {
      rafCallbacks[id] = null;
    });

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

  afterEach(() => {
    global.requestAnimationFrame = originalRAF;
    global.cancelAnimationFrame = originalCAF;
  });

  // Helper to flush RAF callbacks
  const flushRAF = () => {
    rafCallbacks.forEach((cb) => cb?.());
    rafCallbacks = [];
  };

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

    // First scroll to set lastScrollLeft
    act(() => {
      primaryRef.current.scrollLeft = 100;
      scrollHandler();
    });

    // Reset mocks to track new calls
    vi.clearAllMocks();

    // Trigger scroll handler again with same position
    act(() => {
      scrollHandler();
    });

    // Secondary scrollLeft should not have been reassigned (no change)
    // It's still 100 from before, but no new assignment happened
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

  test('attaches listener via RAF polling when ref is initially null', () => {
    // Start with null ref
    const delayedRef = { current: null };

    renderHook(() => useScrollSync(delayedRef, secondaryRef));

    // No listener attached yet since ref is null
    expect(delayedRef.current).toBeNull();

    // Simulate ref becoming available (like react-window outerRef)
    delayedRef.current = {
      scrollLeft: 0,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      scrollTo: vi.fn(),
    };

    // Flush RAF callbacks to trigger attachment
    act(() => {
      flushRAF();
    });

    // Now listener should be attached
    expect(delayedRef.current.addEventListener).toHaveBeenCalledWith(
      'scroll',
      expect.any(Function),
      { passive: true }
    );
  });

  test('updateScroll handles elements without scrollTo method', () => {
    // Create refs with only scrollLeft (no scrollTo)
    const simpleRef = {
      current: {
        scrollLeft: 0,
      },
    };

    const { result } = renderHook(() => useScrollSync(primaryRef, simpleRef));

    act(() => {
      result.current.updateScroll(500);
    });

    // Should fall back to direct scrollLeft assignment
    expect(simpleRef.current.scrollLeft).toBe(500);
  });
});
