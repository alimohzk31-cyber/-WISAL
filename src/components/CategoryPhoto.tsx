import { useState } from 'react';
import type { CategoryVisual } from '../data/categoryVisuals';

interface CategoryPhotoProps {
  visual: CategoryVisual;
  alt: string;
  className?: string;
  objectPosition?: string;
  eager?: boolean;
}

/** Missing or failed photographs stay neutral; category icons are never a fallback. */
export default function CategoryPhoto({
  visual,
  alt,
  className = '',
  objectPosition = 'center 38%',
  eager = false,
}: CategoryPhotoProps) {
  const [failedSource, setFailedSource] = useState<string>();

  if (!visual.photoUrl || failedSource === visual.photoUrl) {
    return (
      <div role="img" aria-label={alt} className={`bg-[var(--surface)] ${className}`} />
    );
  }

  return (
    <img
      src={visual.photoUrl}
      alt={alt}
      loading={eager ? 'eager' : 'lazy'}
      decoding="async"
      fetchPriority={eager ? 'high' : 'auto'}
      referrerPolicy="no-referrer"
      onError={() => setFailedSource(visual.photoUrl)}
      style={{ objectPosition }}
      className={className}
    />
  );
}
