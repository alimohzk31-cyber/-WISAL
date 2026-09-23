import { supabase } from './supabase';
import { createRequestCache } from './requestCache';

const rows = createRequestCache<any[]>(300_000);
export const invalidateCategoryRows = () => rows.invalidate();
export const fetchCategoryRows = (force = false) => rows.get(async () => {
  let { data, error } = await supabase
    .from('categories')
    .select('id,slug,name_ar,name_en,icon,parent_id,color,image');
  // Older deployments may not have the optional visual columns yet. Keep the
  // category list usable there while preserving color/image when available.
  if (error && /color|image/i.test(`${error.message} ${error.details || ''}`)) {
    ({ data, error } = await supabase
      .from('categories')
      .select('id,slug,name_ar,name_en,icon,parent_id'));
  }
  if (error) throw error;
  return data ?? [];
}, force);
