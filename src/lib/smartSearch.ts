/**
 * Lightweight, local search vocabulary shared by the services and jobs
 * directories.  It deliberately contains no network/database code.
 */

const ARABIC_DIACRITICS = /[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED]/g;
const SEARCH_PUNCTUATION = /[^\p{L}\p{N}+#.]+/gu;

/** Intent words add no useful meaning to a directory query. */
export const SMART_SEARCH_STOPWORDS = new Set([
  'اريد', 'أريد', 'اني', 'أني', 'انا', 'أنا', 'اشتغل', 'أشتغل', 'شغل',
  'وظيفة', 'وظائف', 'وظيفه', 'وظايف', 'عمل', 'اعمال', 'أعمال', 'فرصة', 'فرص',
  'محتاج', 'محتاجه', 'محتاجين', 'احتاج', 'أحتاج', 'نحتاج', 'مطلوب', 'مطلوبة',
  'أسوي', 'اسوي', 'أسويها', 'اسويها', 'أسويلي', 'اسويلي', 'أسويهن', 'اسويهن',
  'خريج', 'خريجة', 'ادور', 'أدور', 'ابحث', 'أبحث', 'دور', 'أريدها', 'اريدها',
  'وين', 'وينه', 'وينها', 'اكو', 'اكو', 'اريد اشتغل', 'اريد شغل', 'لو سمحت',
  'من فضلك', 'رجاء', 'please', 'want',
]);

/** Add a new phrase to the appropriate group instead of editing components. */
export const SMART_SEARCH_SYNONYM_GROUPS: readonly (readonly string[])[] = [
  ['شركة', 'شركات', 'جهة', 'مؤسسة'],
  ['محاسب', 'محاسبة', 'محاسبه', 'محاسبات', 'حسابات', 'حساب', 'مالية', 'ماليه', 'تدقيق', 'مدقق', 'دفاتر'],
  ['مبيعات', 'موظف مبيعات', 'مندوب', 'مندوب مبيعات', 'مندوبي', 'بائع', 'بياع', 'بياعة', 'بائعين', 'بيع', 'تسويق', 'sales'],
  ['ادارة', 'إدارة', 'إداري', 'اداري', 'إدارية', 'موظف اداري', 'موظف إداري', 'سكرتير', 'مكتب', 'موارد بشرية', 'hr'],
  ['فيتر', 'فيترجي', 'فيترچي', 'فترجي', 'فني فيتر', 'فيتر سيارات', 'ميكانيك', 'ميكانيكي', 'ميكانيكي سيارات', 'تصليح سيارات', 'صيانة سيارات', 'سمكري'],
  ['بنشرجي', 'فنشرجي', 'بنجرجي', 'بنجري', 'بنچرجي', 'بنجرچي', 'بنچر', 'بنجر', 'بنشر', 'تاير', 'تايرات', 'إطار', 'إطارات', 'عجلة', 'عجلات'],
  ['انترنت', 'الانترنت', 'إنترنت', 'شبكات', 'شبكة', 'شبكه', 'isp', 'اتصالات', 'اتصال', 'شبكة انترنت', 'واي فاي', 'wifi'],
  ['استقبال', 'ريسبشن', 'موظف استقبال', 'كاونتر'],
  ['سائق', 'سياقة', 'سواق', 'نقل', 'توصيل', 'مندوب توصيل', 'دليفري', 'delivery'],
  ['مبرمج', 'مبرمجة', 'برمجة', 'تطوير', 'مطوّر', 'مطوَر', 'software', 'developer', 'coding'],
  ['سباك', 'سباكة', 'مواسير', 'مجاري', 'تسريب مياه'],
  ['كهربائي', 'كهرباء', 'كهربائي منازل', 'تمديدات كهربائية'],
  ['طبيب', 'طبيبة', 'دكتور', 'دكتورة', 'عيادة'],
  ['صيدلية', 'صيدلي', 'صيدلانية', 'دواء', 'أدوية'],
  ['مطعم', 'مطاعم', 'طباخ', 'شيف', 'عامل مطعم', 'اكل', 'أكل'],
  ['بناء', 'إنشاءات', 'مقاول', 'عامل بناء', 'معمار'],
  ['مصمم', 'مصممة', 'تصميم', 'جرافيك', 'فوتوشوب', 'graphic designer'],
  ['عن بعد', 'عن بُعد', 'عمل عن بعد', 'remote', 'اونلاين', 'online'],
];

/** Normalize Arabic spelling, punctuation, whitespace and common Iraqi forms. */
export function normalizeSmartSearch(value: unknown): string {
  return String(value ?? '')
    .normalize('NFKC')
    .toLocaleLowerCase('ar')
    .replace(ARABIC_DIACRITICS, '')
    .replace(/ـ/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(SEARCH_PUNCTUATION, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const normalizedStopwords = new Set([...SMART_SEARCH_STOPWORDS].map(word => normalizeSmartSearch(word)));
const synonymLookup = new Map<string, string[]>();
for (const group of SMART_SEARCH_SYNONYM_GROUPS) {
  const normalized = [...new Set(group.map(term => normalizeSmartSearch(term)).filter(Boolean))];
  for (const term of normalized) synonymLookup.set(term, normalized);
}

/** Return meaningful tokens, stripping intent words and Arabic clitics. */
export function smartSearchTokens(value: unknown): string[] {
  return normalizeSmartSearch(value)
    .split(' ')
    .filter(Boolean)
    .flatMap(token => {
      const bare = token.length > 4 && token.startsWith('ال') ? token.slice(2) : token;
      const withoutClitic = bare.length > 4 && /^[وفبكل]ال/u.test(bare) ? bare.slice(3) : bare;
      return [withoutClitic];
    })
    .filter(token => token && !normalizedStopwords.has(token));
}

/** Expand one meaningful token through the shared synonym dictionary. */
export function smartSearchVariants(token: string): string[] {
  const normalized = normalizeSmartSearch(token);
  const bare = normalized.length > 4 && normalized.startsWith('ال') ? normalized.slice(2) : normalized;
  const group = synonymLookup.get(normalized) ?? synonymLookup.get(bare);
  return [...new Set([normalized, bare, ...(group ?? [])].filter(Boolean))];
}

export function smartSearchHasMatch(haystack: string, token: string): boolean {
  const normalizedHaystack = normalizeSmartSearch(haystack);
  return smartSearchVariants(token).some(alias => normalizedHaystack.includes(alias));
}
