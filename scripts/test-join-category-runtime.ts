/**
 * اختبار Runtime فعلي لمشكلة «الانضمام إلى القسم غير متاح حالياً».
 *
 * 1) منطق الهدف: pickJoinTarget لكل قسم رئيسي وكل فرع في دليل وصال، في أسوأ
 *    الحالات (قائمة الأقسام العامة فارغة/غير محمّلة) — يجب أن يُعاد هدف صالح
 *    دائمًا لقسم معروف.
 * 2) قاعدة البيانات: نفس عمليات الواجهة الحرفية عبر REST بمفتاح anon:
 *    - تجهيز صف categories لقسم الأثاث (ensureSectionCategoryRow).
 *    - INSERT خدمة pending بنفس payload بناء buildInsertPayload.
 *    - قراءة الخدمة كزائر (يجب أن يخفيها RLS لأنها pending).
 *
 * تشغيل: node --require ./scripts/node-os-userinfo-shim.cjs --import tsx scripts/test-join-category-runtime.ts
 */
import { pickJoinTarget } from '../src/lib/serviceCategorySelection';
import { directorySections } from '../src/data/categoryDirectory';

const SUPABASE_URL = 'https://nnxrjpitjxtceydlcxzm.supabase.co';
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5ueHJqcGl0anh0Y2V5ZGxjeHptIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU2NDkyMjMsImV4cCI6MjA5MTIyNTIyM30.Ui1IQ4OOJ8wngBoNIBNe0nTCQgfm0q8P7AjrKhyAU4w';

const headers: Record<string, string> = {
  apikey: ANON_KEY,
  Authorization: `Bearer ${ANON_KEY}`,
  'Content-Type': 'application/json',
};

let failures = 0;

// ---------------------------------------------------------------------------
// 1) مصفوفة أهداف الانضمام — كل قسم رئيسي وكل فرع (قائمة الأقسام غير محمّلة).
// ---------------------------------------------------------------------------
let sectionsChecked = 0;
let childrenChecked = 0;
for (const section of directorySections) {
  const cases: Array<{ slug: string; childSlug?: string; childName?: string }> = [
    { slug: section.slug },
    ...section.children.map(child => ({ slug: section.slug, childSlug: child.slug, childName: child.name })),
  ];
  for (const joinSection of cases) {
    const target = pickJoinTarget(
      [], // لا مصادر DB محمّلة
      [], // قائمة الأقسام العامة غير محمّلة بعد
      { slug: joinSection.slug, name: section.name, childSlug: joinSection.childSlug, childName: joinSection.childName },
      () => undefined, // locateCategory غير متاح أيضًا (أسوأ حالة)
    );
    const expectedSlug = joinSection.childSlug ?? joinSection.slug;
    const ok = !!target && target.slug === expectedSlug && target.sectionSlug === section.slug && target.name.length > 0;
    if (!ok) {
      failures++;
      console.error(`FAIL join-target ${joinSection.slug}/${joinSection.childSlug ?? '-'} =>`, target);
    }
    if (joinSection.childSlug) childrenChecked++; else sectionsChecked++;
  }
}
console.log(`join-target: ${sectionsChecked} sections + ${childrenChecked} children checked, failures=${failures}`);

// حالة الأثاث المُبلّغ عنها تحديدًا: قسم الأثاث + فرع أثاث منزلي.
const furnitureTarget = pickJoinTarget([], [], { slug: 'furniture', name: 'الأثاث والمفروشات', childSlug: 'home-furniture', childName: 'أثاث منزلي' }, () => undefined);

// ---------------------------------------------------------------------------
// 2) ensureSectionCategoryRow — نفس عمليات الوحدة حرفيًا (REST/anon).
// ---------------------------------------------------------------------------
async function restGet(path: string): Promise<{ status: number; body: any }> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { headers });
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : null };
}

async function ensureCategoryRow(slug: string, nameAr: string): Promise<string | null> {
  const existing = await restGet(`categories?select=id,slug&slug=eq.${encodeURIComponent(slug)}&limit=1`);
  const row = Array.isArray(existing.body) ? existing.body[0] : undefined;
  if (row?.id) { console.log(`category row exists: ${slug} -> id=${row.id}`); return String(row.id); }

  const res = await fetch(`${SUPABASE_URL}/rest/v1/categories`, {
    method: 'POST',
    headers: { ...headers, Prefer: 'return=representation' },
    body: JSON.stringify({ id: slug, slug, name_ar: nameAr, name_en: slug, parent_id: null }),
  });
  const text = await res.text();
  console.log(`category provision POST ${slug}: status=${res.status} body=${text.slice(0, 300)}`);
  if (res.status === 201) {
    const created = JSON.parse(text);
    return created?.[0]?.id != null ? String(created[0].id) : slug;
  }
  if (res.status === 409) return slug; // سباق: الصف أُدرج للتو
  return null;
}

