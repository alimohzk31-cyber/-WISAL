import { useState, useEffect, useCallback } from 'react';
import { supabase, supabaseUrl, supabaseAnonKey } from '../lib/supabase';

export type AdPeriod = 'am' | 'pm';
export type AdStatus = 'active' | 'upcoming' | 'expired' | 'disabled';

export interface SliderAd {
  id: number;
  url?: string;
  title: string; // اسم الشركة أو المنتج
  display_date: string; // YYYY-MM-DD
  start_time: string; // "HH:MM:SS" بنظام 24 ساعة (مثال: "08:30:15")
  end_time: string;
  start_hour: number; // 0-23 (نظام 24 ساعة)
  start_minute: number; // 0-59
  start_second?: number; // 0-59
  end_hour: number; // 0-23 (نظام 24 ساعة)
  end_minute: number; // 0-59
  end_second?: number; // 0-59
  // حقول نظام 12 ساعة القديمة — للتوافق مع البيانات المحفوظة سابقاً فقط،
  // وتُحوَّل تلقائياً إلى 24 ساعة عند القراءة (normalizeAd / getAdStatus).
  start_period?: AdPeriod;
  end_period?: AdPeriod;
  images: string[]; // مصفوفة الصور من 1 إلى 5
  is_active: boolean; // حالة التشغيل
  sort_order?: number; // ترتيب العرض (1 = الأول) - محفوظ في Supabase
  // حقول التصميم (اختيارية): تُحفظ في أعمدة Supabase عند توفرها، وإلا
  // في طبقة overlay محلية حتى تنفيذ ترقية SQL — دون أي كسر للبيانات القديمة.
  subtitle?: string; // العنوان الفرعي
  button_text?: string; // نص الزر
  button_link?: string; // رابط الزر
  duration_seconds?: number; // مدة عرض الشريحة بالثواني (2-60، الافتراضي 5)
  language?: string; // لغة الشريحة ('ar' | 'en')
  font_family?: string; // نوع الخط
  font_size?: number; // حجم الخط px
  text_color?: string; // لون النص
  button_color?: string; // لون الزر
  text_position?: 'top' | 'middle' | 'bottom'; // مكان النص على الصورة
  text_align?: 'right' | 'center' | 'left'; // محاذاة النص
  created_at?: string;
  updated_at?: string;
}

// Backward compatibility alias for any existing imports
export type SliderImage = SliderAd;

const storageKey = 'saleen_slider_ads_v2';

// ==============================
// حقول تصميم الشريحة (مدة العرض/الألوان/الخط...)
// ------------------------------
// أعمدة Supabase الهدف: subtitle, button_text, button_link, duration_seconds,
// language, font_family, font_size, text_color, button_color.
// إذا لم تكن الأعمدة قد أُضيفت بعد (ترقية SQL اختيارية)، تُحفظ القيم في
// overlay محلي (localStorage) ويُعاد دمجها تلقائياً عند القراءة — بدون أي فقدان
// للبيانات القديمة وبدون أخطاء ظاهرة. بعد تنفيذ الترقية تُكتب في Supabase مباشرة.
// ==============================
export const MIN_SLIDE_DURATION_SECONDS = 2;
export const MAX_SLIDE_DURATION_SECONDS = 60;
export const DEFAULT_SLIDE_DURATION_SECONDS = 5;
export const DEFAULT_SLIDE_DESIGN = {
  subtitle: '',
  button_text: '',
  button_link: '',
  duration_seconds: DEFAULT_SLIDE_DURATION_SECONDS,
  language: 'ar',
  font_family: 'Cairo',
  font_size: 28,
  text_color: '#FFFFFF',
  button_color: '#7C3AED',
  text_position: 'bottom',
  text_align: 'center'
} as const;

export const DESIGN_FIELD_KEYS = [
  'subtitle', 'button_text', 'button_link', 'duration_seconds',
  'language', 'font_family', 'font_size', 'text_color', 'button_color',
  'text_position', 'text_align'
] as const;

export type SlideDesignFieldKey = (typeof DESIGN_FIELD_KEYS)[number];
export type SlideDesign = Partial<Record<SlideDesignFieldKey, any>>;

