import { useEffect, useRef, useState } from 'react';
import {
  BriefcaseBusiness, Building2, CalendarDays, ImagePlus, MapPin,
  Phone, Send, Trash2, Upload, Video, X,
} from 'lucide-react';
import { useToast } from '../../components/ToastProvider';
import { employmentTypes } from './jobData';
import {
  MAX_JOB_IMAGE_BYTES, MAX_JOB_IMAGES, MAX_JOB_VIDEO_BYTES, MAX_JOB_VIDEO_SECONDS,
} from './jobMediaConfig';
import type { EmploymentType, NewJob, NewJobMedia } from './types';
import type { JobCategory } from './admin/jobAdminApi';

const emptyJob = (employmentType: EmploymentType = 'كامل'): NewJob => ({
  title: '', company: '', specialty: '', description: '', governorate: '', area: '',
  employmentType, salary: '', experience: '', qualification: '', phone: '', requirements: '',
  companyAbout: '', benefits: '', address: '', whatsapp: '', email: '', applicationDeadline: '',
  trainingDuration: '', trainingPaid: false, trainingHiringPossible: false, salaryNegotiable: false,
});

interface SelectedImage { file: File; preview: string }
interface SelectedVideo { file: File; preview: string; duration: number }

function videoDuration(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.onloadedmetadata = () => {
      const duration = video.duration;
      URL.revokeObjectURL(url);
      if (Number.isFinite(duration)) resolve(duration);
      else reject(new Error('تعذر قراءة مدة الفيديو.'));
    };
    video.onerror = () => { URL.revokeObjectURL(url); reject(new Error('ملف الفيديو غير صالح.')); };
    video.src = url;
  });
}

const inputClass = 'w-full rounded-xl border border-[var(--input-border)] bg-[var(--input-bg)] px-4 py-3 text-sm font-bold text-[var(--text-primary)] outline-none transition focus:border-[var(--accent-primary)] focus:ring-2 focus:ring-[var(--focus-ring)]';

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return <label className="space-y-1.5">
    <span className="block text-sm font-bold text-[var(--text-secondary)]">{label}{required ? <span className="text-red-500"> *</span> : null}</span>
    {children}
  </label>;
}

function SectionTitle({ icon, title, hint }: { icon: React.ReactNode; title: string; hint?: string }) {
  return <div className="flex items-start gap-3">
    <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent-primary)]">{icon}</span>
    <div><h3 className="font-black text-[var(--text-primary)]">{title}</h3>{hint ? <p className="text-xs font-bold text-[var(--text-muted)]">{hint}</p> : null}</div>
  </div>;
}

