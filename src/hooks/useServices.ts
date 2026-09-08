import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { offlineStore, OFFLINE_KEYS } from '../lib/offlineStore';
import { measureAdminOperation } from '../lib/adminPerformance';
import { notifyServiceChange } from '../lib/serviceChanges';
import { browserStorage } from '../lib/browserStorage';
import { withTimeout } from '../lib/withTimeout';

export interface Service {
  id?: string | number;
  slug: string;
  name: string;
  profession?: string;
  experience?: string;
  phone?: string;
  location: string;
  latitude?: number;
  longitude?: number;
  image: string;
  video?: string;
  categorySlug: string;
  // The REAL primary key of the section row in public.categories (services.category_id FK).
  // Kept alongside categorySlug so we never depend on the name/slug alone.
  categoryId?: string | number | null;
  subCategory?: string;
  createdAt: number;
  status?: 'pending' | 'approved' | 'rejected' | 'archived' | 'deleted';
  // Last modification time from services.updated_at (exists in DB - no new columns)
  updatedAt?: number;
  // Time of the admin decision from services.reviewed_at. For approved rows this
  // is the approval time and is the authoritative browse ordering key.
  reviewedAt?: number;
  rejectionReason?: string;
  isOffline?: boolean;
  ownerId?: string;
  userId?: number | null;
}

// Actual columns in public.services (verified against the live database):
// id (integer PK), title, description, price, image_url, category_id (FK -> categories.id),
// subcategory_id, user_id (integer), phone, lat, lng, service_type, experience, certificates,
// bio, video_url, views, created_at, slug, category_slug, profession, address,
// latitude, longitude, status, rejection_reason, reviewed_at, reviewed_by, updated_at
//
// NOTE: "owner_id" does NOT exist yet. It can be added later via supabase_add_owner_id.sql.
// The code below detects whether it exists and only sends it when available.

const carSubSlugs = [
  'car-electric', 'oil-change', 'car-wash', 'spare-parts',
  'car-rental', 'car-tires', 'car-accessories', 'car-filters', 'car-glass'
];

