import type { Job } from './types';
import {
  normalizeSmartSearch,
  smartSearchTokens,
  smartSearchVariants,
  SMART_SEARCH_SYNONYM_GROUPS,
} from '../../lib/smartSearch';

// Kept as a named export for existing consumers; the vocabulary itself lives
// in one shared utility so services and jobs understand the same language.
export const JOB_SEARCH_SYNONYM_GROUPS = SMART_SEARCH_SYNONYM_GROUPS;

export function normalizeJobSearch(value: unknown): string {
  return normalizeSmartSearch(value);
}

function tokenMatchesIndex(index: string, token: string): boolean {
  return smartSearchVariants(token).some(alias => index.includes(alias));
}

const employmentLabels: Record<string, string> = {
  كامل: 'دوام كامل',
  جزئي: 'دوام جزئي',
  تدريب: 'تدريب internship',
  'عن بعد': 'عن بعد remote',
};

export function createJobSearchIndex(job: Job): string {
  const keywords = Array.isArray(job.keywords) ? job.keywords.join(' ') : '';
  const employmentType = employmentLabels[job.employmentType] ?? job.employmentType;
  return normalizeJobSearch([
    job.title, job.company, job.categoryName, job.specialty, job.description,
    job.requirements, job.governorate, job.area, job.address,
    employmentType, keywords,
  ].filter(Boolean).join(' '));
}

export function matchesJobSearchIndex(index: string, query: string): boolean {
  if (!query.trim()) return true;
  const tokens = smartSearchTokens(query);
  // A query made only of intent words ("أريد شغل") has no profession to match.
  if (!tokens.length) return false;
  const normalizedIndex = normalizeJobSearch(index);
  if (tokens.length > 1 && normalizedIndex.includes(tokens.join(' '))) return true;
  return tokens.every(token => tokenMatchesIndex(normalizedIndex, token));
}

interface SearchField { value: string; weight: number }

function jobSearchFields(job: Job): SearchField[] {
  const keywords = Array.isArray(job.keywords) ? job.keywords.join(' ') : '';
  return [
    { value: job.title, weight: 150 },
    { value: job.company, weight: 130 },
    { value: job.specialty, weight: 115 },
    { value: job.categoryName, weight: 105 },
    { value: employmentLabels[job.employmentType] ?? job.employmentType, weight: 90 },
    { value: `${job.governorate ?? ''} ${job.area ?? ''} ${job.address ?? ''}`, weight: 78 },
    { value: job.description, weight: 65 },
    { value: job.requirements, weight: 60 },
    { value: keywords, weight: 55 },
  ].map(field => ({ ...field, value: normalizeJobSearch(field.value ?? '') }));
}

/** Weighted local ranking: title/company first, then specialty/category, then prose. */
export function scoreJobSearch(job: Job, query: string): number {
  if (!query.trim()) return 0;
  const tokens = smartSearchTokens(query);
  if (!tokens.length) return 0;
  const fields = jobSearchFields(job);
  let score = 0;
  for (const token of tokens) {
    const variants = smartSearchVariants(token);
    let best = 0;
    for (const field of fields) {
      const direct = field.value.includes(token);
      const matched = variants.some(alias => field.value.includes(alias));
      if (!matched) continue;
      const candidate = field.weight + (direct ? 24 : 0);
      if (candidate > best) best = candidate;
    }
    if (!best) return 0;
    score += best;
  }
  const meaningfulPhrase = normalizeJobSearch(tokens.join(' '));
  if (meaningfulPhrase && fields[0].value.includes(meaningfulPhrase)) score += 90;
  else if (meaningfulPhrase && fields[1].value.includes(meaningfulPhrase)) score += 65;
  return score;
}

export function matchesJobSearch(job: Job, query: string): boolean {
  return scoreJobSearch(job, query) > 0 || !query.trim();
}
