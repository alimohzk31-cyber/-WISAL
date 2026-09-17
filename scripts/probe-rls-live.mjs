const URL = 'https://nnxrjpitjxtceydlcxzm.supabase.co/rest/v1';
const KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5ueHJqcGl0anh0Y2V5ZGxjeHptIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU2NDkyMjMsImV4cCI6MjA5MTIyNTIyM30.Ui1IQ4OOJ8wngBoNIBNe0nTCQgfm0q8P7AjrKhyAU4w';
const H = { apikey: KEY, Authorization: 'Bearer ' + KEY, 'Content-Type': 'application/json' };

async function call(method, path, extra = {}, body) {
  const res = await fetch(URL + path, { method, headers: { ...H, ...extra }, body: body === undefined ? undefined : JSON.stringify(body) });
  const text = await res.text();
  let parsed = null; try { parsed = text ? JSON.parse(text) : null; } catch { parsed = text.slice(0, 200); }
  return { status: res.status, body: parsed };
}

// 1) anon SELECT on services
const sel = await call('GET', '/services?select=id,slug,status&limit=2');
console.log('SELECT services:', sel.status, JSON.stringify(sel.body)?.slice(0, 200));

// 2) anon SELECT on categories
const cats = await call('GET', '/categories?select=id,slug&slug=eq.home-furniture');
console.log('SELECT categories(home-furniture):', cats.status, JSON.stringify(cats.body));

// 3) anon INSERT pending service (minimal return, app-identical)
const slug = 'probe-rls-' + Date.now();
const ins = await call('POST', '/services', { Prefer: 'return=minimal' }, {
  title: 'فحص RLS تشخيصي', description: 'probe', phone: '07000000000',
  status: 'pending', slug, category_id: 'furniture', owner_id: 'probe-device'
});
console.log('INSERT services (anon, pending):', ins.status, JSON.stringify(ins.body)?.slice(0, 300));

// 4) readback
const rb = await call('GET', '/services?select=id,slug,status&slug=eq.' + slug);
console.log('READBACK:', rb.status, JSON.stringify(rb.body));

// 5) anon DELETE of probe (cleanup) — with owner header
const del = await call('DELETE', '/services?slug=eq.' + slug, { 'x-owner-id': 'probe-device' });
console.log('DELETE probe:', del.status);

// 6) categories upsert as anon (what ensureSectionCategoryRow does)
const up = await call('POST', '/categories?on_conflict=id', { Prefer: 'resolution=merge-duplicates,return=representation' },
  { id: 'probe-cat-' + Date.now(), slug: 'probe-cat-' + Date.now(), name_ar: 'فحص', name_en: 'probe', parent_id: null });
console.log('UPSERT categories (anon):', up.status, JSON.stringify(up.body)?.slice(0, 200));
process.exit(0);
