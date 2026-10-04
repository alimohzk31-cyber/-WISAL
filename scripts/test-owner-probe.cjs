require('./load-supabase-env.cjs');
const { createClient } = require('@supabase/supabase-js');
const url = 'https://nnxrjpitjxtceydlcxzm.supabase.co';
const key = (process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '');
(async () => {
  const sb = createClient(url, key);
  const { data, error } = await sb.from('services').select('owner_id,category_id,category_slug,status,title,slug,created_at').order('created_at', { ascending: false }).limit(5);
  if (error) { console.log('SELECT error:', error.message, error.code); return; }
  console.log(JSON.stringify(data, null, 2));
})();