const clampDuration = (v: any): number => {
  const n = Math.round(Number(v));
  if (!Number.isFinite(n)) return DEFAULT_SLIDE_DURATION_SECONDS;
  return Math.min(MAX_SLIDE_DURATION_SECONDS, Math.max(MIN_SLIDE_DURATION_SECONDS, n));
};

/** مدة عرض الشريحة بالثواني (مضمونة ضمن 2..60 والافتراضي 5) */
export function getSlideDuration(ad?: Partial<SliderAd> | null): number {
  return clampDuration(ad?.duration_seconds);
}

const designOverlayKey = 'saleen_slider_design_v1';

function readDesignOverlay(): Record<string, SlideDesign> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(designOverlayKey);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function writeDesignOverlay(overlay: Record<string, SlideDesign>) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(designOverlayKey, JSON.stringify(overlay));
  } catch (error) {
    console.warn('Failed to save slider design overlay:', error);
  }
}

/** يحفظ حقول التصميم في overlay المحلي (تُستخدم فقط عندما تكون أعمدة Supabase غير متاحة) */
function saveDesignOverlayEntry(id: number, design: SlideDesign) {
  const entries = Object.keys(design).filter(k => design[k as SlideDesignFieldKey] !== undefined);
  if (entries.length === 0) return;
  const overlay = readDesignOverlay();
  overlay[String(id)] = { ...(overlay[String(id)] || {}), ...design };
  writeDesignOverlay(overlay);
}

function clearDesignOverlayEntry(id: number) {
  const overlay = readDesignOverlay();
  if (!overlay[String(id)]) return;
  delete overlay[String(id)];
  writeDesignOverlay(overlay);
}

/** يبني جزء الحمولة الخاص بحقول التصميم (فقط الحقول المعرفة) */
export function buildDesignPayload(ad: Partial<SliderAd>): SlideDesign {
  const p: SlideDesign = {};
  if (ad.subtitle !== undefined) p.subtitle = ad.subtitle;
  if (ad.button_text !== undefined) p.button_text = ad.button_text;
  if (ad.button_link !== undefined) p.button_link = ad.button_link;
  if (ad.duration_seconds !== undefined) p.duration_seconds = clampDuration(ad.duration_seconds);
  if (ad.language !== undefined) p.language = ad.language;
  if (ad.font_family !== undefined) p.font_family = ad.font_family;
  if (ad.font_size !== undefined) p.font_size = Math.round(Number(ad.font_size)) || DEFAULT_SLIDE_DESIGN.font_size;
  if (ad.text_color !== undefined) p.text_color = ad.text_color;
  if (ad.button_color !== undefined) p.button_color = ad.button_color;
  if (ad.text_position !== undefined) p.text_position = ad.text_position;
  if (ad.text_align !== undefined) p.text_align = ad.text_align;
  return p;
}

const stripDesignPayload = (payload: Record<string, any>): Record<string, any> => {
  const next = { ...payload };
  DESIGN_FIELD_KEYS.forEach(k => delete next[k]);
  return next;
};

/** هل الخطأ يعني أن أحد أعمدة التصميم غير موجود في الجدول بعد؟ */
const isMissingColumnError = (error: any): boolean => {
  if (!error) return false;
  const code = (error as any).code;
  const message = String((error as any).message || '');
  return (
    code === 'PGRST204' ||
    code === '42703' ||
    /could not find the .* column|column .* does not exist|schema cache/i.test(message)
  );
};

// حالة دعم أعمدة التصميم في Supabase (null = لم تُجرَّب بعد)
let designColumnsSupported: boolean | null = null;

// ==============================
// Session-level cache (per page load)
// ------------------------------
// يمنع إعادة الاتصال بـ Supabase عند كل زيارة للصفحة الرئيسية خلال نفس الجلسة
// (التنقل بين الصفحات/الرجوع). بيانات السلايدر وصفية صغيرة ولا تُعدَّل كثيراً،
// لذا جلب البريد فقط مرة كل فترة قصيرة — مع بقاء التحديث اليدوي (refresh) فورياً.
// ==============================
const SESSION_CACHE_TTL = 300 * 1000; // 5 دقائق — السلايدر يتغير نادراً (refreshAds يجبر التحديث)
let sessionAdsCache: SliderAd[] | null = null;
let sessionAdsCacheAt = 0;

