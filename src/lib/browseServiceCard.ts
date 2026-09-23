import { getServiceCoordinates } from './serviceLocation';

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

// ---------------------------------------------------------------------------
// صور البطاقة — الصورة الرئيسية أولًا ثم الصور الإضافية بلا تكرار.
// مصدر واحد يمنع ظهور الصورة نفسها مرتين (معرض البطاقة + «صور إضافية»).
// ---------------------------------------------------------------------------

export interface BrowseCardMedia {
  image?: string;
  images?: string[];
}

export function getBrowseImages(service: BrowseCardMedia): string[] {
  return Array.from(new Set([service.image, ...(service.images ?? [])]
    .filter((image): image is string => typeof image === 'string' && image.trim().length > 0)));
}

/** الصور الزائدة عن الصورة الرئيسية المعروضة في معرض البطاقة. */
export function getBrowseExtraImages(service: BrowseCardMedia): string[] {
  return getBrowseImages(service).slice(1);
}

// ---------------------------------------------------------------------------
// هل يوجد في البطاقة تفاصيل إضافية تُفتح بكلمة «المزيد»؟
// تُحسب فقط الحقول غير الظاهرة في الحالة المختصرة، فلا يظهر «المزيد» بلا فائدة
// ولا يُعاد عرض معلومة موجودة أصلًا داخل البطاقة.
// ---------------------------------------------------------------------------

function isFilled(value?: string | null): boolean {
  return Boolean(value && value.trim().length > 0);
}

export interface BrowseDetailSource extends BrowseCardMedia {
  subCategory?: string;
  phone?: string;
  whatsappPhone?: string;
  location?: string;
  latitude?: number;
  longitude?: number;
  facebookUrl?: string;
  instagramUrl?: string;
  tiktokUrl?: string;
  video?: string;
}

export function hasBrowseDetails(service: BrowseDetailSource): boolean {
  return Boolean(
    isFilled(service.subCategory)
    || isFilled(service.phone)
    || isFilled(service.whatsappPhone)
    || Boolean(getServiceCoordinates(service))
    || isFilled(service.facebookUrl)
    || isFilled(service.instagramUrl)
    || isFilled(service.tiktokUrl)
    || isFilled(service.video)
    || getBrowseExtraImages(service).length > 0,
  );
}
