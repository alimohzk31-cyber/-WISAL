import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  ArrowDown, ArrowUp, ChevronDown, Copy, GripVertical, Image as ImageIcon,
  Images, Link2, Palette, Pencil, Play, Plus, RefreshCw, Save, SlidersHorizontal,
  Square, Timer, Trash2, Upload, X,
} from 'lucide-react';
import { uploadSliderImageWithProgress } from '../../../hooks/useSlider';
import SafeImage from '../../../components/SafeImage';
import { useToast } from '../../../components/ToastProvider';
import {
  deleteJobSlide, duplicateJobSlide, loadJobSliderSettings, loadJobSlides,
  restartJobSlideRun, reorderJobSlide, reorderJobSlides, saveJobSlide,
  saveJobSliderSettings, setJobSlideVisible,
} from './jobAdminApi';
import type { JobSlide, JobSliderSettings } from './jobAdminApi';
import {
  durationToMs, formatCountdown, formatDurationLabel, getJobSlideStatus,
  getSlideRemainingMs, JOB_DURATION_OPTIONS, JOB_SLIDE_DEFAULTS, JOB_SLIDER_SETTINGS_DEFAULTS,
  JOB_STATUS_META, LINK_TYPE_OPTIONS, SLIDE_HEIGHT_CLASSES, SLIDE_RADIUS_CLASSES,
  suggestButtonText,
} from '../jobSlideMeta';
import type {
  JobCornerRadius, JobImageFit, JobLinkType, JobMobileHeight, JobRunMode,
  JobSizeLevel, JobTextPosition, JobTextVertical,
} from '../jobSlideMeta';
import JobSlideView from '../JobSlideView';

// ============================================================================
// لوحة إدارة سلايدر الوظائف — الإدارة > الوظائف > السلايدر
// ----------------------------------------------------------------------------
// نظام "مدة تشغيل السلايدر": تشغيل دائم أو تشغيل لمدة (ساعة:دقيقة:ثانية)
// مع عد تنازلي حقيقي محفوظ في قاعدة البيانات (run_started_at / run_ends_at)
// ============================================================================

type JobSlideDraft = Omit<JobSlide, 'id'> & { id?: number };
type StatusFilter = 'all' | 'active' | 'stopped' | 'expired';

function emptyDraft(sortOrder: number): JobSlideDraft {
  return { ...JOB_SLIDE_DEFAULTS, title: '', imageUrl: '', sortOrder, isVisible: true, id: undefined };
}

function draftFromSlide(slide: JobSlide): JobSlideDraft {
  return { ...slide };
}

function slideFromDraft(draft: JobSlideDraft): JobSlide {
  return { ...draft, id: draft.id ?? 0 };
}

const inputCls = 'w-full rounded-xl border border-[var(--input-border)] bg-[var(--input-bg)] px-3.5 py-2.5 text-sm font-bold text-[var(--text-primary)] outline-none transition-colors focus:border-[var(--accent-primary)]';

// ============================================================================
// مكوّنات واجهة صغيرة
// ============================================================================
function SectionHeader({ icon, text, hint }: { icon: ReactNode; text: string; hint?: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[var(--accent-primary)]/15 text-[var(--accent-primary)]">{icon}</div>
      <div>
        <h4 className="text-sm font-black text-[var(--text-primary)]">{text}</h4>
        {hint ? <p className="text-[11px] font-bold text-[var(--text-muted)]">{hint}</p> : null}
      </div>
    </div>
  );
}

function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <div className="block space-y-1.5">
      <span className="text-xs font-bold text-[var(--text-secondary)]">{label}</span>
      {children}
      {hint ? <span className="block text-[11px] font-bold text-[var(--text-muted)]">{hint}</span> : null}
    </div>
  );
}

