import { useState } from 'react';
import type { CategoryVisual } from '../data/categoryVisuals';

interface CategoryPhotoProps {
  visual: CategoryVisual;
  alt: string;
  className?: string;
  objectPosition?: string;
  eager?: boolean;
}

/** Loads the category's real photo and falls back to its small category icon on failure. */
export default function CategoryPhoto({
  visual,
  alt,
  className = '',
  objectPosition = 'center 38%',
  eager = false,
}: CategoryPhotoProps) {
  const [failed, setFailed] = useState(false);
  const FallbackIcon = visual.icon;

  if (failed) {
    return (
      <div role="img" aria-label={alt} className={`flex items-center justify-center bg-[#e8f4ff] text-[#2582ed] ${className}`}>
        <FallbackIcon className="h-16 w-16" aria-hidden="true" />
      </div>
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
      onError={() => setFailed(true)}
      style={{ objectPosition }}
      className={className}
    />
  );
}
