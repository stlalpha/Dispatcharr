import { useRef, useCallback, useLayoutEffect } from 'react';

/**
 * Synchronizes horizontal scroll between a primary and secondary container
 * Uses direct DOM manipulation for 60fps performance
 *
 * No RAF debouncing - browser already throttles scroll events to 1/frame max
 * No boolean sync flags - position comparison prevents circular updates
 *
 * @param {RefObject} primaryRef - Main scrollable container (e.g., react-window outerRef)
 * @param {RefObject} secondaryRef - Container to sync with primary
 * @returns {Object} - { scrollLeft (current position), updateScroll (function) }
 */
export function useScrollSync(primaryRef, secondaryRef) {
  const lastScrollLeft = useRef(0);
  const listenerAttached = useRef(false);
  const scrollHandlerRef = useRef(null);

  // Create stable scroll handler
  scrollHandlerRef.current = () => {
    const primary = primaryRef.current;
    if (!primary) return;

    const scrollLeft = primary.scrollLeft;

    // Position comparison prevents circular updates
    if (scrollLeft === lastScrollLeft.current) return;
    lastScrollLeft.current = scrollLeft;

    // Direct DOM sync - synchronous, no React overhead
    if (secondaryRef.current) {
      secondaryRef.current.scrollLeft = scrollLeft;
    }
  };

  // Use useLayoutEffect to run synchronously after DOM mutations
  // This catches react-window's ref assignment which happens after commit
  useLayoutEffect(() => {
    const attachListener = () => {
      const primary = primaryRef.current;
      if (!primary || listenerAttached.current) return false;

      const handler = () => scrollHandlerRef.current?.();
      primary.addEventListener('scroll', handler, { passive: true });
      listenerAttached.current = true;

      // Store cleanup function
      return () => {
        primary.removeEventListener('scroll', handler);
        listenerAttached.current = false;
      };
    };

    // Try to attach immediately
    const cleanup = attachListener();
    if (cleanup) return cleanup;

    // If primary ref not ready, observe for when it becomes available
    // react-window assigns outerRef after initial render cycle
    let rafId;
    let attempts = 0;
    const maxAttempts = 30; // ~500ms at 60fps

    const checkAndAttach = () => {
      attempts++;
      if (primaryRef.current && !listenerAttached.current) {
        const cleanup = attachListener();
        if (cleanup) {
          // Store cleanup for later
          cleanupFnRef.current = cleanup;
        }
        return;
      }
      if (attempts < maxAttempts) {
        rafId = requestAnimationFrame(checkAndAttach);
      }
    };

    const cleanupFnRef = { current: null };
    rafId = requestAnimationFrame(checkAndAttach);

    return () => {
      if (rafId) cancelAnimationFrame(rafId);
      if (cleanupFnRef.current) cleanupFnRef.current();
      // Reset attachment flag on cleanup
      listenerAttached.current = false;
    };
  }, [primaryRef, secondaryRef]);

  /**
   * Programmatically update scroll position of both containers
   * Use this for "Jump to now", timeline clicks, etc.
   */
  const updateScroll = useCallback(
    (scrollLeft, behavior = 'auto') => {
      if (primaryRef.current) {
        if (typeof primaryRef.current.scrollTo === 'function') {
          primaryRef.current.scrollTo({ left: scrollLeft, behavior });
        } else {
          primaryRef.current.scrollLeft = scrollLeft;
        }
      }

      if (secondaryRef.current) {
        if (typeof secondaryRef.current.scrollTo === 'function') {
          secondaryRef.current.scrollTo({ left: scrollLeft, behavior });
        } else {
          secondaryRef.current.scrollLeft = scrollLeft;
        }
      }

      lastScrollLeft.current = scrollLeft;
    },
    [primaryRef, secondaryRef]
  );

  return { scrollLeft: lastScrollLeft.current, updateScroll };
}
