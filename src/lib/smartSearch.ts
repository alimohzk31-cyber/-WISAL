import { categoryGroups } from '../data/categories';
import { getCategoryFieldConfig } from '../data/categoryFields';
import { RAW_CATEGORY_SYNONYMS } from '../data/categorySynonyms';
import type { Service } from '../hooks/useServices';

type SearchCategory = { slug: string; name: string; groupId?: string; icon?: any; color?: any; searchText?: string };

const FILLER_WORDS = new Set([
  'السلام', 'عليكم', 'اريد', 'أريد', 'احتاج', 'أحتاج', 'محتاج', 'محتاجه',
  'ابحث', 'أبحث', 'عن', 'وين', 'الكه', 'ألكه', 'اريدكم', 'لو', 'سمحت', 'خدمة', 'خدمات',
]);

// تُطبَّع مرة واحدة عند تحميل الوحدة (وليس في كل ضغطة زر).
const CATEGORY_SYNONYMS: Record<string, string> = Object.fromEntries(
  Object.entries(RAW_CATEGORY_SYNONYMS).map(([slug, words]) => [
    slug,
    words.map(word => normalizeArabic(word)).filter(Boolean).join(' '),
  ])
);

/**
 * كلمات الإدارة المحظورة من البحث.
 * المستخدم الذي يكتب "الإدارة" / "admin" / "الموافقات"… يجب أن يرى
 * "لا توجد خدمة مطابقة لبحثك" — البحث لا يصل إلى أي شيء إداري إطلاقًا.
 */
const ADMIN_BLOCKED_TOKENS = new Set([
  'اداره', 'الاداره', 'اداري', 'الاداريه', 'ادمن', 'لوحه', 'تحكم',
  'موافقه', 'الموافقه', 'موافقات', 'الموافقات', 'مرفوضه', 'مرفوض', 'مضافه',
]);

/** true إذا كان نص البحث موجهًا لقسم الإدارة (يبقى دائمًا بلا نتائج). */
export function isBlockedAdminQuery(query: string): boolean {
  const normalized = normalizeArabic(query);
  if (!normalized) return false;
  if (normalized.includes('admin')) return true;
  return meaningfulTokens(query).some(token => ADMIN_BLOCKED_TOKENS.has(token));
}


export function normalizeArabic(value: string): string {
  return value
    .toLowerCase()
    .replace(/[إأآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/[ًٌٍَُِّْـ]/g, '')
    .replace(/تصليح|اصلح|إصلاح|اصلاح/g, 'صيانه')
    .replace(/[^؀-ۿa-z0-9\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function meaningfulTokens(query: string): string[] {
  return normalizeArabic(query)
    .split(' ')
    .filter(token => token.length > 1 && !FILLER_WORDS.has(token));
}

function tokenMatches(token: string, candidate: string): boolean {
  if (!candidate) return false;
  if (token.length >= 3 && candidate.length >= 3 && (candidate.includes(token) || token.includes(candidate))) return true;
  // Handles common Arabic singular/plural endings, e.g. صيدلية/صيدليات.
  return token.length >= 5 && candidate.length >= 5 && token.slice(0, 5) === candidate.slice(0, 5);
}

/** نتيجة مفردة مرتّبة تستهلكها نافذة البحث الذكي في قائمة ☰. */
export interface SmartSearchResult<T extends SearchCategory> {
  category: T;
  score: number;
  /** نسبة كلمات البحث التي تطابق هذا القسم (0-1) */
  coverage: number;
}

function scoreCategories<T extends SearchCategory>(
  categories: T[],
  services: Service[],
  rawQuery: string
): SmartSearchResult<T>[] {
  const tokens = meaningfulTokens(rawQuery);
  if (tokens.length === 0 || isBlockedAdminQuery(rawQuery)) return [];

  return categories
    .map(category => {
      const config = getCategoryFieldConfig(category.slug);
      const groupName = categoryGroups.find(group => group.id === category.groupId)?.name ?? '';
      const categoryServices = services.filter(service => service.categorySlug === category.slug);
      const weightedParts = [
        { weight: 8, text: category.name },
        { weight: 7, text: category.searchText ?? '' },
        { weight: 7, text: CATEGORY_SYNONYMS[category.slug] ?? '' },
        { weight: 6, text: config.profession },
        { weight: 5, text: config.specialties.join(' ') },
        { weight: 3, text: `${config.nameLabel} ${config.namePlaceholder}` },
        { weight: 2, text: groupName },
        { weight: 4, text: categoryServices.map(service => `${service.name} ${service.profession ?? ''}`).join(' ') },
        { weight: 1, text: category.slug.replace(/-/g, ' ') },
      ];

      const matchedTokens = tokens.filter(token =>
        weightedParts.some(part => normalizeArabic(part.text).split(' ').some(candidate => tokenMatches(token, candidate)))
      );
      const score = weightedParts.reduce((total, part) => {
        const candidates = normalizeArabic(part.text).split(' ');
        return total + tokens.reduce((sum, token) => sum + (candidates.some(candidate => tokenMatches(token, candidate)) ? part.weight : 0), 0);
      }, 0) + (matchedTokens.length === tokens.length ? 20 : 0);

      return { category, score, coverage: tokens.length ? matchedTokens.length / tokens.length : 0 };
    })
    .filter(item => item.score > 0)
    .sort((a, b) => b.coverage - a.coverage || b.score - a.score || a.category.name.localeCompare(b.category.name, 'ar'));
}

/**
 * نتائج البحث الذكي مرتّبة تنازليًا (نافذة البحث الذكي في قائمة ☰).
 * تعيد كل الأقسام المطابقة مرتّبة، أو [] إذا لم يوجد أي تطابق.
 */
export function rankSmartSearchResults<T extends SearchCategory>(
  categories: T[],
  services: Service[],
  rawQuery: string
): SmartSearchResult<T>[] {
  return scoreCategories(categories, services, rawQuery);
}

export function smartCategorySearch<T extends SearchCategory>(
  categories: T[],
  services: Service[],
  rawQuery: string
): T[] {
  // بحث فارغ → كل الأقسام (سلوك الشبكة الرئيسية الأصلي)، أما استعلام محجوب
  // (إدارة/admin) فتُعاد قائمة فارغة دائمًا.
  if (meaningfulTokens(rawQuery).length === 0) {
    return isBlockedAdminQuery(rawQuery) ? [] : categories;
  }
  const scored = scoreCategories(categories, services, rawQuery);
  if (scored.length === 0) return [];

  const completeMatches = scored.filter(item => item.coverage === 1);
  const bestCoverage = Math.max(0, ...scored.map(item => item.coverage));
  const relevant = completeMatches.length > 0
    ? completeMatches
    : scored.filter(item => item.coverage === bestCoverage && item.coverage >= 0.5);
  if (relevant.length === 0) return [];
  const bestScore = Math.max(...relevant.map(item => item.score));
  return relevant.filter(item => item.score >= bestScore * 0.8).map(item => item.category);
}