export const defaultAds: SliderAd[] = [
  {
    id: 101,
    title: 'خدمات الطوارئ على مدار الساعة',
    display_date: new Date().toISOString().split('T')[0],
    start_time: '00:00:00',
    end_time: '00:00:00',
    start_hour: 0,
    start_minute: 0,
    start_second: 0,
    end_hour: 0,
    end_minute: 0,
    end_second: 0,
    images: ['https://images.unsplash.com/photo-1587560699334-cc4ff634909a?auto=format&fit=crop&q=80&w=1200'],
    url: 'https://images.unsplash.com/photo-1587560699334-cc4ff634909a?auto=format&fit=crop&q=80&w=1200',
    is_active: true
  },
  {
    id: 102,
    title: 'صيانة السيارات بأيدي خبراء',
    display_date: new Date().toISOString().split('T')[0],
    start_time: '00:00:00',
    end_time: '00:00:00',
    start_hour: 0,
    start_minute: 0,
    start_second: 0,
    end_hour: 0,
    end_minute: 0,
    end_second: 0,
    images: ['https://images.unsplash.com/photo-1486006396113-ad73c5946ee9?auto=format&fit=crop&q=80&w=1200'],
    url: 'https://images.unsplash.com/photo-1486006396113-ad73c5946ee9?auto=format&fit=crop&q=80&w=1200',
    is_active: true
  },
  {
    id: 103,
    title: 'خدمات النظافة والتعقيم الشاملة',
    display_date: new Date().toISOString().split('T')[0],
    start_time: '00:00:00',
    end_time: '00:00:00',
    start_hour: 0,
    start_minute: 0,
    start_second: 0,
    end_hour: 0,
    end_minute: 0,
    end_second: 0,
    images: ['https://images.unsplash.com/photo-1581578731522-745d05ad9a2d?auto=format&fit=crop&q=80&w=1200'],
    url: 'https://images.unsplash.com/photo-1581578731522-745d05ad9a2d?auto=format&fit=crop&q=80&w=1200',
    is_active: true
  }
];

export function parse12hTo24h(hour: number, minute: number, period: AdPeriod): { hour24: number; minute: number } {
  let h = hour % 12;
  if (period === 'pm') {
    h += 12;
  }
  return { hour24: h, minute };
}

/** تنسيق الوقت بنظام 24 ساعة مع الثواني: "HH:MM:SS" */
export function formatTimeArabic(hour: number, minute: number, second: number = 0): string {
  const p = (n: number) => String(Math.max(0, Math.round(Number(n) || 0))).padStart(2, '0');
  return `${p(hour)}:${p(minute)}:${p(second)}`;
}

export function getAdStatus(ad: Partial<SliderAd>, customNow?: Date): AdStatus {
  if (ad.is_active === false) {
    return 'disabled';
  }

  if (!ad.display_date) {
    return 'active';
  }

  const now = customNow || new Date();
  
  // Date format: YYYY-MM-DD
  const dateParts = ad.display_date.split('-').map(Number);
  if (dateParts.length < 3 || isNaN(dateParts[0]) || isNaN(dateParts[1]) || isNaN(dateParts[2])) {
    return 'active';
  }

  const year = dateParts[0];
  const month = dateParts[1] - 1; // 0-indexed
  const day = dateParts[2];

  // القيم الافتراضية 00:00:00 — ولا يُستخدم وقت الجهاز إطلاقاً.
  // توافق مع البيانات القديمة: إذا وُجد period فالساعة محفوظة بنظام 12 ساعة.
  const startHourRaw = ad.start_hour ?? 0;
  const startMin = ad.start_minute ?? 0;
  const startSec = ad.start_second ?? 0;
  const endHourRaw = ad.end_hour ?? 0;
  const endMin = ad.end_minute ?? 0;
  const endSec = ad.end_second ?? 0;

  const startHour = ad.start_period ? parse12hTo24h(startHourRaw, startMin, ad.start_period).hour24 : startHourRaw;
  const endHour = ad.end_period ? parse12hTo24h(endHourRaw, endMin, ad.end_period).hour24 : endHourRaw;

  const startDateTime = new Date(year, month, day, startHour, startMin, startSec, 0);
  const endDateTime = new Date(year, month, day, endHour, endMin, endSec, 999);

  if (now.getTime() < startDateTime.getTime()) {
    return 'upcoming';
  }

  if (now.getTime() > endDateTime.getTime()) {
    return 'expired';
  }

  return 'active';
}

