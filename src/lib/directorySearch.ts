import type { DirectoryChild, DisplaySection } from '../data/categoryDirectory';
import { normalizeCategoryKey, resolveDirectoryCategory } from '../data/categoryDirectory';
import { directorySearchAliases } from '../data/directorySearchAliases';
import { SMART_SEARCH_VOCABULARY, SMART_SEARCH_STOPWORDS } from '../data/smartSearchVocabulary';
import { getCategorySynonyms } from '../data/categorySynonyms';
import { getCategoryFieldConfig } from '../data/categoryFields';
import type { Service } from '../hooks/useServices';
import { categoryUrl } from './directoryNavigation';

const filler = new Set([
  'السلام', 'عليكم', 'اريد', 'احتاج', 'محتاج', 'محتاجه', 'ابحث', 'عن', 'وين', 'الكه', 'لو', 'سمحت',
  ...SMART_SEARCH_STOPWORDS.map(normalizeCategoryKey),
]);
// كلمات عامية شائعة تُحوَّل إلى الصيغة القياسية الواردة في قاموس الفئات.
const variants: Record<string, string> = {
  سيارات: 'سياره', مستشفيات: 'مستشفي', صيدليات: 'صيدليه', جامعات: 'جامعه',
  اهليه: 'اهلي', حكوميه: 'حكومي', هواتف: 'هاتف', موبايلات: 'موبايل',
  مكيفات: 'مكيف', ميكانيكي: 'ميكانيك', زيوت: 'زيت', بنجري: 'بنجرجي',
};
export function normalizeDirectoryQuery(value: string): string {
  return normalizeCategoryKey(value).replace(/[ؤئ]/g, letter => letter === 'ؤ' ? 'و' : 'ي')
    .replace(/تصليح|اصلاح|اصلح/g, 'صيانه').split(/\s+/)
    .filter(word => word && !filler.has(word))
    // لهجة عراقية: نزع بادئات الجر والتعريف المركبة (بالوايرات → وايرات،
    // والكهرباء → كهرباء، فالمكيف → مكيف). تُطبَّق على الاستعلام وعلى القاموس
    // معاً فتبقى المطابقة متسقة، والكلمات القصيرة (< 4 أحرف) لا تُمسّ.
    .map(word => {
      const stripped = word.length >= 5 ? word.replace(/^[وفبك]ال(?=[\p{L}]{2,})/u, '') : word;
      return variants[stripped] ?? variants[word] ?? stripped;
    }).join(' ');
}

// Public business services may legitimately contain إدارة. Remove only their
// complete phrases; administrative UI tokens elsewhere still block the query.
export function isPrivateDirectoryQuery(query: string): boolean {
  let text = ` ${normalizeDirectoryQuery(query)} `;
  for (const phrase of ['إدارة صفحات', 'إدارة أملاك', 'المكاتب والخدمات الإدارية', 'خدمات إدارية']) {
    text = text.replace(` ${normalizeDirectoryQuery(phrase)} `, ' ');
  }
  return /admin|dashboard|settings|\/|\\|لوحه|اعدادات|ادمن|موافقات|مرفوض|تحكم/.test(text)
    || text.trim().split(/\s+/).some(word => ['اداره', 'اداري', 'اداريه', 'داخليه'].includes(word));
}

export interface DirectorySearchEntry {
  section: DisplaySection;
  child?: DirectoryChild;
  url: string;
  label: string;
  terms: string[];
  ownTokens: string[];
  contextTokens: string[];
  serviceTerms: string[];
}
export interface DirectorySearchResult extends DirectorySearchEntry {
  score: number;
  exact: boolean;
  fuzzy: boolean;
}

const EMPTY_SEARCH_SERVICES: Service[] = [];
const searchIndexCache = new WeakMap<DisplaySection[], WeakMap<Service[], DirectorySearchEntry[]>>();

export function buildDirectorySearchIndex(
  sections: DisplaySection[],
  services: Service[] = EMPTY_SEARCH_SERVICES,
): DirectorySearchEntry[] {
  let byServices = searchIndexCache.get(sections);
  if (!byServices) {
    byServices = new WeakMap();
    searchIndexCache.set(sections, byServices);
  }
  const cached = byServices.get(services);
  if (cached) return cached;
  const index = createDirectorySearchIndex(sections, services);
  byServices.set(services, index);
  return index;
}

