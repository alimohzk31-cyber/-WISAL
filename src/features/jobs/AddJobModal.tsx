import { useEffect, useRef, useState } from 'react';
import { BriefcaseBusiness, ImagePlus, MapPin, Phone, Send, Trash2, Upload, X } from 'lucide-react';
import { useToast } from '../../components/ToastProvider';
import { employmentTypes, whatsappFromSocialLinks } from './jobData';
import { MAX_JOB_IMAGE_BYTES } from './jobMediaConfig';
import type { EmploymentType, Job, NewJob, NewJobMedia } from './types';
import type { JobCategory } from './admin/jobAdminApi';

const emptyJob = (employmentType: EmploymentType = 'كامل'): NewJob => ({
  title: '', company: '', specialty: '', description: '', governorate: '', area: '',
  employmentType, salary: '', experience: '', phone: '', requirements: '', socialLinks: '',
});

function draftFromJob(job?: Job, employmentType?: EmploymentType): NewJob {
  if (!job) return emptyJob(employmentType);
  return {
    ...emptyJob(job.employmentType),
    ...job,
    socialLinks: job.socialLinks || [job.email, job.whatsapp].filter(Boolean).join('\n'),
  };
}

interface JobImage { file?: File; preview: string }

const inputClass = 'w-full rounded-xl border border-[var(--input-border)] bg-[var(--input-bg)] px-4 py-3 text-sm font-bold text-[var(--text-primary)] outline-none transition focus:border-[var(--accent-primary)] focus:ring-2 focus:ring-[var(--focus-ring)]';

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return <label className="block space-y-1.5">
    <span className="block text-sm font-bold text-[var(--text-secondary)]">{label}{required ? <span className="text-red-500"> *</span> : null}</span>
    {children}
  </label>;
}