/**
 * Compress an image file to Base64 (JPEG) using HTML5 Canvas.
 * Keeps output below reasonable limits for smooth performance.
 */
export async function compressImageFile(file: File, maxWidth = 1200, maxHeight = 700, quality = 0.75): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = (e) => {
      const img = new Image();
      img.onerror = reject;
      img.onload = () => {
        let { width, height } = img;
        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }
        if (height > maxHeight) {
          width = Math.round((width * maxHeight) / height);
          height = maxHeight;
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(e.target?.result as string);
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL('image/jpeg', quality);
        resolve(dataUrl);
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  });
}

function normalizeAd(row: any): SliderAd {
  const images = Array.isArray(row.images) && row.images.length > 0
    ? row.images
    : (row.url ? [row.url] : []);

  const todayStr = new Date().toISOString().split('T')[0];
  // دمج حقول التصميم: عمود Supabase أولاً، ثم overlay المحلي (إن لم تكن الأعمدة موجودة)، ثم الافتراضي
  const overlay: SlideDesign = readDesignOverlay()[String(row.id)] || {};
  const dv = (rowVal: any, overlayVal: any, defaultVal: any) =>
    rowVal !== undefined && rowVal !== null ? rowVal : (overlayVal !== undefined && overlayVal !== null ? overlayVal : defaultVal);

  // توحيد الوقت بنظام 24 ساعة: العمود الرقمي أولاً (مع تحويل النظام 12 القديم إن وُجد)،
  // ثم تحليل نص start_time/end_time، والافتراضي 00:00:00 دائماً — لا وقت جهاز ولا auto-fill.
  const startTimeParts = row.start_time ? parseTimeHours(String(row.start_time)) : null;
  const endTimeParts = row.end_time ? parseTimeHours(String(row.end_time)) : null;

  const startHour24 = row.start_hour !== undefined && row.start_hour !== null
    ? (row.start_period ? parse12hTo24h(row.start_hour, row.start_minute ?? 0, row.start_period).hour24 : row.start_hour)
    : (startTimeParts ? startTimeParts.hour : 0);
  const startMinute = row.start_minute ?? (startTimeParts ? startTimeParts.minute : 0);
  const startSecond = row.start_second ?? (startTimeParts ? startTimeParts.second : 0);

  const endHour24 = row.end_hour !== undefined && row.end_hour !== null
    ? (row.end_period ? parse12hTo24h(row.end_hour, row.end_minute ?? 0, row.end_period).hour24 : row.end_hour)
    : (endTimeParts ? endTimeParts.hour : 0);
  const endMinute = row.end_minute ?? (endTimeParts ? endTimeParts.minute : 0);
  const endSecond = row.end_second ?? (endTimeParts ? endTimeParts.second : 0);

  return {
    id: Number(row.id),
    title: row.title || '',
    display_date: row.display_date || todayStr,
    start_time: formatTimeArabic(startHour24, startMinute, startSecond),
    end_time: formatTimeArabic(endHour24, endMinute, endSecond),
    start_hour: startHour24,
    start_minute: startMinute,
    start_second: startSecond,
    end_hour: endHour24,
    end_minute: endMinute,
    end_second: endSecond,
    images: images.length > 0 ? images : ['https://images.unsplash.com/photo-1587560699334-cc4ff634909a?auto=format&fit=crop&q=80&w=1200'],
    url: images[0] || row.url || '',
    is_active: row.is_active !== false,
    sort_order: Number.isFinite(Number(row.sort_order)) ? Number(row.sort_order) : 0,
    subtitle: dv(row.subtitle, overlay.subtitle, DEFAULT_SLIDE_DESIGN.subtitle),
    button_text: dv(row.button_text, overlay.button_text, DEFAULT_SLIDE_DESIGN.button_text),
    button_link: dv(row.button_link, overlay.button_link, DEFAULT_SLIDE_DESIGN.button_link),
    duration_seconds: clampDuration(dv(row.duration_seconds, overlay.duration_seconds, DEFAULT_SLIDE_DESIGN.duration_seconds)),
    language: dv(row.language, overlay.language, DEFAULT_SLIDE_DESIGN.language),
    font_family: dv(row.font_family, overlay.font_family, DEFAULT_SLIDE_DESIGN.font_family),
    font_size: dv(row.font_size, overlay.font_size, DEFAULT_SLIDE_DESIGN.font_size),
    text_color: dv(row.text_color, overlay.text_color, DEFAULT_SLIDE_DESIGN.text_color),
    button_color: dv(row.button_color, overlay.button_color, DEFAULT_SLIDE_DESIGN.button_color),
    created_at: row.created_at,
    updated_at: row.updated_at
  };
}

