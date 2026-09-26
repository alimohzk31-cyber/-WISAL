import { Link } from 'react-router-dom';
import SafeImage, { FALLBACK_IMAGE } from '../../components/SafeImage';
import type { JobSlide } from './jobSlideMeta';
import type { Job } from './types';
import { sanitizeExternalUrl } from '../../lib/externalUrl';
import {
  SLIDE_TEXT_ALIGN, SLIDE_VERTICAL_CLASSES, SUBTITLE_SIZE_CLASSES, TITLE_SIZE_CLASSES,
} from './jobSlideMeta';

// ============================================================================
// JobSlideView — عرض شريحة واحدة بكل خيارات التصميم
// ----------------------------------------------------------------------------
// مكوّن مشترك تستخدمه:
//   * لوحة الإدارة في "المعاينة المباشرة" قبل الحفظ
//   * السلايدر العام في صفحة الوظائف
// لأنه نفسه، فالمعاينة مطابقة تماماً للعرض النهائي.
// ارتفاع الشريحة وزواياها تحددها الحاوية الأم (h-full w-full).
// ============================================================================
export default function JobSlideView({ slide, linkedJob, loading = 'lazy', className = '', interactive = true }: { slide: JobSlide; linkedJob?: Job; loading?: 'lazy' | 'eager'; className?: string; interactive?: boolean }) {
  const rawLink = (slide.buttonLink || (linkedJob ? `/jobs/${linkedJob.id}` : '')).trim();
  const link = rawLink.startsWith('/') || rawLink.startsWith('#') ? rawLink : sanitizeExternalUrl(rawLink) ?? '';
  const isExternal = /^https?:\/\//i.test(link);
  const imageSrc = slide.imageUrl || linkedJob?.image || FALLBACK_IMAGE;
  const title = linkedJob?.title || slide.title;
  const company = linkedJob?.company || '';
  const description = slide.subtitle || linkedJob?.description || '';

  const buttonCls = 'inline-flex items-center justify-center gap-1.5 rounded-xl px-5 py-2.5 text-sm font-black shadow-lg';
  const buttonStyle = { backgroundColor: slide.buttonColor, color: slide.buttonTextColor };

  const button = slide.showButton && slide.buttonText
    ? <span className={buttonCls} style={buttonStyle}>{slide.buttonText}</span>
    : null;

  return (
    <div className={`relative h-full w-full select-none overflow-hidden ${className}`}>
      <SafeImage
        src={imageSrc}
        alt={title || company || 'فرصة عمل'}
        className={`absolute inset-0 h-full w-full object-center ${slide.imageFit === 'contain' ? 'object-contain' : 'object-cover'}`}
        draggable={false}
        loading={loading}
        decoding="async"
      />

      {interactive && link ? (
        slide.linkType === 'external' || isExternal ? (
          <a href={link} target="_blank" rel="noopener noreferrer" className="absolute inset-0 z-10" aria-label={`فتح ${title || company || 'تفاصيل الوظيفة'}`} />
        ) : (
          <Link to={link} className="absolute inset-0 z-10" aria-label={`فتح ${title || company || 'تفاصيل الوظيفة'}`} />
        )
      ) : null}

      {slide.overlayEnabled && (
        <div
          className="absolute inset-0"
          style={{ backgroundColor: `rgba(0,0,0,${Math.min(0.9, Math.max(0, slide.overlayOpacity))})` }}
          aria-hidden="true"
        />
      )}

      <div
        className={`pointer-events-none absolute inset-0 z-20 flex flex-col px-5 ${SLIDE_VERTICAL_CLASSES[slide.textVertical]} ${SLIDE_TEXT_ALIGN[slide.textPosition]}`}
        style={{ color: slide.textColor }}
      >
        {company ? <p className="mb-1 w-full text-xs font-black opacity-90 sm:text-sm">{company}</p> : null}
        {slide.showTitle && title ? (
          <h1 className={`w-full font-black ${TITLE_SIZE_CLASSES[slide.titleSize]}`} style={{ color: slide.textColor }}>{title}</h1>
        ) : null}
        {slide.showDescription && description ? (
          <p className={`line-clamp-2 w-full font-bold opacity-95 ${SUBTITLE_SIZE_CLASSES[slide.subtitleSize]}`} style={{ color: slide.textColor }}>{description}</p>
        ) : null}
        {button}
      </div>
    </div>
  );
}
