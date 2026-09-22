import { useEffect, useRef, useState } from 'react';
import type { Service } from '../types/models';
import { fetchServiceImage } from '../lib/serviceMedia';
import SafeImage, { FALLBACK_IMAGE } from './SafeImage';
import BrowseServiceGallery from './BrowseServiceGallery';

function useVisibleServiceImage(service: Service, priority = false, enabled = true) {
  const hostRef = useRef<HTMLDivElement>(null);
  const imageKey = String(service.id ?? service.slug);
  const [resolved, setResolved] = useState(() => ({
    key: imageKey,
    image: service.image || '',
    settled: Boolean(service.image),
  }));
  useEffect(() => {
    if (!enabled || service.image || service.id == null) return;
    const host = hostRef.current;
    if (!host) return;
    let active = true;
    const load = () => { void fetchServiceImage(service.id!).then(value => {
      if (!active) return;
      setResolved(previous => previous.key === imageKey && previous.settled && previous.image === value
        ? previous
        : { key: imageKey, image: value, settled: true });
    }); };
    if (!('IntersectionObserver' in window)) load();
    else {
      const observer = new IntersectionObserver(entries => {
        if (!entries.some(entry => entry.isIntersecting)) return;
        observer.disconnect();
        load();
      }, { rootMargin: priority ? '180px 0px' : '120px 0px' });
      observer.observe(host);
      return () => { active = false; observer.disconnect(); };
    }
    return () => { active = false; };
  }, [enabled, imageKey, priority, service.id, service.image]);

  const current = resolved.key === imageKey ? resolved : { key: imageKey, image: '', settled: false };
  return {
    hostRef,
    image: service.image || current.image,
    settled: Boolean(service.image) || current.settled,
  };
}

export function LazyServiceCardImage({ service, className, priority = false }: { service: Service; className?: string; priority?: boolean }) {
  const { hostRef, image, settled } = useVisibleServiceImage(service, priority);
  return (
    <div ref={hostRef} className="h-full w-full bg-[var(--bg-secondary)]">
      {image || settled
        ? <SafeImage src={image || FALLBACK_IMAGE} alt={service.name} className={className} loading={priority ? 'eager' : 'lazy'} fetchPriority={priority ? 'high' : 'auto'} />
        : <div className="h-full w-full animate-pulse bg-[var(--bg-secondary)]" role="status" aria-label="جارٍ تحميل الصورة" />}
    </div>
  );
}

export function LazyServiceGallery({ service, images }: { service: Service; images: string[] }) {
  const { hostRef, image, settled } = useVisibleServiceImage(service, false, images.length === 0);
  const resolvedImages = images.length ? images : image ? [image] : [];
  if (settled && resolvedImages.length === 0) return null;
  return (
    <div ref={hostRef} className="w-full bg-[var(--bg-secondary)]">
      {resolvedImages.length
        ? <BrowseServiceGallery images={[resolvedImages[0]]} alt={service.name} compact />
        : <div className="h-52 animate-pulse bg-[var(--bg-secondary)] sm:h-60" role="status" aria-label="جارٍ تحميل الصورة" />}
    </div>
  );
}
