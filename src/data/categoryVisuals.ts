import { Briefcase } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { directorySections } from './categoryDirectory';

export interface CategoryVisual {
  photoUrl: string;
  icon: LucideIcon;
}

const photoAsset = (fileName: string) => `${(import.meta as any).env?.BASE_URL ?? './'}category-photos/${fileName}.webp`;

/** Child-specific photos are keyed only by slugs that exist in categoryDirectory.ts. */
const CHILD_PHOTOS: Record<string, Record<string, string>> = {
  doctors: {
    dentist: photoAsset('doctors--dentist'),
    orthopedics: photoAsset('doctors--orthopedics'),
  },
  cars: {
    'car-repair': photoAsset('cars--car-repair'),
    'car-mechanic': photoAsset('cars--car-mechanic'),
    'car-tires': photoAsset('cars--car-tires'),
    'car-rental': photoAsset('cars--car-rental'),
  },
  communications: {
    internet: photoAsset('communications--internet'),
    telecom: photoAsset('communications--telecom'),
  },
  food: {
    restaurant: photoAsset('food--restaurant'),
    cafe: photoAsset('food--cafe'),
    bakery: photoAsset('food--bakery'),
  },
  'building-materials': {
    steel: photoAsset('building-materials--steel'),
    cement: photoAsset('building-materials--cement'),
    bricks: photoAsset('building-materials--bricks'),
  },
  'doors-windows': {
    pvc: photoAsset('doors-windows--pvc'),
    windows: photoAsset('doors-windows--windows'),
  },
  'equipment-rental': {
    'crane-rental': photoAsset('equipment-rental--crane-rental'),
    'generator-rental': photoAsset('equipment-rental--generator-rental'),
  },
};

const FALLBACK_ICON: LucideIcon = Briefcase;
const FALLBACK_VISUAL: CategoryVisual = {
  photoUrl: photoAsset('office-services'),
  icon: FALLBACK_ICON,
};

/**
 * The root photo names are derived from the real directory slugs. Local WebP files
 * under public/category-photos avoid runtime hotlinks and keep the category visuals
 * available in local previews and offline builds.
 */
export const CATEGORY_VISUALS: Record<string, CategoryVisual> = Object.fromEntries(
  directorySections.map(section => [section.slug, {
    photoUrl: photoAsset(section.slug),
    icon: section.icon ?? FALLBACK_ICON,
  }]),
);

export function getCategoryVisual(sectionSlug: string, childSlug?: string): CategoryVisual {
  const section = CATEGORY_VISUALS[sectionSlug];
  if (!section) return FALLBACK_VISUAL;
  const childPhoto = childSlug ? CHILD_PHOTOS[sectionSlug]?.[childSlug] : undefined;
  return childPhoto ? { ...section, photoUrl: childPhoto } : section;
}

export function getCategoryIcon(sectionSlug: string, childSlug?: string): LucideIcon {
  return getCategoryVisual(sectionSlug, childSlug).icon;
}
