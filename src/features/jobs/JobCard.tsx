import { Bookmark, BriefcaseBusiness, Clock3, MapPin } from 'lucide-react';
import { Link } from 'react-router-dom';
import SafeImage from '../../components/SafeImage';
import { employmentTypeLabel } from './jobData';
import type { Job } from './types';

function relativeTime(value: string): string {
  const date = new Date(value);
  const seconds = Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000));
  if (!Number.isFinite(seconds)) return '';
  if (seconds < 60) return 'منذ لحظات';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `منذ ${minutes} ${minutes === 1 ? 'دقيقة' : 'دقائق'}`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `منذ ${hours} ${hours === 1 ? 'ساعة' : 'ساعات'}`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `منذ ${days} ${days === 1 ? 'يوم' : 'أيام'}`;
  return new Intl.DateTimeFormat('ar-IQ', { day: 'numeric', month: 'short' }).format(date);
}

export default function JobCard({ job, saved, onToggleSaved }: {
  job: Job;
  saved?: boolean;
  onToggleSaved?: (jobId: number) => void;
}) {
  const location = [job.governorate, job.area].filter(Boolean).join('، ') || 'عن بُعد';
  return <article className="group relative flex min-h-[126px] min-w-0 max-w-full gap-2 overflow-hidden rounded-[22px] border border-[#e0ebf7] bg-white p-2.5 shadow-[0_8px_26px_rgba(31,83,142,0.10)] transition hover:-translate-y-0.5 hover:border-[#9fcaff] hover:shadow-[0_14px_34px_rgba(31,100,180,0.16)] sm:min-h-[142px] sm:gap-3 sm:p-3">
    <Link to={`/jobs/${job.id}`} className="absolute inset-0 z-0 rounded-[inherit]" aria-label={`تفاصيل وظيفة ${job.title} في ${job.company}`} />
    <div className="relative z-[1] flex w-[36%] max-w-[104px] shrink-0 items-center justify-center overflow-hidden rounded-[17px] bg-[#e9f3ff] sm:w-[128px] sm:max-w-none">
      {job.image ? <SafeImage src={job.image} alt={`صورة ${job.company}`} className="h-full w-full object-cover" /> : <BriefcaseBusiness className="h-9 w-9 text-[var(--accent-primary)]" />}
    </div>
    <div className="pointer-events-none relative z-[1] min-w-0 flex-1">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 pl-8"><p className="truncate text-xs font-extrabold text-[#344f70]">{job.company}</p><h3 className="mt-0.5 line-clamp-2 text-[15px] font-black leading-6 text-[#101f35] sm:text-lg">{job.title}</h3></div>
        <button type="button" onClick={() => onToggleSaved?.(job.id)} aria-label={saved ? 'إزالة الوظيفة من المحفوظات' : 'حفظ الوظيفة'} className="pointer-events-auto absolute left-0 top-0 z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[var(--accent-primary)] transition hover:bg-[var(--accent-soft)]"><Bookmark className={`h-[19px] w-[19px] ${saved ? 'fill-current' : ''}`} /></button>
      </div>
      <div className="mt-2 flex min-w-0 items-center gap-1 text-[10px] font-bold text-[#526c8b] sm:text-xs"><MapPin className="h-3.5 w-3.5 shrink-0 text-[#3e6797]" /><span className="truncate">{location}</span></div>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2"><span className="rounded-lg bg-[#d5f6ee] px-2 py-1 text-[10px] font-black text-[#07876c] sm:text-[11px]">{employmentTypeLabel(job.employmentType)}</span><time dateTime={job.createdAt} className="flex items-center gap-1 text-[10px] font-bold text-[#73869e] sm:text-[11px]"><Clock3 className="h-3.5 w-3.5" />{relativeTime(job.createdAt)}</time></div>
    </div>
  </article>;
}
