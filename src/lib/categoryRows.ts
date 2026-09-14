import { supabase } from './supabase';
import { createRequestCache } from './requestCache';

const rows = createRequestCache<any[]>(300_000);
export const invalidateCategoryRows = () => rows.invalidate();
export const fetchCategoryRows = (force = false) => rows.get(async () => {
  const { data, error } = await supabase
    .from('categories')
    .select('id,slug,name_ar,name_en,icon,parent_id');
  if (error) throw error;
  return data ?? [];
}, force);