/**
 * يفهم صيغتَي الوقت:
 * - الجديدة: "HH:MM:SS" بنظام 24 ساعة (مثال "14:05:00")
 * - القديمة: "HH:MM ص/م" بنظام 12 ساعة (بيانات محفوظة سابقاً)
 * تعيد الساعة دائماً بنظام 24 ساعة.
 */
function parseTimeHours(timeStr: string): { hour: number; minute: number; second: number; period?: AdPeriod } {
  try {
    const isPm = timeStr.includes('م') || timeStr.toLowerCase().includes('pm');
    const isAm = timeStr.includes('ص') || timeStr.toLowerCase().includes('am');
    const clean = timeStr.replace(/[^\d:]/g, '');
    const parts = clean.split(':').map(p => parseInt(p, 10) || 0);
    const rawHour = parts[0] ?? 0;
    const minute = parts[1] ?? 0;
    const second = parts[2] ?? 0;
    if (isPm || isAm) {
      const period: AdPeriod = isPm ? 'pm' : 'am';
      return { hour: parse12hTo24h(rawHour, minute, period).hour24, minute, second, period };
    }
    return { hour: Math.min(23, rawHour), minute, second };
  } catch {
    return { hour: 0, minute: 0, second: 0 };
  }
}

/** يعيد البيانات المخزنة محلياً (بدون إرجاع defaultAds كنسخة بديلة). */
const readLocalAdsRaw = (): SliderAd[] | null => {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed.map(normalizeAd);
    }
  } catch (error) {
    console.warn('Failed to read local slider ads cache:', error);
  }
  return null;
};

/** هل توجد بيانات إعلانية حقيقية مخزنة محلياً (وليست مجرد defaultAds)؟ */
const hasLocalAds = (): boolean => {
  if (typeof window === 'undefined') return false;
  try {
    const raw = localStorage.getItem(storageKey);
    return !!raw && Array.isArray(JSON.parse(raw)) && JSON.parse(raw).length > 0;
  } catch {
    return false;
  }
};

const readLocalAds = (): SliderAd[] => readLocalAdsRaw() ?? defaultAds;

const writeLocalAds = (items: SliderAd[]) => {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(storageKey, JSON.stringify(items));
  } catch (error) {
    console.warn('Failed to save local slider ads cache:', error);
  }
};

/**
 * Upload a slider image file to the project's existing Supabase Storage bucket
 * ("service-media", public) and return its public URL.
 * The original file is uploaded AS-IS: no canvas re-encoding, no quality loss,
 * no color changes. Supabase serves the original bytes.
 */
const SLIDER_BUCKET = 'service-media';

export async function uploadSliderImage(file: File): Promise<string> {
  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
  const path = `slider/${Date.now()}_${Math.random().toString(36).substring(2, 10)}.${ext}`;

  const { error } = await supabase.storage
    .from(SLIDER_BUCKET)
    .upload(path, file, {
      cacheControl: '31536000',
      contentType: file.type || 'image/jpeg',
      upsert: false,
    });

  if (error) {
    console.error('[useSlider] uploadSliderImage failed:', {
      message: (error as any)?.message, code: (error as any)?.code, bucket: SLIDER_BUCKET, path,
    });
    throw error;
  }

  const { data: urlData } = supabase.storage
    .from(SLIDER_BUCKET)
    .getPublicUrl(path);

  if (!urlData?.publicUrl) {
    throw new Error('فشل الحصول على رابط الصورة العامة بعد الرفع إلى التخزين.');
  }
  return urlData.publicUrl;
}