export default function AddJobModal({ onClose, onSubmit, categories, initialEmploymentType, initialJob, mode = 'create' }: {
  onClose: () => void;
  onSubmit: (job: NewJob, media: NewJobMedia) => Promise<void>;
  categories: JobCategory[];
  initialEmploymentType?: EmploymentType;
  initialJob?: Job;
  mode?: 'create' | 'edit';
}) {
  const toast = useToast();
  const [form, setForm] = useState<NewJob>(() => draftFromJob(initialJob, initialEmploymentType));
  const [image, setImage] = useState<JobImage | undefined>(() => initialJob?.image ? { preview: initialJob.image } : undefined);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const imageInput = useRef<HTMLInputElement>(null);
  const imageRef = useRef(image);

  useEffect(() => { imageRef.current = image; }, [image]);
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
      const preview = imageRef.current?.preview;
      if (preview?.startsWith('blob:')) URL.revokeObjectURL(preview);
    };
  }, []);

  const patch = <K extends keyof NewJob>(key: K, value: NewJob[K]) => setForm(current => ({ ...current, [key]: value }));

  const chooseImage = (file?: File) => {
    setError('');
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setError('الصورة المسموحة: JPG أو PNG أو WebP.');
      return;
    }
    if (file.size > MAX_JOB_IMAGE_BYTES) {
      setError('يجب ألا يتجاوز حجم الصورة 2 ميغابايت.');
      return;
    }
    const currentPreview = imageRef.current?.preview;
    if (currentPreview?.startsWith('blob:')) URL.revokeObjectURL(currentPreview);
    const nextImage = { file, preview: URL.createObjectURL(file) };
    imageRef.current = nextImage;
    setImage(nextImage);
  };

  const removeImage = () => {
    const preview = imageRef.current?.preview;
    if (preview?.startsWith('blob:')) URL.revokeObjectURL(preview);
    imageRef.current = undefined;
    setImage(undefined);
    if (imageInput.current) imageInput.current.value = '';
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setError('');
    const socialLinks = form.socialLinks?.trim() || '';
    const cover = image?.preview && !image.preview.startsWith('blob:') ? image.preview : undefined;
    const draft: NewJob = {
      ...form,
      company: initialJob?.company?.trim() || form.company?.trim() || form.title.trim(),
      // The legacy database column is NOT NULL; requirements now supply its compatible value.
      description: initialJob?.description || form.requirements?.trim() || '',
      socialLinks,
      email: socialLinks || undefined,
      whatsapp: whatsappFromSocialLinks(socialLinks),
      image: image ? (image.file ? cover : image.preview) : undefined,
      images: image ? [image.file ? cover || '' : image.preview] : [],
    };
    try {
      await onSubmit(draft, {
        imageFile: image?.file,
        removeImage: Boolean(initialJob?.image && !image),
      });
      toast('success', mode === 'edit' ? 'تم حفظ تعديلات الوظيفة' : 'تم إرسال الوظيفة بنجاح وهي الآن بانتظار موافقة الإدارة');
      onClose();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : mode === 'edit' ? 'تعذر حفظ تعديلات الوظيفة.' : 'تعذر إرسال الوظيفة. حاول مجدداً.');
    } finally {
      setSaving(false);
    }
  };

  const title = mode === 'edit' ? 'تعديل الوظيفة' : 'نشر فرصة عمل';

  return <div className="fixed inset-0 z-[110] flex min-w-0 items-end justify-center bg-black/65 sm:items-center sm:p-4" role="presentation">
    <section role="dialog" aria-modal="true" aria-labelledby="job-form-title" className="flex h-[100dvh] w-full min-w-0 flex-col overflow-hidden bg-[var(--surface-elevated)] shadow-2xl sm:max-h-[92dvh] sm:max-w-2xl sm:rounded-3xl">
      <header className="flex min-w-0 shrink-0 items-center justify-between gap-2 border-b border-[var(--border)] px-3 py-3.5 sm:px-6 sm:py-4">
        <div className="flex min-w-0 items-center gap-2 sm:gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--accent-primary)] text-white"><BriefcaseBusiness /></span><div className="min-w-0"><h2 id="job-form-title" className="text-lg font-black text-[var(--text-primary)] sm:text-xl">{title}</h2><p className="text-xs font-bold text-[var(--text-muted)]">{mode === 'edit' ? 'حدّث بيانات الوظيفة' : 'ستُراجع الوظيفة قبل ظهورها للعامة'}</p></div></div>
        <button type="button" onClick={onClose} disabled={saving} aria-label="إغلاق" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[var(--border)] text-[var(--text-primary)] hover:bg-[var(--bg-secondary)] disabled:opacity-50"><X /></button>
      </header>

      <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
        <div className="flex-1 space-y-4 overflow-y-auto overscroll-contain px-4 py-5 sm:px-6">
          <Field label="عنوان الوظيفة" required><input required value={form.title} onChange={event => patch('title', event.target.value)} className={inputClass} placeholder="مثال: محاسب" /></Field>
          <Field label="المهنة / الاختصاص" required><input required value={form.specialty} onChange={event => patch('specialty', event.target.value)} className={inputClass} placeholder="مثال: محاسبة، مبيعات، طبخ" /></Field>
          <Field label="متطلبات الوظيفة" required><textarea required value={form.requirements || ''} onChange={event => patch('requirements', event.target.value)} className={`${inputClass} min-h-24 resize-y leading-7`} placeholder="اكتب كل متطلب في سطر مستقل" /></Field>
          <Field label="مواقع التواصل"><textarea value={form.socialLinks || ''} onChange={event => patch('socialLinks', event.target.value)} className={`${inputClass} min-h-20 resize-y leading-7`} placeholder="أضف روابط التواصل، رابطاً في كل سطر" /></Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="المحافظة" required><input required value={form.governorate} onChange={event => patch('governorate', event.target.value)} className={inputClass} /></Field>
            <Field label="المنطقة" required><input required value={form.area} onChange={event => patch('area', event.target.value)} className={inputClass} /></Field>
          </div>
          <Field label="رقم الهاتف" required><div className="relative"><Phone className="absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]" /><input required type="tel" dir="ltr" minLength={7} value={form.phone} onChange={event => patch('phone', event.target.value)} className={`${inputClass} pr-10 text-left`} placeholder="07X XXXX XXXX" /></div></Field>
          <Field label="نوع الوظيفة" required><select required value={form.employmentType} onChange={event => patch('employmentType', event.target.value as EmploymentType)} className={inputClass}>{employmentTypes.map(type => <option key={type} value={type}>{type === 'كامل' ? 'دوام كامل' : type === 'جزئي' ? 'دوام جزئي' : type}</option>)}</select></Field>
          <Field label="الراتب (اختياري)"><input value={form.salary || ''} onChange={event => patch('salary', event.target.value)} className={inputClass} placeholder="مثال: 750,000 دينار" /></Field>
          <Field label="الخبرة (اختياري)"><input value={form.experience || ''} onChange={event => patch('experience', event.target.value)} className={inputClass} placeholder="مثال: سنتان" /></Field>
          <Field label="صورة الوظيفة / صورة الشركة (صورة واحدة)">
            <div className="space-y-3">
              {image ? <div className="relative aspect-[16/9] max-h-64 overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--bg-secondary)]">
                <img src={image.preview} alt="معاينة صورة الوظيفة" className="h-full w-full object-cover" />
                <button type="button" onClick={removeImage} disabled={saving} aria-label="حذف الصورة" className="absolute left-2 top-2 flex h-10 w-10 items-center justify-center rounded-full bg-black/65 text-white"><Trash2 className="h-4 w-4" /></button>
              </div> : null}
              <button type="button" onClick={() => imageInput.current?.click()} disabled={saving} className="flex min-h-16 w-full items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-[var(--accent-primary)] bg-[var(--accent-soft)] p-4 font-black text-[var(--accent-primary)] disabled:opacity-50"><Upload className="h-5 w-5" />{image ? 'استبدال الصورة' : 'اختيار صورة'}<ImagePlus className="h-5 w-5" /></button>
              <input ref={imageInput} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" aria-label="اختيار صورة الوظيفة" onChange={event => { chooseImage(event.target.files?.[0]); event.target.value = ''; }} />
            </div>
          </Field>
          {categories.length > 0 ? <Field label="قسم الوظائف" required={!initialJob}><select required={!initialJob} value={form.categoryId || ''} onChange={event => patch('categoryId', Number(event.target.value) || undefined)} className={inputClass}><option value="">{initialJob ? 'بدون قسم' : 'اختر القسم'}</option>{initialJob?.categoryId && !categories.some(category => category.id === initialJob.categoryId) ? <option value={initialJob.categoryId}>{initialJob.categoryName || 'القسم الحالي'}</option> : null}{categories.map(category => <option key={category.id} value={category.id}>{category.name}</option>)}</select></Field> : null}
        </div>

        <footer className="shrink-0 border-t border-[var(--border)] bg-[var(--surface-elevated)] px-4 py-3 sm:px-6 sm:py-4">
          {error ? <p role="alert" className="mb-3 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm font-bold text-red-500">{error}</p> : null}
          <div className="flex gap-3"><button type="button" onClick={onClose} disabled={saving} className="flex-1 rounded-xl border border-[var(--border)] px-4 py-3 font-black text-[var(--text-primary)] disabled:opacity-50">إلغاء</button><button type="submit" disabled={saving} className="flex-[2] rounded-xl bg-[var(--accent-primary)] px-4 py-3 font-black text-white disabled:opacity-50">{saving ? 'جارٍ الحفظ…' : <span className="flex items-center justify-center gap-2"><Send className="h-4 w-4" />{mode === 'edit' ? 'حفظ التعديلات' : 'إرسال للمراجعة'}</span>}</button></div>
        </footer>
      </form>
    </section>
  </div>;
}
