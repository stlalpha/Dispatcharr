/**
 * Design tokens for TV Guide
 * Single source of truth for all guide dimensions
 * Mobile-first approach: base values are for mobile, desktop values are enhancements
 */

export const guideTokens = {
  row: {
    base: 56,              // Mobile row height (meets 44px min tap target with padding)
    desktop: 90,           // Desktop row height
    expandedBase: 112,     // Mobile expanded row
    expandedDesktop: 180,  // Desktop expanded row
  },
  channel: {
    base: 64,              // Mobile channel column width (optimized for screen space)
    desktop: 120,          // Desktop channel column width
  },
  timeline: {
    hourWidth: 450,        // Width of each hour block (same for mobile/desktop)
    headerBase: 44,        // Mobile time header height (meets min tap target)
    headerDesktop: 40,     // Desktop time header height
  },
  program: {
    paddingBase: 4,
    paddingDesktop: 10,
    fontSizeBase: 11,
    fontSizeDesktop: 14,
    borderRadiusBase: 4,
    borderRadiusDesktop: 8,
  },
  channelNumber: {
    heightBase: 16,
    heightDesktop: 24,
    minWidthBase: 24,
    minWidthDesktop: 36,
  },
  spacing: {
    programGap: 2,
  },
};

/**
 * Get responsive tokens based on viewport
 * @param {boolean} isDesktop - true if viewport is desktop (>= 768px)
 * @returns {object} Responsive dimension values
 */
export function getGuideTokens(isDesktop) {
  if (isDesktop) {
    return {
      rowHeight: guideTokens.row.desktop,
      expandedHeight: guideTokens.row.expandedDesktop,
      channelWidth: guideTokens.channel.desktop,
      headerHeight: guideTokens.timeline.headerDesktop,
      programPadding: guideTokens.program.paddingDesktop,
      programFontSize: guideTokens.program.fontSizeDesktop,
      programBorderRadius: guideTokens.program.borderRadiusDesktop,
      channelNumberHeight: guideTokens.channelNumber.heightDesktop,
      channelNumberMinWidth: guideTokens.channelNumber.minWidthDesktop,
    };
  }

  // Mobile-first (base) values
  return {
    rowHeight: guideTokens.row.base,
    expandedHeight: guideTokens.row.expandedBase,
    channelWidth: guideTokens.channel.base,
    headerHeight: guideTokens.timeline.headerBase,
    programPadding: guideTokens.program.paddingBase,
    programFontSize: guideTokens.program.fontSizeBase,
    programBorderRadius: guideTokens.program.borderRadiusBase,
    channelNumberHeight: guideTokens.channelNumber.heightBase,
    channelNumberMinWidth: guideTokens.channelNumber.minWidthBase,
  };
}

// Computed values (same for all viewports)
export const computed = {
  minuteBlockWidth: guideTokens.timeline.hourWidth / 4,  // 15-minute blocks
};
