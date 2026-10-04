require('./load-supabase-env.cjs');
const { createClient } = require('@supabase/supabase-js');
const url = 'https://nnxrjpitjxtceydlcxzm.supabase.co';
const key = (process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '');
(async () => {
  const sb = createClient(url, key);
  const { data, error } = await sb.from('categories').select('id,slug,name_ar,name_en,parent_id').eq('id','furniture').maybeSingle();
  if (error) { console.log('ERR', error.message); return; }
  console.log('stored name_ar bytes:', Buffer.from(data.name_ar, 'utf8').toString('hex'));
  console.log('correct  name_ar bytes:', Buffer.from('الأثاث والمفروشات', 'utf8').toString('hex'));
  console.log('equal:', data.name_ar === 'الأثاث والمفروشات');
  if (data.name_ar !== 'الأثاث والمفروشات') {
    const { error: uerr } = await sb.from('categories').update({ name_ar: 'الأثاث والمفروشات' }).eq('id','furniture');
    console.log('UPDATE result:', uerr ? ('BLOCKED: ' + uerr.message + ' / ' + uerr.code) : 'OK');
  }
})();
