import { useRef, useState } from 'react';
import { ImagePlus, X } from 'lucide-react';
import { optimizeImageToDataUrl } from '../lib/imageOptimization';

interface Props {
  images: string[];
  min: number;
  max: number;
  onChange: (images: string[]) => void;
  onBusy: (busy: boolean) => void;
}

export default function ServiceImagePicker({ images, min, max, onChange, onBusy }: Props) {
  const input = useRef<HTMLInputElement>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const addImages = async (files: File[]) => {
    setError('');
    if (!files.length || busy) return;
    if (images.length + files.length > max) { setError(`يمكنك إضافة ${max} صور كحد أقصى. لم تُضف الصور الزائدة.`); return; }
    if (files.some(file => !['image/jpeg', 'image/png', 'image/webp'].includes(file.type))) { setError('الصور المسموحة: JPG أو PNG أو WebP.'); return; }
    if (files.some(file => file.size > 2 * 1024 * 1024)) { setError('يجب ألا يتجاوز حجم الصورة الواحدة 2 ميغابايت.'); return; }
    setBusy(true); onBusy(true);
    try {
      const urls = await Promise.all(files.map(file => optimizeImageToDataUrl(file, 1280, 1280, 0.78)));
      onChange([...images, ...urls]);
    } catch { setError('تعذر قراءة إحدى الصور. اختر صورًا سليمة وحاول مجددًا.'); }
    finally { setBusy(false); onBusy(false); }
  };
  return <fieldset className="space-y-3 rounded-2xl border border-[var(--border)] p-4">
    <legend className="px-1 text-sm font-bold text-[var(--text-primary)]">صور الصيدلية <span aria-hidden="true">*</span></legend>
    <div className="flex items-center justify-between gap-2 text-xs text-[var(--text-muted)]"><span>من {min} إلى {max} صور؛ الصورة الأولى هي الغلاف.</span><span aria-live="polite">{images.length} / {max}</span></div>
    {images.length > 0 && <div className="grid grid-cols-3 gap-2">
      {images.map((image, index) => <div key={`${index}-${image.slice(-24)}`} className="relative aspect-square overflow-hidden rounded-xl border border-[var(--border)]">
        <img src={image} alt={`صورة الصيدلية ${index + 1}`} loading="lazy" decoding="async" className="h-full w-full object-cover" />
        <button type="button" disabled={busy} aria-label={`حذف الصورة ${index + 1}`} onClick={() => onChange(images.filter((_, i) => i !== index))} className="absolute left-0 top-0 flex h-11 w-11 items-center justify-center rounded-br-xl bg-black/60 text-white"><X className="h-4 w-4" /></button>
        {index === 0 && <span className="absolute bottom-0 right-0 rounded-tl-lg bg-[var(--accent-primary)] px-2 py-1 text-[10px] font-bold text-white">الغلاف</span>}
      </div>)}
    </div>}
    <button type="button" onClick={() => input.current?.click()} disabled={busy || images.length >= max} className="flex min-h-16 w-full items-center justify-center gap-2 rounded-xl border border-dashed border-[var(--accent-primary)] bg-[var(--accent-soft)] px-3 py-4 text-sm font-bold text-[var(--accent-primary)] disabled:cursor-not-allowed disabled:opacity-50"><ImagePlus className="h-5 w-5" />{busy ? 'جارٍ تجهيز الصور…' : images.length >= max ? 'اكتمل عدد الصور' : 'إضافة صور الصيدلية'}</button>
    <p className="text-xs text-[var(--text-muted)]">JPG أو PNG أو WebP، حتى 2 ميغابايت لكل صورة.</p>
    <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" multiple aria-label="صور الصيدلية" className="hidden" onChange={event => { void addImages(Array.from(event.target.files ?? [])); event.target.value = ''; }} />
    {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
  </fieldset>;
}
