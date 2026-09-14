import type { EmploymentType, Job, NewJob } from './types';

export const employmentTypes: EmploymentType[] = ['كامل', 'جزئي', 'مؤقت', 'عمل حر', 'عن بُعد', 'تدريب'];

export function mapJob(row: any): Job {
  const images = Array.isArray(row.image_urls)
    ? row.image_urls.filter((url: unknown): url is string => typeof url === 'string' && url.trim().length > 0)
    : [];
  const cover = row.image_url || images[0] || undefined;
  if (cover && !images.includes(cover)) images.unshift(cover);
  return { id: Number(row.id), title: row.title, company: row.company, specialty: row.specialty, categoryId: row.category_id ? Number(row.category_id) : undefined, categoryName: row.job_categories?.name || undefined, description: row.description, governorate: row.governorate, area: row.area, employmentType: row.employment_type, salary: row.salary || undefined, experience: row.experience || undefined, qualification: row.qualification || undefined, phone: row.phone, image: cover, images, video: row.video_url || undefined, createdAt: row.created_at, status: row.status };
}

export function newJobRow(job: NewJob, includeMediaColumns = true) {
  const base = { title: job.title.trim(), company: job.company.trim(), specialty: job.specialty.trim(), category_id: job.categoryId || null, description: job.description.trim(), governorate: job.governorate.trim(), area: job.area.trim(), employment_type: job.employmentType, salary: job.salary?.trim() || null, experience: job.experience?.trim() || null, qualification: job.qualification?.trim() || null, phone: job.phone.trim(), image_url: job.image?.trim() || null, status: 'pending' };
  return includeMediaColumns
    ? { ...base, image_urls: job.images?.filter(Boolean) ?? [], video_url: job.video?.trim() || null }
    : base;
}
