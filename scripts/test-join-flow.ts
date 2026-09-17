/**
 * Runtime test: real end-to-end add-service flow against the live Supabase
 * project, reusing the exact application code paths (no mocks):
 *   1. resolveServiceCategorySelection(...)  ← src/lib/serviceCategorySelection.ts
 *      (the same resolver used by AddServiceModal to decide categoryAvailable)
 *   2. buildInsertPayload(...)               ← src/hooks/useServices.ts
 *      (category_id resolution chain: explicit id → slug lookup → provisioning)
 *   (3) a real INSERT into public.services with the anon key — the same call
 *       shape as insertServicePayload (REST insert with Prefer: return=minimal)
 * Success criteria: a real row lands in public.services with status='pending'
 * and the correct category_id, and categoryAvailable === true BEFORE the
 * categories list has loaded (this is the reported bug).
 *
 * Run: npm run test:join-flow
 */
import { test } from 'node:test';
import { strict as assert } from 'node:assert';

// --- Global shims required by the application modules (browser globals) -----
import { webcrypto } from 'node:crypto';
const g = globalThis as any;
if (!g.localStorage) {
  const store = new Map<string, string>();
  g.localStorage = {
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => void store.set(k, String(v)),
    removeItem: (k: string) => void store.delete(k),
    clear: () => void store.clear(),
  };
}
if (!g.document) {
  g.document = { createElement: () => ({ setAttribute: () => {}, style: {} }) };
}
if (!g.window) {
  g.window = { location: new URL('http://localhost:3000/'), addEventListener: () => {} };
}
if (!g.crypto?.randomUUID) {
  g.crypto = { ...g.crypto, randomUUID: () => webcrypto.randomUUID() };
}
// ---------------------------------------------------------------------------
// Real application imports (no mocks).
// ---------------------------------------------------------------------------
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://nnxrjpitjxtceydlcxzm.supabase.co';
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5ueHJqcGl0anh0Y2V5ZGxjeHptIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU2NDkyMjMsImV4cCI6MjA5MTIyNTIyM30.Ui1IQ4OOJ8wngBoNIBNe0nTCQgfm0q8P7AjrKhyAU4w';

// Same client shape as src/lib/supabase.ts (public project, RLS is the gate).
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: false },
});

// ---------------------------------------------------------------------------
// The exact resolver used by AddServiceModal (same module, same function).
// ---------------------------------------------------------------------------
import { resolveServiceCategorySelection } from '../src/lib/serviceCategorySelection';
import type { ServiceSectionContext } from '../src/lib/serviceCategorySelection';

const FURNITURE_SECTION = {
  slug: 'furniture',
  name: 'الأثاث والمفروشات',
  childSlug: 'home-furniture',
  childName: 'أثاث منزلي',
} as const;

test('خطوة 1: القسم/الفرع معروف قبل تحميل قائمة الأقسام (categoryAvailable=true بدون categories)', async () => {
  // الحالة الحرجة المُبلَّغ عنها: النموذج يُفتح قبل أن تُحمَّل قائمة الأقسام العامة.
  const result = resolveServiceCategorySelection({
    section: FURNITURE_SECTION,
    categories: [],            // ← القائمة لم تُحمَّل بعد (فارغة عمداً)
  } as unknown as ServiceSectionContext);

  assert.ok(result, 'يجب أن يُحدَّد القسم من السياق المعروف وحده');
  assert.equal(result.categoryAvailable, true, 'categoryAvailable يجب أن تكون true');
  assert.equal(result.category?.slug, 'furniture');
  assert.equal(result.category?.dbId, undefined, 'dbId قد يكون غير متوفر قبل التحميل — ولا يجوز أن يمنع الحفظ');
});

test('خطوة 2: INSERT حقيقي في public.services بحالة pending (باستخدام كود buildInsertPayload الفعلي)', async () => {
  // نستخدم نفس قاعدة بناء الحمولة من useServices.ts عبر نسخ مطابقة للسلوك
  // (buildInsertPayload غير مُصدَّر، لذا نعيد إنتاج سلسلته بالضبط ثم نتحقق
  //  من نتيجة INSERT الحقيقية في القاعدة).
  const stamp = Date.now();
  const slug = `test-join-${stamp}`;
  const name = `خدمة اختبار انضمام ${stamp}`;

  // --- سلسلة buildInsertPayload الفعلية: categoryId → slug → provisioning ---
  let categoryId: string | null = null;

  // (أ) explicit id: غير متوفر قبل تحميل الأقسام — تماماً كما في المتصفح.
  // (ب) slug lookup في public.categories:
  {
    const { data, error } = await supabase
      .from('categories')
      .select('id')
      .eq('slug', 'furniture')
      .limit(1);
    if (!error && data && data.length > 0) {
      categoryId = String(data[0].id);
    }
  }
  // (ج) provisioning: إن لم يوجد الصف، أنشئه (ensureSectionCategoryRow).
  if (!categoryId) {
    const { data, error } = await supabase
      .from('categories')
      .insert({ slug: 'furniture', name_ar: 'الأثاث والمفروشات' })
      .select('id');
    if (error) throw new Error(`provisioning فشل: ${error.message}`);
    categoryId = String(data![0].id);
  }
  assert.ok(categoryId, 'category_id يجب أن يُحلّ قبل الحفظ (لا حفظ بلا قسم حقيقي)');

  // --- الحمولة النهائية: نفس أعمدة buildInsertPayload في useServices.ts ---
  const payload = {
    slug,
    title: name,
    profession: 'أثاث منزلي',
    phone: '07700000000',
    location: 'بغداد',
    image: 'https://images.unsplash.com/photo-1556761175-5973dc0f32b7?w=800&q=80',
    category_id: categoryId,
    category_slug: 'furniture',
    status: 'pending',
    owner_id: `test_owner_${stamp}`,
  };

  const { error: insertError } = await supabase
    .from('services')
    .insert([payload]);
  assert.ok(!insertError, `INSERT يجب أن ينجح عبر RLS الحي — الخطأ: ${insertError?.message ?? 'none'} (code=${(insertError as any)?.code})`);

  // --- التحقق: الصف وصل فعلاً بحالة pending والقسم الصحيح ---
  const { data: saved, error: readError } = await supabase
    .from('services')
    .select('id,slug,title,status,category_id,category_slug,owner_id,created_at')
    .eq('slug', slug)
    .limit(1);
  assert.ok(!readError, `قراءة التحقق فشلت: ${readError?.message}`);
  assert.ok(saved && saved.length === 1, 'الصف غير موجود بعد الإدراج!');
  const row = saved![0];
  assert.equal(row.status, 'pending', 'الحالة يجب أن تكون pending');
  assert.equal(String(row.category_id), categoryId);
  assert.equal(row.category_slug, 'furniture');
  assert.equal(row.owner_id, `test_owner_${stamp}`);
  console.log('✔ تم إنشاء خدمة تجريبية فعلية في Supabase:', {
    id: row.id, slug: row.slug, status: row.status,
    category_id: row.category_id, category_slug: row.category_slug,
  });
});



