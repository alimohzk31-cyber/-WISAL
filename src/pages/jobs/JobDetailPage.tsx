import { useMemo, useState } from 'react';
import { ArrowRight, Bookmark, BriefcaseBusiness, CalendarDays, ChevronLeft, ChevronRight, Clock3, GraduationCap, MapPin, Share2, Sparkles, WalletCards } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import SafeImage from '../../components/SafeImage';
import JobApplicationModal from '../../features/jobs/JobApplicationModal';
import { employmentTypeLabel } from '../../features/jobs/jobData';
import { useJobs } from '../../features/jobs/useJobs';
import { useSavedJobs } from '../../features/jobs/useSavedJobs';
import { useToast } from '../../components/ToastProvider';
import { sanitizeExternalUrl } from '../../lib/externalUrl';

const infoCard = 'flex min-w-0 flex-col items-center justify-center gap-1.5 rounded-[18px] border border-[var(--theme-border)] bg-[var(--theme-surface)] p-3 text-center shadow-[var(--theme-shadow)]';

function lines(value?: string) {
  return value?.split(/\r?\n|،|•/).map(item => item.replace(/^[-✓\s]+/, '').trim()).filter(Boolean) || [];
}

export default function JobDetailPage() {
  const { jobId } = useParams();
  const { jobs, loading, configured } = useJobs();
  const { isSaved, toggleSaved } = useSavedJobs();
  const toast = useToast();
  const [imageIndex, setImageIndex] = useState(0);
  const [applicationOpen, setApplicationOpen] = useState(false);
  const job = useMemo(() => jobs.find(item => String(item.id) === jobId), [jobs, jobId]);
  if (loading) return <div className="mx-auto h-96 max-w-3xl animate-pulse rounded-3xl bg-[var(--bg-secondary)]" />;
  if (!configured || !job) return <div className="py-20 text-center"><p className="text-xl font-black">الوظيفة غير موجودة أو غير متاحة</p><Link to="/jobs" className="mt-4 inline-block text-[var(--accent-primary)]">العودة إلى الوظائف</Link></div>;
  const images = job.images?.length ? job.images : job.image ? [job.image] : [];
  const requirements = lines(job.requirements);
  const benefits = lines(job.benefits);
  const videoUrl = sanitizeExternalUrl(job.video);
  const location = [job.governorate, job.area, job.address].filter(Boolean).join('، ') || 'عن بُعد';
  const saved = isSaved(job.id);
  const share = async () => {
    const url = window.location.href;
    try {
      if (navigator.share) await navigator.share({ title: `${job.title} — ${job.company}`, text: `فرصة عمل: ${job.title} لدى ${job.company}`, url });
      else { await navigator.clipboard.writeText(url); toast('success', 'تم نسخ رابط الوظيفة'); }
    } catch (error) {
      if ((error as DOMException)?.name !== 'AbortError') toast('error', 'تعذرت مشاركة الرابط');
    }
  };
  return <article className="-mx-3 -my-8 min-h-screen min-w-0 max-w-none bg-[var(--theme-background)] px-3 pb-28 pt-3 text-[var(--theme-text)] sm:-mx-4 sm:px-6 sm:pt-6" dir="rtl">
    <div className="mx-auto w-full min-w-0 max-w-3xl">
    <header className="mb-4 flex min-w-0 items-center justify-between gap-2 rounded-[20px] bg-[var(--theme-surface)] px-2 py-2 shadow-[var(--theme-shadow)] sm:gap-3"><Link to="/jobs" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-[var(--theme-text)] hover:bg-[var(--theme-primary-soft)]" aria-label="رجوع"><ArrowRight /></Link><h1 className="min-w-0 flex-1 text-center text-base font-black text-[var(--theme-text)] sm:text-xl">تفاصيل الوظيفة</h1><button type="button" onClick={() => void share()} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-[var(--theme-text)] hover:bg-[var(--theme-primary-soft)]" aria-label="مشاركة الوظيفة"><Share2 className="h-5 w-5" /></button></header>

    <div>
      {images.length ? <div className="relative aspect-[16/10] max-h-[28rem] overflow-hidden rounded-[26px] border-[5px] border-white bg-[var(--theme-surface-alt)] shadow-[var(--theme-shadow)]"><SafeImage key={images[imageIndex]} src={images[imageIndex]} alt={`${job.title} — صورة ${imageIndex + 1}`} loading={imageIndex === 0 ? 'eager' : 'lazy'} className="h-full w-full object-cover" />{images.length > 1 ? <><button type="button" onClick={() => setImageIndex(current => (current - 1 + images.length) % images.length)} aria-label="الصورة السابقة" className="absolute right-3 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/55 text-white"><ChevronRight /></button><button type="button" onClick={() => setImageIndex(current => (current + 1) % images.length)} aria-label="الصورة التالية" className="absolute left-3 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/55 text-white"><ChevronLeft /></button><span className="absolute bottom-3 left-3 rounded-full bg-black/65 px-3 py-1 text-xs font-black text-white" dir="ltr">{imageIndex + 1}/{images.length}</span></> : null}</div> : <div className="flex h-52 items-center justify-center rounded-[26px] border-[5px] border-white bg-[var(--theme-surface-alt)] shadow-[var(--theme-shadow)]"><BriefcaseBusiness className="h-16 w-16 text-[var(--accent-primary)]" /></div>}
      <div className="space-y-5 py-5 sm:py-7">
        <section className="min-w-0 rounded-[22px] bg-[var(--theme-surface)] p-4 shadow-[var(--theme-shadow)] sm:p-5"><div className="flex min-w-0 flex-wrap items-start justify-between gap-3"><div className="min-w-0 flex-1"><h2 className="break-words text-2xl font-black leading-tight text-[var(--theme-text)] sm:text-3xl">{job.title}</h2><p className="mt-1 break-words text-sm font-extrabold text-[var(--theme-muted)] sm:text-base">{job.company}</p></div><span className="shrink-0 rounded-lg bg-[var(--theme-primary-soft)] px-3 py-1.5 text-xs font-black text-[var(--theme-primary-dark)]">{employmentTypeLabel(job.employmentType)}</span></div></section>
        <div className="grid min-w-0 grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-3">
          <div className={infoCard}><MapPin className="h-6 w-6 shrink-0 text-[var(--theme-secondary)]" /><div className="min-w-0"><p className="text-[10px] font-bold text-[var(--theme-muted)] sm:text-xs">الموقع</p><p className="line-clamp-2 text-[10px] font-black text-[var(--theme-text)] sm:text-sm">{location}</p></div></div>
          <div className={infoCard}><WalletCards className="h-6 w-6 shrink-0 text-[var(--accent-primary)]" /><div className="min-w-0"><p className="text-[10px] font-bold text-[var(--theme-muted)] sm:text-xs">الراتب</p><p className="line-clamp-2 text-[10px] font-black text-[var(--theme-text)] sm:text-sm">{job.salaryNegotiable || !job.salary ? 'بعد المقابلة' : job.salary}</p></div></div>
          <div className={infoCard}><BriefcaseBusiness className="h-6 w-6 shrink-0 text-[var(--theme-secondary)]" /><div className="min-w-0"><p className="text-[10px] font-bold text-[var(--theme-muted)] sm:text-xs">الخبرة</p><p className="line-clamp-2 text-[10px] font-black text-[var(--theme-text)] sm:text-sm">{job.experience || 'غير محددة'}</p></div></div>
          <div className={infoCard}><CalendarDays className="h-6 w-6 shrink-0 text-[var(--theme-secondary)]" /><div className="min-w-0"><p className="text-[10px] font-bold text-[var(--theme-muted)] sm:text-xs">تاريخ النشر</p><p className="line-clamp-2 text-[10px] font-black text-[var(--theme-text)] sm:text-sm">{new Intl.DateTimeFormat('ar-IQ', { dateStyle: 'medium' }).format(new Date(job.createdAt))}</p></div></div>
          <div className={infoCard}><Clock3 className="h-6 w-6 shrink-0 text-[var(--theme-secondary)]" /><div className="min-w-0"><p className="text-[10px] font-bold text-[var(--theme-muted)] sm:text-xs">نوع الدوام</p><p className="line-clamp-2 text-[10px] font-black text-[var(--theme-text)] sm:text-sm">{employmentTypeLabel(job.employmentType)}</p></div></div>
          {job.qualification ? <div className={infoCard}><GraduationCap className="h-6 w-6 shrink-0 text-[var(--theme-secondary)]" /><div className="min-w-0"><p className="text-[10px] font-bold text-[var(--theme-muted)] sm:text-xs">المؤهل</p><p className="line-clamp-2 text-[10px] font-black text-[var(--theme-text)] sm:text-sm">{job.qualification}</p></div></div> : null}
        </div>
        {job.companyAbout ? <section className="rounded-[22px] bg-[var(--theme-surface)] p-5 shadow-[var(--theme-shadow)]"><h3 className="text-lg font-black text-[var(--theme-text)]">نبذة عن الشركة</h3><p className="mt-2 whitespace-pre-wrap leading-8 text-[var(--theme-muted)]">{job.companyAbout}</p></section> : null}
        <section className="rounded-[22px] bg-[var(--theme-surface)] p-5 shadow-[var(--theme-shadow)]"><h3 className="text-lg font-black text-[var(--theme-text)]">وصف الوظيفة</h3><p className="mt-2 whitespace-pre-wrap leading-8 text-[var(--theme-muted)]">{job.description}</p></section>
        {requirements.length ? <section className="rounded-[22px] bg-[var(--theme-surface)] p-5 shadow-[var(--theme-shadow)]"><h3 className="text-lg font-black text-[var(--theme-text)]">المتطلبات</h3><ul className="mt-3 space-y-2">{requirements.map((item, index) => <li key={`${item}-${index}`} className="flex gap-2 leading-7 text-[var(--theme-muted)]"><span className="mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--theme-primary-soft)] text-xs font-black text-[var(--theme-primary-dark)]">✓</span>{item}</li>)}</ul></section> : null}
        {benefits.length ? <section className="rounded-[22px] bg-[var(--theme-surface)] p-5 shadow-[var(--theme-shadow)]"><h3 className="flex items-center gap-2 text-lg font-black text-[var(--theme-text)]"><Sparkles className="h-5 w-5 text-amber-500" />المميزات</h3><div className="mt-3 flex flex-wrap gap-2">{benefits.map((item, index) => <span key={`${item}-${index}`} className="rounded-full bg-[var(--theme-primary-soft)] px-3 py-2 text-sm font-bold text-[var(--theme-primary-dark)]">{item}</span>)}</div></section> : null}
        {job.employmentType === 'تدريب' && (job.trainingDuration || job.trainingPaid || job.trainingHiringPossible) ? <section className="rounded-2xl bg-[var(--accent-soft)] p-4"><h3 className="font-black text-[var(--accent-primary)]">تفاصيل التدريب</h3><div className="mt-2 space-y-1 text-sm font-bold">{job.trainingDuration ? <p>المدة: {job.trainingDuration}</p> : null}<p>{job.trainingPaid ? 'تدريب مدفوع' : 'تدريب غير مدفوع'}</p>{job.trainingHiringPossible ? <p>توجد إمكانية للتوظيف بعد التدريب</p> : null}</div></section> : null}
        {videoUrl ? <video src={videoUrl} controls preload="none" className="max-h-96 w-full rounded-2xl bg-black object-contain" /> : null}
      </div>
    </div>
    </div>

    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-[var(--theme-border)] bg-[var(--theme-surface)]/95 px-2 py-3 shadow-[var(--theme-shadow)] backdrop-blur-xl sm:px-4"><div className="mx-auto grid w-full min-w-0 max-w-3xl grid-cols-2 gap-2 sm:gap-3"><button type="button" onClick={() => { const next = toggleSaved(job.id); toast('success', next ? 'تم حفظ الوظيفة' : 'تمت إزالة الوظيفة من المحفوظات'); }} className="flex min-w-0 items-center justify-center gap-1 rounded-[16px] border-2 border-[var(--accent-primary)] px-2 py-3 text-center text-sm font-black text-[var(--accent-primary)] sm:gap-2 sm:px-3 sm:text-base"><Bookmark className={`h-5 w-5 shrink-0 ${saved ? 'fill-current' : ''}`} /><span className="min-w-0">{saved ? 'محفوظة' : 'حفظ الوظيفة'}</span></button><button type="button" onClick={() => setApplicationOpen(true)} className="min-w-0 rounded-[16px] bg-[var(--accent-primary)] px-2 py-3 text-center text-sm font-black text-white shadow-[0_8px_22px_var(--glow)] sm:px-4 sm:text-base">التقديم الآن</button></div></div>
    {applicationOpen ? <JobApplicationModal job={job} onClose={() => setApplicationOpen(false)} /> : null}
  </article>;
}
