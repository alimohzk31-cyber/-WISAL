export const BROWSE_DESCRIPTION_PREVIEW_LENGTH = 90;

export function getBrowseDescriptionPreview(value?: string): { text: string; truncated: boolean } {
  const text = value?.trim().replace(/\s+/g, ' ') ?? '';
  if (text.length <= BROWSE_DESCRIPTION_PREVIEW_LENGTH) return { text, truncated: false };

  const candidate = text.slice(0, BROWSE_DESCRIPTION_PREVIEW_LENGTH);
  const lastSpace = candidate.lastIndexOf(' ');
  const end = lastSpace >= Math.floor(BROWSE_DESCRIPTION_PREVIEW_LENGTH * 0.65)
    ? lastSpace
    : BROWSE_DESCRIPTION_PREVIEW_LENGTH;
  return { text: `${candidate.slice(0, end).trimEnd()}…`, truncated: true };
}
