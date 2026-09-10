import { GENERIC_FIELD_CONFIG, getCategoryFieldConfig } from '../data/categoryFields';
import { directorySections, resolveDirectoryCategory } from '../data/categoryDirectory';
import { SECTION_FIELD_CONFIGS } from '../data/sectionFieldConfigs';
import type { Section } from '../types/models';

/** Resolve presentation aliases without changing the stored category slug or ID. */
export function getServiceFormConfig(category: Pick<Section, 'slug' | 'name' | 'fields'>, sectionSlug?: string, childSlug?: string) {
  const section = directorySections.find(item => item.slug === (sectionSlug ?? resolveDirectoryCategory(category)?.sectionSlug));
  const candidates = [
    childSlug && getCategoryFieldConfig(childSlug),
    getCategoryFieldConfig(category.slug, category.fields),
    ...[section?.slug, ...(section?.aliases ?? [])].map(slug => getCategoryFieldConfig(slug)),
    section && SECTION_FIELD_CONFIGS[section.slug],
  ];
  return candidates.find(config => config && config !== GENERIC_FIELD_CONFIG) || GENERIC_FIELD_CONFIG;
}

export function getInitialProfession(config: ReturnType<typeof getCategoryFieldConfig>, requested?: string) {
  if (!config.specialties.length) return requested || config.profession;
  if (requested && config.specialties.includes(requested)) return requested;
  return config.specialties.includes(config.profession) ? config.profession : '';
}