export default function AddJobModal({ onClose, onSubmit, categories, initialEmploymentType }: {
  onClose: () => void;
  onSubmit: (job: NewJob, media: NewJobMedia) => Promise<void>;
  categories: JobCategory[];
  initialEmploymentType?: EmploymentType;
}) {
  const toast = useToast();
  const [form, setForm] = useState<NewJob>(() => emptyJob(initialEmploymentType));
  const [images, setImages] = useState<SelectedImage[]>([]);
  const [selectedVideo, setSelectedVideo] = useState<SelectedVideo>();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const imageInput = useRef<HTMLInputElement>(null);
  const videoInput = useRef<HTMLInputElement>(null);
  const imagesRef = useRef(images);
  const videoRef = useRef(selectedVideo);

  useEffect(() => { imagesRef.current = images; }, [images]);
  useEffect(() => { videoRef.current = selectedVideo; }, [selectedVideo]);
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
      imagesRef.current.forEach(image => URL.revokeObjectURL(image.preview));
      if (videoRef.current) URL.revokeObjectURL(videoRef.current.preview);
    };
  }, []);

  const patch = <K extends keyof NewJob>(key: K, value: NewJob[K]) => setForm(current => ({ ...current, [key]: value }));

  const addImages = (files: File[]) => {
    setError('');
    if (!files.length) return;
    if (images.length + files.length > MAX_JOB_IMAGES) {
      setError(`يمكن اختيار ${MAX_JOB_IMAGES} صور كحد أقصى.`); return;
    }
    if (files.some(file => !['image/jpeg', 'image/png', 'image/webp'].includes(file.type))) {
      setError('الصور المسموحة: JPG أو PNG أو WebP.'); return;
    }
    if (files.some(file => file.size > MAX_JOB_IMAGE_BYTES)) {
      setError('يجب ألا يتجاوز حجم الصورة الواحدة 2 ميغابايت.'); return;
    }
    setImages(current => [...current, ...files.map(file => ({ file, preview: URL.createObjectURL(file) }))]);
  };

  const removeImage = (index: number) => setImages(current => {
    const target = current[index];
    if (target) URL.revokeObjectURL(target.preview);
    return current.filter((_, itemIndex) => itemIndex !== index);
  });

  const chooseVideo = async (file?: File) => {
    setError('');
    if (!file) return;
    if (!file.type.startsWith('video/')) { setError('يرجى اختيار ملف فيديو صالح.'); return; }
    if (file.size > MAX_JOB_VIDEO_BYTES) { setError('حجم الفيديو يجب ألا يتجاوز 20 ميغابايت.'); return; }
    try {
      const duration = await videoDuration(file);
      if (duration < 1 || duration > MAX_JOB_VIDEO_SECONDS + 0.05) {
        setError(`مدة الفيديو يجب أن تكون من ثانية واحدة إلى ${MAX_JOB_VIDEO_SECONDS} ثانية.`); return;
      }
      if (selectedVideo) URL.revokeObjectURL(selectedVideo.preview);
      setSelectedVideo({ file, preview: URL.createObjectURL(file), duration });
    } catch (videoError) {
      setError(videoError instanceof Error ? videoError.message : 'تعذر تجهيز الفيديو.');
    }
  };

  const removeVideo = () => {
    if (selectedVideo) URL.revokeObjectURL(selectedVideo.preview);
    setSelectedVideo(undefined);
    if (videoInput.current) videoInput.current.value = '';
  };

  const reset = () => {
    images.forEach(image => URL.revokeObjectURL(image.preview));
    if (selectedVideo) URL.revokeObjectURL(selectedVideo.preview);
    setForm(emptyJob(initialEmploymentType)); setImages([]); setSelectedVideo(undefined); setError('');
    if (imageInput.current) imageInput.current.value = '';
    if (videoInput.current) videoInput.current.value = '';
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (saving) return;
    setSaving(true); setError('');
    try {
      await onSubmit(form, { imageFiles: images.map(image => image.file), videoFile: selectedVideo?.file });
      reset();
      onClose();
      toast('success', '✓ تم إرسال الوظيفة بنجاح وهي الآن بانتظار موافقة الإدارة');
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'تعذر إرسال الوظيفة. حاول مجددًا.');
    } finally {
      setSaving(false);
    }
  };

  return <div className="fixed inset-0 z-[110] flex items-end justify-center bg-black/65 sm:items-center sm:p-4" role="presentation">
    <section role="dialog" aria-modal="true" aria-labelledby="add-job-title" className="flex h-[100dvh] w-full flex-col overflow-hidden bg-[var(--surface-elevated)] shadow-2xl sm:max-h-[92dvh] sm:max-w-2xl sm:rounded-3xl">
      <header className="flex shrink-0 items-center justify-between border-b border-[var(--border)] px-4 py-3.5 sm:px-6 sm:py-4">
        <div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--accent-primary)] text-white"><BriefcaseBusiness /></span><div><h2 id="add-job-title" className="text-lg font-black text-[var(--text-primary)] sm:text-xl">نشر فرصة عمل</h2><p className="text-xs font-bold text-[var(--text-muted)]">ستُراجع الفرصة قبل ظهورها للعامة</p></div></div>
        <button type="button" onClick={onClose} disabled={saving} aria-label="إغلاق" className="flex h-11 w-11 items-center justify-center rounded-full border border-[var(--border)] text-[var(--text-primary)] hover:bg-[var(--bg-secondary)] disabled:opacity-50"><X /></button>
      </header>

      <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
        <div className="flex-1 space-y-6 overflow-y-auto overscroll-contain px-4 py-5 sm:px-6">
          <section className="space-y-4">
            <SectionTitle icon={<Building2 className="h-5 w-5" />} title="بيانات الوظيفة" />
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="عنوان الوظيفة" required><input required value={form.title} onChange={event => patch('title', event.target.value)} className={inputClass} placeholder="مثال: محاسب" /></Field>
              <Field label="اسم الجهة / الشركة" required><input required value={form.company} onChange={event => patch('company', event.target.value)} className={inputClass} placeholder="اسم الشركة أو المتجر" /></Field>
              <Field label="المهنة أو الاختصاص" required><input required value={form.specialty} onChange={event => patch('specialty', event.target.value)} className={inputClass} placeholder="مثال: محاسبة، مبيعات، طبخ" /></Field>
              {categories.length > 0 ? <Field label="قسم الوظيفة" required><select required value={form.categoryId || ''} onChange={event => patch('categoryId', Number(event.target.value) || undefined)} className={inputClass}><option value="">اختر القسم</option>{categories.map(category => <option key={category.id} value={category.id}>{category.name}</option>)}</select></Field> : null}
            </div>
            <Field label="وصف الوظيفة" required><textarea required value={form.description} onChange={event => patch('description', event.target.value)} className={`${inputClass} min-h-28 resize-y leading-7`} placeholder="طبيعة العمل والمسؤوليات اليومية" /></Field>
            <Field label="المتطلبات" required><textarea required value={form.requirements || ''} onChange={event => patch('requirements', event.target.value)} className={`${inputClass} min-h-24 resize-y leading-7`} placeholder="اكتب كل متطلب في سطر مستقل" /></Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="نبذة عن الشركة (اختياري)"><textarea value={form.companyAbout || ''} onChange={event => patch('companyAbout', event.target.value)} className={`${inputClass} min-h-24 resize-y`} /></Field>
              <Field label="المميزات (اختياري)"><textarea value={form.benefits || ''} onChange={event => patch('benefits', event.target.value)} className={`${inputClass} min-h-24 resize-y`} placeholder="راتب، حوافز، نقل..." /></Field>
            </div>
          </section>

          <section className="space-y-4 border-t border-[var(--border)] pt-5">
            <SectionTitle icon={<MapPin className="h-5 w-5" />} title="الموقع والتواصل" />
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="المحافظة" required={form.employmentType !== 'عن بُعد'}><input required={form.employmentType !== 'عن بُعد'} value={form.governorate} onChange={event => patch('governorate', event.target.value)} className={inputClass} placeholder={form.employmentType === 'عن بُعد' ? 'اختياري للعمل عن بُعد' : ''} /></Field>
              <Field label="المنطقة" required={form.employmentType !== 'عن بُعد'}><input required={form.employmentType !== 'عن بُعد'} value={form.area} onChange={event => patch('area', event.target.value)} className={inputClass} placeholder={form.employmentType === 'عن بُعد' ? 'اختياري للعمل عن بُعد' : ''} /></Field>
              <Field label="العنوان (اختياري)"><input value={form.address || ''} onChange={event => patch('address', event.target.value)} className={inputClass} /></Field>
              <Field label="رقم الهاتف أو وسيلة التواصل" required><div className="relative"><Phone className="absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]" /><input required type="tel" dir="ltr" minLength={7} value={form.phone} onChange={event => patch('phone', event.target.value)} className={`${inputClass} pr-10 text-left`} placeholder="07X XXXX XXXX" /></div></Field>
              <Field label="نوع الوظيفة" required><select value={form.employmentType} onChange={event => patch('employmentType', event.target.value as NewJob['employmentType'])} className={inputClass}>{employmentTypes.map(type => <option key={type}>{type === 'كامل' ? 'دوام كامل' : type === 'جزئي' ? 'دوام جزئي' : type}</option>)}</select></Field>
              <Field label="الراتب (اختياري)"><div className="space-y-2"><input disabled={form.salaryNegotiable} value={form.salary || ''} onChange={event => patch('salary', event.target.value)} className={inputClass} placeholder="مثال: 750,000 دينار" /><label className="flex items-center gap-2 text-xs font-bold"><input type="checkbox" checked={Boolean(form.salaryNegotiable)} onChange={event => patch('salaryNegotiable', event.target.checked)} /> يحدد بعد المقابلة</label></div></Field>
              <Field label="الخبرة (اختياري)"><input value={form.experience || ''} onChange={event => patch('experience', event.target.value)} className={inputClass} /></Field>
              <Field label="المؤهل (اختياري)"><input value={form.qualification || ''} onChange={event => patch('qualification', event.target.value)} className={inputClass} /></Field>
              <Field label="واتساب (اختياري)"><input type="tel" dir="ltr" value={form.whatsapp || ''} onChange={event => patch('whatsapp', event.target.value)} className={`${inputClass} text-left`} /></Field>
              <Field label="البريد الإلكتروني (اختياري)"><input type="email" dir="ltr" value={form.email || ''} onChange={event => patch('email', event.target.value)} className={`${inputClass} text-left`} /></Field>
              <Field label="آخر موعد للتقديم (اختياري)"><div className="relative"><CalendarDays className="absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]" /><input type="date" value={form.applicationDeadline || ''} onChange={event => patch('applicationDeadline', event.target.value)} className={`${inputClass} pr-10`} /></div></Field>
            </div>
            {form.employmentType === 'تدريب' ? <div className="rounded-2xl bg-[var(--accent-soft)] p-4"><h4 className="mb-3 font-black text-[var(--accent-primary)]">تفاصيل التدريب</h4><div className="grid gap-4 sm:grid-cols-2"><Field label="مدة التدريب"><input value={form.trainingDuration || ''} onChange={event => patch('trainingDuration', event.target.value)} className={inputClass} placeholder="مثال: 3 أشهر" /></Field><div className="space-y-3 pt-1 text-sm font-bold"><label className="flex items-center gap-2"><input type="checkbox" checked={Boolean(form.trainingPaid)} onChange={event => patch('trainingPaid', event.target.checked)} /> التدريب مدفوع</label><label className="flex items-center gap-2"><input type="checkbox" checked={Boolean(form.trainingHiringPossible)} onChange={event => patch('trainingHiringPossible', event.target.checked)} /> توجد إمكانية للتوظيف بعد التدريب</label></div></div></div> : null}
          </section>

          <section className="space-y-4 border-t border-[var(--border)] pt-5">
            <SectionTitle icon={<ImagePlus className="h-5 w-5" />} title="صور الوظيفة" hint={`حتى ${MAX_JOB_IMAGES} صور؛ الصورة الأولى هي الغلاف`} />
            {images.length ? <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {images.map((image, index) => <div key={image.preview} className="relative aspect-square overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)]">
                <img src={image.preview} alt={`معاينة الصورة ${index + 1}`} className="h-full w-full object-cover" />
                <button type="button" onClick={() => removeImage(index)} disabled={saving} aria-label={`حذف الصورة ${index + 1}`} className="absolute left-1 top-1 flex h-9 w-9 items-center justify-center rounded-full bg-black/65 text-white"><Trash2 className="h-4 w-4" /></button>
                {index === 0 ? <span className="absolute bottom-0 right-0 rounded-tl-lg bg-[var(--accent-primary)] px-2 py-1 text-[10px] font-bold text-white">الغلاف</span> : null}
              </div>)}
            </div> : null}
            <button type="button" onClick={() => imageInput.current?.click()} disabled={saving || images.length >= MAX_JOB_IMAGES} className="flex min-h-20 w-full items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-[var(--accent-primary)] bg-[var(--accent-soft)] p-4 font-black text-[var(--accent-primary)] disabled:opacity-50"><Upload className="h-5 w-5" />{images.length >= MAX_JOB_IMAGES ? 'اكتمل عدد الصور' : 'إضافة صور'}<span className="text-xs">{images.length} / {MAX_JOB_IMAGES}</span></button>
            <input ref={imageInput} type="file" accept="image/jpeg,image/png,image/webp" multiple className="hidden" aria-label="اختيار صور الوظيفة" onChange={event => { addImages(Array.from(event.target.files || [])); event.target.value = ''; }} />
          </section>

          <section className="space-y-4 border-t border-[var(--border)] pt-5">
            <SectionTitle icon={<Video className="h-5 w-5" />} title="فيديو قصير (اختياري)" hint={`مقطع واحد، حتى ${MAX_JOB_VIDEO_SECONDS} ثانية و20 ميغابايت`} />
            {selectedVideo ? <div className="overflow-hidden rounded-2xl border border-[var(--border)] bg-black">
              <video src={selectedVideo.preview} controls preload="metadata" className="max-h-56 w-full object-contain" />
              <div className="flex items-center justify-between gap-3 bg-[var(--surface-elevated)] p-3 text-xs font-bold"><span className="min-w-0 truncate">{selectedVideo.file.name} — {Math.round(selectedVideo.duration)} ثانية</span><button type="button" onClick={removeVideo} disabled={saving} className="shrink-0 text-red-500">حذف الفيديو</button></div>
            </div> : <button type="button" onClick={() => videoInput.current?.click()} disabled={saving} className="flex min-h-20 w-full items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-[var(--border)] bg-[var(--bg-secondary)] p-4 font-black text-[var(--text-secondary)] hover:border-[var(--accent-primary)]"><Video className="h-6 w-6" />اختيار فيديو من الجهاز</button>}
            <input ref={videoInput} type="file" accept="video/*" className="hidden" aria-label="اختيار فيديو الوظيفة" onChange={event => { void chooseVideo(event.target.files?.[0]); event.target.value = ''; }} />
          </section>
        </div>

        <footer className="shrink-0 border-t border-[var(--border)] bg-[var(--surface-elevated)] px-4 py-3 sm:px-6 sm:py-4">
          {error ? <p role="alert" className="mb-3 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm font-bold text-red-500">{error}</p> : null}
          <div className="flex gap-3"><button type="button" onClick={onClose} disabled={saving} className="flex-1 rounded-xl border border-[var(--border)] px-4 py-3 font-black text-[var(--text-primary)] disabled:opacity-50">إلغاء</button><button type="submit" disabled={saving} className="flex-[2] rounded-xl bg-[var(--accent-primary)] px-4 py-3 font-black text-white disabled:opacity-50">{saving ? 'جارٍ رفع الملفات والإرسال…' : <span className="flex items-center justify-center gap-2"><Send className="h-4 w-4" />إرسال للمراجعة</span>}</button></div>
        </footer>
      </form>
    </section>
  </div>;
}
