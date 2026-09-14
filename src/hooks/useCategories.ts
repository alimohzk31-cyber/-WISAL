import { createContext, createElement, useContext, useState, useEffect, useMemo, type ReactNode } from 'react';
import { fetchCategoryRows, invalidateCategoryRows } from '../lib/categoryRows';
import { supabase } from '../lib/supabase';
import { categories as staticCategories } from '../data/categories';
import { offlineStore, OFFLINE_KEYS } from '../lib/offlineStore';
import { getCategoryIcon } from '../data/categoryIcons';
import { resolveCategoryIcon } from '../data/serviceIcons';
import { mergeCategoriesSafely, canAddCategory } from '../lib/categoryValidation';
import type { Section } from '../types/models';
import { APP_ONLINE_EVENT } from '../lib/connectivity';


// CustomCategory تمتد Section (المصدر المركزي للأنواع): نفس الشكل السابق،
// مع دعم keywords/fields المضمّنة إن أُضيفت لقسم من قاعدة البيانات.
export interface CustomCategory extends Section {
  icon: string;
  color: string;
}

const localCategoriesKey = 'saleen_custom_categories_v1';

// ==============================
// Session-level cache لمنع إعادة جلب التصنيفات من الشبكة عند كل زيارة/تركيب
// (مثل الانتقال بين الصفحات). يمنع الطلب المكرر ويُسرّع التنقل.
// ==============================
const CATEGORIES_CACHE_TTL = 300 * 1000; // 5 دقائق — الأقسام تتغير نادراً، والتحديث القسري متاح من لوحة الإدارة
let sessionCategoriesCache: any[] | null = null;
let sessionCategoriesCacheAt = 0;
let categoriesRevision = 0;

// طلب شبكة مشترك على مستوى الوحدة: عند أول تحميل تُركَّب عدة مكوّنات تستدعي
// useCategories في نفس اللحظة (الرئيسية، SocialFeed، نافذة البحث الذكي...)،
// وبدون مشاركة الطلب يطلق كل منها طلب Supabase مطابقاً (طلبات مكررة).
// null = لا يوجد طلب جارٍ.
let categoriesNetworkRequest: Promise<any[] | null> | null = null;

// تنسيق صف قاعدة البيانات إلى كائن قسم موحّد (مُستخرج من fetchCustomCategories
// ليمكن مشاركة نتيجة الطلب المشترك بين كل نسخ الخطاف).
const formatCategoryRow = (d: any) => ({
  // slug column added by migration; fall back to id for pre-migration DBs
  slug: d.slug ?? d.id,
  // The REAL primary key of the row in public.categories - used as
  // services.category_id so we never depend on the slug/name alone.
  dbId: d.id,
  name: d.name_ar ?? d.name ?? d.id,
  // Store the icon NAME as a string so the object can be written to
  // IndexedDB/localStorage (components cannot be cloned/serialized).
  icon: d.icon ?? 'Folder',
  // color column added by migration; fall back to 'blue'
  color: d.color ?? 'blue',
  // image column added by migration; may be null/undefined
  image: d.image ?? undefined,
  isCustom: true
});

const readLocalCustomCategories = () => {
  if (typeof window === 'undefined') return [];

  try {
    const raw = localStorage.getItem(localCategoriesKey);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(c => ({ ...c, isCustom: true })) : [];
  } catch (error) {
    console.warn('Failed to read local custom categories:', error);
    return [];
  }
};

const writeLocalCustomCategories = (items: any[], changed = true) => {
  sessionCategoriesCache = items;
  sessionCategoriesCacheAt = Date.now();
  if (changed) { categoriesRevision++; invalidateCategoryRows(); }
  if (typeof window === 'undefined') return;

  try {
    localStorage.setItem(localCategoriesKey, JSON.stringify(items));
  } catch (error) {
    console.warn('Failed to write local custom categories:', error);
  }
};

// React icon components (functions) cannot be cloned into IndexedDB / serialized
// to JSON, which caused "DataCloneError: Symbol(react.forward_ref) could not be
// cloned" everywhere. We therefore ALWAYS persist category objects with the icon
// stored as a string NAME, and only convert it to a real component right before
// rendering via this helper.
const hydrateIconComponent = (item: any): any => {
  if (!item || typeof item.icon === 'function') return item;
  // 1) النظام المركزي serviceIcons: يحل الأيقونة عبر slug الفئة أو اسمها العربي
  //    بكل صيغه (صيدلية/صيدليه/Pharmacy) أو اسم الأيقونة المحفوظ — بحيث تحصل
  //    كل فئة (حتى القديمة أو المخصصة من قاعدة البيانات) على أيقونتها الصحيحة.
  // 2) إن لم يوجد تطابق مركزي: نرجع للسلوك القديم getCategoryIcon (بما فيه
  //    fallback العام) حتى لا يتغير أي سلوك قائم.
  const resolved = resolveCategoryIcon(item);
  if (typeof resolved.icon === 'function' && resolved.icon !== resolveCategoryIcon(null).icon) {
    return { ...item, icon: resolved.icon };
  }
  return { ...item, icon: getCategoryIcon(item.icon) };
};

