// ============================================================================
// وصفات/أنواع سلايدر الوظائف المشتركة
// ----------------------------------------------------------------------------
// ملف خفيف لا يستورد أي مكتبة ثقيلة ولا Supabase، تستورده كل من:
//   * لوحة الإدارة (JobSlidesAdmin)  — للمعاينة والتحكم
//   * الواجهة العامة (JobsSlider)    — للعرض النهائي
//   * hook التغذية (useJobPresentation) — لدمج البيانات
// النموذج يعتمد على "مدة تشغيل السلايدر" (ساعة:دقيقة:ثانية) مع عدّ تنازلي
// حقيقي محفوظ أوقاته في قاعدة البيانات (run_started_at / run_ends_at)
// بدلاً من نظام التاريخ.
// ============================================================================

export type JobTextPosition = 'right' | 'center' | 'left';
export type JobTextVertical = 'top' | 'middle' | 'bottom';
export type JobSizeLevel = 'small' | 'medium' | 'large';
export type JobImageFit = 'cover' | 'contain';
export type JobMobileHeight = 'short' | 'medium' | 'tall';
export type JobCornerRadius = 'soft' | 'medium' | 'rounded';
export type JobLinkType = 'internal' | 'job' | 'jobs_section' | 'external' | 'none';
export type JobRunMode = 'always' | 'timed';
export type JobSlideStatus = 'active' | 'stopped' | 'expired';

export interface JobSlide {
  id: number;
  title: string;
  subtitle: string;
  imageUrl: string;
  sortOrder: number;
  isVisible: boolean;
  // زر ورابط
  buttonText: string;
  buttonLink: string;                 // الرابط النهائي المحسوب للعرض
  linkType: JobLinkType;              // نوع الوجهة
  linkValue: string;                  // القيمة الخام (مسار/رابط/معرّف وظيفة)
  // مدة التشغيل (بدلاً من التاريخ)
  runMode: JobRunMode;                // always | timed
  durationHours: number;
  durationMinutes: number;
  durationSeconds: number;
  runStartedAt: string | null;        // ISO — متى بدأ العد التنازلي
  runEndsAt: string | null;           // ISO — متى ينتهي
  // تصميم النص
  textPosition: JobTextPosition;      // يمين / وسط / يسار
  textVertical: JobTextVertical;      // أعلى / وسط / أسفل
  titleSize: JobSizeLevel;
  subtitleSize: JobSizeLevel;
  textColor: string;
  buttonColor: string;
  buttonTextColor: string;
  overlayEnabled: boolean;
  overlayOpacity: number;             // 0 .. 0.9 درجة التغميق
  imageFit: JobImageFit;
  showDots: boolean;
  showTitle: boolean;
  showDescription: boolean;
  showButton: boolean;
  cornerRadius: JobCornerRadius;
}

export interface JobSliderSettings {
  autoplay: boolean;
  durationSeconds: number;            // مدة الانتقال بين السلايدات 3/5/7/10
  loop: boolean;
  touchDrag: boolean;
  mobileHeight: JobMobileHeight;
  cornerRadius: JobCornerRadius;      // احتياطي — تُفضَّل قيمة كل سلايد
}

export const JOB_SLIDE_BASE_COLUMNS = 'id,title,subtitle,image_url,sort_order,is_visible,created_at';
export const JOB_SLIDE_COLUMNS = `${JOB_SLIDE_BASE_COLUMNS},button_text,button_link,link_type,link_value,run_mode,duration_hours,duration_minutes,duration_seconds,run_started_at,run_ends_at,text_position,text_vertical,title_size,subtitle_size,text_color,button_color,button_text_color,overlay_enabled,overlay_opacity,image_fit,show_dots,show_title,show_description,show_button,corner_radius`;
export const JOB_SLIDER_SETTINGS_COLUMNS = 'id,autoplay,duration_seconds,loop_enabled,touch_drag,mobile_height,corner_radius,updated_at';
export const JOB_CATEGORY_COLUMNS = 'id,name,icon,sort_order,is_visible,created_at';

