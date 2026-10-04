import type { MenuPopoverAnchorRect } from './MenuSubmenuPopover';

// Sections replace the menu at one anchor, with content-specific sizing.
export function menuPanelLayout(viewport: { width: number; height: number }, anchor?: MenuPopoverAnchorRect | null, size: 'compact' | 'large' = 'compact') {
  const width = Math.min(size === 'large' ? 720 : 286, Math.max(0, viewport.width - 24));
  const left = Math.max(12, Math.min(anchor?.left ?? (viewport.width - width) / 2, viewport.width - width - 12));
  const top = Math.max(12, Math.min(anchor?.top ?? 72, Math.max(12, viewport.height - Math.min(282, viewport.height - 24) - 12)));
  const height = Math.max(0, Math.min(size === 'large' ? 720 : 282, viewport.height - top - 12));
  return { left, top, width, height };
}
