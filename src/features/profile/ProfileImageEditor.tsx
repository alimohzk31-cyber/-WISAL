import { useCallback, useEffect, useRef, useState } from 'react';
import { Minus, Plus, RotateCcw, X, Check } from 'lucide-react';
import type { ProfileImageKind } from './profileData';

interface Props {
  src: string;
  kind: ProfileImageKind;
  onCancel: () => void;
  onSave: (file: File) => Promise<void> | void;
}

interface Point { x: number; y: number; }

export default function ProfileImageEditor({ src, kind, onCancel, onSave }: Props) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const [naturalSize, setNaturalSize] = useState({ width: 1, height: 1 });
  const [viewport, setViewport] = useState({ width: 320, height: kind === 'cover' ? 110 : 320 });
  const [zoom, setZoom] = useState(1);
  const zoomRef = useRef(1);
  const [position, setPosition] = useState<Point>({ x: 0, y: 0 });
  const positionRef = useRef<Point>({ x: 0, y: 0 });
  const [saving, setSaving] = useState(false);
  const pointers = useRef(new Map<number, Point>());
  const gesture = useRef<{ center: Point; distance: number; zoom: number; position: Point } | null>(null);

  useEffect(() => {
    const node = viewportRef.current;
    if (!node) return;
    const update = () => {
      const width = Math.max(1, node.clientWidth);
      setViewport({ width, height: kind === 'cover' ? Math.max(80, Math.round(width / 3.2)) : width });
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(node);
    return () => observer.disconnect();
  }, [kind]);

  const setPositionNow = useCallback((next: Point) => {
    positionRef.current = next;
    setPosition(next);
  }, []);

  const setZoomNow = useCallback((next: number) => {
    const value = Math.min(4, Math.max(1, next));
    zoomRef.current = value;
    setZoom(value);
  }, []);

  const reset = () => { setZoomNow(1); setPositionNow({ x: 0, y: 0 }); };
  const fitScale = Math.min(viewport.width / naturalSize.width, viewport.height / naturalSize.height);
  const renderedWidth = Math.max(1, Math.round(naturalSize.width * fitScale));
  const renderedHeight = Math.max(1, Math.round(naturalSize.height * fitScale));

  const pointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pointers.current.size === 1) {
      gesture.current = { center: { x: event.clientX, y: event.clientY }, distance: 0, zoom: zoomRef.current, position: positionRef.current };
    } else if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      gesture.current = { center: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, distance: Math.hypot(a.x - b.x, a.y - b.y), zoom: zoomRef.current, position: positionRef.current };
    }
  };

  const pointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!pointers.current.has(event.pointerId)) return;
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const start = gesture.current;
    if (!start) return;
    const values = [...pointers.current.values()];
    if (values.length >= 2 && start.distance > 0) {
      const distance = Math.hypot(values[0].x - values[1].x, values[0].y - values[1].y);
      setZoomNow(start.zoom * (distance / start.distance));
      return;
    }
    const point = values[0];
    setPositionNow({ x: start.position.x + point.x - start.center.x, y: start.position.y + point.y - start.center.y });
  };

  const pointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    pointers.current.delete(event.pointerId);
    if (!pointers.current.size) gesture.current = null;
  };

  const save = async () => {
    const image = imageRef.current;
    if (!image || !image.naturalWidth || saving) return;
    setSaving(true);
    try {
      const canvas = document.createElement('canvas');
      canvas.width = kind === 'avatar' ? 900 : 1800;
      canvas.height = kind === 'avatar' ? 900 : Math.round(canvas.width / 3.2);
      const context = canvas.getContext('2d');
      if (!context) throw new Error('تعذر تجهيز الصورة.');
      const drawWidth = image.naturalWidth * Math.min(viewport.width / image.naturalWidth, viewport.height / image.naturalHeight);
      const drawHeight = image.naturalHeight * Math.min(viewport.width / image.naturalWidth, viewport.height / image.naturalHeight);
      const scale = (canvas.width / viewport.width) * zoomRef.current;
      context.translate(canvas.width / 2 + positionRef.current.x * (canvas.width / viewport.width), canvas.height / 2 + positionRef.current.y * (canvas.height / viewport.height));
      context.scale(scale, scale);
      context.drawImage(image, -drawWidth / 2, -drawHeight / 2, drawWidth, drawHeight);
      const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/webp', 0.86));
      if (!blob) throw new Error('تعذر إنشاء الصورة.');
      await onSave(new File([blob], `${kind}-${Date.now()}.webp`, { type: 'image/webp' }));
    } finally { setSaving(false); }
  };

  return <div className="fixed inset-0 z-[500] flex items-center justify-center bg-slate-950/75 p-3 sm:p-6" dir="rtl">
    <div className="flex max-h-[calc(100dvh-1.5rem)] w-full max-w-2xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl sm:max-h-[90dvh]">
      <header className="flex shrink-0 items-center justify-between border-b border-slate-100 px-4 py-3"><h2 className="font-black text-slate-800">تعديل الصورة</h2><button type="button" onClick={onCancel} className="rounded-full p-2 text-slate-500 hover:bg-slate-100" aria-label="إغلاق"><X size={20} /></button></header>
      <div className="min-h-0 flex-1 overflow-auto p-4 sm:p-6">
        <div ref={viewportRef} className={`relative mx-auto w-full max-w-xl overflow-hidden bg-slate-900 ${kind === 'avatar' ? 'aspect-square rounded-full' : 'rounded-2xl'}`} style={{ height: kind === 'avatar' ? undefined : `${viewport.height}px`, touchAction: 'none' }} onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={pointerUp} onPointerCancel={pointerUp}>
          <img ref={imageRef} src={src} alt="معاينة الصورة" draggable={false} onLoad={event => setNaturalSize({ width: event.currentTarget.naturalWidth, height: event.currentTarget.naturalHeight })} className="absolute left-1/2 top-1/2 max-w-none select-none" style={{ width: `${renderedWidth}px`, height: `${renderedHeight}px`, transform: `translate3d(calc(-50% + ${position.x}px), calc(-50% + ${position.y}px), 0) scale(${zoom})`, transformOrigin: 'center center' }} />
        </div>
        <div className="mx-auto mt-5 flex max-w-xl items-center gap-3"><button type="button" onClick={() => setZoomNow(zoomRef.current - 0.1)} className="rounded-xl bg-slate-100 p-2" aria-label="تصغير"><Minus size={18} /></button><input aria-label="التكبير" type="range" min="1" max="4" step="0.01" value={zoom} onChange={event => setZoomNow(Number(event.target.value))} className="min-w-0 flex-1 accent-blue-600" /><button type="button" onClick={() => setZoomNow(zoomRef.current + 0.1)} className="rounded-xl bg-slate-100 p-2" aria-label="تكبير"><Plus size={18} /></button><button type="button" onClick={reset} className="inline-flex items-center gap-1 rounded-xl bg-slate-100 px-3 py-2 text-sm font-bold" title="إعادة ضبط"><RotateCcw size={16} /> ضبط</button></div>
      </div>
      <footer className="flex shrink-0 gap-3 border-t border-slate-100 bg-white p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]"><button type="button" onClick={onCancel} className="flex-1 rounded-xl border border-slate-200 px-4 py-3 font-bold text-slate-700">إلغاء</button><button type="button" onClick={() => void save()} disabled={saving} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 font-bold text-white disabled:opacity-60">{saving ? 'جارٍ التجهيز...' : <><Check size={18} /> حفظ</>}</button></footer>
    </div>
  </div>;
}
