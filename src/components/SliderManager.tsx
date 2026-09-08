import { useState, useRef, useEffect, useMemo, useCallback, type ReactNode } from 'react';
import {
  useSlider, SliderAd, getAdStatus, formatTimeArabic, uploadSliderImageWithProgress,
  AdStatus, getSlideDuration,
  MIN_SLIDE_DURATION_SECONDS, MAX_SLIDE_DURATION_SECONDS, DEFAULT_SLIDE_DURATION_SECONDS
} from '../hooks/useSlider';
import {
  Plus, Trash2, Edit, X, Image as ImageIcon, Eye, Power, Calendar,
  ChevronDown, ChevronLeft, ChevronRight, Upload, CheckCircle2, AlertCircle,
  GripVertical, Link as LinkIcon, Type as TypeIcon, ListOrdered, Timer,
  Palette, Save, RotateCcw, RefreshCw, Languages,
  AlignStartVertical, AlignHorizontalJustifyStart,
  ArrowRight, Film, Play
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { SafeImage } from './SafeImage';

// ==============================
// أنواع ومساعدو النموذج
// ==============================
interface SlideDraft {
  id?: number;
  title: string;
  subtitle: string;
  button_text: string;
  button_link: string;
  duration_seconds: number;
  sort_order: number;
  language: string;
  font_family: string;
  font_size: number;
  text_color: string;
  button_color: string;
  text_position: 'top' | 'middle' | 'bottom';
  text_align: 'right' | 'center' | 'left';
  display_date: string;
  start_hour: number; // 0-23
  start_minute: number; // 0-59
  start_second: number; // 0-59
  end_hour: number; // 0-23
  end_minute: number; // 0-59
  end_second: number; // 0-59
  images: string[];
  is_active: boolean;
}

interface ToastItem {
  id: number;
  type: 'success' | 'error';
  message: string;
}

const FONT_OPTIONS = ['Cairo', 'Tahoma', 'Arial', 'Segoe UI', 'Georgia', 'Times New Roman'];
const FONT_SIZE_OPTIONS = [16, 18, 20, 24, 28, 32, 36, 42, 48];


/** عنوان قسم داخل نموذج الشريحة — يفصل الإعدادات إلى مجموعات واضحة */
function SectionHeader({ icon, text, desc }: { icon: ReactNode; text: string; desc?: string }) {
  return (
    <div className="flex items-center gap-2.5 pb-1">
      <div className="w-8 h-8 rounded-xl bg-[var(--accent-primary)]/15 text-[var(--accent-primary)] flex items-center justify-center shrink-0">
        {icon}
      </div>
      <div>
        <h4 className="text-sm font-bold text-[var(--text-primary)]">{text}</h4>
        {desc ? <p className="text-[11px] text-[var(--text-muted)] font-bold">{desc}</p> : null}
      </div>
    </div>
  );
}

function draftFromAd(ad: SliderAd): SlideDraft {
  return {
    id: ad.id,
    title: ad.title || '',
    subtitle: ad.subtitle || '',
    button_text: ad.button_text || '',
    button_link: ad.button_link || '',
    duration_seconds: getSlideDuration(ad),
    sort_order: Number(ad.sort_order) || 1,
    language: ad.language || 'ar',
    font_family: ad.font_family || 'Cairo',
    font_size: Number(ad.font_size) || 28,
    text_color: ad.text_color || '#FFFFFF',
    button_color: ad.button_color || '#7C3AED',
    text_position: ad.text_position || 'bottom',
    text_align: ad.text_align || 'center',
    display_date: ad.display_date || new Date().toISOString().split('T')[0],
    // normalizeAd يحوّل أوقات النظام القديم (12 ساعة) إلى 24 ساعة مسبقاً؛
    // القيم الافتراضية عند غياب أي وقت محفوظ = 00:00:00 (بدون أي auto-fill).
    start_hour: ad.start_hour ?? 0,
    start_minute: ad.start_minute ?? 0,
    start_second: ad.start_second ?? 0,
    end_hour: ad.end_hour ?? 0,
    end_minute: ad.end_minute ?? 0,
    end_second: ad.end_second ?? 0,
    images: [...(ad.images || [])],
    is_active: ad.is_active !== false
  };
}

function emptyDraft(sortOrder: number): SlideDraft {
  return {
    title: '',
    subtitle: '',
    button_text: '',
    button_link: '',
    duration_seconds: DEFAULT_SLIDE_DURATION_SECONDS,
    sort_order: sortOrder,
    language: 'ar',
    font_family: 'Cairo',
    font_size: 28,
    text_color: '#FFFFFF',
    button_color: '#7C3AED',
    text_position: 'bottom',
    text_align: 'center',
    display_date: new Date().toISOString().split('T')[0],
    // القيمة الافتراضية لأي شريحة جديدة: 00:00:00 (وليس وقت الجهاز أو أي قيمة أخرى)
    start_hour: 0,
    start_minute: 0,
    start_second: 0,
    end_hour: 0,
    end_minute: 0,
    end_second: 0,
    images: [],
    is_active: true
  };
}

/** معرف الشريحة الجديدة (غير المحفوظة) في قائمة المعاينة */
const DRAFT_NEW_PREVIEW_ID = -1;

/** يبني كائن شريحة كامل من النموذج الحالي — ليعمل تبويب المعاينة على
 * نفس بيانات الإضافة/التعديل لحظياً (حتى قبل الحفظ) بنفس التنسيقات */
function draftToAd(draft: SlideDraft): SliderAd {
  return {
    id: draft.id ?? DRAFT_NEW_PREVIEW_ID,
    title: draft.title,
    subtitle: draft.subtitle,
    button_text: draft.button_text,
    button_link: draft.button_link,
    duration_seconds: draft.duration_seconds,
    sort_order: draft.sort_order,
    language: draft.language,
    font_family: draft.font_family,
    font_size: draft.font_size,
    text_color: draft.text_color,
    button_color: draft.button_color,
    text_position: draft.text_position,
    text_align: draft.text_align,
    display_date: draft.display_date,
    start_time: formatTimeArabic(draft.start_hour, draft.start_minute, draft.start_second),
    end_time: formatTimeArabic(draft.end_hour, draft.end_minute, draft.end_second),
    start_hour: draft.start_hour,
    start_minute: draft.start_minute,
    start_second: draft.start_second,
    end_hour: draft.end_hour,
    end_minute: draft.end_minute,
    end_second: draft.end_second,
    images: [...draft.images],
    url: draft.images[0],
    is_active: draft.is_active
  };
}

const STATUS_META: Record<AdStatus, { label: string; cls: string }> = {
  active: { label: 'نشطة', cls: 'bg-emerald-500/15 text-emerald-500 border border-emerald-500/30' },
  upcoming: { label: 'مجدولة', cls: 'bg-blue-500/15 text-blue-400 border border-blue-500/30' },
  expired: { label: 'منتهية', cls: 'bg-gray-500/15 text-gray-400 border border-gray-500/30' },
  disabled: { label: 'معطلة', cls: 'bg-amber-500/15 text-amber-500 border border-amber-500/30' }
};

function StatusBadge({ ad }: { ad: SliderAd }) {
  const meta = STATUS_META[getAdStatus(ad)];
  return <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${meta.cls}`}>{meta.label}</span>;
}

function FieldLabel({ icon, text }: { icon: ReactNode; text: string }) {
  return (
    <span className="text-xs font-bold flex items-center gap-1.5 text-[var(--text-secondary)]">
      <span className="text-[var(--accent-primary)]">{icon}</span> {text}
    </span>
  );
}

/** خطوة رقمية (+ / −) كما في التصميم */
function Stepper({ value, onChange, min, max }: { value: number; onChange: (v: number) => void; min: number; max: number }) {
  const btnCls = 'w-10 h-10 flex items-center justify-center rounded-xl bg-[var(--surface-elevated)] text-[var(--text-secondary)] hover:bg-[var(--accent-light)] hover:text-[var(--accent-primary)] transition-colors text-lg font-bold disabled:opacity-30 disabled:cursor-not-allowed';
  return (
    <div className="flex items-center gap-1.5">
      <button type="button" className={btnCls} disabled={value <= min} onClick={() => onChange(Math.max(min, value - 1))} aria-label="إنقاص">−</button>
      <div className="flex-1 h-10 flex items-center justify-center rounded-xl border bg-[var(--bg-secondary)] border-[var(--border)] text-[var(--text-primary)] font-bold min-w-[56px]">{value}</div>
      <button type="button" className={btnCls} disabled={value >= max} onClick={() => onChange(Math.min(max, value + 1))} aria-label="زيادة">+</button>
    </div>
  );
}

const inputCls = 'w-full rounded-xl border bg-[var(--bg-secondary)] border-[var(--border)] px-3.5 py-2.5 text-sm font-bold text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-primary)] transition-colors';

// مكان النص على الصورة (أعلى/وسط/أسفل) ومحاذاة النص (يمين/وسط/يسار)
export const SLIDE_POSITION_CLASSES: Record<string, string> = {
  top: 'justify-start pt-5 md:pt-7',
  middle: 'justify-center',
  bottom: 'justify-end pb-8 md:pb-12'
};
export const SLIDE_TEXT_ALIGN: Record<string, 'right' | 'center' | 'left'> = {
  right: 'right',
  center: 'center',
  left: 'left'
};


/** عرض الشريحة كما ستظهر فعلياً في الصفحة الرئيسية (نفس التنسيقات) */
function SlideView({ ad }: { ad: SliderAd }) {
  return (
    <div
      dir={ad.language === 'en' ? 'ltr' : 'rtl'}
      className="relative w-full h-full select-none"
      style={{ fontFamily: `'${ad.font_family || 'Cairo'}', Cairo, sans-serif` }}
    >
      <SafeImage
        src={ad.url || ad.images[0] || ''}
        alt={ad.title || 'شريحة'}
        loading="lazy"
        draggable={false}
        className="absolute inset-0 w-full h-full object-cover object-center"
      />
      <div
        className={`absolute inset-0 flex flex-col px-4 pointer-events-none ${SLIDE_POSITION_CLASSES[ad.text_position || 'bottom']}`}
        style={{ textAlign: SLIDE_TEXT_ALIGN[ad.text_align || 'center'] }}
      >
        {ad.title ? (
          <h1
            className="text-2xl md:text-4xl font-bold mb-1.5 drop-shadow-md w-full"
            style={{ color: ad.text_color || '#FFFFFF', fontSize: ad.font_size ? `min(${ad.font_size}px, 6vw)` : undefined }}
          >
            {ad.title}
          </h1>
        ) : null}
        {ad.subtitle ? (
          <p className="text-xs md:text-base font-bold drop-shadow-sm w-full" style={{ color: ad.text_color || '#FFFFFF' }}>
            {ad.subtitle}
          </p>
        ) : null}
        {ad.button_text ? (
          <span
            className="inline-block mt-2.5 px-5 py-2 rounded-xl text-sm md:text-base font-bold text-white shadow-lg pointer-events-auto"
            style={{ backgroundColor: ad.button_color || '#7C3AED' }}
          >
            {ad.button_text}
          </span>
        ) : null}
      </div>
      <span className="absolute top-3 left-3 z-10 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/50 backdrop-blur-sm text-white text-[11px] font-bold" dir="rtl">
        <Timer className="w-3.5 h-3.5" /> {getSlideDuration(ad)} ث
      </span>
    </div>
  );
}

// ==============================
// المكوّن الرئيسي
// ==============================
export default function SliderManager() {
  const { ads, addAd, updateAd, deleteAd, reorderAds, loading, refreshAds } = useSlider();

  // القائمة المعروضة تتبع دائماً الترتيب المحفوظ في Supabase (sort_order)
  const sortedAds = useMemo(
    () => [...ads].sort((a, b) => ((a.sort_order ?? 0) - (b.sort_order ?? 0)) || (Number(a.id) - Number(b.id))),
    [ads]
  );

  // واجهة القسم الحالي: home (الرئيسية بقسمين) | add (إضافة/تعديل شريحة) | list (معاينة الشرائح)
  const [view, setView] = useState<'home' | 'add' | 'list'>('home');
  // نافذة معاينة السلايدر كاملاً (تشغيل تلقائي بمدد العرض الحقيقية)
  const [fullPreviewOpen, setFullPreviewOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<number | 'new' | null>(null);
  const [draft, setDraft] = useState<SlideDraft | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [fileDrag, setFileDrag] = useState(false);
  const [previewAd, setPreviewAd] = useState<SliderAd | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<SliderAd | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [schedulingOpen, setSchedulingOpen] = useState(false);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [liveIndex, setLiveIndex] = useState(0);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const dragIndexRef = useRef<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const toastIdRef = useRef(0);

  // Toast خفيف بدون أي مكتبة خارجية (يُنظَّف تلقائياً)
  const pushToast = useCallback((type: ToastItem['type'], message: string) => {
    const id = ++toastIdRef.current;
    setToasts(prev => [...prev.slice(-2), { id, type, message }]);
    window.setTimeout(() => setToasts(prev => prev.filter(x => x.id !== id)), 4000);
  }, []);

  // تحديث حالات العرض (نشطة/منتهية) كل دقيقة — لا re-render كل ثانية
  const [, setTick] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setTick(v => v + 1), 60000);
    return () => clearInterval(timer);
  }, []);

  const selectSlide = useCallback((ad: SliderAd) => {
    setSelectedId(ad.id);
    setDraft(draftFromAd(ad));
    setView('add');
  }, []);

  const openNewSlide = useCallback(() => {
    setSelectedId('new');
    setDraft(emptyDraft(sortedAds.length + 1));
    setView('add');
  }, [sortedAds.length]);

  // تهيئة النموذج بأول شريحة عند فتح الصفحة — بدون تغيير الواجهة
  // (الواجهة الرئيسية بقسمين تظل معروضة حتى يختار المدير قسماً)
  useEffect(() => {
    if (selectedId === null && sortedAds.length > 0 && !draft) {
      setSelectedId(sortedAds[0].id);
      setDraft(draftFromAd(sortedAds[0]));
    }
  }, [selectedId, sortedAds, draft]);

  // إسقاط التحديد إذا حُذفت الشريحة المحددة (لا تبقى بيانات قديمة ظاهرة)
  useEffect(() => {
    if (typeof selectedId === 'number' && !sortedAds.some(a => a.id === selectedId)) {
      setSelectedId(null);
      setDraft(null);
    }
  }, [selectedId, sortedAds]);

  const selectedAd = useMemo(
    () => (typeof selectedId === 'number' ? sortedAds.find(a => a.id === selectedId) ?? null : null),
    [selectedId, sortedAds]
  );

  // هل هناك تعديلات غير محفوظة؟ (زر إعادة التعيين يعتمد عليه)
  const isDirty = useMemo(() => {
    if (!draft) return false;
    if (selectedId === 'new') return true;
    if (!selectedAd) return false;
    return JSON.stringify(draft) !== JSON.stringify(draftFromAd(selectedAd));
  }, [draft, selectedId, selectedAd]);

  const setField = useCallback(<K extends keyof SlideDraft>(key: K, value: SlideDraft[K]) => {
    setDraft(prev => (prev ? { ...prev, [key]: value } : prev));
  }, []);

  // ==============================
  // قائمة المعاينة: نفس الشرائح المحفوظة، لكن الشريحة قيد الإضافة/التعديل
  // تُعرض بنسخة النموذج الحية — فتطبيق كل إعدادات الصورة والنص يظهر فوراً
  // في تبويب المعاينة حتى قبل الحفظ، دون أي تغيير في نظام الحفظ نفسه.
  // ==============================
  const previewAds = useMemo<SliderAd[]>(() => {
    if (!draft) return sortedAds;
    if (selectedId === 'new') return [...sortedAds, draftToAd(draft)];
    const idx = sortedAds.findIndex(a => a.id === draft.id);
    if (idx === -1) return sortedAds;
    const next = [...sortedAds];
    next[idx] = draftToAd(draft);
    return next;
  }, [sortedAds, draft, selectedId]);

  // هل الشريحة المعروضة حالياً في المعاينة هي نسخة النموذج (تعديلات غير محفوظة)؟
  const previewingDraft = useMemo(() => {
    if (!draft) return false;
    const targetId = selectedId === 'new' ? DRAFT_NEW_PREVIEW_ID : draft.id;
    return previewAds[liveIndex]?.id === targetId;
  }, [draft, selectedId, previewAds, liveIndex]);

  // ==============================
  // مؤقت نافذة معاينة السلايدر كاملاً: setTimeout لكل شريحة بمدتها الحقيقية
  // (لا interval) ويُنظَّف تلقائياً عند إغلاق النافذة/مغادرة الصفحة
  // ==============================
  // عند فتح النافذة: ابدأ من الشريحة المحددة حالياً (أو الأولى)؛
  // وعند الإغلاق يُعاد الفهرس إلى البداية
  useEffect(() => {
    if (!fullPreviewOpen) {
      setLiveIndex(0);
      return;
    }
    const targetId = draft ? (selectedId === 'new' ? DRAFT_NEW_PREVIEW_ID : draft.id) : null;
    const idx = targetId !== null ? previewAds.findIndex(a => a.id === targetId) : -1;
    setLiveIndex(idx >= 0 ? idx : 0);
    // يعمل فقط عند فتح/إغلاق النافذة — بقية القيم تُقرأ لحظة التنفيذ
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fullPreviewOpen]);

  useEffect(() => {
    if (!fullPreviewOpen || previewAds.length === 0) return;
    if (liveIndex >= previewAds.length) { setLiveIndex(0); return; }
    if (previewAds.length <= 1) return;
    const ms = getSlideDuration(previewAds[liveIndex]) * 1000;
    const timer = setTimeout(() => setLiveIndex(i => (i + 1) % previewAds.length), ms);
    return () => clearTimeout(timer);
  }, [fullPreviewOpen, liveIndex, previewAds]);

  // عند فتح قسم الإضافة/التعديل: الانتقال مباشرة في المعاينة إلى الشريحة الجارية
  // (الجاهزة للإنشاء أو التي نعدّلها) لتظهر التعديلات فوراً
  useEffect(() => {
    if (view !== 'add' || selectedId === null || !draft) return;
    const targetId = selectedId === 'new' ? DRAFT_NEW_PREVIEW_ID : draft.id;
    const idx = previewAds.findIndex(a => a.id === targetId);
    if (idx >= 0) setLiveIndex(idx);
    // يعمل فقط عند تغيير القسم/الشريحة المحددة، لا عند كل ضغطة زر
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, selectedId]);


  // ==============================
  // رفع الصور: Progress حقيقي + رسائل نجاح/خطأ + حد 5 صور + 10MB
  // ==============================
  const handleFiles = useCallback(async (fileList: FileList | File[] | null) => {
    if (!fileList) return;
    const files = Array.from(fileList).filter(f => f.type.startsWith('image/'));
    if (files.length === 0) {
      pushToast('error', 'يرجى اختيار صور بصيغة PNG أو JPG أو WebP.');
      return;
    }
    try {
      const uploaded: string[] = [];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (file.size > 10 * 1024 * 1024) {
          throw new Error(`الصورة "${file.name}" أكبر من 10 ميجابايت.`);
        }
        const url = await uploadSliderImageWithProgress(file, (p) => {
          setUploadProgress(Math.min(99, Math.round(((i + p / 100) / files.length) * 100)));
        });
        uploaded.push(url);
      }
      const before = draft?.images.length || 0;
      setDraft(prev => (prev ? { ...prev, images: [...prev.images, ...uploaded].slice(0, 5) } : prev));
      if (before + uploaded.length > 5) {
        pushToast('error', 'الحد الأقصى 5 صور لكل شريحة — تم قبول أول 5 صور فقط.');
      } else {
        pushToast('success', uploaded.length > 1 ? `تم رفع ${uploaded.length} صور بنجاح.` : 'تم رفع الصورة بنجاح.');
      }
    } catch (e: any) {
      pushToast('error', `فشل رفع الصورة: ${e?.message || 'خطأ غير معروف'}`);
    } finally {
      setUploadProgress(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }, [draft?.images.length, pushToast]);

  // ==============================
  // حفظ التغييرات: Loading + منع الضغط المتكرر + Toast نجاح/خطأ
  // ==============================
  const handleSave = useCallback(async () => {
    if (!draft || saving || uploadProgress !== null) return;
    if (!draft.title.trim()) {
      pushToast('error', 'يرجى إدخال العنوان الرئيسي.');
      return;
    }
    if (draft.images.length === 0) {
      pushToast('error', 'يرجى رفع صورة واحدة على الأقل للشريحة.');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        title: draft.title.trim(),
        subtitle: draft.subtitle.trim(),
        button_text: draft.button_text.trim(),
        button_link: draft.button_link.trim(),
        duration_seconds: draft.duration_seconds,
        language: draft.language,
        font_family: draft.font_family,
        font_size: draft.font_size,
        text_color: draft.text_color,
        button_color: draft.button_color,
        display_date: draft.display_date,
        start_time: formatTimeArabic(draft.start_hour, draft.start_minute, draft.start_second),
        end_time: formatTimeArabic(draft.end_hour, draft.end_minute, draft.end_second),
        start_hour: draft.start_hour,
        start_minute: draft.start_minute,
        start_second: draft.start_second,
        end_hour: draft.end_hour,
        end_minute: draft.end_minute,
        end_second: draft.end_second,
        images: draft.images,
        url: draft.images[0],
        is_active: draft.is_active,
        sort_order: draft.sort_order
      };

      if (selectedId === 'new') {
        const inserted = await addAd(payload);
        pushToast('success', 'تمت إضافة الشريحة الجديدة بنجاح.');
        setSelectedId(inserted.id);
        setDraft(draftFromAd(inserted));
        // الانتقال إلى قسم معاينة الشرائح لإظهار الشريحة الجديدة مع القديمة
        setView('list');
      } else if (draft.id) {
        const oldOrder = Number(selectedAd?.sort_order ?? draft.sort_order);
        await updateAd(draft.id, payload);
        // حفظ الترتيب الجديد عند تغيّره من حقل "ترتيب الشريحة"
        if (Number(draft.sort_order) !== oldOrder) {
          const ids = sortedAds.filter(a => a.id !== draft.id).map(a => a.id);
          const target = Math.min(Math.max(1, draft.sort_order), ids.length + 1) - 1;
          ids.splice(target, 0, draft.id);
          await reorderAds(ids);
        }
        pushToast('success', 'تم حفظ التغييرات بنجاح.');
        // العودة إلى قسم معاينة الشرائح بعد الحفظ
        setView('list');
      }
    } catch (e: any) {
      pushToast('error', `تعذر حفظ التغييرات: ${e?.message || 'خطأ غير معروف'}`);
    } finally {
      setSaving(false);
    }
  }, [draft, saving, uploadProgress, selectedId, selectedAd, sortedAds, addAd, updateAd, reorderAds, pushToast]);


  // إعادة تعيين: تعيد النموذج إلى آخر نسخة محفوظة فقط (لا تحذف أي بيانات)
  const handleReset = useCallback(() => {
    if (!draft) return;
    if (selectedId === 'new') {
      setDraft(emptyDraft(sortedAds.length + 1));
    } else if (selectedAd) {
      setDraft(draftFromAd(selectedAd));
    }
    pushToast('success', 'تمت إعادة النموذج إلى آخر نسخة محفوظة.');
  }, [draft, selectedId, selectedAd, sortedAds.length, pushToast]);

  // ==============================
  // إعادة الترتيب (سحب وإفلات) — تُحفظ فوراً في Supabase
  // ==============================
  const applyNewOrder = useCallback(async (next: SliderAd[]) => {
    try {
      await reorderAds(next.map(a => a.id));
      pushToast('success', 'تم حفظ الترتيب الجديد.');
    } catch (e: any) {
      pushToast('error', `تعذر حفظ الترتيب: ${e?.message || 'خطأ غير معروف'}`);
    }
  }, [reorderAds, pushToast]);

  const handleDropReorder = useCallback((targetIndex: number) => {
    const fromIndex = dragIndexRef.current;
    dragIndexRef.current = null;
    setDragOverIndex(null);
    if (fromIndex === null || fromIndex === targetIndex) return;
    const next = [...sortedAds];
    const [moved] = next.splice(fromIndex, 1);
    next.splice(targetIndex, 0, moved);
    applyNewOrder(next);
  }, [sortedAds, applyNewOrder]);

  // ==============================
  // حذف الشريحة: نافذة تأكيد ثم حذف فعلي + تحديث القائمة فوراً
  // ==============================
  const confirmDelete = useCallback(async () => {
    if (!deleteTarget || deleting) return;
    setDeleting(true);
    try {
      await deleteAd(deleteTarget.id);
      pushToast('success', 'تم حذف الشريحة بنجاح.');
      setDeleteTarget(null);
    } catch (e: any) {
      pushToast('error', `تعذر حذف الشريحة: ${e?.message || 'خطأ غير معروف'}`);
    } finally {
      setDeleting(false);
    }
  }, [deleteTarget, deleting, deleteAd, pushToast]);

  return (
    <div className="space-y-5">
      {/* 1) الواجهة الرئيسية — قسمان فقط */}
      {view === 'home' && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-[var(--accent-primary)]/15 text-[var(--accent-primary)] flex items-center justify-center">
                <ImageIcon className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-xl md:text-2xl font-bold text-[var(--text-primary)]">إدارة السلايدر</h2>
                <p className="text-xs text-[var(--text-muted)] font-bold">أضف شريحة جديدة أو استعرض الشرائح الحالية</p>
              </div>
            </div>
            <button
              onClick={() => refreshAds()}
              className="p-2.5 rounded-xl bg-[var(--surface-elevated)] text-[var(--text-secondary)] hover:bg-[var(--accent-light)] hover:text-[var(--accent-primary)] transition-colors"
              title="تحديث البيانات"
            >
              <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {/* بطاقتا القسمين */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <button onClick={openNewSlide} className="group text-right rounded-3xl border border-[var(--border)] bg-[var(--card)] p-7 md:p-8 transition-all hover:border-[var(--accent-primary)] hover:shadow-xl hover:-translate-y-0.5 active:scale-[0.99]">
              <span className="w-14 h-14 rounded-2xl bg-[var(--accent-primary)]/15 text-[var(--accent-primary)] flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <Plus className="w-7 h-7" />
              </span>
              <span className="block text-lg md:text-xl font-bold text-[var(--text-primary)]">إضافة شريحة جديدة</span>
              <span className="block text-sm text-[var(--text-muted)] font-bold mt-1.5 leading-relaxed">إنشاء شريحة كاملة: صورة، عنوان، نص، خط، ألوان، موضع، رابط، ومدة عرض — مع معاينة مباشرة قبل الحفظ</span>
              <span className="inline-flex items-center gap-1.5 mt-4 text-sm font-bold text-[var(--accent-primary)]">
                ابدأ الإنشاء <ChevronLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
              </span>
            </button>

            <button onClick={() => setView('list')} className="group text-right rounded-3xl border border-[var(--border)] bg-[var(--card)] p-7 md:p-8 transition-all hover:border-[var(--accent-primary)] hover:shadow-xl hover:-translate-y-0.5 active:scale-[0.99]">
              <span className="w-14 h-14 rounded-2xl bg-[var(--accent-primary)]/15 text-[var(--accent-primary)] flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <Film className="w-7 h-7" />
              </span>
              <span className="block text-lg md:text-xl font-bold text-[var(--text-primary)] flex items-center gap-2.5">
                معاينة الشرائح
                <span className="min-w-[28px] h-7 px-2 inline-flex items-center justify-center rounded-full bg-[var(--accent-primary)]/15 text-[var(--accent-primary)] text-sm font-bold">{sortedAds.length}</span>
              </span>
              <span className="block text-sm text-[var(--text-muted)] font-bold mt-1.5 leading-relaxed">جميع الشرائح الحالية والجديدة: معاينة حقيقية، تعديل، حذف، وإعادة ترتيب بالسحب والإفلات</span>
              <span className="inline-flex items-center gap-1.5 mt-4 text-sm font-bold text-[var(--accent-primary)]">
                استعراض الشرائح <ChevronLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
              </span>
            </button>
          </div>
        </>
      )}

      {/* 2) قسم: إضافة / تعديل شريحة */}
      {view === 'add' && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setView('home')}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[var(--surface-elevated)] text-[var(--text-secondary)] font-bold text-sm hover:bg-[var(--accent-light)] hover:text-[var(--accent-primary)] transition-colors"
              >
                <ArrowRight className="w-4 h-4" /> العودة إلى إدارة السلايدر
              </button>
              <div className="w-11 h-11 rounded-2xl bg-[var(--accent-primary)]/15 text-[var(--accent-primary)] flex items-center justify-center">
                {selectedId === 'new' ? <Plus className="w-6 h-6" /> : <Edit className="w-6 h-6" />}
              </div>
              <div>
                <h2 className="text-xl md:text-2xl font-bold text-[var(--text-primary)]">{selectedId === 'new' ? 'إضافة شريحة جديدة' : 'تعديل الشريحة'}</h2>
                <p className="text-xs text-[var(--text-muted)] font-bold">جميع الإعدادات تنعكس فوراً على المعاينة المباشرة</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr),400px] gap-5 items-start">


      <div className="rounded-2xl border bg-[var(--card)] border-[var(--border)] p-4 md:p-6 space-y-5">
              {draft ? (
                <motion.div
                  key="panel-settings"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.18, ease: 'easeOut' }}
                  className="space-y-5"
                >


        {/* ===== الصورة ===== */}
                <SectionHeader icon={<ImageIcon className="w-5 h-5" />} text="صورة الشريحة" desc="ارفع صورة أو أكثر — تُحدَّث المعاينة فوراً" />
                {/* الصورة */}
                <div className="space-y-2">
                  <FieldLabel icon={<ImageIcon className="w-4 h-4" />} text="صورة" />
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      onDragOver={(e) => { e.preventDefault(); setFileDrag(true); }}
                      onDragLeave={() => setFileDrag(false)}
                      onDrop={(e) => { e.preventDefault(); setFileDrag(false); handleFiles(e.dataTransfer.files); }}
                      disabled={uploadProgress !== null}
                      className={`flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed p-8 text-center transition-colors disabled:opacity-60 ${
                        fileDrag
                          ? 'border-[var(--accent-primary)] bg-[var(--accent-light)]'
                          : 'border-[var(--border)] hover:border-[var(--accent-primary)]/60'
                      }`}
                    >
                      <Upload className="w-8 h-8 text-[var(--text-muted)]" />
                      <span className="text-sm font-bold text-[var(--text-primary)]">اضغط لرفع صورة الشريحة</span>
                      <span className="text-xs text-[var(--text-muted)] font-bold">PNG, JPG, WebP</span>
                    </button>
                    {draft.images[0] ? (
                      <div className="relative rounded-2xl overflow-hidden border border-[var(--border)] min-h-[150px]">
                        <SafeImage
                          src={draft.images[0]}
                          alt="معاينة صورة الشريحة"
                          loading="lazy"
                          className="w-full h-full min-h-[150px] object-cover"
                        />
                        <button
                          type="button"
                          onClick={() => setField('images', draft.images.filter((_, idx) => idx !== 0))}
                          className="absolute top-2 left-2 p-2 rounded-full bg-black/60 text-white hover:bg-red-500 transition-colors"
                          title="إزالة الصورة"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-center rounded-2xl border border-[var(--border)] bg-[var(--bg-secondary)] min-h-[150px] text-[var(--text-muted)] text-xs font-bold">
                        لم تُرفع صورة بعد
                      </div>
                    )}
                  </div>


                  {/* شريط تقدم الرفع */}
                  {uploadProgress !== null && (
                    <div className="space-y-1.5 pt-1">
                      <div className="flex justify-between text-xs font-bold text-[var(--text-secondary)]">
                        <span>جاري رفع الصورة...</span>
                        <span>{uploadProgress}%</span>
                      </div>
                      <div className="h-2 rounded-full bg-[var(--surface-elevated)] overflow-hidden">
                        <div className="h-full rounded-full bg-[var(--accent-primary)] transition-all" style={{ width: `${uploadProgress}%` }} />
                      </div>
                    </div>
                  )}

                  {/* باقي صور الشريحة (حتى 5) */}
                  {draft.images.length > 1 && (
                    <div className="flex flex-wrap gap-2 pt-1">
                      {draft.images.slice(1).map((img, idx) => (
                        <div key={`thumb-${idx}`} className="relative w-16 h-12 rounded-lg overflow-hidden border border-[var(--border)]">
                          <SafeImage src={img} alt={`صورة ${idx + 2}`} loading="lazy" className="w-full h-full object-cover" />
                          <button
                            type="button"
                            onClick={() => setField('images', draft.images.filter((_, i) => i !== idx + 1))}
                            className="absolute top-0.5 left-0.5 p-0.5 rounded-full bg-black/60 text-white hover:bg-red-500 transition-colors"
                            title="إزالة"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={(e) => handleFiles(e.target.files)}
                  />
                </div>

                {/* ===== المحتوى ===== */}
                <SectionHeader icon={<TypeIcon className="w-5 h-5" />} text="المحتوى" desc="العنوان الرئيسي والعنوان الفرعي" />
                {/* العنوان الرئيسي والفرعي */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <FieldLabel icon={<TypeIcon className="w-4 h-4" />} text="العنوان الرئيسي" />
                    <input
                      className={inputCls}
                      value={draft.title}
                      onChange={(e) => setField('title', e.target.value)}
                      placeholder="خدمات احترافية بجودة عالية"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <FieldLabel icon={<TypeIcon className="w-4 h-4" />} text="العنوان الفرعي" />
                    <input
                      className={inputCls}
                      value={draft.subtitle}
                      onChange={(e) => setField('subtitle', e.target.value)}
                      placeholder="نقدم الأفضل لعملائنا دائماً"
                    />
                  </div>
                </div>

                {/* ===== الرابط والزر ===== */}
                <SectionHeader icon={<LinkIcon className="w-5 h-5" />} text="الرابط والزر (اختياري)" desc="نص الزر ورابطه" />
                {/* نص الزر ورابطه */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <FieldLabel icon={<TypeIcon className="w-4 h-4" />} text="نص الزر" />
                    <input
                      className={inputCls}
                      value={draft.button_text}
                      onChange={(e) => setField('button_text', e.target.value)}
                      placeholder="اكتشف المزيد"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <FieldLabel icon={<LinkIcon className="w-4 h-4" />} text="رابط الزر" />
                    <input
                      dir="ltr"
                      className={inputCls}
                      value={draft.button_link}
                      onChange={(e) => setField('button_link', e.target.value)}
                      placeholder="/services"
                    />
                  </div>
                </div>


                {/* ===== الموضع والترتيب ===== */}
                <SectionHeader icon={<ListOrdered className="w-5 h-5" />} text="الموضع والترتيب" desc="ترتيب ظهور الشريحة ومدة العرض" />
                {/* ترتيب الشريحة + مدة العرض */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-secondary)] p-4 space-y-2.5">
                    <FieldLabel icon={<ListOrdered className="w-4 h-4" />} text="ترتيب الشريحة" />
                    <Stepper
                      value={draft.sort_order}
                      min={1}
                      max={Math.max(sortedAds.length, selectedId === 'new' ? sortedAds.length + 1 : 1)}
                      onChange={(v) => setField('sort_order', v)}
                    />
                    <p className="text-[11px] text-[var(--text-muted)] font-bold">ترتيب ظهور الشريحة في السلايدر (1 = الأولى)</p>
                  </div>
                  <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-secondary)] p-4 space-y-2.5">
                    <FieldLabel icon={<Timer className="w-4 h-4" />} text="مدة العرض (بالثواني)" />
                    <Stepper
                      value={draft.duration_seconds}
                      min={MIN_SLIDE_DURATION_SECONDS}
                      max={MAX_SLIDE_DURATION_SECONDS}
                      onChange={(v) => setField('duration_seconds', v)}
                    />
                    <p className="text-[11px] text-[var(--text-muted)] font-bold">حدد عدد الثواني لعرض هذه الشريحة قبل الانتقال للشريحة التالية</p>
                  </div>
                </div>

                {/* ===== النص والخط (المظهر) ===== */}
                <SectionHeader icon={<Palette className="w-5 h-5" />} text="النص والخط والمظهر" desc="اللغة، نوع الخط، الحجم، الألوان، والمحاذاة" />
                {/* تنسيق النص */}
                <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-secondary)] p-4 space-y-3">
                  <div className="text-sm font-bold text-[var(--text-primary)] flex items-center gap-2">
                    <Palette className="w-4 h-4 text-[var(--accent-primary)]" /> تنسيق النص
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 items-end">
                    <div className="col-span-2 space-y-1.5">
                      <FieldLabel icon={<Languages className="w-4 h-4" />} text="اللغة" />
                      <select
                        className={inputCls}
                        value={draft.language}
                        onChange={(e) => setField('language', e.target.value)}
                      >
                        <option value="ar">العربية</option>
                        <option value="en">English</option>
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <FieldLabel icon={<TypeIcon className="w-4 h-4" />} text="نوع الخط" />
                      <select
                        className={inputCls}
                        value={draft.font_family}
                        onChange={(e) => setField('font_family', e.target.value)}
                      >
                        {FONT_OPTIONS.map(f => <option key={f} value={f}>{f}</option>)}
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <FieldLabel icon={<TypeIcon className="w-4 h-4" />} text="حجم الخط" />
                      <select
                        className={inputCls}
                        value={draft.font_size}
                        onChange={(e) => setField('font_size', Number(e.target.value))}
                      >
                        {FONT_SIZE_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <FieldLabel icon={<Palette className="w-4 h-4" />} text="لون النص" />
                      <input
                        type="color"
                        className="w-full h-10 rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)] cursor-pointer p-1"
                        value={draft.text_color}
                        onChange={(e) => setField('text_color', e.target.value)}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <FieldLabel icon={<Palette className="w-4 h-4" />} text="لون الزر" />
                      <input
                        type="color"
                        className="w-full h-10 rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)] cursor-pointer p-1"
                        value={draft.button_color}
                        onChange={(e) => setField('button_color', e.target.value)}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <FieldLabel icon={<AlignStartVertical className="w-4 h-4" />} text="مكان النص" />
                      <select
                        className={inputCls}
                        value={draft.text_position}
                        onChange={(e) => setField('text_position', e.target.value as SlideDraft['text_position'])}
                      >
                        <option value="top">أعلى</option>
                        <option value="middle">وسط</option>
                        <option value="bottom">أسفل</option>
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <FieldLabel icon={<AlignHorizontalJustifyStart className="w-4 h-4" />} text="محاذاة النص" />
                      <select
                        className={inputCls}
                        value={draft.text_align}
                        onChange={(e) => setField('text_align', e.target.value as SlideDraft['text_align'])}
                      >
                        <option value="right">يمين</option>
                        <option value="center">وسط</option>
                        <option value="left">يسار</option>
                      </select>
                    </div>
                  </div>
                </div>


                {/* ===== جدولة العرض والإعدادات ===== */}
                <SectionHeader icon={<Calendar className="w-5 h-5" />} text="جدولة العرض (اختياري)" desc="تاريخ ووقت البدء والانتهاء + حالة الشريحة" />
                {/* جدولة العرض — الوظيفة الموجودة مسبقاً (تاريخ ووقت البدء/الانتهاء) */}
                <div className="rounded-2xl border border-[var(--border)] overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setSchedulingOpen(o => !o)}
                    className="w-full flex items-center justify-between px-4 py-3 bg-[var(--bg-secondary)] font-bold text-sm text-[var(--text-primary)] hover:bg-[var(--accent-light)]/40 transition-colors"
                  >
                    <span className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-[var(--accent-primary)]" />
                      جدولة العرض (تاريخ ووقت) — اختياري
                    </span>
                    <ChevronDown className={`w-4 h-4 transition-transform ${schedulingOpen ? 'rotate-180' : ''}`} />
                  </button>
                  {schedulingOpen && (
                    <div className="p-4 space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="space-y-1.5">
                          <FieldLabel icon={<Calendar className="w-4 h-4" />} text="تاريخ العرض" />
                          <input
                            type="date"
                            className={inputCls}
                            value={draft.display_date}
                            onChange={(e) => setField('display_date', e.target.value)}
                          />
                        </div>
                        <div className="space-y-1.5">
                          <FieldLabel icon={<Timer className="w-4 h-4" />} text="وقت البدء" />
                          <div className="flex gap-1.5">
                            <select className={inputCls} value={draft.start_hour} onChange={(e) => setField('start_hour', Number(e.target.value))} aria-label="الساعة">
                              {Array.from({ length: 24 }, (_, i) => i).map(h => <option key={h} value={h}>{String(h).padStart(2, '0')}</option>)}
                            </select>
                            <select className={inputCls} value={draft.start_minute} onChange={(e) => setField('start_minute', Number(e.target.value))} aria-label="الدقيقة">
                              {Array.from({ length: 60 }, (_, i) => i).map(m => <option key={m} value={m}>{String(m).padStart(2, '0')}</option>)}
                            </select>
                            <select className={inputCls} value={draft.start_second} onChange={(e) => setField('start_second', Number(e.target.value))} aria-label="الثانية">
                              {Array.from({ length: 60 }, (_, i) => i).map(s => <option key={s} value={s}>{String(s).padStart(2, '0')}</option>)}
                            </select>
                          </div>
                        </div>
                        <div className="space-y-1.5">
                          <FieldLabel icon={<Timer className="w-4 h-4" />} text="وقت الانتهاء" />
                          <div className="flex gap-1.5">
                            <select className={inputCls} value={draft.end_hour} onChange={(e) => setField('end_hour', Number(e.target.value))} aria-label="الساعة">
                              {Array.from({ length: 24 }, (_, i) => i).map(h => <option key={h} value={h}>{String(h).padStart(2, '0')}</option>)}
                            </select>
                            <select className={inputCls} value={draft.end_minute} onChange={(e) => setField('end_minute', Number(e.target.value))} aria-label="الدقيقة">
                              {Array.from({ length: 60 }, (_, i) => i).map(m => <option key={m} value={m}>{String(m).padStart(2, '0')}</option>)}
                            </select>
                            <select className={inputCls} value={draft.end_second} onChange={(e) => setField('end_second', Number(e.target.value))} aria-label="الثانية">
                              {Array.from({ length: 60 }, (_, i) => i).map(s => <option key={s} value={s}>{String(s).padStart(2, '0')}</option>)}
                            </select>
                          </div>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setField('is_active', !draft.is_active)}
                        className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm transition-colors ${
                          draft.is_active
                            ? 'bg-emerald-500/15 text-emerald-500 border border-emerald-500/30'
                            : 'bg-amber-500/15 text-amber-500 border border-amber-500/30'
                        }`}
                      >
                        <Power className="w-4 h-4" />
                        {draft.is_active ? 'مفعّلة — تظهر في الصفحة الرئيسية' : 'معطلة — مخفية عن الزوار'}
                      </button>
                    </div>
                  )}
                </div>


                {/* أزرار الحفظ */}
                <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={handleReset}
                    disabled={!isDirty || saving}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[var(--surface-elevated)] text-[var(--text-secondary)] font-bold text-sm hover:bg-[var(--accent-light)] hover:text-[var(--accent-primary)] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <RotateCcw className="w-4 h-4" /> إعادة تعيين
                  </button>
                  <button
                    type="button"
                    onClick={handleSave}
                    disabled={saving || uploadProgress !== null}
                    className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-[var(--accent-primary)] text-white font-bold text-sm hover:brightness-110 active:scale-95 transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Save className="w-4 h-4" />
                    {saving ? 'جاري الحفظ...' : selectedId === 'new' ? 'حفظ الشريحة' : 'حفظ التغييرات'}
                  </button>
                </div>
              </motion.div>
              ) : (
                <motion.div
                  key="panel-empty"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.18, ease: 'easeOut' }}
                  className="py-16 flex flex-col items-center gap-3 text-center"
                >
                  <ImageIcon className="w-10 h-10 text-[var(--text-muted)]" />
                  <p className="text-sm font-bold text-[var(--text-secondary)]">اختر شريحة من القائمة أو أضف شريحة جديدة</p>
                  <button onClick={openNewSlide} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[var(--accent-primary)] text-white font-bold text-sm">
                    <Plus className="w-4 h-4" /> إضافة شريحة جديدة
                  </button>
                </motion.div>
              )}
            </div>

            {/* المعاينة المباشرة للشريحة */}
            <div className="rounded-2xl border bg-[var(--card)] border-[var(--border)] overflow-hidden xl:sticky xl:top-24">
              <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)]">
                <h3 className="font-bold text-[var(--text-primary)] flex items-center gap-2">
                  <Eye className="w-4 h-4 text-[var(--accent-primary)]" /> المعاينة المباشرة
                </h3>
                <span className="text-[11px] text-[var(--text-muted)] font-bold">تُحدَّث مع كل تغيير</span>
              </div>
              <div className="p-4 md:p-6 space-y-4">
              {previewAds.length === 0 || !previewAds[liveIndex] ? (
                <div className="py-16 flex flex-col items-center gap-3 text-center">
                  <ImageIcon className="w-10 h-10 text-[var(--text-muted)]" />
                  <p className="text-sm font-bold text-[var(--text-secondary)]">لا توجد شرائح للمعاينة بعد</p>
                </div>
              ) : (
                <>
                  <div className="relative w-full h-[260px] md:h-[380px] rounded-2xl overflow-hidden shadow-lg">
                    <AnimatePresence mode="wait">
                      <motion.div
                        key={`live-${liveIndex}-${previewAds[liveIndex]?.id}`}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.5 }}
                        className="absolute inset-0"
                      >
                        <SlideView ad={previewAds[liveIndex]} />
                      </motion.div>
                    </AnimatePresence>

                    {/* شارة توضح أن المعاينة تعرض نسخة النموذج الحية (تعديلات غير محفوظة) */}
                    {previewingDraft && (
                      <span
                        className="absolute top-3 right-3 z-20 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/90 text-white text-[11px] font-bold shadow-lg"
                        dir="rtl"
                      >
                        <Eye className="w-3.5 h-3.5" /> معاينة مباشرة لتعديلاتك الحالية
                      </span>
                    )}

                    {previewAds.length > 1 && (
                      <>
                        <button
                          onClick={() => setLiveIndex(i => (i - 1 + previewAds.length) % previewAds.length)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 p-2.5 rounded-full bg-black/60 text-white hover:bg-black/80 transition-colors z-20"
                          title="السابق"
                        >
                          <ChevronRight className="w-5 h-5" />
                        </button>
                        <button
                          onClick={() => setLiveIndex(i => (i + 1) % previewAds.length)}
                          className="absolute left-3 top-1/2 -translate-y-1/2 p-2.5 rounded-full bg-black/60 text-white hover:bg-black/80 transition-colors z-20"
                          title="التالي"
                        >
                          <ChevronLeft className="w-5 h-5" />
                        </button>
                        <div className="absolute bottom-3 left-0 right-0 flex justify-center gap-1.5 z-20 px-4">
                          {previewAds.map((_, idx) => (
                            <button
                              key={`live-dot-${idx}`}
                              onClick={() => setLiveIndex(idx)}
                              className={`h-2 rounded-full transition-all ${idx === liveIndex ? 'w-6 bg-white' : 'w-2 bg-white/40'}`}
                            />
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                  <p className="text-xs text-center text-[var(--text-muted)] font-bold">
                    معاينة حقيقية بنفس مدة العرض ({getSlideDuration(previewAds[liveIndex])} ثوانٍ) والتنسيقات كما ستظهر في الصفحة الرئيسية
                  </p>
                </>
              )}
              </div>
            </div>
          </div>
        </>
      )}

      {/* ==================== قسم 3: معاينة الشرائح (جميع الشرائح) ==================== */}
      {view === 'list' && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setView('home')}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[var(--surface-elevated)] text-[var(--text-secondary)] font-bold text-sm hover:bg-[var(--accent-light)] hover:text-[var(--accent-primary)] transition-colors"
              >
                <ArrowRight className="w-4 h-4" /> العودة إلى إدارة السلايدر
              </button>
              <div className="w-11 h-11 rounded-2xl bg-[var(--accent-primary)]/15 text-[var(--accent-primary)] flex items-center justify-center">
                <Film className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-xl md:text-2xl font-bold text-[var(--text-primary)]">معاينة الشرائح</h2>
                <p className="text-xs text-[var(--text-muted)] font-bold">جميع الشرائح — معاينة وتعديل وحذف وترتيب بالسحب والإفلات</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setFullPreviewOpen(true)}
                disabled={sortedAds.length === 0}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[var(--accent-primary)] text-white font-bold text-sm hover:brightness-110 active:scale-95 transition-all shadow-lg disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Play className="w-4 h-4" /> تشغيل السلايدر
              </button>
              <button
                onClick={() => refreshAds()}
                className="p-2.5 rounded-xl bg-[var(--surface-elevated)] text-[var(--text-secondary)] hover:bg-[var(--accent-light)] hover:text-[var(--accent-primary)] transition-colors"
                title="تحديث القائمة"
              >
                <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>

          {loading && sortedAds.length === 0 ? (
            <div className="py-20 flex flex-col items-center gap-3 text-[var(--text-muted)]">
              <RefreshCw className="w-8 h-8 animate-spin" />
              <span className="text-sm font-bold">جاري تحميل الشرائح...</span>
            </div>
          ) : sortedAds.length === 0 ? (
            <div className="py-20 flex flex-col items-center gap-3 text-center rounded-3xl border border-dashed border-[var(--border)] bg-[var(--card)]">
              <ImageIcon className="w-12 h-12 text-[var(--text-muted)]" />
              <p className="text-base font-bold text-[var(--text-secondary)]">لا توجد شرائح حالياً</p>
              <button onClick={openNewSlide} className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[var(--accent-primary)] text-white font-bold text-sm">
                <Plus className="w-4 h-4" /> إضافة أول شريحة
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
{sortedAds.map((ad, adIndex) => (
                  <div
                    key={`slide-card-${ad.id}`}
                    draggable
                    onDragStart={() => { dragIndexRef.current = adIndex; }}
                    onDragEnd={() => { dragIndexRef.current = null; setDragOverIndex(null); }}
                    onDragOver={(e) => { e.preventDefault(); setDragOverIndex(adIndex); }}
                    onDrop={(e) => { e.preventDefault(); handleDropReorder(adIndex); }}
                    className={`rounded-3xl border bg-[var(--card)] overflow-hidden transition-all ${
                      dragOverIndex === adIndex ? 'ring-2 ring-[var(--accent-primary)]/50 border-[var(--accent-primary)]' : 'border-[var(--border)]'
                    }`}
                  >
                    <div className="relative h-44 md:h-52">
                      <SlideView ad={ad} />
                      <span className="absolute top-2.5 right-2.5 z-10 min-w-[26px] h-7 px-1.5 inline-flex items-center justify-center rounded-full bg-black/60 text-white text-xs font-bold" dir="rtl" title="ترتيب الشريحة">
                        {ad.sort_order ?? adIndex + 1}
                      </span>
                      <span className="absolute top-2.5 left-2.5 z-10" dir="rtl">
                        <StatusBadge ad={ad} />
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-2 px-4 py-3 border-t border-[var(--border)]">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="cursor-grab active:cursor-grabbing p-1.5 rounded-lg bg-[var(--bg-secondary)] text-[var(--text-muted)]" title="اسحب لتغيير الترتيب">
                          <GripVertical className="w-4 h-4" />
                        </span>
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-[var(--text-primary)] truncate">{ad.title || `شريحة ${adIndex + 1}`}</p>
                          <p className="text-[11px] text-[var(--text-muted)] font-bold flex items-center gap-1">
                            <Timer className="w-3 h-3" /> {getSlideDuration(ad)} ثوانٍ
                            {ad.display_date ? <> · {ad.display_date}</> : null}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button onClick={() => setPreviewAd(ad)} className="p-2 rounded-xl bg-purple-500/10 text-purple-400 hover:bg-purple-500/20 transition-colors" title="معاينة الشريحة">
                          <Eye className="w-4 h-4" />
                        </button>
                        <button onClick={() => selectSlide(ad)} className="p-2 rounded-xl bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 transition-colors" title="تعديل الشريحة">
                          <Edit className="w-4 h-4" />
                        </button>
                        <button onClick={() => setDeleteTarget(ad)} className="p-2 rounded-xl bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors" title="حذف الشريحة">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
                </div>
              )}
        </>
      )}


      {/* ==================== نافذة: تشغيل السلايدر كاملاً ==================== */}
      <AnimatePresence>
        {fullPreviewOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm overflow-y-auto" onClick={() => setFullPreviewOpen(false)}>
            <motion.div
              initial={{ scale: 0.96, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.96, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-4xl rounded-3xl border border-[var(--border)] bg-[var(--card)] overflow-hidden shadow-2xl my-auto"
            >
              <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)]">
                <h3 className="font-bold text-[var(--text-primary)] flex items-center gap-2">
                  <Play className="w-4 h-4 text-[var(--accent-primary)]" /> معاينة السلايدر — تشغيل تلقائي
                </h3>
                <button onClick={() => setFullPreviewOpen(false)} className="p-1.5 rounded-lg hover:bg-[var(--surface-elevated)] text-[var(--text-secondary)] transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="relative h-[280px] md:h-[420px]">
                {previewAds.length === 0 || !previewAds[liveIndex] ? (
                  <div className="h-full flex flex-col items-center justify-center gap-3 text-[var(--text-muted)]">
                    <ImageIcon className="w-10 h-10" />
                    <p className="text-sm font-bold">لا توجد شرائح للمعاينة</p>
                  </div>
                ) : (
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={`full-${liveIndex}-${previewAds[liveIndex]?.id}`}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.5 }}
                      className="absolute inset-0"
                    >
                      <SlideView ad={previewAds[liveIndex]} />
                    </motion.div>
                  </AnimatePresence>
                )}
                {previewAds.length > 1 && (
                  <>
                    <button onClick={() => setLiveIndex(i => (i - 1 + previewAds.length) % previewAds.length)} className="absolute right-3 top-1/2 -translate-y-1/2 p-2.5 rounded-full bg-black/60 text-white hover:bg-black/80 transition-colors z-20" title="السابق">
                      <ChevronRight className="w-5 h-5" />
                    </button>
                    <button onClick={() => setLiveIndex(i => (i + 1) % previewAds.length)} className="absolute left-3 top-1/2 -translate-y-1/2 p-2.5 rounded-full bg-black/60 text-white hover:bg-black/80 transition-colors z-20" title="التالي">
                      <ChevronLeft className="w-5 h-5" />
                    </button>
                    <div className="absolute bottom-3 left-0 right-0 flex justify-center gap-1.5 z-20 px-4">
                      {previewAds.map((_, idx) => (
                        <button
                          key={`full-dot-${idx}`}
                          onClick={() => setLiveIndex(idx)}
                          className={`h-2 rounded-full transition-all ${idx === liveIndex ? 'w-6 bg-white' : 'w-2 bg-white/40'}`}
                        />
                      ))}
                    </div>
                  </>
                )}
              </div>
              <div className="px-4 py-3 border-t border-[var(--border)] text-xs font-bold text-[var(--text-muted)] text-center">
                تشغيل تلقائي بالمدة الحقيقية لكل شريحة ({previewAds[liveIndex] ? getSlideDuration(previewAds[liveIndex]) : ''} ثانية للشريحة الحالية)
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* نافذة معاينة الشريحة */}
      <AnimatePresence>
        {previewAd && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm overflow-y-auto" onClick={() => setPreviewAd(null)}>
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-3xl rounded-3xl border border-[var(--border)] bg-[var(--card)] overflow-hidden shadow-2xl my-auto"
            >
              <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)]">
                <h3 className="font-bold text-[var(--text-primary)] flex items-center gap-2">
                  <Eye className="w-4 h-4 text-[var(--accent-primary)]" /> معاينة الشريحة
                </h3>
                <button onClick={() => setPreviewAd(null)} className="p-1.5 rounded-lg hover:bg-[var(--surface-elevated)] text-[var(--text-secondary)] transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="h-[280px] md:h-[360px]">
                <SlideView ad={previewAd} />
              </div>
              <div className="px-4 py-3 border-t border-[var(--border)] flex flex-wrap items-center justify-between gap-3 text-xs font-bold bg-[var(--bg-secondary)] text-[var(--text-secondary)]">
                <div className="flex flex-wrap items-center gap-3">
                  <span>📅 التاريخ: {previewAd.display_date}</span>
                  <span>⏰ الفترة: {previewAd.start_time} - {previewAd.end_time}</span>
                  <span>⏱ المدة: {getSlideDuration(previewAd)} ثوانٍ</span>
                  <StatusBadge ad={previewAd} />
                </div>
                <button onClick={() => setPreviewAd(null)} className="px-4 py-2 bg-[var(--accent-primary)] text-white rounded-xl font-bold">
                  إغلاق المعاينة
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* نافذة تأكيد الحذف */}
      <AnimatePresence>
        {deleteTarget && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-md rounded-3xl border border-[var(--border)] bg-[var(--card)] p-6 space-y-5 shadow-2xl text-center"
            >
              <div className="w-14 h-14 mx-auto rounded-2xl bg-red-500/10 text-red-500 flex items-center justify-center">
                <Trash2 className="w-7 h-7" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-[var(--text-primary)]">تأكيد حذف الشريحة</h3>
                <p className="text-sm text-[var(--text-secondary)] font-bold mt-1.5">
                  هل أنت متأكد من حذف "شريحة {deleteTarget.title || ''}"؟ لا يمكن التراجع عن هذا الإجراء.
                </p>
              </div>
              <div className="flex items-center justify-center gap-2">
                <button
                  onClick={() => setDeleteTarget(null)}
                  disabled={deleting}
                  className="px-5 py-2.5 rounded-xl bg-[var(--surface-elevated)] text-[var(--text-secondary)] font-bold text-sm hover:bg-[var(--accent-light)] transition-colors disabled:opacity-40"
                >
                  إلغاء
                </button>
                <button
                  onClick={confirmDelete}
                  disabled={deleting}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-red-500 text-white font-bold text-sm hover:bg-red-600 transition-colors disabled:opacity-50"
                >
                  <Trash2 className="w-4 h-4" /> {deleting ? 'جاري الحذف...' : 'نعم، احذف الشريحة'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* إشعارات Toast */}
      <div className="fixed bottom-4 left-4 z-[60] space-y-2 pointer-events-none">
        <AnimatePresence>
          {toasts.map(toast => (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className={`pointer-events-auto flex items-center gap-2.5 px-4 py-3 rounded-2xl shadow-xl border text-sm font-bold backdrop-blur-md bg-[var(--card)] ${
                toast.type === 'success'
                  ? 'border-emerald-500/40 text-emerald-500'
                  : 'border-red-500/40 text-red-500'
              }`}
            >
              {toast.type === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
              {toast.message}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
