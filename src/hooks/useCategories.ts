import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { categories as staticCategories } from '../data/categories';
import { offlineStore, OFFLINE_KEYS } from '../lib/offlineStore';
import { getCategoryIcon } from '../data/categoryIcons';
import { resolveCategoryIcon } from '../data/serviceIcons';
import { withTimeout } from '../lib/withTimeout';


export interface CustomCategory {
  slug: string;
  name: string;
  icon: string;
  color: string;
  image?: string;
  isCustom?: boolean;
}

const localCategoriesKey = 'saleen_custom_categories_v1';
const categoryRecords = (value: unknown): any[] => Array.isArray(value)
  ? value.filter(item => item && typeof item === 'object' && item.slug != null)
  : [];

// ==============================
// Session-level cache لمنع إعادة جلب التصنيفات من الشبكة عند كل زيارة/تركيب
// (مثل الانتقال بين الصفحات). يمنع الطلب المكرر ويُسرّع التنقل.
// ==============================
const CATEGORIES_CACHE_TTL = 45 * 1000;
let sessionCategoriesCache: any[] | null = null;
let sessionCategoriesCacheAt = 0;

const readLocalCustomCategories = () => {
  if (typeof window === 'undefined') return [];

  try {
    const raw = localStorage.getItem(localCategoriesKey);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return categoryRecords(parsed).map(c => ({ ...c, isCustom: true }));
  } catch (error) {
    console.warn('Failed to read local custom categories:', error);
    return [];
  }
};

const writeLocalCustomCategories = (items: any[]) => {
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

export function useCategories() {
  const [customCategories, setCustomCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const init = async () => {
      const cached = categoryRecords(await offlineStore.getItem(OFFLINE_KEYS.CATEGORIES));
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

    void init().catch(error => console.warn('تعذرت قراءة الأقسام المحلية:', error));
  }, []);

  const fetchCustomCategories = async (force = false) => {
    // إذا كانت بيانات حديثة موجودة في ذاكرة الجلسة وغير مجبرين على التحديث،
    // نستخدمها فوراً دون الاتصال بالشبكة (يمنع الطلب المكرر عند التنقل).
    if (!force && sessionCategoriesCache !== null && Date.now() - sessionCategoriesCacheAt < CATEGORIES_CACHE_TTL) {
      setCustomCategories(sessionCategoriesCache);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const { data, error } = await withTimeout(supabase.from('categories').select('*'));
      if (error && error.code !== '42P01') throw error;
      if (data) {
        const formatted = (Array.isArray(data) ? data : []).filter(d => d && typeof d === 'object').map(d => ({
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
        }));
        setCustomCategories(formatted);
        sessionCategoriesCache = formatted;
        sessionCategoriesCacheAt = Date.now();
        await offlineStore.setItem(OFFLINE_KEYS.CATEGORIES, formatted);
        writeLocalCustomCategories(formatted);
      }
    } catch (e) {
      const localFallback = readLocalCustomCategories();
      console.error('Error fetching custom categories:', e);
      setError('تعذر تحميل الأقسام. تحقق من الاتصال وأعد المحاولة.');
      if (localFallback.length > 0) {
        setCustomCategories(localFallback);
      }
    } finally {
      setLoading(false);
    }
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
            const next = [...prev, dbCat];
            writeLocalCustomCategories(next);
            return next;
          });

          const cached = await offlineStore.getItem<any[]>(OFFLINE_KEYS.CATEGORIES) || [];
          const nextCache = [...cached, dbCat];
          await offlineStore.setItem(OFFLINE_KEYS.CATEGORIES, nextCache);
          writeLocalCustomCategories(nextCache);

          return dbCat;
        }
      } catch (dbError) {
        console.warn('Failed to sync with Supabase, saving locally:', dbError);

        setCustomCategories(prev => {
          const next = [...prev, newCat];
          writeLocalCustomCategories(next);
          return next;
        });

        const cached = await offlineStore.getItem<any[]>(OFFLINE_KEYS.CATEGORIES) || [];
        const nextCache = [...cached, newCat];
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
    return [...customCategories, ...staticCategories].reduce((acc: any[], current: any) => {
      const x = acc.find((item: any) => item.slug === current.slug);
      if (!x) {
        return acc.concat([current]);
      } else {
        return acc;
      }
    }, [] as any[]).map(hydrateIconComponent);
  }, [customCategories]);

  return { categories: uniqueCategories, loading, error, refreshCategories: () => fetchCustomCategories(true), addCategory, deleteCategory, editCategory };
}