function createDirectorySearchIndex(sections: DisplaySection[], services: Service[]): DirectorySearchEntry[] {
  return sections.filter(section => !isPrivateDirectoryQuery(section.name) && !isPrivateDirectoryQuery(section.slug)).flatMap(section => {
    const sourceTerms = new Map<string, string[]>();
    const sourceKeywords = new Map<string, string[]>();
    for (const source of section.sources) {
      const placement = resolveDirectoryCategory(source);
      const target = placement?.childSlug ?? section.children.find(child => child.slug === source.slug)?.slug ?? section.slug;
      sourceTerms.set(target, [...(sourceTerms.get(target) ?? []), source.name]);
      const config = getCategoryFieldConfig(source.slug);
      sourceKeywords.set(target, [...(sourceKeywords.get(target) ?? []), ...getCategorySynonyms(source.slug), ...config.specialties]);
    }
    return [undefined, ...section.children].filter(child => !child || !isPrivateDirectoryQuery(child.name)).map(child => {
      const item = child ?? section;
      // قاموس المرادفات المنظّم: مفردات المنتج تنضم لمدخله (القسم) فقط،
      // ومفردات التخصّص (child) تنضم للمدخل الفرعي فقط — لتفادي نتائج متعددة.
      const vocab = child
        ? (SMART_SEARCH_VOCABULARY[item.slug] ?? [])
        : [...(SMART_SEARCH_VOCABULARY[section.slug] ?? []), ...(SMART_SEARCH_VOCABULARY[item.slug] ?? [])];
      const terms = [...new Set([item.name, item.slug.replace(/-/g, ' '), ...item.aliases, ...(directorySearchAliases[item.slug] ?? []), ...(sourceTerms.get(item.slug) ?? []), ...vocab].map(normalizeDirectoryQuery).filter(Boolean))];
      return {
        section, child, terms,
        url: categoryUrl(section.slug, child?.slug),
        label: child ? `${section.name} ← ${child.name}` : section.name,
        ownTokens: [...new Set([...terms, ...(sourceKeywords.get(item.slug) ?? []).map(normalizeDirectoryQuery)].flatMap(term => term.split(' ')))],
        contextTokens: normalizeDirectoryQuery([section.name, ...section.aliases, ...(directorySearchAliases[section.slug] ?? [])].join(' ')).split(' '),
        serviceTerms: services.filter(service => service.categorySlug === section.slug && (!child || service.subCategory === child.slug))
          .map(service => normalizeDirectoryQuery(`${service.name} ${service.profession ?? ''}`)),
      };
    });
  });
}

// A single insertion/deletion/substitution or adjacent transposition. Short
// words use exact matches so ري / RO don't produce unrelated suggestions.
function nearWord(a: string, b: string): boolean {
  if (a.length < 4 || b.length < 4 || Math.abs(a.length - b.length) > 1) return false;
  if (a.length === b.length) {
    const differences = [...a].map((letter, i) => letter === b[i] ? -1 : i).filter(i => i >= 0);
    return differences.length === 1 || (differences.length === 2 && differences[1] === differences[0] + 1 && a[differences[0]] === b[differences[1]] && a[differences[1]] === b[differences[0]]);
  }
  const [short, long] = a.length < b.length ? [a, b] : [b, a];
  let i = 0;
  while (i < short.length && short[i] === long[i]) i++;
  return short.slice(i) === long.slice(i + 1);
}

export function searchDirectory(index: DirectorySearchEntry[], query: string): DirectorySearchResult[] {
  const normalized = normalizeDirectoryQuery(query);
  if (!normalized || isPrivateDirectoryQuery(query)) return [];
  const tokens = [...new Set(normalized.split(' '))];

  // حرف واحد: مطابقة احتواء حرفية فقط داخل اسم القسم/الفرع أو مفرداته
  // المباشرة (aliases, keywords, synonyms). لا نستخدم fuzzy أو سياق الأب هنا
  // حتى لا تظهر نتائج بعيدة لمجرد تشابه تقريبي.
  if ([...normalized].length === 1) {
    return index.flatMap(entry => {
      const itemName = normalizeDirectoryQuery(entry.child?.name ?? entry.section.name);
      const directTerm = entry.terms.some(term => term.includes(normalized));
      const keyword = entry.ownTokens.some(word => word.includes(normalized));
      if (!directTerm && !keyword) return [];
      const score = itemName.includes(normalized) ? 140 : directTerm ? 125 : 110;
      return [{ ...entry, exact: false, fuzzy: false, score }];
    }).sort((a, b) => b.score - a.score || Number(Boolean(a.child)) - Number(Boolean(b.child)) || a.label.localeCompare(b.label, 'ar'));
  }

  const results = index.flatMap(entry => {
    const exact = entry.terms.includes(normalized);
    const own = tokens.filter(token => entry.ownTokens.includes(token));
    const context = tokens.filter(token => entry.contextTokens.includes(token));
    const fuzzyTokens = tokens.filter(token => !entry.ownTokens.includes(token) && !entry.contextTokens.includes(token) && entry.ownTokens.some(word => nearWord(token, word) || (token.length >= 3 && word.startsWith(token))));
    const matched = new Set([...own, ...context, ...fuzzyTokens]).size;
    const serviceMatch = entry.serviceTerms.some(term => tokens.every(token => term.split(' ').includes(token)));
    if (!exact && !serviceMatch && (own.length + fuzzyTokens.length === 0 || matched < tokens.length)) return [];
    const fuzzy = fuzzyTokens.length > 0;
    const score = exact ? 160 : serviceMatch && matched < tokens.length ? 80 : 100 + (own.length / tokens.length) * 20 - (fuzzy ? 25 : 0);
    return [{ ...entry, exact, fuzzy, score }];
  }).sort((a, b) => b.score - a.score || Number(Boolean(a.child)) - Number(Boolean(b.child)) || a.label.localeCompare(b.label, 'ar'));
  const best = results[0]?.score ?? 0;
  const relevant = results.filter(result => result.score >= best - 12);
  // An exact main-field match wins over its generic child (e.g. ذهب/أدوية).
  // Otherwise the more specific child replaces its redundant parent result.
  return relevant.filter(result => !relevant.some(other => other !== result && other.section.slug === result.section.slug && (
    (result.child && !other.child && other.exact) || (!result.child && other.child && !result.exact && other.score >= result.score)
  )));
}

export function getDirectDirectoryMatch(results: DirectorySearchResult[]): DirectorySearchResult | undefined {
  return results.length === 1 && results[0].exact && !results[0].fuzzy ? results[0] : undefined;
}
