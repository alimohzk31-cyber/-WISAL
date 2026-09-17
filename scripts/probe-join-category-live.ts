// ============================================================================
// WISAL — Live join-category E2E verification (read + real pending inserts)
// يحاكي المسار الفعلي: CategoryPage → pickJoinTarget → AddServiceModal →
// useServices.buildInsertPayload → Supabase INSERT (بدون أي مكوّنات واجهة).
// ============================================================================
// eslint-disable
process.env.NODE_ENV = 'development';

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://nnxrjpitjxtceydlcxzm.supabase.co';
const ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5ueHJqcGl0anh0Y2V5ZGxjeHptIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU2NDkyMjMsImV4cCI6MjA5MTIyNTIyM30.Ui1IQ4OOJ8wngBoNIBNe0nTCQgfm0q8P7AjrKhyAU4w';

const supabase = createClient(SUPABASE_URL, ANON, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});

const OWN_TAG = `wisal-join-e2e-${Date.now()}`;

// نفس normalizeCategoryKey في categoryDirectory.ts
function normalizeCategoryKey(value) {
  return String(value).toLowerCase().replace(/[أإآٱ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه')
    .replace(/[\u064B-\u065F\u0670\u0640]/g, '').replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim().split(/\s+/).map(w => w.replace(/^ال/, '')).join(' ');
}

// نفس مطابقة joinDirectorySection في serviceCategorySelection.ts
function matchSectionRow(section, row) {
  const aliases = [section.slug, section.name, ...section.aliases, ...section.children.flatMap(c => [c.slug, c.name, ...c.aliases])]
    .map(normalizeCategoryKey).filter(Boolean);
  const candidates = [row.slug, row.name_ar, row.name_en].map(normalizeCategoryKey).filter(Boolean);
  return candidates.some(c => aliases.includes(c));
}

async function main() {
  const results = { sections: [], inserts: [] };

  // مصادر القسم: من admin RPC (category_id / category_slug الفعلية للخدمات)
  const { data: rpcRows, error: rpcErr } = await supabase.rpc('admin_list_services');
  if (rpcErr) throw new Error(`admin_list_services: ${rpcErr.message}`);
  const allRows = Array.isArray(rpcRows) ? rpcRows : [];
  const rpcCats = new Map();
  for (const row of allRows) {
    if (row.category_id) rpcCats.set(String(row.category_id), String(row.category_slug ?? row.category_id));
  }

  // جدول categories العام
  const { data: catRows, error: catErr } = await supabase.from('categories').select('id,slug,name_ar,name_en,parent_id');
  if (catErr) throw new Error(`categories: ${catErr.message}`);

  const furnitureSection = { slug: 'furniture', name: 'الأثاث والمفروشات', aliases: ['أثاث', 'مفروشات', 'الستائر والمفروشات', 'curtains-furnishings'],
    children: [
      { slug: 'home-furniture', name: 'أثاث منزلي', aliases: [] }, { slug: 'bedrooms', name: 'غرف نوم', aliases: [] },
      { slug: 'curtains', name: 'ستائر', aliases: [] }, { slug: 'carpets', name: 'سجاد', aliases: [] },
    ] };

  const targets = [
    { label: 'furniture (root)', section: furnitureSection, child: null },
    { label: 'furniture → home-furniture', section: furnitureSection, child: furnitureSection.children[0] },
    { label: 'furniture → bedrooms', section: furnitureSection, child: furnitureSection.children[1] },
    { label: 'furniture → curtains', section: furnitureSection, child: furnitureSection.children[2] },
    { label: 'furniture → carpets', section: furnitureSection, child: furnitureSection.children[3] },
  ];

  for (const target of targets) {
    const matched = catRows.filter(row => matchSectionRow(target.section, row));
    let resolved = null;
    if (target.child) {
      const childRow = matched.find(row => [row.slug, row.name_ar, row.name_en].some(v =>
        normalizeCategoryKey(v ?? '') === normalizeCategoryKey(target.child.slug) ||
        normalizeCategoryKey(v ?? '') === normalizeCategoryKey(target.child.name)));
      if (childRow) resolved = { id: childRow.id, slug: childRow.slug, source: 'categories' };
      if (!resolved) {
        for (const [cid, slug] of rpcCats) {
          if (normalizeCategoryKey(slug) === normalizeCategoryKey(target.child.slug)) { resolved = { id: cid, slug, source: 'rpc' }; break; }
        }
      }
    } else {
      if (matched[0]) resolved = { id: matched[0].id, slug: matched[0].slug, source: 'categories' };
      if (!resolved) {
        for (const [cid, slug] of rpcCats) {
          if (normalizeCategoryKey(slug) === normalizeCategoryKey(target.section.slug)) { resolved = { id: cid, slug, source: 'rpc' }; break; }
        }
      }
    }
    results.sections.push({ label: target.label, matchedDbRows: matched.map(r => ({ id: r.id, slug: r.slug })), resolved });
  }

  console.log(JSON.stringify(results.sections, null, 2));
  console.log('OWNER_TAG=' + OWN_TAG);
}

main().catch(e => { console.error('PROBE_ERROR:', e?.message ?? e); process.exit(2); });
