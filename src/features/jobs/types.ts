export type JobStatus = 'pending' | 'approved' | 'rejected';
export type EmploymentType = 'كامل' | 'جزئي' | 'مؤقت' | 'عمل حر' | 'عن بُعد' | 'تدريب';

export interface Job {
  id: number;
  title: string;
  company: string;
  specialty: string;
  categoryId?: number;
  categoryName?: string;
  description: string;
  governorate: string;
  area: string;
  employmentType: EmploymentType;
  salary?: string;
  experience?: string;
  qualification?: string;
  phone: string;
  image?: string;
  images?: string[];
  video?: string;
  createdAt: string;
  status: JobStatus;
}

export type NewJob = Omit<Job, 'id' | 'createdAt' | 'status'>;

export interface NewJobMedia {
  imageFiles: File[];
  videoFile?: File;
}
