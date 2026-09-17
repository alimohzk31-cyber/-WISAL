const { createClient } = require('@supabase/supabase-js');
const url = 'https://nnxrjpitjxtceydlcxzm.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5ueHJqcGl0anh0Y2V5ZGxjeHptIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU2NDkyMjMsImV4cCI6MjA5MTIyNTIyM30.Ui1IQ4OOJ8wngBoNIBNe0nTCQgfm0q8P7AjrKhyAU4w';
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
