import { supabase } from '../../../lib/supabase';
import {
  buildSlideRowPayload, clearSlideOverlayEntry, mergeJobSlideRow, mergeSettings,
  pickSlideDesign, saveSlideOverlayEntry, saveSettingsOverlay, startRunPayload,
  JOB_CATEGORY_COLUMNS, JOB_SLIDE_BASE_COLUMNS, JOB_SLIDE_COLUMNS, JOB_SLIDER_SETTINGS_COLUMNS,
} from '../jobSlideMeta';
import type { JobSlide, JobSliderSettings } from '../jobSlideMeta';

export type {
  JobSlide, JobSliderSettings, JobSlideStatus, JobSlideOverlayEntry,
  JobTextPosition, JobTextVertical, JobSizeLevel, JobCornerRadius, JobMobileHeight,
  JobImageFit, JobLinkType, JobRunMode,
} from '../jobSlideMeta';
export {
  JOB_SLIDE_DEFAULTS, JOB_SLIDER_SETTINGS_DEFAULTS, JOB_DURATION_OPTIONS, LINK_TYPE_OPTIONS,
  JOB_STATUS_META, computeButtonLink, durationToMs, formatCountdown, formatDurationLabel,
  getJobSlideStatus, getSlideRemainingMs, isSlideRunning, mergeJobSlideRow, mergeSettings,
  suggestButtonText,
} from '../jobSlideMeta';

export interface JobCategory { id: number; name: string; icon: string; sortOrder: number; isVisible: boolean; }

const unwrap = <T>(result: { data: T | null; error: any }): T => { if (result.error) throw result.error; return result.data as T; };

// ============================================================================
// كشف توفر أعمدة الترقية / جدول الإعدادات (مرة واحدة لكل جلسة)
// النظام يعمل قبل وبعد تنفيذ supabase_job_slides_upgrade.sql:
//   * قبلها: تُحفظ حقول التشغيل والتصميم في overlay محلي (localStorage)
//   * بعدها: تُحفظ في قاعدة البيانات مباشرة
// ============================================================================
let slideColumnsSupported: boolean | null = null;
let settingsTableSupported: boolean | null = null;

async function ensureSlideColumns(): Promise<boolean> {
  if (slideColumnsSupported !== null) return slideColumnsSupported;
  const { error } = await supabase.from('job_slides').select('run_mode,link_type,text_position,overlay_opacity,run_ends_at').limit(1);
  slideColumnsSupported = !error;
  return slideColumnsSupported;
}

async function ensureSettingsTable(): Promise<boolean> {
  if (settingsTableSupported !== null) return settingsTableSupported;
  const { error } = await supabase.from('job_slider_settings').select('id').limit(1);
  settingsTableSupported = !error;
  return settingsTableSupported;
}

// ============================================================================
// السلايدات
// ============================================================================
export const loadJobSlides = async (): Promise<JobSlide[]> => {
  await ensureSlideColumns();
  let { data, error } = await supabase.from('job_slides').select(JOB_SLIDE_COLUMNS as any).order('sort_order');
  if (error && ['42703', 'PGRST100', 'PGRST204'].includes(String((error as any).code || ''))) {
    ({ data, error } = await supabase.from('job_slides').select(JOB_SLIDE_BASE_COLUMNS as any).order('sort_order'));
  }
  if (error) throw error;
  return (data || []).map(mergeJobSlideRow);
};

export interface SaveJobSlideOptions {
  /** إجبار بدء عد تنازلي جديد من الآن (عند تغيير المدة أو الضغط على إعادة التشغيل داخل النموذج) */
  restartRun?: boolean;
}

export const saveJobSlide = async (slide: Partial<JobSlide>, options: SaveJobSlideOptions = {}): Promise<JobSlide> => {
  const supported = await ensureSlideColumns();
  const isNew = !slide.id;

  if (supported) {
    const full: Partial<JobSlide> = { ...slide };
    if (full.runMode === 'timed') {
      const now = new Date();
      const ends = full.runEndsAt ? new Date(full.runEndsAt).getTime() : 0;
      const windowValid = !!full.runStartedAt && ends > now.getTime();
      if (isNew || options.restartRun || !windowValid) {
        const run = startRunPayload(full.durationHours ?? 0, full.durationMinutes ?? 0, full.durationSeconds ?? 0, now);
        full.runStartedAt = run.run_started_at;
        full.runEndsAt = run.run_ends_at;
      }
      // نافذة صالحة ولم تطلب إعادة تشغيل → تُحفظ كما هي فيبقى العد حقيقياً
    }
    const payload = buildSlideRowPayload(full);
    const result = slide.id
      ? await supabase.from('job_slides').update(payload).eq('id', slide.id).select().single()
      : await supabase.from('job_slides').insert(payload).select().single();
    if (result.error) throw result.error;
    const saved = mergeJobSlideRow(result.data);
    clearSlideOverlayEntry(saved.id);
    return saved;
  }

  // الاحتياط المحلي: أعمدة الترقية غير موجودة بعد في قاعدة البيانات
  const base = {
    title: slide.title,
    subtitle: slide.subtitle,
    image_url: slide.imageUrl,
    is_visible: slide.isVisible !== undefined ? slide.isVisible : true,
    sort_order: slide.sortOrder,
  };
  const result = slide.id
    ? await supabase.from('job_slides').update(base).eq('id', slide.id).select().single()
    : await supabase.from('job_slides').insert(base).select().single();
  if (result.error) throw result.error;
  const saved = mergeJobSlideRow(result.data);
  saveSlideOverlayEntry(saved.id, pickSlideDesign(slide));
  return saved;
};

