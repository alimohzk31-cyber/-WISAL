import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent, type WheelEvent as ReactWheelEvent } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, ChevronRight, Minus, Plus, RotateCcw, X } from 'lucide-react';
import SafeImage from './SafeImage';

interface BrowseServiceGalleryProps {
  images: string[];
  alt: string;
  compact?: boolean;
}

type Point = { x: number; y: number };

const MIN_SWIPE_DISTANCE = 48;
const MAX_ZOOM = 4;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function pointerDistance(points: Point[]) {
  return Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y);
}

export default function BrowseServiceGallery({ images, alt, compact = false }: BrowseServiceGalleryProps) {
  const galleryImages = useMemo(
    () => Array.from(new Set(images.map(image => image?.trim()).filter(Boolean))),
    [images],
  );
  const [index, setIndex] = useState(0);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState<Point>({ x: 0, y: 0 });
  const cardStartX = useRef<number | null>(null);
  const skipCardClick = useRef(false);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const viewerRef = useRef<HTMLDivElement>(null);
  const pointers = useRef(new Map<number, Point>());
  const panStart = useRef<{ point: Point; offset: Point } | null>(null);
  const swipeStartX = useRef<number | null>(null);
  const pinchStart = useRef<{ distance: number; scale: number } | null>(null);

  const hasMultiple = galleryImages.length > 1;
  const activeImage = galleryImages[index];

  const resetTransform = useCallback(() => {
    setScale(1);
    setOffset({ x: 0, y: 0 });
    pointers.current.clear();
    panStart.current = null;
    pinchStart.current = null;
  }, []);

  const showImage = useCallback((nextIndex: number) => {
    if (!galleryImages.length) return;
    setIndex((nextIndex + galleryImages.length) % galleryImages.length);
    resetTransform();
  }, [galleryImages.length, resetTransform]);

  const showPrevious = useCallback(() => showImage(index - 1), [index, showImage]);
  const showNext = useCallback(() => showImage(index + 1), [index, showImage]);

  const closeViewer = useCallback(() => {
    setViewerOpen(false);
    resetTransform();
  }, [resetTransform]);

  useEffect(() => {
    if (index >= galleryImages.length) setIndex(0);
  }, [galleryImages.length, index]);

  useEffect(() => {
    if (!viewerOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeButtonRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeViewer();
      if (event.key === 'ArrowLeft' && hasMultiple) showPrevious();
      if (event.key === 'ArrowRight' && hasMultiple) showNext();
      if (event.key === '+' || event.key === '=') setScale(value => clamp(value + 0.5, 1, MAX_ZOOM));
      if (event.key === '-') setScale(value => clamp(value - 0.5, 1, MAX_ZOOM));
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [closeViewer, hasMultiple, showNext, showPrevious, viewerOpen]);

  const constrainOffset = useCallback((nextOffset: Point, nextScale = scale) => {
    const viewport = viewerRef.current;
    if (!viewport || nextScale <= 1) return { x: 0, y: 0 };
    const maxX = viewport.clientWidth * (nextScale - 1) / 2;
    const maxY = viewport.clientHeight * (nextScale - 1) / 2;
    return {
      x: clamp(nextOffset.x, -maxX, maxX),
      y: clamp(nextOffset.y, -maxY, maxY),
    };
  }, [scale]);

  const changeZoom = useCallback((nextScale: number) => {
    const boundedScale = clamp(nextScale, 1, MAX_ZOOM);
    setScale(boundedScale);
    setOffset(current => constrainOffset(current, boundedScale));
  }, [constrainOffset]);

  const handleCardPointerDown = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (!event.isPrimary) return;
    cardStartX.current = event.clientX;
  };

  const handleCardPointerUp = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (cardStartX.current === null) return;
    const distance = event.clientX - cardStartX.current;
    cardStartX.current = null;
    if (!hasMultiple) return;
    if (Math.abs(distance) < MIN_SWIPE_DISTANCE) return;
    skipCardClick.current = true;
    if (distance < 0) showNext();
    else showPrevious();
  };

  const handleViewerPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const activePointers = [...pointers.current.values()];

    if (activePointers.length === 1) {
      panStart.current = { point: activePointers[0], offset };
      swipeStartX.current = event.clientX;
    } else if (activePointers.length === 2) {
      swipeStartX.current = null;
      pinchStart.current = { distance: pointerDistance(activePointers), scale };
    }
  };

  const handleViewerPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!pointers.current.has(event.pointerId)) return;
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const activePointers = [...pointers.current.values()];

    if (activePointers.length === 2 && pinchStart.current) {
      const nextScale = clamp(
        pinchStart.current.scale * pointerDistance(activePointers) / Math.max(pinchStart.current.distance, 1),
        1,
        MAX_ZOOM,
      );
      setScale(nextScale);
      setOffset(current => constrainOffset(current, nextScale));
      return;
    }

    if (activePointers.length === 1 && scale > 1 && panStart.current) {
      const nextOffset = {
        x: panStart.current.offset.x + event.clientX - panStart.current.point.x,
        y: panStart.current.offset.y + event.clientY - panStart.current.point.y,
      };
      setOffset(constrainOffset(nextOffset));
    }
  };

  const handleViewerPointerEnd = (event: ReactPointerEvent<HTMLDivElement>) => {
    const swipeDistance = swipeStartX.current === null ? 0 : event.clientX - swipeStartX.current;
    pointers.current.delete(event.pointerId);

    if (pointers.current.size === 0) {
      if (scale === 1 && hasMultiple && Math.abs(swipeDistance) >= MIN_SWIPE_DISTANCE) {
        if (swipeDistance < 0) showNext();
        else showPrevious();
      }
      panStart.current = null;
      pinchStart.current = null;
      swipeStartX.current = null;
    } else if (pointers.current.size === 1) {
      const point = [...pointers.current.values()][0];
      panStart.current = { point, offset };
      pinchStart.current = null;
    }
  };

  const handleWheel = (event: ReactWheelEvent<HTMLDivElement>) => {
    event.preventDefault();
    changeZoom(scale + (event.deltaY < 0 ? 0.25 : -0.25));
  };

  if (!activeImage) return null;

  const viewer = viewerOpen ? createPortal(
    <div
      className="fixed inset-0 z-[200] flex flex-col bg-black/95 text-white"
      role="dialog"
      aria-modal="true"
      aria-label={`عارض صور ${alt}`}
      dir="ltr"
    >
      <div className="relative z-20 flex min-h-16 shrink-0 items-center justify-between gap-3 px-3 py-2 sm:px-5">
        <button
          ref={closeButtonRef}
          type="button"
          onClick={closeViewer}
          className="flex h-11 w-11 items-center justify-center rounded-full bg-white/15 transition-colors hover:bg-white/25 focus:outline-none focus:ring-2 focus:ring-white"
          aria-label="إغلاق عارض الصور"
        >
          <X className="h-6 w-6" />
        </button>

        {hasMultiple && <span className="rounded-full bg-black/40 px-3 py-1 text-sm" aria-live="polite">{index + 1} / {galleryImages.length}</span>}

        <div className="flex items-center gap-1">
          <button type="button" onClick={() => changeZoom(scale - 0.5)} disabled={scale <= 1} className="flex h-10 w-10 items-center justify-center rounded-full bg-white/15 disabled:opacity-35" aria-label="تصغير الصورة"><Minus className="h-5 w-5" /></button>
          <button type="button" onClick={resetTransform} className="flex h-10 w-10 items-center justify-center rounded-full bg-white/15" aria-label="إعادة ضبط التكبير"><RotateCcw className="h-4 w-4" /></button>
          <button type="button" onClick={() => changeZoom(scale + 0.5)} disabled={scale >= MAX_ZOOM} className="flex h-10 w-10 items-center justify-center rounded-full bg-white/15 disabled:opacity-35" aria-label="تكبير الصورة"><Plus className="h-5 w-5" /></button>
        </div>
      </div>

      <div
        ref={viewerRef}
        className={`relative min-h-0 flex-1 overflow-hidden touch-none ${scale > 1 ? 'cursor-grab active:cursor-grabbing' : ''}`}
        onPointerDown={handleViewerPointerDown}
        onPointerMove={handleViewerPointerMove}
        onPointerUp={handleViewerPointerEnd}
        onPointerCancel={handleViewerPointerEnd}
        onWheel={handleWheel}
        onDoubleClick={() => changeZoom(scale > 1 ? 1 : 2)}
      >
        <SafeImage
          key={activeImage}
          src={activeImage}
          alt={`${alt}${hasMultiple ? ` — الصورة ${index + 1}` : ''}`}
          loading="eager"
          draggable={false}
          className="pointer-events-none absolute inset-0 m-auto max-h-full max-w-full select-none object-contain object-center will-change-transform"
          style={{ transform: `translate3d(${offset.x}px, ${offset.y}px, 0) scale(${scale})` }}
        />

        {hasMultiple && scale === 1 && (
          <>
            <button type="button" onPointerDown={event => event.stopPropagation()} onClick={showPrevious} className="absolute left-2 top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-black/45 hover:bg-black/65 sm:left-5" aria-label="الصورة السابقة"><ChevronLeft className="h-7 w-7" /></button>
            <button type="button" onPointerDown={event => event.stopPropagation()} onClick={showNext} className="absolute right-2 top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-black/45 hover:bg-black/65 sm:right-5" aria-label="الصورة التالية"><ChevronRight className="h-7 w-7" /></button>
          </>
        )}
      </div>

      <p className="shrink-0 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2 text-center text-xs text-white/70" dir="rtl">
        {scale > 1 ? 'اسحب الصورة للتنقل داخلها' : 'انقر مرتين للتكبير، أو استخدم إصبعين'}
      </p>
    </div>,
    document.body,
  ) : null;

  return (
    <>
      <div className="relative w-full overflow-hidden bg-[var(--bg-secondary)]" dir="ltr">
        <button
          type="button"
          className="block w-full cursor-zoom-in touch-pan-y"
          style={{ touchAction: 'pan-y' }}
          onPointerDown={handleCardPointerDown}
          onPointerUp={handleCardPointerUp}
          onPointerCancel={() => { cardStartX.current = null; }}
          onClick={() => {
            if (skipCardClick.current) {
              skipCardClick.current = false;
              return;
            }
            setViewerOpen(true);
          }}
          aria-label={`فتح صورة ${alt} بملء الشاشة`}
        >
          <SafeImage
            key={activeImage}
            src={activeImage}
            alt={`${alt}${hasMultiple ? ` — الصورة ${index + 1}` : ''}`}
            draggable={false}
            className={compact
              ? 'mx-auto block h-52 w-full select-none object-contain object-center sm:h-60'
              : 'mx-auto block h-auto max-h-[min(70dvh,42rem)] w-full select-none object-contain object-center'}
          />
        </button>

        {hasMultiple && (
          <>
            <button type="button" onClick={showPrevious} className="absolute left-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-black/45 text-white shadow-md hover:bg-black/65" aria-label="الصورة السابقة"><ChevronLeft className="h-5 w-5" /></button>
            <button type="button" onClick={showNext} className="absolute right-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-black/45 text-white shadow-md hover:bg-black/65" aria-label="الصورة التالية"><ChevronRight className="h-5 w-5" /></button>
            <div className="pointer-events-none absolute bottom-2 left-1/2 flex -translate-x-1/2 gap-1.5 rounded-full bg-black/40 px-2.5 py-1.5" aria-hidden="true">
              {galleryImages.map((image, imageIndex) => <span key={`${image}-${imageIndex}`} className={`h-1.5 rounded-full transition-all ${imageIndex === index ? 'w-4 bg-white' : 'w-1.5 bg-white/55'}`} />)}
            </div>
          </>
        )}
      </div>
      {viewer}
    </>
  );
}
