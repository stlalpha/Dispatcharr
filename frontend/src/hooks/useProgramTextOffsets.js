import { useRef, useEffect, useCallback } from 'react';

/**
 * Manages program text positioning to keep titles visible during horizontal scroll
 * Uses direct DOM manipulation with translate3d for GPU acceleration
 *
 * When a program block starts before the visible viewport and extends into it,
 * the text is shifted horizontally within the block to remain visible.
 *
 * @param {RefObject} scrollRef - Reference to scrollable container
 * @param {boolean} enabled - Whether to enable text offsetting (desktop only, disabled on mobile for performance)
 * @returns {Object} - { registerText }
 */
export function useProgramTextOffsets(scrollRef, enabled = true) {
  const textRefs = useRef(new Map()); // Map<programKey, {element, leftPx, widthPx}>
  const lastScrollLeft = useRef(0);

  const updateOffsets = useCallback(
    (scrollLeft) => {
      if (!enabled) return;

      // Position comparison - skip if unchanged
      if (scrollLeft === lastScrollLeft.current) return;
      lastScrollLeft.current = scrollLeft;

      const gapSize = 2; // Match program container gap

      textRefs.current.forEach(({ element, leftPx, widthPx }) => {
        const programStart = leftPx + gapSize;
        const programEnd = leftPx + gapSize + widthPx;
        const startsBeforeView = programStart < scrollLeft;
        const extendsIntoView = programEnd > scrollLeft;

        let offset = 0;
        if (startsBeforeView && extendsIntoView) {
          // Calculate how much of the program is hidden off-screen
          const visibleStart = Math.max(scrollLeft - programStart, 0);

          // Cap offset - prevent text from scrolling too far right
          // Use minimum of fixed px value and percentage of block width
          const maxOffset = Math.max(widthPx - 200, widthPx * 0.6);
          offset = Math.min(visibleStart, maxOffset);
        }

        // Use translate3d for GPU acceleration (not translateX)
        // GPU layer promotion gives us compositor-thread transforms
        element.style.transform = `translate3d(${offset}px, 0, 0)`;
      });
    },
    [enabled]
  );

  /**
   * Register a program text element for offset updates
   * Call this from a ref callback in your component
   *
   * @param {string} key - Unique program key
   * @param {HTMLElement} element - DOM element containing program text
   * @param {number} leftPx - Program block left position
   * @param {number} widthPx - Program block width
   */
  const registerText = useCallback(
    (key, element, leftPx, widthPx) => {
      if (!enabled) return;

      if (element) {
        // Register element with position metadata
        textRefs.current.set(key, { element, leftPx, widthPx });

        // Initialize position based on current scroll
        const scrollLeft = scrollRef.current?.scrollLeft || 0;
        const gapSize = 2;
        const programStart = leftPx + gapSize;
        const programEnd = leftPx + gapSize + widthPx;
        const startsBeforeView = programStart < scrollLeft;
        const extendsIntoView = programEnd > scrollLeft;

        if (startsBeforeView && extendsIntoView) {
          const visibleStart = Math.max(scrollLeft - programStart, 0);
          const maxOffset = Math.max(widthPx - 200, widthPx * 0.6);
          const offset = Math.min(visibleStart, maxOffset);
          element.style.transform = `translate3d(${offset}px, 0, 0)`;
        }
      } else {
        // Element unmounting (virtualization) - clean up ref
        textRefs.current.delete(key);
      }
    },
    [enabled, scrollRef]
  );

  // Listen to scroll events and update text offsets
  useEffect(() => {
    const container = scrollRef.current;
    if (!container || !enabled) return;

    const handleScroll = () => {
      updateOffsets(container.scrollLeft);
    };

    container.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      container.removeEventListener('scroll', handleScroll);
    };
  }, [scrollRef, enabled, updateOffsets]);

  return { registerText, updateOffsets };
}