const CATEGORY_SLUG = 'home-furniture';
const categoryId = await ensureCategoryRow(CATEGORY_SLUG, 'أثاث منزلي');
console.log(`ensureSectionCategoryRow('${CATEGORY_SLUG}') => ${categoryId}`);
if (!categoryId) { failures++; console.error('FAIL category provisioning'); }

// ---------------------------------------------------------------------------
// 3) INSERT خدمة تجريبية pending بنفس payload بناء buildInsertPayload.
// ---------------------------------------------------------------------------
if (categoryId) {
  // هل عمود owner_id موجود؟ (يقرّر إرساله كما يفعل التطبيق)
  let hasOwnerIdColumn = true;
  const probe = await restGet('services?select=owner_id&limit=1');
  if (probe.status === 400 && String(probe.body?.message ?? '').includes('owner_id')) hasOwnerIdColumn = false;
  console.log('services.owner_id column exists:', hasOwnerIdColumn);

  const stamp = Date.now();
  const payload: Record<string, unknown> = {
    title: 'خدمة اختبار — أثاث منزلي (اختبار آلي للانضمام)',
    description: 'اختبار آلي للتحقق من إصلاح «الانضمام إلى القسم غير متاح حالياً». تُراجع ثم تُحذف من لوحة الإدارة.',
    phone: '07800000000',
    image_url: 'https://images.unsplash.com/photo-1556761175-5973dc0f32b7?w=800&q=80',
    video_url: null,
    status: 'pending',
    slug: `test-furniture-join-${stamp}`,
    profession: 'أثاث منزلي',
    address: 'النجف — اختبار آلي',
    latitude: null,
    longitude: null,
    category_id: categoryId,
  };
  if (hasOwnerIdColumn) payload.owner_id = 'runtime-join-test-device';

  // التطبيق الحقيقي يُدرج بدون RETURNING (useServices: سياسة SELECT تخفي
  // pending عن anon فتُفشل عبارة RETURNING بخطأ 42501 رغم نجاح الإدراج).
  const insertRes = await fetch(`${SUPABASE_URL}/rest/v1/services`, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });
  const insertText = await insertRes.text();
  console.log(`service INSERT (no RETURNING, exactly like the app): status=${insertRes.status} body=${insertText.slice(0, 200)}`);
  if (insertRes.status !== 201) {
    failures++;
    console.error('FAIL service insert');
  } else {
    // أ) RLS يفرض status='pending' حرفيًا: أي حالة أخرى يجب أن تُرفض.
    const approvedProbe = await fetch(`${SUPABASE_URL}/rest/v1/services`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ ...payload, slug: `${payload.slug}-approved-probe`, status: 'approved' }),
    });
    const approvedRejected = approvedProbe.status === 401 || approvedProbe.status === 403;
    console.log(`negative probe (status=approved): status=${approvedProbe.status} (expected 4xx - RLS must force pending)`);
    if (!approvedRejected) { failures++; console.error('FAIL RLS does not force pending'); }

    // ب) RLS يفرض owner_id غير فارغ.
    const noOwnerProbe = await fetch(`${SUPABASE_URL}/rest/v1/services`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ ...payload, slug: `${payload.slug}-noowner-probe`, owner_id: null }),
    });
    const noOwnerRejected = noOwnerProbe.status === 401 || noOwnerProbe.status === 403;
    console.log(`negative probe (owner_id=null): status=${noOwnerProbe.status} (expected 4xx - RLS must require owner_id)`);
    if (!noOwnerRejected) { failures++; console.error('FAIL RLS does not require owner_id'); }

    // ج) سياسة SELECT تخفي pending عن الزائر — تطابق توقّع لوحة الإدارة فقط.
    const slug = String(payload.slug);
    // 4) القراءة كزائر: pending يجب أن تكون مخفية بـRLS (تظهر للإدارة فقط).
    const readBack = await restGet(`services?select=id,status&slug=eq.${encodeURIComponent(slug)}&limit=5`);
    const visible = Array.isArray(readBack.body) ? readBack.body.length : -1;
    console.log(`anon readback of pending service: rows=${visible} (expected 0 - hidden by RLS until approved)`);
    if (visible !== 0) { failures++; console.error('FAIL pending service is visible to anon (RLS leak or wrong expectation)'); }
  }
}

console.log('furniture join target:', JSON.stringify(furnitureTarget));
if (!furnitureTarget || furnitureTarget.slug !== 'home-furniture') { failures++; console.error('FAIL furniture join target'); }

console.log(failures === 0 ? 'RESULT: ALL RUNTIME CHECKS PASSED' : `RESULT: ${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
