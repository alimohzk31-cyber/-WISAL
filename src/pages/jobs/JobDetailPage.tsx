import { useMemo } from 'react';
import { ArrowRight, BriefcaseBusiness, MapPin, Phone } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import SafeImage from '../../components/SafeImage';
import { useJobs } from '../../features/jobs/useJobs';

export default function JobDetailPage() {
  const { jobId } = useParams();
  const { jobs, loading, configured } = useJobs();
  const job = useMemo(() => jobs.find(item => String(item.id) === jobId), [jobs, jobId]);
  if (loading) return <div className="h-96 animate-pulse rounded-3xl bg-[var(--bg-secondary)]" />;
  if (!configured || !job) return <div className="py-20 text-center"><p className="text-xl font-black">الوظيفة غير موجودة أو غير متاحة</p><Link to="/jobs" className="mt-4 inline-block text-[var(--accent-primary)]">العودة إلى الوظائف</Link></div>;
  const phone = job.phone.replace(/[^+0-9]/g, '');
  const images = job.images?.length ? job.images : job.image ? [job.image] : [];
  return <article className="mx-auto max-w-3xl overflow-hidden rounded-3xl border border-[var(--border)] bg-[var(--surface-elevated)] shadow-[var(--shadow-lg)]">
    <div className="bg-gradient-to-br from-violet-700 to-indigo-950 p-7 text-white sm:p-10"><Link to="/jobs" className="mb-6 inline-flex items-center gap-2 font-bold"><ArrowRight />رجوع</Link><BriefcaseBusiness className="h-12 w-12" /><h1 className="mt-4 text-3xl font-black">{job.title}</h1><p className="mt-2 text-lg font-bold text-white/80">{job.company}</p></div>
    <div className="space-y-6 p-5 sm:p-9">
      {images.length ? <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">{images.map((image, index) => <SafeImage key={`${image}-${index}`} src={image} alt={`${job.title} — صورة ${index + 1}`} loading={index === 0 ? 'eager' : 'lazy'} className={`w-full rounded-2xl bg-[var(--bg-secondary)] object-contain ${index === 0 ? 'col-span-2 max-h-80 sm:col-span-3' : 'aspect-square'}`} />)}</div> : null}
      {job.video ? <video src={job.video} controls preload="none" className="max-h-96 w-full rounded-2xl bg-black object-contain" /> : null}
      <div className="flex flex-wrap gap-2"><span className="rounded-full bg-[var(--bg-secondary)] px-4 py-2 font-bold"><MapPin className="ml-1 inline h-4 w-4" />{job.governorate} — {job.area}</span><span className="rounded-full bg-[var(--accent-soft)] px-4 py-2 font-bold text-[var(--accent-primary)]">{job.employmentType}</span></div>
      <section><h2 className="font-black">التفاصيل</h2><p className="mt-2 whitespace-pre-wrap leading-8 text-[var(--text-secondary)]">{job.description}</p></section>
      <div className="grid gap-3 sm:grid-cols-2">{job.salary ? <p><b>الراتب:</b> {job.salary}</p> : null}{job.experience ? <p><b>الخبرة:</b> {job.experience}</p> : null}{job.qualification ? <p><b>المؤهل:</b> {job.qualification}</p> : null}<p><b>الاختصاص:</b> {job.specialty}</p></div>
      <a href={`tel:${phone}`} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 py-4 font-black text-white"><Phone />اتصال للتقديم</a>
    </div>
  </article>;
}