function useCategoriesState() {
  const [customCategories, setCustomCategories] = useState<any[]>(() => sessionCategoriesCache ?? []);

  useEffect(() => {
    let active = true;
    const init = async () => {
      if (sessionCategoriesCache) { await fetchCustomCategories(); return; }
      const cached = await offlineStore.getItem<any[]>(OFFLINE_KEYS.CATEGORIES).catch(() => null);
      if (!active) return;
      const localCached = readLocalCustomCategories();
      const merged = [...(cached || []), ...localCached].reduce((acc: any[], current: any) => {
        const existing = acc.find((item: any) => item.slug === current.slug);
        if (!existing) acc.push({ ...current, isCustom: current.isCustom !== false });
        return acc;
      }, []);

      if (merged.length > 0) {
        setCustomCategories(merged);
      }

      await fetchCustomCategories();
    };

    init();
    const refreshVisible = () => { if (!document.hidden) void fetchCustomCategories(); };
    const refreshOnline = () => { void fetchCustomCategories(true); };
    window.addEventListener('focus', refreshVisible);
    window.addEventListener('online', refreshOnline);
    window.addEventListener(APP_ONLINE_EVENT, refreshOnline);
    document.addEventListener('visibilitychange', refreshVisible);
    return () => {
      active = false;
      window.removeEventListener('focus', refreshVisible);
      window.removeEventListener('online', refreshOnline);
      window.removeEventListener(APP_ONLINE_EVENT, refreshOnline);
      document.removeEventListener('visibilitychange', refreshVisible);
    };
  }, []);

  const applyFetchedCategories = (formatted: any[]) => {
    // بدلاً من استبدال القائمة بالكامل (setCustomCategories(formatted))
    // ندمج الأقسام الجديدة مع القديمة لمنع اختفاء أقسام موجودة مؤقتاً
    // من الكاش إذا كانت نتيجة Supabase ناقصة لأي سبب
    setCustomCategories(prev => mergeCategoriesSafely(prev, formatted));
    // نحدث الكاش الجلسة بنفس الطريقة الآمنة
    sessionCategoriesCache = mergeCategoriesSafely(sessionCategoriesCache ?? [], formatted);
    sessionCategoriesCacheAt = Date.now();
  };

  const mergeLocalCategoriesFallback = () => {
    const localFallback = readLocalCustomCategories();
    if (localFallback.length > 0) {
      // دمج بدلاً من استبدال لمنع فقدان أقسام حديثة أضيفت قبل الخطأ
      setCustomCategories(prev => mergeCategoriesSafely(prev, localFallback));
    }
  };

  const fetchCustomCategories = async (force = false) => {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      mergeLocalCategoriesFallback();
      return;
    }
    // إذا كانت بيانات حديثة موجودة في ذاكرة الجلسة وغير مجبرين على التحديث،
    // نستخدمها فوراً دون الاتصال بالشبكة (يمنع الطلب المكرر عند التنقل).
    if (!force && sessionCategoriesCache !== null && Date.now() - sessionCategoriesCacheAt < CATEGORIES_CACHE_TTL) {
      // دمج بدلاً من استبدال لمنع فقدان أقسام أضيفت بعد تخزين الكاش
      return;
    }

    // -------------------------------------------------------------------
    // منع السباق وتكرار الطلبات: الطلب الجاري يُشارَك على مستوى الوحدة، ثم
    // يدمج كل مكوّن النتيجة في حالته المحلية (حالة كل مكوّن مستقلة لأن
    // الخطاف غير موحّد عبر Context) فتظهر الأقسام عند أول من يطلبها،
    // وباقي النسخ فور اكتمال نفس الطلب — بدون أي طلب شبكة إضافي.
    // -------------------------------------------------------------------
    if (categoriesNetworkRequest) {
      await categoriesNetworkRequest;
      return;
    }

    const request = (categoriesNetworkRequest = (async () => {
      const revision = categoriesRevision;
      try {
        const data = await fetchCategoryRows(force);
        if (revision !== categoriesRevision) return [];
        const formatted = (data || []).map(formatCategoryRow);
        if (formatted.length === 0) {
          // نتيجة فارغة (جدول مفقود 42P01/قاعدة فارغة): لا تُطبَّق ولا تُحفظ
          // كناتج نهائي حتى لا تمسح الأقسام المخزنة محلياً
          // (ممنوع حفظ نتيجة مؤقتة فارغة كأنها النتيجة النهائية).
          return [];
        }
        applyFetchedCategories(formatted);
        try {
          await offlineStore.setItem(OFFLINE_KEYS.CATEGORIES, sessionCategoriesCache);
          writeLocalCustomCategories(sessionCategoriesCache!, false);
        } catch (cacheError) {
          console.warn('Failed to persist categories cache:', cacheError);
        }
        return formatted;
      } catch (e) {
        console.error('Error fetching custom categories:', e);
        return null;
      } finally {
        categoriesNetworkRequest = null;
      }
    })());

    const result = await request;
    if (result === null) mergeLocalCategoriesFallback();
  };

  const addCategory = async (cat: Omit<CustomCategory, 'slug'> & { slug: string }) => {
    try {
      const newCat = {
        slug: cat.slug,
        name: cat.name,
        icon: cat.icon,
        color: cat.color,
        image: cat.image || '',
        isCustom: true
      };

      // تحقق من التكرار قبل الإضافة - لا نضيف قسم موجود بالفعل
      let currentCategories: any[] = [];
      setCustomCategories(prev => {
        currentCategories = prev;
        return prev;
      });
      // قراءة الحالة الحالية مباشرة من الكاش أيضاً
      const cachedCategories = await offlineStore.getItem<any[]>(OFFLINE_KEYS.CATEGORIES) || [];
      const localCategories = readLocalCustomCategories();
      const allExisting = mergeCategoriesSafely(
        mergeCategoriesSafely(cachedCategories, localCategories),
        currentCategories
      );
      const validation = canAddCategory(allExisting, newCat);
      if (!validation.canAdd) {
        console.warn(`[addCategory] منع إضافة قسم مكرر: ${validation.reason}`);
        // نرجع القسم الموجود بدلاً من إنشاء واحد جديد
        const existing = allExisting.find(c => c.slug === newCat.slug);
        return existing ? { ...existing, isCustom: true } : newCat;
      }

      try {
        // Build insert payload: always include columns that exist in DB
        // slug, color, image are added by migration - include them if available
        const insertPayload: any = {
          name_ar: cat.name,
          icon: cat.icon,
          description: '',
        };
        // These columns exist after migration - include them (DB will ignore if column absent)
        insertPayload.slug = cat.slug;
        insertPayload.color = cat.color;
        insertPayload.image = cat.image || null;

        const { data, error } = await supabase.from('categories').insert([insertPayload]).select().single();

        if (error) throw error;

        if (data) {
          const dbCat = {
            slug: data.slug ?? data.id,
            dbId: data.id,
            name: data.name_ar ?? cat.name,
            icon: data.icon ?? cat.icon ?? 'Folder',
            color: data.color ?? cat.color ?? 'blue',
            image: data.image ?? cat.image,
            isCustom: true
          };
          setCustomCategories(prev => {
            // دمج آمن بدلاً من إضافة مباشرة - يمنع التكرار
            const next = mergeCategoriesSafely(prev, [dbCat]);
            writeLocalCustomCategories(next);
            return next;
          });

          const cached = await offlineStore.getItem<any[]>(OFFLINE_KEYS.CATEGORIES) || [];
          const nextCache = mergeCategoriesSafely(cached, [dbCat]);
          await offlineStore.setItem(OFFLINE_KEYS.CATEGORIES, nextCache);
          writeLocalCustomCategories(nextCache);

          return dbCat;
        }
      } catch (dbError) {
        console.warn('Failed to sync with Supabase, saving locally:', dbError);

        setCustomCategories(prev => {
          const next = mergeCategoriesSafely(prev, [newCat]);
          writeLocalCustomCategories(next);
          return next;
        });

        const cached = await offlineStore.getItem<any[]>(OFFLINE_KEYS.CATEGORIES) || [];
        const nextCache = mergeCategoriesSafely(cached, [newCat]);
        await offlineStore.setItem(OFFLINE_KEYS.CATEGORIES, nextCache);
        writeLocalCustomCategories(nextCache);

        const pending = await offlineStore.getItem<any[]>(OFFLINE_KEYS.PENDING_CATEGORIES) || [];
        await offlineStore.setItem(OFFLINE_KEYS.PENDING_CATEGORIES, [...pending, newCat]);

        return newCat;
      }
    } catch (e) {
      console.error('Error adding category:', e);
      throw e;
    }
  };

  const deleteCategory = async (category: any) => {
    const slug = category?.slug;
    const dbId = category?.dbId ?? category?.id ?? null;

    // Delete against the REAL primary key whenever the row actually lives in
    // Supabase (categories.id is an independent text key from categories.slug).
    const targetColumn = dbId != null ? 'id' : 'slug';
    const targetValue = dbId != null ? dbId : slug;

    if (targetValue == null) {
      throw new Error('لا يمكن الحذف: القسم لا يحتوي على معرّف (id) صالح.');
    }

    // 1) Perform the actual delete against public.categories.
    const { error: deleteError } = await supabase
      .from('categories')
      .delete()
      .eq(targetColumn, targetValue);
    if (deleteError) throw deleteError;

    // 2) Verify the row is REALLY gone from Supabase so we never report a
    //    false-positive delete (e.g. RLS/permissions silently keeping the row).
    const { data: leftover, error: verifyError } = await supabase
      .from('categories')
      .select('id')
      .eq(targetColumn, targetValue);
    if (verifyError) throw verifyError;
    if (leftover && leftover.length > 0) {
      throw new Error('القسم لم يُحذف فعليًا من قاعدة البيانات (يُراجَع مستوى الصلاحيات/RLS).');
    }

    // 3) ONLY after a confirmed Supabase delete: update the UI and local caches,
    //    so the category can never come back after a refresh.
    setCustomCategories(prev => {
      const next = prev.filter(c => c.slug !== slug);
      writeLocalCustomCategories(next);
      return next;
    });

    const cached = (await offlineStore.getItem<any[]>(OFFLINE_KEYS.CATEGORIES)) || [];
    const nextCache = cached.filter(c => c.slug !== slug && c.id !== dbId);
    await offlineStore.setItem(OFFLINE_KEYS.CATEGORIES, nextCache);
    writeLocalCustomCategories(nextCache);
  };

  const editCategory = async (slug: string, updates: Partial<CustomCategory>) => {
    try {
      const updatePayload: any = {};
      if (updates.name) updatePayload.name_ar = updates.name;
      if (updates.color) updatePayload.color = updates.color;
      if (updates.icon) updatePayload.icon = updates.icon;
      if (updates.image !== undefined) updatePayload.image = updates.image || null;

      const { error } = await supabase.from('categories').update(updatePayload).eq('slug', slug);
      if (error) throw error;

      setCustomCategories(prev => {
        const next = prev.map(c => c.slug === slug ? { ...c, ...updates } : c);
        writeLocalCustomCategories(next);
        return next;
      });

      const cached = await offlineStore.getItem<any[]>(OFFLINE_KEYS.CATEGORIES) || [];
      const nextCache = cached.map(c => c.slug === slug ? { ...c, ...updates } : c);
      await offlineStore.setItem(OFFLINE_KEYS.CATEGORIES, nextCache);
      writeLocalCustomCategories(nextCache);
    } catch (e) {
      console.error('Error editing category:', e);
      setCustomCategories(prev => {
        const next = prev.map(c => c.slug === slug ? { ...c, ...updates } : c);
        writeLocalCustomCategories(next);
        return next;
      });
      const cached = await offlineStore.getItem<any[]>(OFFLINE_KEYS.CATEGORIES) || [];
      const nextCache = cached.map(c => c.slug === slug ? { ...c, ...updates } : c);
      await offlineStore.setItem(OFFLINE_KEYS.CATEGORIES, nextCache);
      writeLocalCustomCategories(nextCache);
    }
  };

  const uniqueCategories = useMemo(() => {
    // Database-backed categories come first so a static entry cannot hide the
    // real categories.id (dbId) required by services.category_id.
    // نمنع التكرار بالـ slug وبالـ dbId معاً للحماية الكاملة
    return [...customCategories, ...staticCategories].reduce((acc: any[], current: any) => {
      const x = acc.find((item: any) =>
        item.slug === current.slug ||
        (current.dbId != null && item.dbId != null && String(item.dbId) === String(current.dbId))
      );
      if (!x) {
        return acc.concat([current]);
      } else {
        // إذا وجد تطابق بالـ slug لكن الجديد يحتوي dbId حقيقي، نحدّث القديم
        if (current.dbId != null && x.dbId == null) {
          const idx = acc.indexOf(x);
          acc[idx] = { ...x, dbId: current.dbId };
        }
        return acc;
      }
    }, [] as any[]).map(hydrateIconComponent);
  }, [customCategories]);

  return { categories: uniqueCategories, addCategory, deleteCategory, editCategory };
}

const CategoriesContext = createContext<ReturnType<typeof useCategoriesState> | null>(null);

export function CategoriesProvider({ children }: { children: ReactNode }) {
  const value = useCategoriesState();
  return createElement(CategoriesContext.Provider, { value }, children);
}

export function useCategories() {
  const value = useContext(CategoriesContext);
  if (!value) throw new Error('useCategories requires CategoriesProvider');
  return value;
}