// ============================================================================
// القيم الافتراضية
// ============================================================================
export const JOB_SLIDE_DEFAULTS: Omit<JobSlide, 'id' | 'title' | 'imageUrl' | 'sortOrder' | 'isVisible'> = {
  subtitle: '',
  buttonText: '',
  buttonLink: '/jobs',
  linkType: 'internal',
  linkValue: '',
  runMode: 'always',
  durationHours: 0,
  durationMinutes: 5,
  durationSeconds: 0,
  runStartedAt: null,
  runEndsAt: null,
  textPosition: 'center',
  textVertical: 'middle',
  titleSize: 'medium',
  subtitleSize: 'medium',
  textColor: '#FFFFFF',
  buttonColor: '#7C3AED',
  buttonTextColor: '#FFFFFF',
  overlayEnabled: true,
  overlayOpacity: 0.45,
  imageFit: 'cover',
  showDots: true,
  showTitle: true,
  showDescription: true,
  showButton: true,
  cornerRadius: 'medium',
};

export const JOB_SLIDER_SETTINGS_DEFAULTS: JobSliderSettings = {
  autoplay: true,
  durationSeconds: 5,
  loop: true,
  touchDrag: true,
  mobileHeight: 'medium',
  cornerRadius: 'medium',
};

export const JOB_DURATION_OPTIONS = [3, 5, 7, 10] as const;

export const LINK_TYPE_OPTIONS: { value: JobLinkType; label: string }[] = [
  { value: 'internal', label: 'صفحة داخل التطبيق' },
  { value: 'job', label: 'وظيفة محددة' },
  { value: 'jobs_section', label: 'قسم الوظائف' },
  { value: 'external', label: 'رابط خارجي' },
  { value: 'none', label: 'بدون رابط' },
];

// ============================================================================
// مساعدات الرابط
// ============================================================================
export function computeButtonLink(linkType: JobLinkType, linkValue: string): string {
  const v = (linkValue || '').trim();
  switch (linkType) {
    case 'internal': return v || '/jobs';
    case 'job': return v ? `/jobs/${v.replace(/^\/+/, '')}` : '';
    case 'jobs_section': return '/jobs';
    case 'external': return v;
    case 'none': return '';
    default: return v || '/jobs';
  }
}

// ============================================================================
// مدة التشغيل / الحالة / العد التنازلي
// ============================================================================
export function durationToMs(hours: number, minutes: number, seconds: number): number {
  return (Number(hours) || 0) * 3600000 + (Number(minutes) || 0) * 60000 + (Number(seconds) || 0) * 1000;
}

