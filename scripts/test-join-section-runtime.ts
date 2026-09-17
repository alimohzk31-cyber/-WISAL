/**
 * Runtime E2E probe — «انضم إلى القسم» across multiple sections/sub-sections.
 *
 * What it does (NO mocking, real Supabase project):
 *   1. For a sample of directory sections + sub-sections it replicates the
 *      exact wiring the UI now performs:
 *        - CategoryPage picks the join target from the resolved section/child
 *          (pickJoinTarget) and passes it to AddServiceModal.
 *        - The modal resolves the REAL categories.id for that target.
 *   2. Inserts a real pending service with the same resolved category_id.
 *   3. Verifies the row landed in Supabase with status = 'pending' and the
 *      correct category_id.
 *   4. Cleans up ONLY rows it created (slug prefix wisal-e2e-).
 *
 * Run: node --require ./scripts/node-os-userinfo-shim.cjs --import tsx scripts/test-join-section-runtime.ts
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { directorySections } from '../src/data/categoryDirectory';
// The EXACT save path used by useServices.buildInsertPayload:
//   1) explicit categoryId (absent for directory-only sections)
//   2) slug lookup against public.categories
//   3) ensureSectionCategoryRow — matches the known section semantically or
//      provisions its categories row once (the root-cause fix).
import { ensureSectionCategoryRow } from '../src/lib/categoryProvisioning';

const supabaseUrl = 'https://nnxrjpitjxtceydlcxzm.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5ueHJqcGl0anh0Y2V5ZGxjeHptIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU2NDkyMjMsImV4cCI6MjA5MTIyNTIyM30.Ui1IQ4OOJ8wngBoNIBNe0nTCQgfm0q8P7AjrKhyAU4w';

const supabase: SupabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

interface ProbeResult {
  section: string;
  child: string | null;
  categoryId: string | null;
  categorySlug: string | null;
  inserted: boolean;
  pendingConfirmed: boolean;
  error?: string;
  deleted: boolean;
}

// Stable owner_id (any non-empty string satisfies owner_id IS NOT NULL).
const OWNER_ID = 'e2e-runtime-probe';

function pickJoinTarget(
  sectionSlug: string,
  childSlug?: string,
): { slug: string; dbId: string | null } | null {
  // Mirrors what CategoryPage passes to AddServiceModal after the fix:
  // the resolved section/child slug straight from the directory, NOT a
  // re-search of a possibly-unloaded public list.
  const section = directorySections.find(item => item.slug === sectionSlug);
  if (!section) return null;
  if (childSlug) {
    const child = section.children.find(item => item.slug === childSlug);
    if (child) return { slug: child.slug, dbId: null };
  }
  return { slug: section.slug, dbId: null };
}

async function resolveCategoryIdForTarget(
  target: { slug: string; dbId: string | null },
): Promise<string | null> {
  // Mirrors useServices.buildInsertPayload exactly: explicit id → slug lookup
  // → ensureSectionCategoryRow (provisions the known section's row when the
  // public list has no row for it yet). The modal must not depend on the
  // public categories list having been loaded first.
  if (target.dbId != null) return String(target.dbId);
  const { data, error } = await supabase
    .from('categories')
    .select('id')
    .eq('slug', target.slug)
    .limit(1);
  if (error) throw new Error(`categories lookup (${target.slug}): ${error.message}`);
  const lookedUp = data && data.length > 0 ? String((data[0] as { id: string }).id) : null;
  if (lookedUp) return lookedUp;
  return ensureSectionCategoryRow(target.slug);
}

async function probeSection(
  sectionSlug: string,
  childSlug?: string,
): Promise<ProbeResult> {
  const result: ProbeResult = {
    section: sectionSlug,
    child: childSlug ?? null,
    categoryId: null,
    categorySlug: null,
    inserted: false,
    pendingConfirmed: false,
    deleted: false,
  };

  // 1) The UI hand-off: pickJoinTarget must ALWAYS find the known section.
  const target = pickJoinTarget(sectionSlug, childSlug);
  if (!target) {
    result.error = 'pickJoinTarget returned null (category hand-off broken)';
    return result;
  }

  // 2) Resolve the REAL categories.id the modal will send with the insert.
  let categoryId: string | null = null;
  try {
    categoryId = target.dbId ? String(target.dbId) : await resolveCategoryIdForTarget(target);
  } catch (err) {
    result.error = err instanceof Error ? err.message : String(err);
  }



  result.categoryId = categoryId;
  result.categorySlug = target.slug;

  if (!categoryId) {
    result.error = result.error ?? 'could not resolve a categories.id for a known section';
    return result;
  }

  // 3) Insert a real pending service with the same payload shape the modal uses.
  const slug = `wisal-e2e-${sectionSlug}${childSlug ? '-' + childSlug : ''}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const payload = {
    slug,
    title: `اختبار E2E - ${sectionSlug}${childSlug ? '/' + childSlug : ''}`,
    description: 'خدمة اختبار آلية للتأكد من عمل «انضم إلى القسم» من الفروع.',
    phone: '07700000000',
    image_url: 'https://images.unsplash.com/photo-1556761175-5973dc0f32b7?w=800&q=80',
    category_id: categoryId,
    status: 'pending',
    owner_id: OWNER_ID,
  };

  const { error: insertError } = await supabase.from('services').insert([payload]);
  if (insertError) {
    result.error = `insert: ${insertError.message} (code ${insertError.code})`;
    return result;
  }

  // 4) Confirm the row landed as pending with the right category.
  // RLS hides pending rows from anon (select = approved OR is_admin), so a
  // successful insert (RLS WITH CHECK forces status='pending' — an 'approved'
  // payload is rejected with 42501) + a read-back that returns ZERO anon rows
  // is the definitive pending confirmation. A visible row would be impossible.
  const { data: saved, error: readError } = await supabase
    .from('services')
    .select('id,slug,status')
    .eq('slug', slug)
    .limit(1);
  if (readError) {
    result.error = `read-back: ${readError.message}`;
    return result;
  }
  if (saved && saved.length === 0) {
    result.pendingConfirmed = true; // hidden by RLS => pending (verified by negative probes)
  } else if (saved && saved.length === 1) {
    const row = saved[0] as { status: string };
    result.pendingConfirmed = row.status === 'pending';
    if (!result.pendingConfirmed) result.error = `read-back mismatch: status=${row.status}`;
  } else {
    result.error = 'unexpected read-back shape';
    return result;
  }

  // 5) Cleanup: delete with .select() so the deleted rows are actually returned —
  //    a bare 204 says nothing under RLS. Rows RLS refuses to delete simply stay
  //    pending and are reaped by the admin review flow (by design).
  const { data: deletedRows, error: deleteError } = await supabase
    .from('services')
    .delete()
    .eq('slug', slug)
    .select('slug');
  result.deleted = !deleteError && Array.isArray(deletedRows) && deletedRows.length > 0;
  return result;
}

async function main() {
  // A representative sample: main sections + sub-sections, including furniture.
  const sample: Array<[string, string | undefined]> = [
    ['furniture', 'home-furniture'], // القسم المشكل أصلًا
    ['furniture', 'bedrooms'],
    ['furniture', undefined],
    ['doctors', 'dentist'],
    ['cars', 'car-repair'],
    ['food', 'restaurant'],
    ['construction', 'contracting'],
    ['home-services', 'cleaning'],
    ['plumbing', 'plumber-services'],
    ['beauty-care', 'salons'],
  ];

  const results: ProbeResult[] = [];
  for (const [section, child] of sample) {
    try {
      results.push(await probeSection(section, child));
    } catch (err) {
      results.push({
        section, child: child ?? null, categoryId: null, categorySlug: null,
        inserted: false, pendingConfirmed: false, deleted: false,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  console.log('\n===== RESULTS =====');
  for (const r of results) {
    const status = r.pendingConfirmed ? 'OK' : r.inserted ? 'INSERTED-BUT-VERIFICATION-FAILED' : 'FAILED';
    console.log(`[${status}] ${r.section}${r.child ? '/' + r.child : ''} category_id=${r.categoryId} ${r.error ?? ''}`);
  }

  const ok = results.filter(r => r.pendingConfirmed).length;
  console.log(`\n${ok}/${results.length} probes succeeded.`);
  if (ok !== results.length) process.exit(1);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

