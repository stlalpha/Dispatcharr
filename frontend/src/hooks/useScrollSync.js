import { useRef, useEffect, useCallback } from 'react';

/**
 * Synchronizes horizontal scroll between a primary and secondary container
 * Uses direct DOM manipulation for 60fps performance
 *
 * No RAF debouncing - browser already throttles scroll events to 1/frame max
 * No boolean sync flags - position comparison prevents circular updates
 *
 * @param {RefObject} primaryRef - Main scrollable container
 * @param {RefObject} secondaryRef - Container to sync with primary
 * @returns {Object} - { scrollLeft (current position), updateScroll (function) }
 */
export function useScrollSync(primaryRef, secondaryRef) {
  const lastScrollLeft = useRef(0);

  useEffect(() => {
    const primary = primaryRef.current;
    if (!primary) return;

    const handleScroll = () => {
      const scrollLeft = primary.scrollLeft;

      // Position comparison prevents circular updates
      // If position hasn't changed, skip (handles both circular updates and duplicate events)
      if (scrollLeft === lastScrollLeft.current) return;
      lastScrollLeft.current = scrollLeft;

      // Direct DOM sync - synchronous, no React overhead, no RAF delay
      if (secondaryRef.current) {
        secondaryRef.current.scrollLeft = scrollLeft;
      }
    };

    // Passive listener - browser can optimize scroll handling
    primary.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      primary.removeEventListener('scroll', handleScroll);
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