function Seg<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: { value: T; label: string }[] }) {
  return (
    <div className="grid gap-1.5 rounded-xl bg-[var(--bg-secondary)] p-1.5" style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0,1fr))` }}>
      {options.map(opt => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={`rounded-lg px-2 py-2 text-xs font-bold transition-colors ${value === opt.value ? 'bg-[var(--accent-primary)] text-white shadow-sm' : 'text-[var(--text-secondary)] hover:bg-[var(--surface-elevated)]'}`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

function Toggle({ checked, onChange, label, hint }: { checked: boolean; onChange: (v: boolean) => void; label: string; hint?: string }) {
  return (
    <button type="button" onClick={() => onChange(!checked)} className="flex min-w-0 items-center justify-between gap-3 rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)] px-3.5 py-2.5 text-start transition-colors hover:border-[var(--accent-primary)]/40">
      <span>
        <span className="block text-xs font-bold text-[var(--text-primary)]">{label}</span>
        {hint ? <span className="block text-[11px] font-bold text-[var(--text-muted)]">{hint}</span> : null}
      </span>
      <span className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${checked ? 'bg-emerald-500' : 'bg-[var(--border)]'}`}>
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${checked ? 'right-0.5' : 'right-[1.375rem]'}`} />
      </span>
    </button>
  );
}

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-1.5">
      <span className="text-xs font-bold text-[var(--text-secondary)]">{label}</span>
      <div className="flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)] p-1.5 pe-3">
        <input type="color" value={value} onChange={e => onChange(e.target.value)} className="h-8 w-10 cursor-pointer rounded-lg border-0 bg-transparent p-0" aria-label={label} />
        <span className="font-mono text-xs font-bold text-[var(--text-secondary)]">{value.toUpperCase()}</span>
      </div>
    </div>
  );
}

/** حقل رقمي محدود (ساعة 0-23 / دقيقة 0-59 / ثانية 0-59) */
function TimePart({ label, value, max, onChange }: { label: string; value: number; max: number; onChange: (v: number) => void }) {
  const clamp = (n: number) => Math.min(max, Math.max(0, n));
  return (
    <div className="space-y-1.5">
      <span className="block text-center text-[11px] font-bold text-[var(--text-muted)]">{label}</span>
      <div className="flex items-center gap-1">
        <button type="button" onClick={() => onChange(clamp(value - 1))} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--bg-secondary)] text-sm font-black text-[var(--text-secondary)] hover:bg-[var(--accent-primary)]/10">−</button>
        <input
          type="number" min={0} max={max} value={String(value).padStart(2, '0')} dir="ltr"
          onChange={e => onChange(clamp(Number(e.target.value) || 0))}
          className="h-8 w-full rounded-lg border border-[var(--input-border)] bg-[var(--input-bg)] text-center font-mono text-sm font-black tabular-nums text-[var(--text-primary)] outline-none focus:border-[var(--accent-primary)]"
        />
        <button type="button" onClick={() => onChange(clamp(value + 1))} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--bg-secondary)] text-sm font-black text-[var(--text-secondary)] hover:bg-[var(--accent-primary)]/10">+</button>
      </div>
    </div>
  );
}

export default function JobSlidesAdmin() {
  const toast = useToast();
  const [slides, setSlides] = useState<JobSlide[]>([]);
  const [settings, setSettings] = useState<JobSliderSettings>(JOB_SLIDER_SETTINGS_DEFAULTS);
  const [draft, setDraft] = useState<JobSlideDraft | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const locked = useRef(false);
  const initialRead = useRef<Promise<[JobSlide[], JobSliderSettings]> | null>(null);

  useEffect(() => {
    let active = true;
    initialRead.current ??= Promise.all([loadJobSlides(), loadJobSliderSettings()]);
    void initialRead.current.then(([items, config]) => {
      if (active) { setSlides(items); setSettings(config); }
    }).catch(reason => { if (active) setError(reason?.message || 'تعذر تحميل السلايدر'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const perform = async (action: () => Promise<void>) => {
    if (locked.current) return;
    locked.current = true; setBusy(true); setError('');
    try { await action(); }
    catch (reason: any) { setError(reason?.message || 'تعذر إتمام العملية'); toast('error', reason?.message || 'تعذر إتمام العملية'); }
    finally { locked.current = false; setBusy(false); }
  };
  const refresh = () => perform(async () => {
    const [items, config] = await Promise.all([loadJobSlides(), loadJobSliderSettings()]);
    setSlides(items); setSettings(config);
  });
  const patchDraft = (patch: Partial<JobSlideDraft>) => setDraft(previous => previous ? { ...previous, ...patch } : previous);
  const replaceSlide = (saved: JobSlide) => setSlides(previous => [...previous.filter(item => item.id !== saved.id), saved].sort((a, b) => a.sortOrder - b.sortOrder));
  const move = (index: number, direction: number) => perform(async () => {
    const next = [...slides];
    const target = index + direction;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    try {
      await reorderJobSlides(next.map(slide => slide.id));
      setSlides(next.map((slide, position) => ({ ...slide, sortOrder: position + 1 })));
    } catch (reason) {
      setSlides(await loadJobSlides());
      throw reason;
    }
  });
  const save = () => perform(async () => {
    if (!draft) return;
    if (!draft.title.trim() || !draft.imageUrl.trim()) throw new Error('أدخل العنوان وصورة السلايد');
    if (draft.runMode === 'timed' && durationToMs(draft.durationHours, draft.durationMinutes, draft.durationSeconds) <= 0) throw new Error('حدد مدة تشغيل أكبر من صفر');
    if (draft.linkType === 'external' && !/^https?:\/\//i.test(draft.linkValue)) throw new Error('أدخل رابطًا يبدأ بـ https:// أو http://');
    const original = slides.find(item => item.id === draft.id);
    const restartRun = !original || original.runMode !== draft.runMode || original.durationHours !== draft.durationHours || original.durationMinutes !== draft.durationMinutes || original.durationSeconds !== draft.durationSeconds;
    replaceSlide(await saveJobSlide(draft, { restartRun }));
    setDraft(null); toast('success', 'تم حفظ السلايد');
  });
  const upload = (file: File) => perform(async () => {
    if (!file.type.startsWith('image/')) throw new Error('اختر ملف صورة');
    setUploadProgress(0);
    try { patchDraft({ imageUrl: await uploadSliderImageWithProgress(file, setUploadProgress) }); }
    finally { setUploadProgress(null); }
  });

  return <section dir="rtl" className="min-w-0 space-y-5">
    <div className="flex min-w-0 flex-wrap items-center justify-between gap-3">
      <SectionHeader icon={<Images className="h-5 w-5" />} text="سلايدر الوظائف" />
      <div className="flex min-w-0 flex-wrap gap-2">
        <button type="button" disabled={busy || loading} onClick={refresh} className={inputCls}>تحديث</button>
        <button type="button" disabled={busy || loading} onClick={() => setDraft(emptyDraft(Math.max(0, ...slides.map(item => item.sortOrder)) + 1))} className={inputCls}>إضافة سلايد</button>
      </div>
    </div>
    {error && <p role="alert" className="rounded-xl bg-red-500/10 p-3 text-red-600">{error}</p>}
    {loading && <p role="status">جارٍ تحميل السلايدر…</p>}
    <details className="rounded-2xl border border-[var(--border)] p-4">
      <summary className="cursor-pointer font-bold text-[var(--text-primary)]">إعدادات العرض</summary>
      <fieldset disabled={busy || loading} className="mt-4 grid gap-3 sm:grid-cols-2">
        <Toggle label="التشغيل التلقائي" checked={settings.autoplay} onChange={autoplay => setSettings(previous => ({ ...previous, autoplay }))} />
        <Toggle label="تكرار السلايدر" checked={settings.loop} onChange={loop => setSettings(previous => ({ ...previous, loop }))} />
        <Toggle label="السحب باللمس" checked={settings.touchDrag} onChange={touchDrag => setSettings(previous => ({ ...previous, touchDrag }))} />
        <Field label="مدة عرض الشريحة">
          <select aria-label="مدة عرض الشريحة" className={inputCls} value={settings.durationSeconds} onChange={event => setSettings(previous => ({ ...previous, durationSeconds: Number(event.target.value) }))}>
            {JOB_DURATION_OPTIONS.map(value => <option key={value} value={value}>{value} ثوانٍ</option>)}
          </select>
        </Field>
        <Field label="ارتفاع السلايدر على الهاتف">
          <select aria-label="ارتفاع السلايدر على الهاتف" className={inputCls} value={settings.mobileHeight} onChange={event => setSettings(previous => ({ ...previous, mobileHeight: event.target.value as JobMobileHeight }))}>
            <option value="short">قصير</option><option value="medium">متوسط</option><option value="tall">طويل</option>
          </select>
        </Field>
        <button type="button" className={inputCls} onClick={() => perform(async () => { setSettings(await saveJobSliderSettings(settings)); toast('success', 'تم حفظ الإعدادات'); })}>حفظ الإعدادات</button>
      </fieldset>
    </details>
    {!loading && !slides.length && !error && <p className="text-[var(--text-muted)]">لا توجد سلايدات بعد.</p>}
    <div className="grid min-w-0 gap-4 sm:grid-cols-2">
      {slides.map((slide, index) => <article key={slide.id} className="min-w-0 overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--card)]">
        <div className="relative h-48"><JobSlideView slide={slide} interactive={false} /></div>
        <div className="space-y-3 p-3">
          <p className="break-words font-bold text-[var(--text-primary)]">{slide.title} <span className={JOB_STATUS_META[getJobSlideStatus(slide)].cls}>{JOB_STATUS_META[getJobSlideStatus(slide)].label}</span></p>
          {slide.runMode === 'timed' && slide.runEndsAt && <p className="text-xs text-[var(--text-muted)]">نهاية التشغيل: {new Date(slide.runEndsAt).toLocaleString('ar-IQ')}</p>}
          <fieldset disabled={busy} className="flex flex-wrap gap-2 text-sm font-bold text-[var(--text-primary)]">
            <button type="button" onClick={() => setDraft(draftFromSlide(slide))}>تعديل</button>
            <button type="button" onClick={() => perform(async () => replaceSlide(await setJobSlideVisible(slide, !slide.isVisible)))}>{slide.isVisible ? 'إيقاف' : 'تشغيل'}</button>
            {slide.runMode === 'timed' && <button type="button" onClick={() => perform(async () => replaceSlide(await restartJobSlideRun(slide)))}>إعادة تشغيل المدة</button>}
            <button type="button" onClick={() => perform(async () => replaceSlide(await duplicateJobSlide(slide)))}>نسخ</button>
            <button type="button" disabled={index === 0} aria-label={`رفع ${slide.title}`} onClick={() => move(index, -1)}><ArrowUp className="h-4 w-4" /></button>
            <button type="button" disabled={index === slides.length - 1} aria-label={`خفض ${slide.title}`} onClick={() => move(index, 1)}><ArrowDown className="h-4 w-4" /></button>
            <button type="button" className="text-red-500" onClick={() => { if (window.confirm(`حذف السلايد «${slide.title}»؟`)) void perform(async () => { await deleteJobSlide(slide.id); setSlides(previous => previous.filter(item => item.id !== slide.id)); }); }}>حذف</button>
          </fieldset>
        </div>
      </article>)}
    </div>
    {draft && <form onSubmit={event => { event.preventDefault(); void save(); }} className="min-w-0 space-y-4 rounded-2xl border border-[var(--border)] bg-[var(--card)] p-3 sm:p-4">
      <h3 className="font-black text-[var(--text-primary)]">{draft.id ? 'تعديل السلايد' : 'سلايد جديد'}</h3>
      <fieldset disabled={busy} className="grid gap-4 sm:grid-cols-2">
        <Field label="العنوان"><input aria-label="عنوان السلايد" required className={inputCls} value={draft.title} onChange={event => patchDraft({ title: event.target.value })} /></Field>
        <Field label="الوصف"><textarea aria-label="وصف السلايد" className={inputCls} value={draft.subtitle} onChange={event => patchDraft({ subtitle: event.target.value })} /></Field>
        <Field label="رابط الصورة"><input aria-label="رابط صورة السلايد" required className={inputCls} value={draft.imageUrl} onChange={event => patchDraft({ imageUrl: event.target.value })} /></Field>
        <Field label="رفع صورة"><input aria-label="رفع صورة السلايد" type="file" accept="image/*" onChange={event => { const file = event.target.files?.[0]; if (file) void upload(file); event.target.value = ''; }} /></Field>
        <Field label="نوع الرابط"><select aria-label="نوع الرابط" className={inputCls} value={draft.linkType} onChange={event => patchDraft({ linkType: event.target.value as JobLinkType })}>{LINK_TYPE_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select></Field>
        <Field label="وجهة الرابط"><input aria-label="وجهة الرابط" className={inputCls} value={draft.linkValue} onChange={event => patchDraft({ linkValue: event.target.value })} /></Field>
        <Field label="نص الزر"><input aria-label="نص الزر" className={inputCls} value={draft.buttonText} onChange={event => patchDraft({ buttonText: event.target.value })} /></Field>
        <Toggle label="السلايد مفعّل" checked={draft.isVisible} onChange={isVisible => patchDraft({ isVisible })} />
        <Field label="مدة التشغيل"><Seg value={draft.runMode} options={[{ value: 'always', label: 'دائم' }, { value: 'timed', label: 'لمدة محددة' }]} onChange={runMode => patchDraft({ runMode })} /></Field>
        {draft.runMode === 'timed' && <div className="grid min-w-0 grid-cols-1 gap-2 min-[420px]:grid-cols-3">
          <TimePart label="ساعة" max={999} value={draft.durationHours} onChange={durationHours => patchDraft({ durationHours })} />
          <TimePart label="دقيقة" max={59} value={draft.durationMinutes} onChange={durationMinutes => patchDraft({ durationMinutes })} />
          <TimePart label="ثانية" max={59} value={draft.durationSeconds} onChange={durationSeconds => patchDraft({ durationSeconds })} />
        </div>}
        <Field label="موضع النص"><select aria-label="موضع النص" className={inputCls} value={draft.textPosition} onChange={event => patchDraft({ textPosition: event.target.value as JobTextPosition })}><option value="right">يمين</option><option value="center">وسط</option><option value="left">يسار</option></select></Field>
        <Field label="محاذاة النص عموديًا"><select aria-label="محاذاة النص عموديًا" className={inputCls} value={draft.textVertical} onChange={event => patchDraft({ textVertical: event.target.value as JobTextVertical })}><option value="top">أعلى</option><option value="middle">وسط</option><option value="bottom">أسفل</option></select></Field>
        {(['titleSize', 'subtitleSize'] as const).map(key => <Field key={key} label={key === 'titleSize' ? 'حجم العنوان' : 'حجم الوصف'}><select aria-label={key === 'titleSize' ? 'حجم العنوان' : 'حجم الوصف'} className={inputCls} value={draft[key]} onChange={event => patchDraft({ [key]: event.target.value as JobSizeLevel })}><option value="small">صغير</option><option value="medium">متوسط</option><option value="large">كبير</option></select></Field>)}
        <ColorField label="لون النص" value={draft.textColor} onChange={textColor => patchDraft({ textColor })} />
        <ColorField label="لون الزر" value={draft.buttonColor} onChange={buttonColor => patchDraft({ buttonColor })} />
        <ColorField label="لون نص الزر" value={draft.buttonTextColor} onChange={buttonTextColor => patchDraft({ buttonTextColor })} />
        <Field label="عرض الصورة"><select aria-label="عرض الصورة" className={inputCls} value={draft.imageFit} onChange={event => patchDraft({ imageFit: event.target.value as JobImageFit })}><option value="cover">ملء المساحة</option><option value="contain">الصورة كاملة</option></select></Field>
        {([{ key: 'showTitle', label: 'إظهار العنوان' }, { key: 'showDescription', label: 'إظهار الوصف' }, { key: 'showButton', label: 'إظهار الزر' }, { key: 'showDots', label: 'إظهار النقاط' }, { key: 'overlayEnabled', label: 'تغميق الصورة' }] as const).map(({ key, label }) => <Toggle key={key} label={label} checked={draft[key]} onChange={value => patchDraft({ [key]: value })} />)}
        <Field label="درجة التغميق"><input aria-label="درجة التغميق" type="range" min={0} max={0.9} step={0.05} value={draft.overlayOpacity} onChange={event => patchDraft({ overlayOpacity: Number(event.target.value) })} /></Field>
      </fieldset>
      {uploadProgress !== null && <p role="status">رفع الصورة: {uploadProgress}%</p>}
      <div className="relative h-64 overflow-hidden rounded-2xl"><JobSlideView slide={slideFromDraft(draft)} interactive={false} /></div>
      <div className="flex min-w-0 flex-col gap-3 min-[360px]:flex-row"><button type="submit" disabled={busy} className={inputCls}>حفظ السلايد</button><button type="button" disabled={busy} className={inputCls} onClick={() => setDraft(null)}>إلغاء</button></div>
    </form>}
  </section>;
}
