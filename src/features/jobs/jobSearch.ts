import type { Job } from './types';

// مجموعات صغيرة ومقصودة، ويمكن توسيعها من مكان واحد دون تلويث مكوّن الواجهة.
export const JOB_SEARCH_SYNONYM_GROUPS = [
  ['شركة', 'شركات'],
  ['انترنت', 'الانترنت', 'شبكات', 'شبكة', 'شبكه', 'isp', 'اتصالات'],
  ['مبيعات', 'بائع', 'بائعه', 'مندوب', 'مندوب مبيعات', 'تسويق'],
  ['محاسب', 'محاسبة', 'محاسبه', 'حسابات', 'مالية', 'ماليه'],
  ['استقبال', 'ريسبشن', 'موظف استقبال'],
  ['سائق', 'سياقة', 'سياقه', 'نقل'],
  ['مبرمج', 'برمجة', 'برمجه', 'تطوير', 'مطور', 'software', 'developer'],
] as const;

const ARABIC_DIACRITICS = /[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED]/g;
const NON_SEARCH_CHARS = /[^\p{L}\p{N}+#.]+/gu;

export function normalizeJobSearch(value: unknown): string {
  return String(value ?? '')
    .toLocaleLowerCase('ar')
    .replace(ARABIC_DIACRITICS, '')
    .replace(/ـ/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .replace(NON_SEARCH_CHARS, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const normalizedGroups = JOB_SEARCH_SYNONYM_GROUPS.map(group => group.map(normalizeJobSearch));

function tokenAlternatives(token: string): string[] {
  const bare = token.startsWith('ال') && token.length > 4 ? token.slice(2) : token;
  const group = normalizedGroups.find(items => items.some(item => item === token || item === bare));
  return group ? [...new Set([...group, token, bare])] : [...new Set([token, bare])];
}

export function createJobSearchIndex(job: Job): string {
  const keywords = Array.isArray(job.keywords) ? job.keywords.join(' ') : '';
  const employmentType = job.employmentType === 'كامل'
    ? 'كامل دوام كامل'
    : job.employmentType === 'جزئي' ? 'جزئي دوام جزئي' : job.employmentType;
  return normalizeJobSearch([
    job.title, job.company, job.categoryName, job.specialty, job.description,
    job.requirements, job.governorate, job.area, job.address,
    employmentType, keywords,
  ].filter(Boolean).join(' '));
}

export function matchesJobSearchIndex(index: string, query: string): boolean {
  const normalizedQuery = normalizeJobSearch(query);
  if (!normalizedQuery) return true;
  if (index.includes(normalizedQuery)) return true;
  return normalizedQuery.split(' ').every(token => tokenAlternatives(token).some(alias => index.includes(alias)));
}

export function matchesJobSearch(job: Job, query: string): boolean {
  return matchesJobSearchIndex(createJobSearchIndex(job), query);
}
