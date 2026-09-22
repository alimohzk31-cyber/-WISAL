import type { EmploymentType, Job, NewJob } from './types';

export const employmentTypes: EmploymentType[] = ['كامل', 'جزئي', 'مؤقت', 'عمل حر', 'عن بُعد', 'تدريب'];

export const primaryEmploymentTypes: EmploymentType[] = ['تدريب', 'عن بُعد', 'كامل', 'جزئي'];

export function employmentTypeLabel(type: EmploymentType): string {
  if (type === 'كامل') return 'دوام كامل';
  if (type === 'جزئي') return 'دوام جزئي';
  return type;
}

const optionalText = (value: unknown) => typeof value === 'string' && value.trim() ? value : undefined;

function socialLinksFromRow(email: unknown, whatsapp: unknown): string {
  const values = [email, whatsapp]
    .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
    .flatMap(value => value.split(/\r?\n/).map(link => link.trim()).filter(Boolean));
  return [...new Set(values)].join('\n');
}

export function whatsappFromSocialLinks(value?: string): string | undefined {
  const link = value?.split(/\r?\n/).map(item => item.trim()).find(item =>
    /(?:wa\.me|whatsapp\.com|whatsapp)|^(?:\+?\d[\d\s()-]{6,})$/i.test(item),
  );
  return link || undefined;
}

export function mapJob(row: any): Job {
  const images = Array.isArray(row.image_urls)
    ? row.image_urls.filter((url: unknown): url is string => typeof url === 'string' && url.trim().length > 0)
    : [];
  const cover = row.image_url || images[0] || undefined;
  if (cover && !images.includes(cover)) images.unshift(cover);
  return {
    id: Number(row.id), title: row.title, company: row.company, specialty: row.specialty,
    keywords: Array.isArray(row.keywords) ? row.keywords.filter((item: unknown): item is string => typeof item === 'string') : undefined,
    categoryId: row.category_id ? Number(row.category_id) : undefined,
    categoryName: row.job_categories?.name || undefined, description: row.description,
    companyAbout: optionalText(row.company_about), requirements: optionalText(row.requirements),
    benefits: optionalText(row.benefits), governorate: row.governorate || '', area: row.area || '',
    address: optionalText(row.address), employmentType: row.employment_type,
    salary: optionalText(row.salary), salaryNegotiable: row.salary_negotiable === true,
    experience: optionalText(row.experience), qualification: optionalText(row.qualification),
    phone: row.phone, whatsapp: optionalText(row.whatsapp), email: optionalText(row.email),
    socialLinks: socialLinksFromRow(row.email, row.whatsapp),
    applicationDeadline: optionalText(row.application_deadline),
    trainingDuration: optionalText(row.training_duration), trainingPaid: row.training_paid === true,
    trainingHiringPossible: row.training_hiring_possible === true,
    image: cover, images, video: optionalText(row.video_url), createdAt: row.created_at, status: row.status,
  };
}

export function newJobRow(job: NewJob, includeMediaColumns = true, includeDetailColumns = true, ownerUid?: string) {
  const base = { title: job.title.trim(), company: job.company.trim() || job.title.trim(), specialty: job.specialty.trim(), category_id: job.categoryId || null, description: (job.requirements || job.description || '').trim(), governorate: job.governorate.trim(), area: job.area.trim(), employment_type: job.employmentType, salary: job.salary?.trim() || null, experience: job.experience?.trim() || null, qualification: job.qualification?.trim() || null, phone: job.phone.trim(), image_url: job.image?.trim() || null, status: 'pending' };
  const ownership = ownerUid ? { owner_uid: ownerUid } : {};
  const detailed = includeDetailColumns ? {
    company_about: job.companyAbout?.trim() || null, requirements: job.requirements?.trim() || null,
    benefits: job.benefits?.trim() || null, address: job.address?.trim() || null,
    salary_negotiable: Boolean(job.salaryNegotiable), whatsapp: whatsappFromSocialLinks(job.socialLinks) || job.whatsapp?.trim() || null,
    email: job.socialLinks?.trim() || job.email?.trim() || null, application_deadline: job.applicationDeadline || null,
    training_duration: job.employmentType === 'تدريب' ? job.trainingDuration?.trim() || null : null,
    training_paid: job.employmentType === 'تدريب' ? Boolean(job.trainingPaid) : null,
    training_hiring_possible: job.employmentType === 'تدريب' ? Boolean(job.trainingHiringPossible) : null,
  } : {};
  return includeMediaColumns
    ? { ...base, ...detailed, ...ownership, image_urls: job.images?.filter(Boolean) ?? [], video_url: job.video?.trim() || null }
    : { ...base, ...detailed, ...ownership };
}