export function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(h)}:${p(m)}:${p(s)}`;
}

/** هل السلايد قيد التشغيل الآن (يظهر للزوار)؟ */
export function isSlideRunning(slide: Pick<JobSlide, 'isVisible' | 'runMode' | 'runStartedAt' | 'runEndsAt'>, now: Date = new Date()): boolean {
  if (slide.isVisible === false) return false;
  if (slide.runMode === 'always') return true;
  if (!slide.runStartedAt || !slide.runEndsAt) return false;
  return now.getTime() <= new Date(slide.runEndsAt).getTime();
}

/** حالة السلايد في لوحة الإدارة: نشط / متوقف / منتهي */
export function getJobSlideStatus(slide: Pick<JobSlide, 'isVisible' | 'runMode' | 'runStartedAt' | 'runEndsAt'>, now: Date = new Date()): JobSlideStatus {
  if (slide.isVisible === false) return 'stopped';
  if (slide.runMode === 'timed') {
    if (!slide.runStartedAt || !slide.runEndsAt) return 'stopped';
    if (now.getTime() > new Date(slide.runEndsAt).getTime()) return 'expired';
  }
  return 'active';
}

/** الوقت المتبقي بالمللي ثانية (null إذا لم يكن سلايداً محدد المدة يعمل الآن) */
export function getSlideRemainingMs(slide: Pick<JobSlide, 'runMode' | 'runEndsAt'>, now: Date = new Date()): number | null {
  if (slide.runMode !== 'timed' || !slide.runEndsAt) return null;
  const remain = new Date(slide.runEndsAt).getTime() - now.getTime();
  return remain > 0 ? remain : 0;
}

export const JOB_STATUS_META: Record<JobSlideStatus, { label: string; cls: string; dot: string }> = {
  active: { label: 'نشط', cls: 'bg-emerald-500/15 text-emerald-600', dot: 'bg-emerald-500' },
  stopped: { label: 'متوقف', cls: 'bg-[var(--bg-secondary)] text-[var(--text-muted)]', dot: 'bg-[var(--text-muted)]' },
  expired: { label: 'منتهي', cls: 'bg-red-500/15 text-red-500', dot: 'bg-red-500' },
};


// ============================================================================
// ثوابت التصميم (classes جاهزة تُستخدم في العرض والمعاينة)
// ============================================================================
export const SLIDE_TEXT_ALIGN: Record<JobTextPosition, string> = {
  right: 'items-end text-right',
  center: 'items-center text-center',
  left: 'items-start text-left',
};

export const SLIDE_VERTICAL_CLASSES: Record<JobTextVertical, string> = {
  top: 'justify-start pt-5',
  middle: 'justify-center',
  bottom: 'justify-end pb-6',
};

export const TITLE_SIZE_CLASSES: Record<JobSizeLevel, string> = {
  small: 'text-lg sm:text-xl md:text-2xl',
  medium: 'text-2xl sm:text-3xl md:text-4xl',
  large: 'text-3xl sm:text-4xl md:text-5xl',
};

export const SUBTITLE_SIZE_CLASSES: Record<JobSizeLevel, string> = {
  small: 'text-xs sm:text-sm',
  medium: 'text-sm sm:text-base',
  large: 'text-base sm:text-lg',
};

export const SLIDE_HEIGHT_CLASSES: Record<JobMobileHeight, string> = {
  short: 'h-40 sm:h-44 md:h-52',
  medium: 'h-52 sm:h-60 md:h-72',
  tall: 'h-64 sm:h-72 md:h-80',
};

export const SLIDE_RADIUS_CLASSES: Record<JobCornerRadius, string> = {
  soft: 'rounded-lg md:rounded-xl',
  medium: 'rounded-2xl md:rounded-3xl',
  rounded: 'rounded-3xl md:rounded-[2.5rem]',
};

// ============================================================================
// الاحتياط المحلي (localStorage) — يُستخدم فقط إذا لم تُنفّذ ترقية قاعدة
// البيانات، حتى لا يفقد الأدمن تخصيصاته قبل تنفيذ supabase_job_slides_upgrade.sql
// ============================================================================
const OVERLAY_KEY = 'wisal_job_slide_designs_v1';
const SETTINGS_OVERLAY_KEY = 'wisal_job_slider_settings_v1';

export type JobSlideOverlayEntry = Partial<Pick<
  JobSlide,
  'buttonText' | 'linkType' | 'linkValue' | 'runMode' | 'durationHours' | 'durationMinutes' | 'durationSeconds'
  | 'runStartedAt' | 'runEndsAt' | 'textPosition' | 'textVertical' | 'titleSize' | 'subtitleSize'
  | 'textColor' | 'buttonColor' | 'buttonTextColor' | 'overlayEnabled' | 'overlayOpacity'
  | 'imageFit' | 'showDots' | 'showTitle' | 'showDescription' | 'showButton' | 'cornerRadius'
>>;
type SlideOverlayMap = Record<string, JobSlideOverlayEntry>;

export function readSlideOverlays(): SlideOverlayMap {
  try { return JSON.parse(localStorage.getItem(OVERLAY_KEY) || '{}') as SlideOverlayMap; } catch { return {}; }
}

function writeSlideOverlays(map: SlideOverlayMap) {
  try { localStorage.setItem(OVERLAY_KEY, JSON.stringify(map)); } catch { /* تجاهل */ }
}

export function saveSlideOverlayEntry(id: number, entry: JobSlideOverlayEntry) {
  const map = readSlideOverlays();
  map[String(id)] = { ...map[String(id)], ...entry };
  writeSlideOverlays(map);
}

export function clearSlideOverlayEntry(id: number) {
  const map = readSlideOverlays();
  delete map[String(id)];
  writeSlideOverlays(map);
}

export function readSettingsOverlay(): Partial<JobSliderSettings> {
  try { return JSON.parse(localStorage.getItem(SETTINGS_OVERLAY_KEY) || '{}') as Partial<JobSliderSettings>; } catch { return {}; }
}


// ============================================================================
// دمج صف Supabase (snake_case) مع الاحتياط المحلي → JobSlide كامل (camelCase)
// ============================================================================
export function mergeJobSlideRow(row: Record<string, any>): JobSlide {
  const id = Number(row.id);
  const overlay = readSlideOverlays()[String(id)] || {};
  const linkType = (row.link_type as JobLinkType) ?? overlay.linkType ?? JOB_SLIDE_DEFAULTS.linkType;
  const linkValue = typeof row.link_value === 'string' ? row.link_value : overlay.linkValue ?? '';
  return {
    id,
    title: typeof row.title === 'string' ? row.title : '',
    subtitle: typeof row.subtitle === 'string' ? row.subtitle : '',
    imageUrl: typeof row.image_url === 'string' ? row.image_url : '',
    sortOrder: Number(row.sort_order ?? 0) || 0,
    isVisible: row.is_visible !== false,
    buttonText: typeof row.button_text === 'string' ? row.button_text : overlay.buttonText ?? JOB_SLIDE_DEFAULTS.buttonText,
    buttonLink: typeof row.button_link === 'string' && row.button_link ? row.button_link : computeButtonLink(linkType, linkValue),
    linkType,
    linkValue,
    runMode: (row.run_mode as JobRunMode) ?? overlay.runMode ?? JOB_SLIDE_DEFAULTS.runMode,
    durationHours: Number(row.duration_hours ?? overlay.durationHours ?? JOB_SLIDE_DEFAULTS.durationHours) || 0,
    durationMinutes: Number(row.duration_minutes ?? overlay.durationMinutes ?? JOB_SLIDE_DEFAULTS.durationMinutes) || 0,
    durationSeconds: Number(row.duration_seconds ?? overlay.durationSeconds ?? JOB_SLIDE_DEFAULTS.durationSeconds) || 0,
    runStartedAt: isoOrNull(row.run_started_at) ?? overlay.runStartedAt ?? null,
    runEndsAt: isoOrNull(row.run_ends_at) ?? overlay.runEndsAt ?? null,
    textPosition: (row.text_position as JobTextPosition) ?? overlay.textPosition ?? JOB_SLIDE_DEFAULTS.textPosition,
    textVertical: (row.text_vertical as JobTextVertical) ?? overlay.textVertical ?? JOB_SLIDE_DEFAULTS.textVertical,
    titleSize: (row.title_size as JobSizeLevel) ?? overlay.titleSize ?? JOB_SLIDE_DEFAULTS.titleSize,
    subtitleSize: (row.subtitle_size as JobSizeLevel) ?? overlay.subtitleSize ?? JOB_SLIDE_DEFAULTS.subtitleSize,
    textColor: typeof row.text_color === 'string' ? row.text_color : overlay.textColor ?? JOB_SLIDE_DEFAULTS.textColor,
    buttonColor: typeof row.button_color === 'string' ? row.button_color : overlay.buttonColor ?? JOB_SLIDE_DEFAULTS.buttonColor,
    buttonTextColor: typeof row.button_text_color === 'string' ? row.button_text_color : overlay.buttonTextColor ?? JOB_SLIDE_DEFAULTS.buttonTextColor,
    overlayEnabled: row.overlay_enabled != null ? row.overlay_enabled !== false : overlay.overlayEnabled ?? JOB_SLIDE_DEFAULTS.overlayEnabled,
    overlayOpacity: Math.min(0.9, Math.max(0, Number(row.overlay_opacity ?? overlay.overlayOpacity ?? JOB_SLIDE_DEFAULTS.overlayOpacity) || 0)),
    imageFit: (row.image_fit as JobImageFit) ?? overlay.imageFit ?? JOB_SLIDE_DEFAULTS.imageFit,
    showDots: row.show_dots != null ? row.show_dots !== false : overlay.showDots ?? JOB_SLIDE_DEFAULTS.showDots,
    showTitle: row.show_title != null ? row.show_title !== false : overlay.showTitle ?? JOB_SLIDE_DEFAULTS.showTitle,
    showDescription: row.show_description != null ? row.show_description !== false : overlay.showDescription ?? JOB_SLIDE_DEFAULTS.showDescription,
    showButton: row.show_button != null ? row.show_button !== false : overlay.showButton ?? JOB_SLIDE_DEFAULTS.showButton,
    cornerRadius: (row.corner_radius as JobCornerRadius) ?? overlay.cornerRadius ?? JOB_SLIDE_DEFAULTS.cornerRadius,
  };
}

export function saveSettingsOverlay(settings: JobSliderSettings) {
  try { localStorage.setItem(SETTINGS_OVERLAY_KEY, JSON.stringify(settings)); } catch { /* تجاهل */ }
}

export function clearSettingsOverlay() {
  try { localStorage.removeItem(SETTINGS_OVERLAY_KEY); } catch { /* تجاهل */ }
}

function isoOrNull(value: unknown): string | null {
  if (!value || typeof value !== 'string') return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}


/** يدمج صف إعدادات السلايدر مع الاحتياط المحلي والافتراضي */
export function mergeSettings(row: Record<string, any> | null): JobSliderSettings {
  const base = { ...JOB_SLIDER_SETTINGS_DEFAULTS, ...readSettingsOverlay() };
  if (!row) return base;
  return {
    autoplay: row.autoplay != null ? row.autoplay !== false : base.autoplay,
    durationSeconds: Number(row.duration_seconds ?? base.durationSeconds) || base.durationSeconds,
    loop: row.loop_enabled != null ? row.loop_enabled !== false : base.loop,
    touchDrag: row.touch_drag != null ? row.touch_drag !== false : base.touchDrag,
    mobileHeight: (row.mobile_height as JobMobileHeight) ?? base.mobileHeight,
    cornerRadius: (row.corner_radius as JobCornerRadius) ?? base.cornerRadius,
  };
}

/** يستخرج الحقول التصميمية + التشغيل (camelCase) — يُستخدم للاحتياط المحلي والنسخ */
export function pickSlideDesign(slide: Partial<JobSlide>): JobSlideOverlayEntry {
  const out: JobSlideOverlayEntry = {};
  const keys: (keyof JobSlideOverlayEntry)[] = [
    'buttonText', 'linkType', 'linkValue', 'runMode', 'durationHours', 'durationMinutes', 'durationSeconds',
    'runStartedAt', 'runEndsAt', 'textPosition', 'textVertical', 'titleSize', 'subtitleSize',
    'textColor', 'buttonColor', 'buttonTextColor', 'overlayEnabled', 'overlayOpacity',
    'imageFit', 'showDots', 'showTitle', 'showDescription', 'showButton', 'cornerRadius',
  ];
  for (const key of keys) {
    if (slide[key] !== undefined) (out as Record<string, unknown>)[key] = slide[key];
  }
  return out;
}

// ============================================================================
// بناء حمولة الصف الكامل لقاعدة البيانات (snake_case) — النموذج الجديد كاملاً
// ============================================================================
export function buildSlideRowPayload(slide: Partial<JobSlide>): Record<string, unknown> {
  const runMode = slide.runMode ?? JOB_SLIDE_DEFAULTS.runMode;
  const linkType = slide.linkType ?? JOB_SLIDE_DEFAULTS.linkType;
  const linkValue = (slide.linkValue ?? '').trim();
  const payload: Record<string, unknown> = {
    title: slide.title ?? '',
    subtitle: slide.subtitle ?? '',
    image_url: slide.imageUrl ?? '',
    is_visible: slide.isVisible !== undefined ? slide.isVisible : true,
    sort_order: slide.sortOrder ?? 0,
    button_text: (slide.buttonText ?? '').trim(),
    button_link: computeButtonLink(linkType, linkValue),
    link_type: linkType,
    link_value: linkType === 'none' ? '' : linkValue,
    run_mode: runMode,
    duration_hours: runMode === 'always' ? 0 : Math.min(23, Math.max(0, Number(slide.durationHours ?? 0) || 0)),
    duration_minutes: runMode === 'always' ? 0 : Math.min(59, Math.max(0, Number(slide.durationMinutes ?? 0) || 0)),
    duration_seconds: runMode === 'always' ? 0 : Math.min(59, Math.max(0, Number(slide.durationSeconds ?? 0) || 0)),
    run_started_at: runMode === 'always' ? null : isoOrNull(slide.runStartedAt),
    run_ends_at: runMode === 'always' ? null : isoOrNull(slide.runEndsAt),
    text_position: slide.textPosition ?? JOB_SLIDE_DEFAULTS.textPosition,
    text_vertical: slide.textVertical ?? JOB_SLIDE_DEFAULTS.textVertical,
    title_size: slide.titleSize ?? JOB_SLIDE_DEFAULTS.titleSize,
    subtitle_size: slide.subtitleSize ?? JOB_SLIDE_DEFAULTS.subtitleSize,
    text_color: slide.textColor ?? JOB_SLIDE_DEFAULTS.textColor,
    button_color: slide.buttonColor ?? JOB_SLIDE_DEFAULTS.buttonColor,
    button_text_color: slide.buttonTextColor ?? JOB_SLIDE_DEFAULTS.buttonTextColor,
    overlay_enabled: slide.overlayEnabled ?? JOB_SLIDE_DEFAULTS.overlayEnabled,
    overlay_opacity: Math.min(0.9, Math.max(0, Number(slide.overlayOpacity ?? JOB_SLIDE_DEFAULTS.overlayOpacity) || 0)),
    image_fit: slide.imageFit ?? JOB_SLIDE_DEFAULTS.imageFit,
    show_dots: slide.showDots ?? JOB_SLIDE_DEFAULTS.showDots,
    show_title: slide.showTitle ?? JOB_SLIDE_DEFAULTS.showTitle,
    show_description: slide.showDescription ?? JOB_SLIDE_DEFAULTS.showDescription,
    show_button: slide.showButton ?? JOB_SLIDE_DEFAULTS.showButton,
    corner_radius: slide.cornerRadius ?? JOB_SLIDE_DEFAULTS.cornerRadius,
  };
  return payload;
}

/** حمولة بدء / إعادة تشغيل العد التنازلي من الآن حتى now + المدة المحددة */
export function startRunPayload(hours: number, minutes: number, seconds: number, now: Date = new Date()): { run_started_at: string; run_ends_at: string } {
  const started = now.toISOString();
  const totalMs = durationToMs(hours, minutes, seconds);
  return { run_started_at: started, run_ends_at: new Date(now.getTime() + totalMs).toISOString() };
}

/** ملصق المدة بشكل مقروء: 05:30 ← "5 د 30 ث" */
export function formatDurationLabel(hours: number, minutes: number, seconds: number): string {
  const parts: string[] = [];
  if (hours > 0) parts.push(`${hours} س`);
  if (minutes > 0) parts.push(`${minutes} د`);
  if (seconds > 0 || parts.length === 0) parts.push(`${seconds} ث`);
  return parts.join(' : ');
}

/** الوضع الافتراضي لنص الزر حسب نوع الرابط */
export function suggestButtonText(linkType: JobLinkType): string {
  switch (linkType) {
    case 'internal': return 'عرض الوظائف';
    case 'job': return 'قدّم الآن';
    case 'jobs_section': return 'تصفح الوظائف';
    case 'external': return 'زيارة الرابط';
    default: return '';
  }
}

