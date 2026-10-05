import { useState } from 'react';
import { getCategoryCardPhoto } from '../data/categoryCardPhotos';

export default function CategoryCardVisual({ slug, name, childSlug, size = 'card' }: {
  slug: string; name: string; childSlug?: string; size?: 'card' | 'compact' | 'search';
}) {
  const photoUrl = getCategoryCardPhoto(slug, childSlug);
  const [failedSource, setFailedSource] = useState<string>();
  const showPhoto = Boolean(photoUrl && failedSource !== photoUrl);
  const dimensions = size === 'compact' ? 'h-10 w-10' : size === 'search' ? 'h-9 w-9' : 'h-[72px] w-[72px]';
  return (
    <div data-category-card-visual data-category-slug={slug} data-photo-status={showPhoto ? 'photo' : 'missing'}
      role={showPhoto ? undefined : 'img'} aria-label={showPhoto ? undefined : name}
      className={`${dimensions} shrink-0 overflow-hidden rounded-full border-2 border-[var(--theme-primary)] bg-[var(--surface)] shadow-sm`}>
      {showPhoto && <img src={photoUrl} alt={name} width={192} height={192} loading="lazy" decoding="async"
        onError={() => setFailedSource(photoUrl)} style={{ borderRadius: '50%' }} className="h-full w-full object-cover object-center" />}
    </div>
  );
}