/** تشغيل/إيقاف السلايد — عند التشغيل (لمدة) بنافذة منتهية/غير موجودة يبدأ عد جديد */
export const setJobSlideVisible = async (slide: JobSlide, visible: boolean): Promise<JobSlide> => {
  await ensureSlideColumns();
  const patch: Record<string, unknown> = { is_visible: visible };
  if (visible && slide.runMode === 'timed') {
    const now = new Date();
    const ends = slide.runEndsAt ? new Date(slide.runEndsAt).getTime() : 0;
    if (!slide.runStartedAt || ends <= now.getTime()) {
      Object.assign(patch, startRunPayload(slide.durationHours, slide.durationMinutes, slide.durationSeconds, now));
    }
  }
  const result = await supabase.from('job_slides').update(patch).eq('id', slide.id).select().single();
  if (result.error) throw result.error;
  return mergeJobSlideRow(result.data);
};

/** إعادة تشغيل المدة من الآن بنفس القيم المحفوظة */
export const restartJobSlideRun = async (slide: JobSlide): Promise<JobSlide> => {
  const supported = await ensureSlideColumns();
  const run = startRunPayload(slide.durationHours, slide.durationMinutes, slide.durationSeconds);
  if (supported) {
    const result = await supabase.from('job_slides').update(run).eq('id', slide.id).select().single();
    if (result.error) throw result.error;
    return mergeJobSlideRow(result.data);
  }
  saveSlideOverlayEntry(slide.id, pickSlideDesign({ runStartedAt: run.run_started_at, runEndsAt: run.run_ends_at }));
  return { ...slide, runStartedAt: run.run_started_at, runEndsAt: run.run_ends_at };
};

/** يستنسخ سلايداً بسرعة (نفس المحتوى والتصميم والمدة، بدون نافذة تشغيل نشطة) */
export const duplicateJobSlide = async (slide: JobSlide): Promise<JobSlide> => {
  const supported = await ensureSlideColumns();
  if (supported) {
    const payload = buildSlideRowPayload({ ...slide, runStartedAt: null, runEndsAt: null, sortOrder: slide.sortOrder + 1 });
    const result = await supabase.from('job_slides').insert(payload).select().single();
    if (result.error) throw result.error;
    return mergeJobSlideRow(result.data);
  }
  const result = await supabase.from('job_slides').insert({
    title: slide.title, subtitle: slide.subtitle, image_url: slide.imageUrl,
    is_visible: slide.isVisible, sort_order: slide.sortOrder + 1,
  }).select().single();
  if (result.error) throw result.error;
  const saved = mergeJobSlideRow(result.data);
  saveSlideOverlayEntry(saved.id, pickSlideDesign(slide));
  return saved;
};

export const deleteJobSlide = async (id: number) => {
  const { error } = await supabase.from('job_slides').delete().eq('id', id);
  if (error) throw error;
  clearSlideOverlayEntry(id);
};

export const reorderJobSlide = async (slide: JobSlide, sortOrder: number) => {
  const { error } = await supabase.from('job_slides').update({ sort_order: sortOrder }).eq('id', slide.id);
  if (error) throw error;
};

// ============================================================================
// الإعدادات العامة للسلايدر
// ============================================================================
export const loadJobSliderSettings = async (): Promise<JobSliderSettings> => {
  if (!(await ensureSettingsTable())) return mergeSettings(null);
  const { data, error } = await supabase.from('job_slider_settings').select(JOB_SLIDER_SETTINGS_COLUMNS).eq('id', 1).maybeSingle();
  if (error) return mergeSettings(null);
  return mergeSettings(data);
};

export const saveJobSliderSettings = async (settings: JobSliderSettings): Promise<JobSliderSettings> => {
  if (!(await ensureSettingsTable())) {
    saveSettingsOverlay(settings);
    return settings;
  }
  const payload = {
    autoplay: settings.autoplay,
    duration_seconds: settings.durationSeconds,
    loop_enabled: settings.loop,
    touch_drag: settings.touchDrag,
    mobile_height: settings.mobileHeight,
    corner_radius: settings.cornerRadius,
    updated_at: new Date().toISOString(),
  };
  const { error } = await supabase.from('job_slider_settings').upsert({ id: 1, ...payload }, { onConflict: 'id' });
  if (error) throw error;
  return settings;
};

// ============================================================================
// الأقسام (كما كانت)
// ============================================================================
export const loadJobCategories = async () => (unwrap(await supabase.from('job_categories').select(JOB_CATEGORY_COLUMNS).order('sort_order')) || []).map((row: any) => ({ id: Number(row.id), name: row.name, icon: row.icon || 'briefcase', sortOrder: Number(row.sort_order), isVisible: row.is_visible }));
export const saveJobCategory = async (category: Partial<JobCategory>) => unwrap(category.id ? await supabase.from('job_categories').update({ name: category.name, icon: category.icon, is_visible: category.isVisible }).eq('id', category.id).select().single() : await supabase.from('job_categories').insert({ name: category.name, icon: category.icon, is_visible: true }).select().single());
export const deleteJobCategory = async (id: number) => unwrap(await supabase.from('job_categories').delete().eq('id', id).select());
export const reorderJobCategory = async (category: JobCategory, sortOrder: number) => unwrap(await supabase.from('job_categories').update({ sort_order: sortOrder }).eq('id', category.id).select());


/** تحديث ترتيب مجموعة كاملة دفعة واحدة (يستخدمه السحب والإفلات) */
export const reorderJobSlides = async (orderedIds: number[]) => {
  for (const [index, id] of orderedIds.entries()) {
    const { error } = await supabase.from('job_slides').update({ sort_order: index + 1 }).eq('id', Number(id));
    if (error) throw error;
  }
};

