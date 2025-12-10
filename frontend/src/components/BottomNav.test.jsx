import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { MantineProvider } from '@mantine/core';
import { BottomNav } from './BottomNav';

// Helper to create matchMedia mock for specific viewport width
function createMatchMediaMock(width) {
  return (query) => {
    const widthInEm = width / 16;
    let matches = false;

    const maxWidthMatch = query.match(/max-width:\s*([\d.]+)em/);
    if (maxWidthMatch) {
      const maxWidth = parseFloat(maxWidthMatch[1]);
      matches = widthInEm <= maxWidth;
    }

    return {
      matches,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => true,
    };
  };
}

const renderWithProviders = (component) => {
  return render(
    <BrowserRouter>
      <MantineProvider>{component}</MantineProvider>
    </BrowserRouter>
  );
};

describe('BottomNav', () => {
  let originalMatchMedia;

  beforeEach(() => {
    originalMatchMedia = window.matchMedia;
  });

  afterEach(() => {
    window.matchMedia = originalMatchMedia;
  });

  it('should render on mobile viewports when authenticated', () => {
    window.matchMedia = createMatchMediaMock(400); // Mobile viewport

    renderWithProviders(<BottomNav isAuthenticated={true} />);

    // Should render bottom navigation
    expect(screen.getByText('Channels')).toBeInTheDocument();
    expect(screen.getByText('Guide')).toBeInTheDocument();
    expect(screen.getByText('VODs')).toBeInTheDocument();
    expect(screen.getByText('Settings')).toBeInTheDocument();
  });

  it('should NOT render when not authenticated', () => {
    window.matchMedia = createMatchMediaMock(400); // Mobile viewport

    renderWithProviders(<BottomNav isAuthenticated={false} />);

    // Should not render
    expect(screen.queryByText('Channels')).not.toBeInTheDocument();
  });

  it('should NOT render on desktop viewports (>= 1024px)', () => {
    window.matchMedia = createMatchMediaMock(1400); // Desktop viewport

    renderWithProviders(<BottomNav isAuthenticated={true} />);

    // Should not render anything
    expect(screen.queryByText('Channels')).not.toBeInTheDocument();
    expect(screen.queryByText('Guide')).not.toBeInTheDocument();
  });

  it('should NOT render on tablet viewports (768-1024px)', () => {
    window.matchMedia = createMatchMediaMock(900); // Tablet viewport

    renderWithProviders(<BottomNav isAuthenticated={true} />);

    // Should not render on tablet
    expect(screen.queryByText('Channels')).not.toBeInTheDocument();
  });

  it('should have correct navigation links', () => {
    window.matchMedia = createMatchMediaMock(400);

    renderWithProviders(<BottomNav isAuthenticated={true} />);

    const channelsLink = screen.getByText('Channels').closest('a');
    const guideLink = screen.getByText('Guide').closest('a');
    const vodsLink = screen.getByText('VODs').closest('a');
    const settingsLink = screen.getByText('Settings').closest('a');

    expect(channelsLink).toHaveAttribute('href', '/channels');
    expect(guideLink).toHaveAttribute('href', '/guide');
    expect(vodsLink).toHaveAttribute('href', '/vods');
    expect(settingsLink).toHaveAttribute('href', '/settings');
  });

  it('should render all 4 quick link icons', () => {
    window.matchMedia = createMatchMediaMock(400);

    renderWithProviders(<BottomNav isAuthenticated={true} />);

    // Verify all labels are present
    expect(screen.getByText('Channels')).toBeInTheDocument();
    expect(screen.getByText('Guide')).toBeInTheDocument();
    expect(screen.getByText('VODs')).toBeInTheDocument();
    expect(screen.getByText('Settings')).toBeInTheDocument();

    // Verify there are exactly 4 links
    const links = screen.getAllByRole('link');
    expect(links).toHaveLength(4);
  });
});
