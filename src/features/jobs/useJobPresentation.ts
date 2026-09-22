import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import type { JobCategory, JobSlide, JobSliderSettings } from './admin/jobAdminApi';
import {
  isSlideRunning, JOB_CATEGORY_COLUMNS, JOB_SLIDE_BASE_COLUMNS, JOB_SLIDE_COLUMNS,
  JOB_SLIDER_SETTINGS_COLUMNS, mergeJobSlideRow, mergeSettings,
} from './jobSlideMeta';
import { offlineStore, OFFLINE_KEYS } from '../../lib/offlineStore';
import { APP_ONLINE_EVENT } from '../../lib/connectivity';

// ============================================================================
// تغذية واجهة الوظائف العامة (JobsPage)
// ----------------------------------------------------------------------------
// جلب مرة واحدة + كاش قصير + تحديث حي عبر Realtime.
// يُرسل للصفحة فقط القيم النهائية اللازمة للعرض:
//   * السلايدات التي "تعمل الآن" (تشغيل دائم، أو عد تنازلي لم ينتهِ بعد)
//   * الإعدادات العامة للسلايدر
// لا تُستورد هنا أي مكوّن إداري ثقيل — ملف خفيف لا يؤثر على أداء الصفحة.
// ============================================================================
let cache: { slides: JobSlide[]; categories: JobCategory[]; settings: JobSliderSettings } | null = null;
let request: Promise<typeof cache> | null = null;
let cacheAt = 0;
let upgradedSlideColumnsSupported: boolean | null = null;
let jobSlidesResourceAvailable: boolean | null = null;
let sliderSettingsResourceAvailable: boolean | null = null;

function isMissingColumn(error: any): boolean {
  return ['42703', 'PGRST100', 'PGRST204'].includes(String(error?.code || ''));
}

function isMissingResource(error: any): boolean {
  const detail = `${error?.message || ''} ${error?.details || ''}`;
  return ['42P01', 'PGRST205'].includes(String(error?.code || ''))
    || error?.status === 404
    || /(relation|table|resource).*?(does not exist|not found)/i.test(detail);
}

function logPresentationError(stage: string, error: any) {
  console.warn(`[JobPresentation:${stage}]`, {
    message: error?.message,
    code: error?.code,
    details: error?.details,
    hint: error?.hint,
    status: error?.status,
  });
}

async function loadVisibleSlides() {
  if (jobSlidesResourceAvailable === false) return { data: [], error: null };
  let result: any = await supabase.from('job_slides')
    .select((upgradedSlideColumnsSupported === false ? JOB_SLIDE_BASE_COLUMNS : JOB_SLIDE_COLUMNS) as any)
    .eq('is_visible', true).order('sort_order');
  if (result.error && upgradedSlideColumnsSupported !== false && isMissingColumn(result.error)) {
    upgradedSlideColumnsSupported = false;
    result = await supabase.from('job_slides').select(JOB_SLIDE_BASE_COLUMNS as any)
      .eq('is_visible', true).order('sort_order');
  } else if (!result.error) upgradedSlideColumnsSupported = true;
  if (result.error && isMissingResource(result.error)) {
    jobSlidesResourceAvailable = false;
    logPresentationError('slides.missing', result.error);
    return { data: [], error: null };
  }
  if (!result.error) jobSlidesResourceAvailable = true;
  return result;
}


export function useJobPresentation(enabled = true) {
  const [state, setState] = useState(() => cache ?? { slides: [], categories: [], settings: mergeSettings(null) });
  useEffect(() => {
    if (!enabled) return;
    let active = true;
    const refresh = (force = false) => {
      if (typeof navigator !== 'undefined' && !navigator.onLine) return;
      if (!force && cache && Date.now() - cacheAt < 60_000) { setState(cache); return; }
      if (!request) request = (async () => {
        const [slidesRes, categoriesRes, settingsRes] = await Promise.all([
          loadVisibleSlides(),
          supabase.from('job_categories').select(JOB_CATEGORY_COLUMNS).eq('is_visible', true).order('sort_order'),
          sliderSettingsResourceAvailable === false
            ? Promise.resolve({ data: null, error: null })
            : supabase.from('job_slider_settings').select(JOB_SLIDER_SETTINGS_COLUMNS).eq('id', 1).maybeSingle(),
        ]);
        if (slidesRes.error) logPresentationError('slides.error', slidesRes.error);
        if (categoriesRes.error) logPresentationError('categories.error', categoriesRes.error);
        if (settingsRes.error) logPresentationError('settings.error', settingsRes.error);
        if (settingsRes.error && isMissingResource(settingsRes.error)) {
          sliderSettingsResourceAvailable = false;
          logPresentationError('settings.missing', settingsRes.error);
        } else if (!settingsRes.error) {
          sliderSettingsResourceAvailable = true;
        }
        const error = slidesRes.error || categoriesRes.error;
        if (error) throw error;
        const allSlides = (slidesRes.data || []).map(mergeJobSlideRow);
        cache = {
          slides: allSlides.filter(slide => isSlideRunning(slide)),
          categories: (categoriesRes.data || []).map((row: any) => ({ id: Number(row.id), name: row.name, icon: row.icon || 'briefcase', sortOrder: Number(row.sort_order), isVisible: row.is_visible })),
          settings: mergeSettings(settingsRes.error ? null : settingsRes.data),
        };
        cacheAt = Date.now();
        void offlineStore.setItem(OFFLINE_KEYS.JOB_PRESENTATION, cache)
          .catch(cacheError => console.warn('[JobPresentation] Cache write failed:', cacheError));
        return cache;
      })().finally(() => { request = null; });
      void request.then(value => { if (active && value) setState(value); }).catch(error => logPresentationError('load.error', error));
    };
    void offlineStore.getItem<typeof cache>(OFFLINE_KEYS.JOB_PRESENTATION).then(cached => {
      if (!active || !cached) return;
      cache = cached;
      cacheAt = 0;
      setState(cached);
    }).catch(() => undefined).finally(() => { if (active) refresh(true); });
    const refreshOnline = () => refresh(true);
    window.addEventListener('online', refreshOnline);
    window.addEventListener(APP_ONLINE_EVENT, refreshOnline);
    const channel = supabase.channel(`job-presentation-live-${Math.random().toString(36).slice(2)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'job_slides' }, () => refresh(true))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'job_categories' }, () => refresh(true))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'job_slider_settings' }, () => refresh(true))
      .subscribe();
    return () => {
      active = false;
      window.removeEventListener('online', refreshOnline);
      window.removeEventListener(APP_ONLINE_EVENT, refreshOnline);
      void supabase.removeChannel(channel);
    };
  }, [enabled]);
  return state;
}
