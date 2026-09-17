import { createClient } from '@supabase/supabase-js';
const URL = 'https://nnxrjpitjxtceydlcxzm.supabase.co';
const KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5ueHJqcGl0anh0Y2V5ZGxjeHptIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU2NDkyMjMsImV4cCI6MjA5MTIyNTIyM30.Ui1IQ4OOJ8wngBoNIBNe0nTCQgfm0q8P7AjrKhyAU4w';
const sb = createClient(URL, KEY, { auth: { autoRefreshToken: false, persistSession: false } });
const email = `wisal-join-test-${Date.now()}@mohal.test`;
const password = 'Wsl!Test1234';
let { data: su, error: suErr } = await sb.auth.signUp({ email, password, email_confirm: true });
console.log('signup:', suErr ? suErr.message : 'OK', su?.user?.id ?? '(no id)');
let session = su?.session;
let userId = su?.user?.id;
if (!session) {
  // try OTP-less admin-less path: check if user exists then use magic link? no — just report.
  console.log('no session from signup; email_confirm unsupported');
}
if (!session) { console.log('NO_SESSION'); process.exit(2); }
const authed = createClient(URL, KEY, { global: { headers: { Authorization: `Bearer ${session.access_token}` } } });
const { data: cats, error: cErr } = await authed.from('categories').select('id,slug,name_ar').limit(1000);
console.log('categories fetch:', cErr ? cErr.message : `${cats.length} rows`);
const furniture = (cats ?? []).find(c => c.id === 'furniture' || c.slug === 'furniture' || c.slug === 'curtains-furnishings');
console.log('furniture row:', JSON.stringify(furniture));
const payload = {
  slug: `wisal-join-test-${Date.now()}`,
  title: 'اختبار انضمام قسم الأثاث',
  description: 'خدمة تجريبية للتحقق من إصلاح انضمام القسم',
  phone: '0700000000',
  category_id: furniture?.id ?? null,
  category_slug: 'furniture',
  status: 'pending',
  owner_id: userId,
  image_url: 'https://images.unsplash.com/photo-1556761175-5973dc0f32b7?w=800&q=80',
  profession: 'أثاث منزلي',
};
const { error: iErr } = await authed.from('services').insert([payload]);
console.log('INSERT result:', iErr ? JSON.stringify({ code: iErr.code, message: iErr.message }) : 'SUCCESS');
if (!iErr) console.log('INSERTED_SLUG=' + payload.slug);
process.exit(0);
