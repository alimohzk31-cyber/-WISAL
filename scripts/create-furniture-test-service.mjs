import './load-supabase-env.cjs';
// Leaves ONE real test service in Supabase from the furniture section
// (قسم الأثاث والمفروشات ← أثاث منزلي) as pending, for admin review.
// Run: node scripts/create-furniture-test-service.mjs
import { createClient } from '@supabase/supabase-js';

const url = 'https://nnxrjpitjxtceydlcxzm.supabase.co';
const key = (process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '');
const supabase = createClient(url, key, { auth: { persistSession: false } });

const slug = `wisal-test-furniture-${Date.now()}`;
const payload = {
  slug,
  title: 'خدمة اختبار - أثاث منزلي (انضم إلى القسم)',
  description: 'خدمة تجريبية أُنشئت للتحقق النهائي من إصلاح «انضم إلى القسم» من قسم الأثاث والمفروشات ← أثاث منزلي. تنتظر مراجعة الإدارة ثم يمكن حذفها.',
  profession: 'أثاث منزلي',
  phone: '07700000000',
  image_url: 'https://images.unsplash.com/photo-1556761175-5973dc0f32b7?w=800&q=80',
  category_id: 'home-furniture',
  category_slug: 'home-furniture',
  status: 'pending',
  owner_id: 'owner_test_furniture_e2e',
};

const { error } = await supabase.from('services').insert([payload]);
if (error) {
  console.error('INSERT FAILED:', error.message, error.code, error.details);
  process.exit(1);
}

// Confirm it is NOT visible to anon (RLS hides pending) but the insert itself
// only succeeded because WITH CHECK forced status='pending'.
const { data: hidden } = await supabase.from('services').select('id').eq('slug', slug);
console.log(JSON.stringify({ slug, inserted: true, hiddenFromAnon: hidden?.length === 0 }, null, 2));