/**
 * رفع صورة مع Progress حقيقي (نسبة مئوية فعليّة من XHR) إلى نفس Bucket المستخدم.
 * يستخدم نفس نقطة النهاية ونفس رؤوس supabase-js (apikey / Bearer) لذا تنطبق
 * نفس سياسات RLS. عند أي فشل يُعاد استخدام uploadSliderImage (supabase-js) كخطة بديلة.
 */
export async function uploadSliderImageWithProgress(
  file: File,
  onProgress?: (percent: number) => void
): Promise<string> {
  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
  const path = `slider/${Date.now()}_${Math.random().toString(36).substring(2, 10)}.${ext}`;

  try {
    const publicUrl = await new Promise<string>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', `${supabaseUrl}/storage/v1/object/${SLIDER_BUCKET}/${path}`);
      xhr.setRequestHeader('apikey', supabaseAnonKey);
      xhr.setRequestHeader('authorization', `Bearer ${supabaseAnonKey}`);
      xhr.setRequestHeader('cache-control', '31536000');
      xhr.setRequestHeader('content-type', file.type || 'image/jpeg');
      xhr.setRequestHeader('x-upsert', 'false');

      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable && onProgress) {
          onProgress(Math.max(1, Math.round((e.loaded / e.total) * 100)));
        }
      };
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          onProgress?.(100);
          resolve(`${supabaseUrl}/storage/v1/object/public/${SLIDER_BUCKET}/${path}`);
        } else {
          let message = `فشل رفع الصورة (HTTP ${xhr.status})`;
          try {
            const body = JSON.parse(xhr.responseText);
            if (body?.message) message = body.message;
          } catch { /* تجاهل */ }
          reject(new Error(message));
        }
      };
      xhr.onerror = () => reject(new Error('تعذر الاتصال بخادم التخزين.'));
      xhr.onabort = () => reject(new Error('تم إلغاء رفع الصورة.'));
      xhr.send(file);
    });
    return publicUrl;
  } catch (xhrError) {
    console.warn('[useSlider] XHR upload failed, falling back to supabase-js upload:', xhrError);
    // خطة بديلة: نفس مسار الرفع المستخدم سابقاً (بدون تقدم تفصيلي)
    const url = await uploadSliderImage(file);
    onProgress?.(100);
    return url;
  }
}

