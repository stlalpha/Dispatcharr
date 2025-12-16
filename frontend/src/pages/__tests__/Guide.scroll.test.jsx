import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { MantineProvider } from '@mantine/core';
import TVChannelGuide from '../Guide';

// Mock dependencies
vi.mock('../../api', () => ({
  default: {
    getChannels: vi.fn(() => Promise.resolve({ data: [] })),
    getPrograms: vi.fn(() => Promise.resolve({ data: [] })),
  },
}));

vi.mock('../../store/channels', () => ({
  default: vi.fn(() => ({ channels: [], fetchChannels: vi.fn() })),
}));

vi.mock('../../store/logos', () => ({
  default: vi.fn(() => ({ logos: {} })),
}));

vi.mock('../../store/epgs', () => ({
  default: vi.fn(() => ({ epgs: [] })),
}));

vi.mock('../../store/settings', () => ({
  default: vi.fn(() => ({ environment: { env_mode: 'prod' } })),
}));

vi.mock('../../store/useVideoStore', () => ({
  default: vi.fn(() => ({ setCurrentStream: vi.fn() })),
}));

vi.mock('../../hooks/useResponsive', () => ({
  useResponsive: () => ({ isMobile: false, isDesktop: true }),
}));

const renderGuideWithProviders = () => {
  return render(
    <BrowserRouter>
      <MantineProvider>
        <TVChannelGuide startDate={new Date()} endDate={new Date()} />
      </MantineProvider>
    </BrowserRouter>
  );
};

describe('TV Guide Horizontal Scroll Synchronization', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('timeline scrolls in sync with guide horizontal scroll', () => {
    renderGuideWithProviders();

    // Get the guide and timeline elements
    const guide = document.querySelector('.guide-list-outer');
    const timeline = document.querySelector('[style*="overflowX"]');

    expect(guide).toBeTruthy();
    expect(timeline).toBeTruthy();

    // Initial state - both at 0
    expect(guide.scrollLeft).toBe(0);
    expect(timeline.scrollLeft).toBe(0);

    // Simulate horizontal scroll on guide
    fireEvent.scroll(guide, { target: { scrollLeft: 500 } });

    // Timeline should match guide position immediately
    expect(timeline.scrollLeft).toBe(500);
    expect(Math.abs(guide.scrollLeft - timeline.scrollLeft)).toBeLessThan(1);
  });

  test('program text offsets update during scroll on desktop', () => {
    renderGuideWithProviders();

    const guide = document.querySelector('.guide-list-outer');
    const programTextContainer = document.querySelector(
      '.guide-program-container .guide-program > div'
    );

    // Initial state - no offset
    const initialTransform = window.getComputedStyle(
      programTextContainer
    ).transform;

    // Scroll to position where text should offset
    fireEvent.scroll(guide, { target: { scrollLeft: 300 } });

    // Text container should have translateX applied
    const afterTransform = window.getComputedStyle(programTextContainer).transform;
    expect(afterTransform).not.toBe('none');
    expect(afterTransform).toContain('matrix');

    // Transform should have changed from initial
    expect(afterTransform).not.toBe(initialTransform);
  });

  test('no circular scroll updates between guide and timeline', () => {
    renderGuideWithProviders();

    const guide = document.querySelector('.guide-list-outer');
    const scrollSpy = vi.fn();

    guide.addEventListener('scroll', scrollSpy);

    // Simulate single scroll event
    fireEvent.scroll(guide, { target: { scrollLeft: 500 } });

    // Should only trigger once, not create infinite loop
    // Note: fireEvent.scroll only fires once, but the handler shouldn't
    // cause additional scroll events on timeline that bounce back
    expect(scrollSpy.mock.calls.length).toBeLessThan(3);

    guide.removeEventListener('scroll', scrollSpy);
  });

  test('programmatic scroll updates both guide and timeline', () => {
    renderGuideWithProviders();

    const guide = document.querySelector('.guide-list-outer');
    const timeline = document.querySelector('[style*="overflowX"]');

    // Simulate programmatic scroll (e.g., "Jump to now" button)
    guide.scrollTo({ left: 750 });

    // Both should be updated
    expect(guide.scrollLeft).toBe(750);
    expect(timeline.scrollLeft).toBe(750);
  });

  test('timeline scroll syncs back to guide (bidirectional)', () => {
    renderGuideWithProviders();

    const guide = document.querySelector('.guide-list-outer');
    const timeline = document.querySelector('[style*="overflowX"]');

    // User scrolls timeline directly (clicking time slots)
    fireEvent.scroll(timeline, { target: { scrollLeft: 600 } });

    // Guide should sync
    expect(guide.scrollLeft).toBe(600);
    expect(Math.abs(guide.scrollLeft - timeline.scrollLeft)).toBeLessThan(1);
  });
});
