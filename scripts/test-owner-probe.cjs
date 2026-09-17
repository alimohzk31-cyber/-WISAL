const { createClient } = require('@supabase/supabase-js');
const url = 'https://nnxrjpitjxtceydlcxzm.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5ueHJqcGl0anh0Y2V5ZGxjeHptIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU2NDkyMjMsImV4cCI6MjA5MTIyNTIyM30.Ui1IQ4OOJ8wngBoNIBNe0nTCQgfm0q8P7AjrKhyAU4w';
(async () => {
  const sb = createClient(url, key);
  const { data, error } = await sb.from('services').select('owner_id,category_id,category_slug,status,title,slug,created_at').order('created_at', { ascending: false }).limit(5);
  if (error) { console.log('SELECT error:', error.message, error.code); return; }
  console.log(JSON.stringify(data, null, 2));
})();
