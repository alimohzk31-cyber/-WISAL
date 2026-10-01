import type { SectionRegistrationConfig } from '../types/models';

interface ServiceFormValidationInput {
  registration?: SectionRegistrationConfig;
  registrationDetails: Record<string, string>;
  registrationImages: string[];
  name: string;
  phone: string;
  categorySelected: boolean;
  profession: string;
  experience: string;
  location: string;
}

/**
 * One validation source for every service-add flow.
 * The database model remains backward-compatible; this only describes fields
 * that the current UI actually asks the user to complete.
 */
export function getMissingServiceFields({
  registration,
  registrationDetails,
  registrationImages,
  name,
  phone,
  categorySelected,
  profession,
  experience,
  location,
}: ServiceFormValidationInput): string[] {
  const missing: string[] = [];

  if (!categorySelected) missing.push('القسم');
  if (!name.trim()) missing.push(registration ? 'اسم الجهة' : 'اسم الخدمة');

  if (registration) {
    if (registration.phoneRequired && phone.trim().length < 7) missing.push('رقم الهاتف');
    for (const field of registration.fields) {
      if (field.required && !registrationDetails[field.key]?.trim()) missing.push(field.label);
    }
    if (registrationImages.length < 1) missing.push('صورة واحدة');
    return missing;
  }

  if (!profession.trim()) missing.push('التخصص أو نوع الخدمة');
  if (!experience.trim()) missing.push('الخبرة أو الوصف');
  if (!location.trim()) missing.push('العنوان أو المنطقة');
  return missing;
}
