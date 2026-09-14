import { BriefcaseBusiness, MapPin } from 'lucide-react';
import { Link } from 'react-router-dom';
import SafeImage from '../../components/SafeImage';
import type { Job } from './types';

export default function JobCard({ job }: { job: Job }) {
  return <article className="flex overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--card)] shadow-[var(--shadow)]">
    <div className="w-28 shrink-0 bg-[var(--bg-secondary)] sm:w-36"><SafeImage src={job.image || ''} alt={job.title} className="h-full min-h-48 w-full object-cover" /></div>
    <div className="flex min-w-0 flex-1 flex-col p-4 sm:p-5">
      <div className="flex items-start gap-3"><div className="hidden rounded-xl bg-[var(--accent-soft)] p-2.5 text-[var(--accent-primary)] sm:block"><BriefcaseBusiness className="h-5 w-5" /></div><div className="min-w-0"><h2 className="line-clamp-2 text-base font-black text-[var(--text-primary)] sm:text-lg">{job.title}</h2><p className="truncate text-sm font-bold text-[var(--text-secondary)]">{job.company}</p></div></div>
      <div className="mt-3 flex flex-wrap gap-1.5 text-[11px] font-bold"><span className="rounded-full bg-[var(--bg-secondary)] px-2.5 py-1"><MapPin className="ml-1 inline h-3 w-3" />{job.governorate} — {job.area}</span><span className="rounded-full bg-[var(--accent-soft)] px-2.5 py-1 text-[var(--accent-primary)]">{job.employmentType}</span>{job.salary ? <span className="rounded-full bg-emerald-500/10 px-2.5 py-1 text-emerald-600">{job.salary}</span> : null}</div>
      <p className="mt-3 line-clamp-2 text-sm leading-6 text-[var(--text-secondary)]">{job.description}</p>
      <div className="mt-auto flex items-center justify-between gap-2 pt-4"><time className="text-[11px] font-bold text-[var(--text-muted)]">{new Intl.DateTimeFormat('ar-IQ').format(new Date(job.createdAt))}</time><Link to={`/jobs/${job.id}`} className="shrink-0 rounded-xl bg-[var(--accent-primary)] px-3 py-2 text-xs font-bold text-white">عرض التفاصيل</Link></div>
    </div>
  </article>;
}