// Generate a unique owner ID for this device/browser
let memoryOwnerId: string | undefined;
export function getOwnerId(): string {
  let ownerId = browserStorage.get('saleen_owner_id') || memoryOwnerId;
  if (!ownerId) {
    ownerId = `owner_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
    browserStorage.set('saleen_owner_id', ownerId);
  }
  memoryOwnerId = ownerId;
  return ownerId;
}

// A valid service id is ONLY the real numeric primary key coming from public.services.
// Slugs, empty strings, NaN and zero are rejected so we never UPDATE/DELETE by anything but id.
export function isValidServiceId(id: unknown): id is string | number {
  if (id === undefined || id === null || id === '') return false;
  const num = typeof id === 'number' ? id : Number(id);
  return Number.isFinite(num) && num > 0;
}

// Log full Supabase error details (never silent)
function logSupabaseError(context: string, error: any) {
  console.error(`[Supabase:${context}]`, {
    message: error?.message,
    code: error?.code,
    details: error?.details,
    hint: error?.hint,
  });
}

// ---------------------------------------------------------------------------
// Categories cache: translates between categories.id (the real FK value stored
// in services.category_id) and the slug used by the UI. Loaded once per session.
// ---------------------------------------------------------------------------
let catIdToSlug: Map<string, string> | null = null;
let catSlugToId: Map<string, string> | null = null;
let categoriesRequest: Promise<void> | null = null;

async function ensureCategoriesCache(): Promise<void> {
  if (catIdToSlug && catSlugToId) return;
  if (categoriesRequest) return categoriesRequest;
  categoriesRequest = loadCategoriesCache();
  try { await categoriesRequest; } finally { categoriesRequest = null; }
}

async function loadCategoriesCache(): Promise<void> {
  try {
    const { data, error } = await withTimeout(measureAdminOperation('categories.lookup', () => supabase.from('categories').select('id, slug')));
    if (error) {
      logSupabaseError('ensureCategoriesCache', error);
      return;
    }
    catIdToSlug = new Map();
    catSlugToId = new Map();
    for (const row of (Array.isArray(data) ? data : []).filter(row => row && typeof row === 'object')) {
      const id = row.id !== undefined && row.id !== null ? String(row.id) : null;
      const slug = row.slug !== undefined && row.slug !== null ? String(row.slug) : null;
      if (id && slug) {
        catIdToSlug.set(id, slug);
        catSlugToId.set(slug, id);
      }
    }
  } catch (e) {
    console.error('[useServices] ensureCategoriesCache failed:', e);
  }
}

function getSlugForCategoryId(categoryId: string | number | null | undefined): string | undefined {
  if (categoryId === null || categoryId === undefined || !catIdToSlug) return undefined;
  return catIdToSlug.get(String(categoryId));
}

export function mapRowToService(item: any): Service {
  item = item && typeof item === 'object' ? item : {};
  const text = (value: unknown) => typeof value === 'string' ? value : typeof value === 'number' ? String(value) : '';
  const timestamp = (value: unknown) => {
    const parsed = typeof value === 'string' || typeof value === 'number' ? new Date(value).getTime() : NaN;
    return Number.isFinite(parsed) ? parsed : undefined;
  };
  // Resolve the UI-facing category slug WITHOUT inventing a fallback while the
  // service has a real category_id:
  //   1) explicit category_slug column
  //   2) translate category_id -> slug using the categories table cache
  //   3) keep it empty when the row has no category; never invent a category
  const rawCategoryId =
    item.category_id !== undefined && item.category_id !== null ? String(item.category_id) : null;
  let rawCategory: string | undefined =
    item.category_slug !== undefined && item.category_slug !== null ? String(item.category_slug) : undefined;
  if (!rawCategory && rawCategoryId) {
    rawCategory = getSlugForCategoryId(rawCategoryId);
  }
  rawCategory = rawCategory ?? '';
  const isCarSub = carSubSlugs.includes(rawCategory);
  return {
    id: item.id,
    slug: item.slug ?? String(item.id),
    categorySlug: isCarSub ? 'car-repair' : rawCategory,
    categoryId: rawCategoryId,
    subCategory: isCarSub ? rawCategory : undefined,
    name: text(item.title ?? item.name),
    profession: text(item.profession) || undefined,
    experience: text(item.description ?? item.experience) || undefined,
    location: text(item.address ?? item.location),
    latitude: item.latitude ?? item.lat ?? undefined,
    longitude: item.longitude ?? item.lng ?? undefined,
    phone: text(item.phone) || undefined,
    image: text(item.image_url ?? item.image),
    video: text(item.video_url ?? item.video) || undefined,
    createdAt: timestamp(item.created_at) ?? 0,
    // "آخر تحديث" for the archive view - read-only from the existing updated_at column
    updatedAt: timestamp(item.updated_at),
    reviewedAt: timestamp(item.reviewed_at),
    // fail-closed: أي صف بلا status يُعتبر pending (لا يظهر للعامة أبداً
    // حتى يوافق المدير) - لا يجوز افتراض 'approved' أبداً.
    status: item.status ?? 'pending',
    rejectionReason: item.rejection_reason ?? undefined,
    ownerId: item.owner_id ?? undefined,
    userId: item.user_id ?? null,
  };
}

// ---------------------------------------------------------------------------
// Column capability detection (cached per session)
// ---------------------------------------------------------------------------
let ownerIdColumnSupported: boolean | null = null;

async function checkOwnerIdColumn(): Promise<boolean> {
  if (ownerIdColumnSupported !== null) return ownerIdColumnSupported;
  try {
    const { error } = await withTimeout(supabase.from('services').select('owner_id').limit(1));
    ownerIdColumnSupported = !error;
    if (error) {
      console.warn(
        '[useServices] Column "owner_id" is not available in public.services. ' +
        'Run supabase_add_owner_id.sql to enable owner tracking.',
        { message: error.message, code: error.code, details: error.details, hint: error.hint }
      );
    }
  } catch (e) {
    ownerIdColumnSupported = false;
  }
  return ownerIdColumnSupported;
}

// Resolve a category slug used by the UI to the real categories.id value,
// because services.category_id is a FOREIGN KEY to categories.id.
// On INSERT a database trigger derives category_slug from category_id,
// so sending category_slug alone results in NULL - we must send category_id.
// If the section does not exist yet in public.categories (e.g. "المحامين"),
// Missing categories are never created here. A service must reference an
// existing public.categories row selected by the user.
async function resolveCategoryId(categorySlug?: string): Promise<string | null> {
  if (!categorySlug) return null;
  await ensureCategoriesCache();
  const cachedId = catSlugToId?.get(categorySlug);
  if (cachedId) return cachedId;

  try {
    const { data, error } = await supabase
      .from('categories')
      .select('id')
      .or(`slug.eq.${categorySlug},id.eq.${categorySlug}`)
      .limit(1);
    if (error) {
      logSupabaseError('resolveCategoryId', error);
      return null;
    }
    if (data && data.length > 0) {
      const foundId = (data[0] as any).id !== undefined && (data[0] as any).id !== null
        ? String((data[0] as any).id)
        : null;
      if (foundId) {
        catSlugToId?.set(categorySlug, foundId);
        catIdToSlug?.set(foundId, categorySlug);
      }
      return foundId;
    }

    return null;
  } catch (e) {
    console.error('[useServices] resolveCategoryId failed:', e);
    return null;
  }
}

// Verify an explicit category id really exists in public.categories.
async function verifyCategoryIdExists(categoryId: string): Promise<boolean> {
  await ensureCategoriesCache();
  if (catIdToSlug?.has(categoryId)) return true;
  try {
    const { data, error } = await supabase.from('categories').select('id').eq('id', categoryId).limit(1);
    if (error) {
      logSupabaseError('verifyCategoryIdExists', error);
      return false;
    }
    return !!data && data.length > 0;
  } catch (e) {
    console.error('[useServices] verifyCategoryIdExists failed:', e);
    return false;
  }
}

// Build insert payload - ONLY columns that actually exist in public.services.
async function buildInsertPayload(serviceData: Omit<Service, 'createdAt'>): Promise<Record<string, any>> {
  const payload: Record<string, any> = {
    title: serviceData.name,
    description: serviceData.experience ?? null,
    phone: serviceData.phone ?? null,
    image_url: serviceData.image ?? null,
    video_url: serviceData.video ?? null,
    status: serviceData.status ?? 'pending',
    slug: serviceData.slug,
    profession: serviceData.profession ?? null,
    address: serviceData.location ?? null,
    latitude: serviceData.latitude ?? null,
    longitude: serviceData.longitude ?? null,
  };

  // category_id is required (FK). Priority:
  //   1) the explicit real categories.id passed by the caller (current section)
  //   2) resolve the real categories.id from the slug
  // NEVER save NULL while the section is known.
  let categoryId: string | null = null;
  if (
    serviceData.categoryId !== undefined &&
    serviceData.categoryId !== null &&
    String(serviceData.categoryId) !== ''
  ) {
    const explicitId = String(serviceData.categoryId);
    if (await verifyCategoryIdExists(explicitId)) {
      categoryId = explicitId;
    }
  }
  if (!categoryId) {
    categoryId = await resolveCategoryId(serviceData.categorySlug);
  }
  if (categoryId) {
    payload.category_id = categoryId;
  } else {
    // القاعدة الأساسية: لا تُحفظ خدمة بلا قسم حقيقي أبداً (ممنوع fallback 'general').
    // يظهر الخطأ الحقيقي للمستخدم ويُسجل في الكونسول بدل تخمين القسم.
    const err = new Error(
      `تعذر ربط الخدمة بالقسم "${serviceData.categorySlug || '(غير محدد)'}": ` +
      'لم يتم العثور على صف مطابق في public.categories ولم يتمكن النظام من إنشائه. ' +
      'لم يتم حفظ الخدمة حفظاً حتى لا تظهر في قسم خاطئ. حاول مرة أخرى أو اختر قسماً موجوداً.'
    );
    console.error('[useServices:buildInsertPayload]', err.message, { categorySlug: serviceData.categorySlug, categoryId: serviceData.categoryId });
    throw err;
  }

  // owner tracking column (only sent when the column exists in the DB).
  // services.owner_id عمود نصي (text) — يُحفظ دائماً بمعرف الجهاز النصي getOwnerId().
  if (await checkOwnerIdColumn()) {
    payload.owner_id = serviceData.ownerId ?? getOwnerId();
  }

  if (serviceData.rejectionReason !== undefined) {
    payload.rejection_reason = serviceData.rejectionReason;
  }

  return payload;
}

function cachedServices(value: unknown): Service[] {
  return Array.isArray(value) ? value.filter(s => s && typeof s === 'object' && typeof s.slug === 'string' && typeof s.name === 'string') : [];
}

export function useServices() {
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const servicesRevision = useRef(0);
  const fetchRequest = useRef<Promise<void> | null>(null);
  const cacheQueue = useRef<Promise<unknown>>(Promise.resolve());
  const persistServices = useCallback((update: (cached: Service[]) => Service[]) => {
    cacheQueue.current = cacheQueue.current.then(() => measureAdminOperation('services.cache', async () => {
      const cached = cachedServices(await offlineStore.getItem(OFFLINE_KEYS.SERVICES));
      await offlineStore.setItem(OFFLINE_KEYS.SERVICES, update(cached));
    })).catch(error => console.warn('[Services] Cache write failed:', error));
    return cacheQueue.current;
  }, []);
  const publicServices = useMemo(
    () => services
      .filter(service => service.status === 'approved')
      .sort((a, b) =>
        (b.reviewedAt ?? b.createdAt) - (a.reviewedAt ?? a.createdAt)
      ),
    [services]
  );

  const fetchServices = useCallback((): Promise<void> => {
    if (fetchRequest.current) return fetchRequest.current;
    setLoading(true);
    setError(null);
    const version = servicesRevision.current;
    const request = (async () => {
    // يُفحص داخل كل مرحلة: إذا عدّل المستخدم قائمة الخدمات أثناء الجلب
    // (إضافة/تعديل/حذف) نتوقف فورًا كي لا نمسح حالته بالبيانات القديمة.
    const isStale = () => servicesRevision.current !== version;
    try {
      // Make sure the categories cache is ready BEFORE mapping rows,
      // so category_id -> slug translation works on the first load.
      await ensureCategoriesCache();

      // -------------------------------------------------------------------
      // تحميل تدريجي للخدمات (Lazy/Paginated loading):
      // كان الجلب القديم يقرأ حتى 1000 صف بكل أعمدته (الصور والفيديوهات
      // مخزّنة base64 داخل الصفوف نفسها) في طلب شبكة واحد ضخم تنتظره
      // الواجهة قبل أول عرض — هذا كان سبب البطء الحقيقي على GitHub Pages.
      // الآن: أول 40 خدمة فقط تُجلب وتُعرض فورًا، ثم تُجلب بقية الصفحات في
      // الخلفية صفحةً صفحة. لا يتغير أي شيء في قاعدة البيانات (استعلام فقط).
      // -------------------------------------------------------------------
      const PAGE_SIZE = 40;
      const approvedServices: Service[] = [];
      const ownerPending: Service[] = [];
      const ownerRejected: Service[] = [];

      const fetchApprovedPage = (from: number) => supabase
        .from('services')
        .select('*')
        .eq('status', 'approved')
        .order('reviewed_at', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false })
        // ترتيب حاسم بالمعرّف حتى لا يتكرر أو يفقد صف بين صفحتين متتاليتين.
        .order('id', { ascending: false })
        .range(from, from + PAGE_SIZE - 1);

      const renderState = () => {
        if (isStale()) return false;
        // Combine: approved first, then user's pending, then user's rejected
        setServices([...approvedServices, ...ownerPending, ...ownerRejected]);
        return true;
      };

      // الصفحة الأولى: تُعرض فورًا ولا ينتظر المستخدم بقية طلبات الشبكة.
      const { data: firstPage, error: firstError } = await withTimeout(measureAdminOperation('services.approved', () => fetchApprovedPage(0)));

      if (firstError) {
        logSupabaseError('fetchServices(approved)', firstError);
        throw firstError;
      }
      approvedServices.push(...(firstPage || []).map(mapRowToService));

      // سياسة RLS الحالية تمنع anon من قراءة الخدمات غير المعتمدة، لذلك الخدمة
      // التي أضافها هذا الجهاز للتو (status = pending) لا تُعاد من قاعدة البيانات
      // وتختفي من الواجهة بعد كل fetch. نحافظ عليها محلياً من الكاش (بيانات هذا
      // الجهاز فقط) حتى تظهر فوراً في التصفح الاجتماعي وصفحة القسم حتى موافقة
      // المدير — وبعد الموافقة يُستبدل الصف المحلي بصف القاعدة (Dedupe حسب slug).
      try {
        const myOwnerId = getOwnerId();
        await cacheQueue.current;
        const cachedBefore = cachedServices(await offlineStore.getItem(OFFLINE_KEYS.SERVICES));
        const knownSlugs = new Set(approvedServices.map((s) => s.slug));
        const localPending = cachedBefore.filter(
          (s) => s.status === 'pending' && (s.ownerId ?? '') === myOwnerId && !knownSlugs.has(s.slug)
        );
        if (localPending.length > 0) {
          approvedServices.push(...localPending);
        }
      } catch (e) {
        console.warn('[useServices] merge local pending failed:', e);
      }

      // أول عرض هنا: الواجهة جاهزة قبل استعلامات المالك وباقي الصفحات.
      if (!renderState()) return;
      setLoading(false);

      // Fetch this device's pending/rejected services (requires owner_id column)
      // تُجلب بعد أول عرض لأنها ليست شرطًا لظهور الواجهة.
      if (await checkOwnerIdColumn()) {
        const ownerId = getOwnerId();

        const { data: pendingData, error: pendingError } = await withTimeout(measureAdminOperation('services.owner.pending', () => supabase
          .from('services')
          .select('*')
          .eq('status', 'pending')
          .eq('owner_id', ownerId)
          .order('created_at', { ascending: false })));

        if (pendingError) {
          logSupabaseError('fetchServices(pending)', pendingError);
        } else {
          ownerPending.push(...(pendingData || []).map(mapRowToService));
        }

        const { data: rejectedData, error: rejectedError } = await withTimeout(measureAdminOperation('services.owner.rejected', () => supabase
          .from('services')
          .select('*')
          .eq('status', 'rejected')
          .eq('owner_id', ownerId)
          .order('created_at', { ascending: false })));

        if (rejectedError) {
          logSupabaseError('fetchServices(rejected)', rejectedError);
        } else {
          ownerRejected.push(...(rejectedData || []).map(mapRowToService));
        }
        renderState();
      }

      // بقية صفحات الخدمات المعتمدة: تحميل تدريجي في الخلفية.
      for (let from = PAGE_SIZE; firstPage?.length === PAGE_SIZE; from += PAGE_SIZE) {
        if (isStale()) return;
        const { data: pageData, error: pageError } = await withTimeout(measureAdminOperation('services.approved.page', () => fetchApprovedPage(from)));
        if (pageError) {
          logSupabaseError('fetchServices(approved.page)', pageError);
          setError('تعذر تحميل بقية الخدمات. تحقق من الاتصال وأعد المحاولة.');
          break;
        }
        const rows = (pageData || []).map(mapRowToService);
        approvedServices.push(...rows);
        if (!renderState()) return;
        if (rows.length < PAGE_SIZE) break;
      }

      // حفظ القائمة الكاملة في الكاش مرة واحدة بالنهاية (وليس مع كل صفحة)
      // لتقليل كتابات IndexedDB الضخمة (الصور base64 داخل الكائنات).
      if (!isStale()) {
        void persistServices(cached => (isStale() ? cached : [...approvedServices, ...ownerPending, ...ownerRejected]));
      }
    } catch (error) {
      logSupabaseError('fetchServices', error);
      if (!isStale()) setError('تعذر تحميل الخدمات. تحقق من اتصال الإنترنت وأعد المحاولة.');
    } finally {
      setLoading(false);
    }
    })();
    fetchRequest.current = request;
    void request.finally(() => {
      fetchRequest.current = null;
      if (servicesRevision.current !== version) void fetchServices();
    });
    return request;
  }, [persistServices]);

  const applyServiceUpdate = useCallback((service: Service) => {
    servicesRevision.current++;
    const apply = (list: Service[]) => list.some(s => String(s.id) === String(service.id))
      ? list.map(s => String(s.id) === String(service.id) ? service : s)
      : service.status === 'approved' ? [service, ...list] : list;
    setServices(apply);
    notifyServiceChange({ kind: 'updated', service });
    void persistServices(apply);
  }, [persistServices]);

  // Legacy offline queue drain (kept for rows queued by older versions).
  const syncPendingServices = useCallback(async () => {
    const pending = cachedServices(await offlineStore.getItem(OFFLINE_KEYS.PENDING_SERVICES));
    if (pending.length === 0) return;

    console.log(`Syncing ${pending.length} locally-queued services...`);
    const remaining: Service[] = [];

    for (const service of pending) {
      try {
        const payload = await buildInsertPayload(service);
        const { error } = await supabase.from('services').insert([payload]);
        if (error) {
          logSupabaseError(`syncPendingServices(${service.slug})`, error);
          remaining.push(service);
        }
      } catch (e) {
        remaining.push(service);
      }
    }

    await offlineStore.setItem(OFFLINE_KEYS.PENDING_SERVICES, remaining);
    if (remaining.length < pending.length) {
      fetchServices();
    }
  }, []);

  useEffect(() => {
    const init = async () => {
      const cached = cachedServices(await offlineStore.getItem(OFFLINE_KEYS.SERVICES));

      // Show cached data immediately (offline support only),
      // then replace it with fresh data straight from Supabase.
      if (cached) {
        setServices(cached);
      }

      await fetchServices();
      await syncPendingServices();
    };

    void init().catch(error => console.warn('تعذرت مزامنة النسخة المحلية:', error));

    const handleOnline = () => {
      console.log('Connection restored. Syncing...');
      void fetchServices();
      void syncPendingServices().catch(error => console.warn('تعذرت مزامنة النسخة المحلية:', error));
    };
    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, [syncPendingServices]);

  const addService = async (serviceData: Omit<Service, 'createdAt'>) => {
    const payload = await buildInsertPayload(serviceData);

    // INSERT بدون RETURNING: الخدمة الجديدة حالتها pending ولا تسمح سياسة SELECT
    // لـ anon بقراءة الصف الجديد، وعبارة RETURNING (‎.select()‎) تسبب خطأ 42501
    // (new row violates row-level security policy) حتى لو كان الـ INSERT نفسه صالحاً.
    const { error } = await measureAdminOperation('services.insert', () => supabase
      .from('services')
      .insert([payload]));

    if (error) {
      // NEVER treat a failed INSERT as success. Surface the real error.
      logSupabaseError('addService(INSERT)', error);
      throw error;
    }

    // Admin re-queries immediately after INSERT, without waiting for owner ID/cache/public reads.
    servicesRevision.current++;
    notifyServiceChange({ kind: 'created' });

    // بناء كائن الخدمة محلياً من الـ payload والقيم المعروفة فقط (بدون صف مُعاد).
    // الـ id الرقمي الحقيقي سيأتي من fetchServices() أدناه التي تعيد الجلب من القاعدة.
    const syncedService: Service = {
      ...serviceData,
      createdAt: Date.now(),
      // احتفاظ صريح بمالك الخدمة: معرف الجهاز النصي getOwnerId().
      ownerId: serviceData.ownerId ?? getOwnerId(),
      isOffline: false,
    };

    // جلب الـ id الرقمي الحقيقي للخدمة المعلقة عبر دالة آمنة (تتحقق من slug +
    // owner_id معاً). بدون هذا الـ id لا يمكن ربط التفاعلات والتعليقات بالمنشور.
    // Publish the confirmed insert locally; admin lists still fetch real database rows.
    const addIfMissing = (list: Service[]) => list.some(s => s.slug === syncedService.slug)
      ? list : [syncedService, ...list];
    setServices(addIfMissing);
    const savedToCache = persistServices(addIfMissing);

    // ID enrichment and reconciliation must not keep the save modal blocked.
    void (async () => {
      try {
        const { data: pendingId, error } = await measureAdminOperation('services.pendingId', () => supabase.rpc('get_own_pending_service_id', {
          p_slug: payload.slug,
          p_owner_id: (payload.owner_id as string) ?? getOwnerId(),
        }));
        if (error) logSupabaseError('addService(get_own_pending_service_id)', error);
        else if (pendingId) {
          const enrich = (list: Service[]) => list.map(s => s.slug === syncedService.slug && !isValidServiceId(s.id)
            ? { ...s, id: pendingId } : s);
          servicesRevision.current++;
          setServices(enrich);
          await persistServices(enrich);
        }
      } catch (error) {
        console.warn('[Services] Pending ID lookup failed:', error);
      }
      await savedToCache;
      void fetchServices();
    })();

    return syncedService;
  };

  // UPDATE by primary key (id) - never by slug
  const editService = async (id: string | number, updatedData: Partial<Service>) => {
    // Strict validation: refuse to run any UPDATE without the real numeric id from Supabase
    if (!isValidServiceId(id)) {
      const err = new Error(
        `editService: معرّف الخدمة غير صالح (القيمة المستلمة: ${JSON.stringify(id)}). ` +
        'يجب استخدام الـ id الرقمي الحقيقي القادم من صف Supabase، وليس slug أو قيمة فارغة.'
      );
      console.error('[Supabase:editService]', err.message);
      throw err;
    }

    const updatePayload: any = {};
    if (updatedData.name !== undefined) updatePayload.title = updatedData.name;
    if (updatedData.experience !== undefined) updatePayload.description = updatedData.experience;
    if (updatedData.phone !== undefined) updatePayload.phone = updatedData.phone;
    if (updatedData.image !== undefined) updatePayload.image_url = updatedData.image;
    if (updatedData.profession !== undefined) updatePayload.profession = updatedData.profession;
    if (updatedData.location !== undefined) updatePayload.address = updatedData.location;
    if (updatedData.latitude !== undefined) updatePayload.latitude = updatedData.latitude;
    if (updatedData.longitude !== undefined) updatePayload.longitude = updatedData.longitude;
    if (updatedData.status !== undefined) updatePayload.status = updatedData.status;

    if (updatedData.categorySlug !== undefined || updatedData.categoryId !== undefined) {
      // Resolve the real FK value. Priority:
      //   1) explicit categoryId passed by the caller (the unchanged original id)
      //   2) resolve the slug against public.categories
      // NEVER write NULL over an existing category_id: if resolution fails the
      // column is left untouched so the service keeps its ORIGINAL section.
      let categoryId: string | null = null;
      if (
        updatedData.categoryId !== undefined &&
        updatedData.categoryId !== null &&
        String(updatedData.categoryId) !== ''
      ) {
        const explicitId = String(updatedData.categoryId);
        if (await verifyCategoryIdExists(explicitId)) {
          categoryId = explicitId;
        }
      }
      if (!categoryId && updatedData.categorySlug) {
        categoryId = await resolveCategoryId(updatedData.categorySlug);
      }
      if (categoryId) {
        updatePayload.category_id = categoryId;
        updatePayload.category_slug =
          updatedData.categorySlug ?? getSlugForCategoryId(categoryId) ?? null;
      } else {
        console.warn(
          '[useServices] editService: could not resolve the category - keeping the existing category_id untouched.'
        );
      }
    }

    // When approving a service, always clear the rejection reason
    if (updatedData.status === 'approved') {
      updatePayload.rejection_reason = null;
    } else if (updatedData.rejectionReason !== undefined) {
      updatePayload.rejection_reason = updatedData.rejectionReason;
    }

    if (Object.keys(updatePayload).length === 0) return;

    // Diagnostic: always print the exact id used in the UPDATE statement
    console.log('[Supabase:editService] UPDATE public.services SET', updatePayload, 'WHERE id =', id);

    const { data: updatedRow, error } = await measureAdminOperation('admin.update', () => supabase.rpc('admin_update_service', {
      p_id: Number(id),
      p_payload: updatePayload,
    }));

    if (error) {
      logSupabaseError('editService(UPDATE)', error);
      // PGRST116 = the UPDATE matched 0 rows: either the id does not exist in public.services,
      // or the row exists but the database refused the UPDATE for the current role
      // (missing GRANT / RLS policy) - PostgREST then reports 0 affected rows.
      if ((error as any).code === 'PGRST116') {
        console.error(
          `[Supabase:editService] PGRST116 diagnosis: verify the row exists and that the anon role ` +
          `is allowed to UPDATE public.services (id sent was ${JSON.stringify(id)}). ` +
          `Run in SQL editor (read-only check): SELECT id, status FROM public.services WHERE id = ${Number(id)};`
        );
        const err = new Error(
          `editService: لم يتم تعديل أي صف في public.services بالمعرّف id=${id} (PGRST116). ` +
          'إما أن الـ id غير موجود في قاعدة البيانات، أو أن قاعدة البيانات منعت عملية التحديث لهذا الدور (صلاحيات/RLS). ' +
          'تأكد أن الخدمة المعروضة تحتفظ بالـ id الحقيقي القادم من Supabase.'
        );
        console.error('[Supabase:editService]', err.message);
        throw err;
      }
      throw error;
    }

    if (!updatedRow) {
      const err = new Error(`editService: no row updated for id=${id}`);
      console.error('[Supabase:editService]', err.message);
      throw err;
    }

    console.log('[Supabase:editService] UPDATE succeeded:', { id, fields: Object.keys(updatePayload) });

    // The RPC returns the complete committed row. No whole-list read is needed here.
    applyServiceUpdate(mapRowToService(updatedRow));
  };

  // DELETE by primary key (id) - never by slug
  const deleteService = async (id: string | number) => {
    // Strict validation: refuse to run any DELETE without the real numeric id from Supabase
    if (!isValidServiceId(id)) {
      const err = new Error(
        `deleteService: معرّف الخدمة غير صالح (القيمة المستلمة: ${JSON.stringify(id)}). ` +
        'يجب استخدام الـ id الرقمي الحقيقي القادم من صف Supabase، وليس slug أو قيمة فارغة.'
      );
      console.error('[Supabase:deleteService]', err.message);
      throw err;
    }

    // Diagnostic: always print the exact id used in the DELETE statement
    console.log('[Supabase:deleteService] DELETE FROM public.services WHERE id =', id);

    // admin_delete_service تحذف الصف وتعيده (أو null إن لم يوجد) حتى نتحقق
    // من أن صفاً واحداً على الأقل أُزيل فعلاً من قاعدة البيانات.
    const { data: deletedRow, error } = await supabase.rpc('admin_delete_service', {
      p_id: Number(id),
    });

    if (error) {
      logSupabaseError('deleteService(DELETE)', error);
      throw error;
    }

    if (!deletedRow) {
      const err = new Error(
        `deleteService: لم يتم حذف أي صف من public.services بالمعرّف id=${id}. ` +
        'قد يكون الصف غير موجود أو أن صلاحيات قاعدة البيانات (RLS) تمنع الحذف.'
      );
      console.error('[Supabase:deleteService]', err.message);
      throw err;
    }

    console.log('[Supabase:deleteService] DELETE succeeded:', { id });

    servicesRevision.current++;
    setServices(prev => prev.filter(s => String(s.id) !== String(id)));
    notifyServiceChange({ kind: 'deleted', id });
    void persistServices(cached => cached.filter(s => String(s.id) !== String(id)));
  };

  // Fetch all pending services (for admin panel) - Supabase ONLY, no local fallback.
  // تمر عبر دالة قاعدة البيانات admin_list_services (SECURITY DEFINER) لأن سياسات
  // RLS الحالية تمنع الدور العام (anon) من قراءة الخدمات غير المعتمدة، ولا نغيّر
  // سياسات RLS نفسها.
  const fetchAllPendingServices = useCallback(async (): Promise<Service[]> => {
    const [, result] = await Promise.all([
      ensureCategoriesCache(),
      measureAdminOperation('admin.list.pending', () => supabase.rpc('admin_list_services', { p_status: 'pending' })),
    ]);
    if (result.error) {
      logSupabaseError('fetchAllPendingServices', result.error);
      throw result.error;
    }
    return (result.data || []).map(mapRowToService);
  }, []);

  // Fetch all rejected services (for admin panel) - Supabase ONLY, no local fallback.
  // تمر عبر دالة قاعدة البيانات admin_list_services (SECURITY DEFINER) لنفس السبب أعلاه.
  const fetchAllRejectedServices = useCallback(async (): Promise<Service[]> => {
    const [, result] = await Promise.all([
      ensureCategoriesCache(),
      measureAdminOperation('admin.list.rejected', () => supabase.rpc('admin_list_services', { p_status: 'rejected' })),
    ]);
    if (result.error) {
      logSupabaseError('fetchAllRejectedServices', result.error);
      throw result.error;
    }
    return (result.data || []).map(mapRowToService);
  }, []);

  return {
    services,
    publicServices,
    loading,
    error,
    addService,
    editService,
    applyServiceUpdate,
    deleteService,
    refreshServices: fetchServices,
    syncPendingServices,
    fetchAllPendingServices,
    fetchAllRejectedServices,
  };
}
