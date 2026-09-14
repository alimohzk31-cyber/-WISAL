import { useEffect, useRef, useState } from 'react';
import type { Service } from '../types/models';
import { fetchServiceImage, getCachedServiceImage } from '../lib/serviceMedia';
import SafeImage, { FALLBACK_IMAGE } from './SafeImage';
import BrowseServiceGallery from './BrowseServiceGallery';

function useVisibleServiceImage(service: Service) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [image, setImage] = useState(service.image || '');
  const [settled, setSettled] = useState(Boolean(service.image));

  useEffect(() => {
    setImage(service.image || '');
    setSettled(Boolean(service.image));
  }, [service.id, service.image]);
  useEffect(() => {
    if (service.image || service.id == null) return;
    let active = true;
    void getCachedServiceImage(service.id).then(cached => {
      if (active && cached) { setImage(cached); setSettled(true); }
    });
    return () => { active = false; };
  }, [service.id, service.image]);
  useEffect(() => {
    if (service.id == null) return;
    const host = hostRef.current;
    if (!host) return;
    let active = true;
    const load = () => { void fetchServiceImage(service.id!).then(value => {
      if (!active) return;
      if (value) setImage(value);
      setSettled(true);
    }); };
    if (!('IntersectionObserver' in window)) load();
    else {
      const observer = new IntersectionObserver(entries => {
        if (!entries.some(entry => entry.isIntersecting)) return;
        observer.disconnect();
        load();
      }, { rootMargin: '120px 0px' });
      observer.observe(host);
      return () => { active = false; observer.disconnect(); };
    }
    return () => { active = false; };
  }, [service.id]);

  return { hostRef, image, settled };
}

export function LazyServiceCardImage({ service, className }: { service: Service; className?: string }) {
  const { hostRef, image, settled } = useVisibleServiceImage(service);
  return (
    <div ref={hostRef} className="h-full w-full bg-[var(--bg-secondary)]">
      {image || settled
        ? <SafeImage src={image || FALLBACK_IMAGE} alt={service.name} className={className} />
        : <div className="h-full w-full animate-pulse bg-[var(--bg-secondary)]" role="status" aria-label="جارٍ تحميل الصورة" />}
    </div>
  );
}

export function LazyServiceGallery({ service, images }: { service: Service; images: string[] }) {
  const { hostRef, image, settled } = useVisibleServiceImage(service);
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
