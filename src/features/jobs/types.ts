export type JobStatus = 'pending' | 'approved' | 'rejected';
export type EmploymentType = 'كامل' | 'جزئي' | 'مؤقت' | 'عمل حر' | 'عن بُعد' | 'تدريب';

export interface Job {
  id: number;
  title: string;
  company: string;
  specialty: string;
  keywords?: string[];
  categoryId?: number;
  categoryName?: string;
  description: string;
  companyAbout?: string;
  requirements?: string;
  benefits?: string;
  governorate: string;
  area: string;
  address?: string;
  employmentType: EmploymentType;
  salary?: string;
  salaryNegotiable?: boolean;
  experience?: string;
  qualification?: string;
  phone: string;
  whatsapp?: string;
  email?: string;
  socialLinks?: string;
  applicationDeadline?: string;
  trainingDuration?: string;
  trainingPaid?: boolean;
  trainingHiringPossible?: boolean;
  image?: string;
  images?: string[];
  video?: string;
  createdAt: string;
  status: JobStatus;
}

export type NewJob = Omit<Job, 'id' | 'createdAt' | 'status'>;

export interface NewJobMedia {
  imageFile?: File;
  removeImage?: boolean;
}

export interface JobApplicationDraft {
  fullName: string;
  phone: string;
  email?: string;
  governorate: string;
  area: string;
  experience?: string;
  message?: string;
}

export interface JobApplication extends JobApplicationDraft {
  id: number;
  jobId: number;
  cvPath: string;
  cvName: string;
  cvMimeType: string;
  createdAt: string;
  jobTitle?: string;
  company?: string;
}