export function useSlider() {
  const [ads, setAds] = useState<SliderAd[]>(() => sessionAdsCache ?? readLocalAds());
  const [loading, setLoading] = useState(sessionAdsCache === null);
  // هل توجد بيانات فورية (من الجلسة أو localStorage) حتى نعرضها قبل انتهاء fetch؟
  const [hasCachedData, setHasCachedData] = useState<boolean>(sessionAdsCache !== null || hasLocalAds());

  const fetchAds = useCallback(async (force = false) => {
    // إذا كانت البيانات الحديثة موجودة في ذاكرة الجلسة وغير مجبرين على التحديث،
    // نعيدها فوراً دون الاتصال بالشبكة (يمنع تأخير زيارة الصفحة مرة أخرى).
    if (!force && sessionAdsCache !== null && Date.now() - sessionAdsCacheAt < SESSION_CACHE_TTL) {
      setAds(sessionAdsCache);
      setLoading(false);
      setHasCachedData(true);
      return sessionAdsCache;
    }

    try {
      // لا نحجب الواجهة عند وجود بيانات سابقة: نُسندها ونُحدّثها في الخلفية فقط.
      setLoading(sessionAdsCache === null);
      const { data, error } = await supabase
        .from('slider_images')
        .select('*')
        // الترتيب المحفوظ في Supabase أولاً (sort_order تصاعدي)، ثم الأقدم أولاً
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: true });

      if (error) throw error;

      const normalized = (data ?? []).map(normalizeAd);
      sessionAdsCache = normalized;
      sessionAdsCacheAt = Date.now();
      setAds(normalized);
      setHasCachedData(normalized.length > 0);
      writeLocalAds(normalized);
      return normalized;
    } catch (error) {
      console.error('Error fetching slider ads from Supabase:', error);
      const cached = readLocalAds();
      sessionAdsCache = cached;
      sessionAdsCacheAt = Date.now();
      setAds(cached);
      setHasCachedData(hasLocalAds());
      return cached;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAds();
  }, [fetchAds]);

  const addAd = async (adData: Omit<SliderAd, 'id' | 'created_at' | 'updated_at'>) => {
    try {
      const primaryUrl = adData.images[0] || adData.url || '';
      // ترتيب الإعلان الجديد = آخر ترتيب + 1 (يُحفظ في Supabase ويُحترم في الواجهة)
      const maxOrder = ads.reduce((m, a) => Math.max(m, Number(a.sort_order) || 0), 0);
      let payload: any = {
        title: adData.title,
        url: primaryUrl,
        display_date: adData.display_date,
        start_time: adData.start_time,
        end_time: adData.end_time,
        images: adData.images,
        is_active: adData.is_active ?? true,
        sort_order: adData.sort_order !== undefined ? adData.sort_order : maxOrder + 1,
        updated_at: new Date().toISOString(),
        // حقول التصميم (تُخفى تلقائياً إن لم تكن أعمدتها موجودة بعد)
        ...(designColumnsSupported !== false ? buildDesignPayload(adData) : {})
      };

      const insertOnce = () => supabase
        .from('slider_images')
        .insert([payload])
        .select()
        .single();

      let result = await insertOnce();

      // إذا كان السبب نقص أعمدة التصميم نُسقطها ونعيد المحاولة مرة واحدة
      if (result.error && isMissingColumnError(result.error) && designColumnsSupported !== false) {
        designColumnsSupported = false;
        payload = stripDesignPayload(payload);
        result = await insertOnce();
      }

      // لا يوجد fallback "أعمدة آمنة": كان ينشئ سجلاً ناقصاً بدون صور ويخفي الخطأ.
      // نعرض الخطأ الحقيقي دائماً حتى لا يظن المدير أن الإعلان حُفظ وهو لم يُحفظ.
      if (result.error) throw result.error;
      if (designColumnsSupported === null) designColumnsSupported = true;

      const data = result.data;
      const inserted = normalizeAd({ ...data, ...adData, sort_order: data?.sort_order ?? payload.sort_order });
      // الأعمدة غير متاحة بعد: نحفظ حقول التصميم في overlay المحلي
      if (designColumnsSupported === false) saveDesignOverlayEntry(inserted.id, buildDesignPayload(adData));
      setAds(prev => {
        const next = [...prev, inserted];
        writeLocalAds(next);
        return next;
      });
      return inserted;
    } catch (error) {
      console.error('Error inserting slider ad in Supabase:', error);
      throw error;
    }
  };

  const updateAd = async (id: number, adData: Partial<SliderAd>) => {
    const safeId = Number(id);

    try {
      const primaryUrl = adData.images?.[0] || adData.url;
      let payload: any = {
        ...(adData.title !== undefined ? { title: adData.title } : {}),
        ...(primaryUrl !== undefined ? { url: primaryUrl } : {}),
        ...(adData.display_date !== undefined ? { display_date: adData.display_date } : {}),
        ...(adData.start_time !== undefined ? { start_time: adData.start_time } : {}),
        ...(adData.end_time !== undefined ? { end_time: adData.end_time } : {}),
        ...(adData.images !== undefined ? { images: adData.images } : {}),
        ...(adData.is_active !== undefined ? { is_active: adData.is_active } : {}),
        ...(adData.sort_order !== undefined ? { sort_order: adData.sort_order } : {}),
        ...(designColumnsSupported !== false ? buildDesignPayload(adData) : {}),
        updated_at: new Date().toISOString()
      };

      const updateOnce = () => supabase
        .from('slider_images')
        .update(payload)
        .eq('id', safeId)
        .select()
        .maybeSingle();

      let result = await updateOnce();

      // أعمدة التصميم غير موجودة بعد في Supabase: نُسقطها ونعيد المحاولة مرة واحدة
      if (result.error && isMissingColumnError(result.error) && designColumnsSupported !== false) {
        designColumnsSupported = false;
        payload = stripDesignPayload(payload);
        result = await updateOnce();
      }

      // UPDATE حقيقي على نفس السجل (by id) - لا يُنشئ سجلاً جديداً ولا يخفي الأخطاء.
      if (result.error) throw result.error;
      const data = result.data;
      if (!data) {
        throw new Error(`لم يتم العثور على السجل id=${safeId} في slider_images أو أن التحديث لم يشمل أي صف.`);
      }
      if (designColumnsSupported === null) designColumnsSupported = true;

      if (designColumnsSupported === false) {
        // نحفظ حقول التصميم في overlay المحلي حتى تعمل المعاينة والسلايدر قبل ترقية SQL
        saveDesignOverlayEntry(safeId, buildDesignPayload(adData));
      } else {
        // الأعمدة متاحة: أي overlay قديم لهذا السجل لم يعد لازماً
        clearDesignOverlayEntry(safeId);
      }

      setAds(prev => {
        const next = prev.map(ad => (ad.id === safeId ? normalizeAd({ ...ad, ...adData, ...(data || {}) }) : ad));
        writeLocalAds(next);
        return next;
      });

      return normalizeAd(data);
    } catch (error) {
      console.error('Error updating slider ad in Supabase:', error);
      throw error;
    }
  };

  // حفظ ترتيب جديد في Supabase: يُمرَّر مصفوفة ids بالترتيب المطلوب
  // ويُحدَّث sort_order لكل سجل على حدة (نفس السجل، لا إنشاء/حذف).
  const reorderAds = async (orderedIds: number[]) => {
    const updates = orderedIds
      .map((id, index) => ({ id: Number(id), sort_order: index + 1 }))
      .filter(u => Number.isFinite(u.id) && u.id > 0);

    if (updates.length === 0) return;

    // تحديث فوري محلي (optimistic) ثم تأكيد من Supabase؛ عند أي فشل نعيد الجلب من المصدر
    setAds(prev => {
      const map = new Map(prev.map(a => [Number(a.id), a]));
      const next = updates
        .map(u => {
          const ad = map.get(u.id);
          return ad ? { ...ad, sort_order: u.sort_order } : null;
        })
        .filter(a => a !== null) as SliderAd[];
      const rest = prev.filter(a => !updates.some(u => Number(u.id) === Number(a.id)));
      const merged = [...next, ...rest].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
      writeLocalAds(merged);
      return merged;
    });

    try {
      for (const u of updates) {
        const { error } = await supabase
          .from('slider_images')
          .update({ sort_order: u.sort_order, updated_at: new Date().toISOString() })
          .eq('id', u.id);
        if (error) throw error;
      }
    } catch (error) {
      console.error('Error reordering slider ads in Supabase:', error);
      await fetchAds(); // مصدر الحقيقة: Supabase
      throw error;
    }
  };

  const toggleAdActive = async (id: number, currentStatus: boolean) => {
    return await updateAd(id, { is_active: !currentStatus });
  };

  const deleteAd = async (id: number) => {
    const safeId = Number(id);

    try {
      const { error } = await supabase
        .from('slider_images')
        .delete()
        .eq('id', safeId);

      if (error) throw error;

      // تنظيف overlay حقول التصميم الخاص بالسجل المحذوف
      clearDesignOverlayEntry(safeId);

      setAds(prev => {
        const next = prev.filter(ad => ad.id !== safeId);
        writeLocalAds(next);
        return next;
      });
    } catch (error) {
      console.error('Error deleting slider ad in Supabase:', error);
      throw error;
    }
  };

  // Aliases for backward compatibility
  const addImage = async (url: string, title: string) => {
    const today = new Date().toISOString().split('T')[0];
    return await addAd({
      title,
      url,
      images: [url],
      display_date: today,
      start_time: '00:00:00',
      end_time: '00:00:00',
      start_hour: 0,
      start_minute: 0,
      start_second: 0,
      end_hour: 0,
      end_minute: 0,
      end_second: 0,
      is_active: true
    });
  };

  const updateImage = async (id: number, url: string, title: string) => {
    return await updateAd(id, { url, title, images: [url] });
  };

  const deleteImage = async (id: number) => {
    return await deleteAd(id);
  };

  return {
    ads,
    images: ads, // Alias for backward compatibility
    loading,
    hasCachedData,
    addAd,
    updateAd,
    toggleAdActive,
    deleteAd,
    reorderAds,
    uploadSliderImage,
    addImage,
    updateImage,
    deleteImage,
    refreshAds: () => fetchAds(true),
    refreshImages: () => fetchAds(true)
  };
}
