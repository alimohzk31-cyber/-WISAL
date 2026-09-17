import { useMemo, useState } from 'react';
import { ArrowLeft, BriefcaseBusiness, GraduationCap, House, Mic, Plus, Search, Timer, X } from 'lucide-react';
import JobsSlider from '../../features/jobs/JobsSlider';
import DirectoryNav from '../../components/DirectoryNav';
import JobCard from '../../features/jobs/JobCard';
import AddJobModal from '../../features/jobs/AddJobModal';
import { employmentTypeLabel } from '../../features/jobs/jobData';
import { useJobs } from '../../features/jobs/useJobs';
import { useJobPresentation } from '../../features/jobs/useJobPresentation';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { useSavedJobs } from '../../features/jobs/useSavedJobs';
import type { EmploymentType } from '../../features/jobs/types';
import { scoreJobSearch } from '../../features/jobs/jobSearch';

const typeCards = [
  { type: 'تدريب' as const, icon: GraduationCap, color: 'bg-amber-500/12 text-amber-600', accent: 'border-amber-400/40' },
  { type: 'عن بُعد' as const, icon: House, color: 'bg-sky-500/12 text-sky-600', accent: 'border-sky-400/40' },
  { type: 'كامل' as const, icon: BriefcaseBusiness, color: 'bg-violet-500/12 text-violet-600', accent: 'border-violet-400/40' },
  { type: 'جزئي' as const, icon: Timer, color: 'bg-emerald-500/12 text-emerald-600', accent: 'border-emerald-400/40' },
];

export default function JobsPage() {
  const { jobs, loading, configured, error, reload, addJob } = useJobs();
  const presentation = useJobPresentation();
  const { isSaved, toggleSaved } = useSavedJobs();
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebouncedValue(query, 250);
  const [employmentType, setEmploymentType] = useState<EmploymentType | ''>('');
  const [addType, setAddType] = useState<EmploymentType>();
  const [showAll, setShowAll] = useState(false);

  const filtered = useMemo(() => jobs
    .flatMap(job => {
      if (employmentType && job.employmentType !== employmentType) return [];
      const score = debouncedQuery.trim() ? scoreJobSearch(job, debouncedQuery) : 0;
      if (debouncedQuery.trim() && score <= 0) return [];
      return [{ job, score }];
    })
    .sort((a, b) => b.score - a.score)
    .map(({ job }) => job), [jobs, debouncedQuery, employmentType]);
  const visibleJobs = showAll || debouncedQuery || employmentType ? filtered : filtered.slice(0, 6);
  const hasFilter = Boolean(debouncedQuery || employmentType);

  return <main className="-mx-3 -my-8 min-h-screen min-w-0 max-w-none bg-[#f3f8ff] px-3 pb-16 pt-3 text-[#12233f] sm:-mx-4 sm:px-6 sm:pt-6 lg:px-8" dir="rtl">
    <div className="mx-auto w-full min-w-0 max-w-6xl space-y-5 sm:space-y-7">
    <JobsSlider settings={presentation.settings} jobs={jobs} loading={loading} />
    <DirectoryNav activeView="jobs" />

    <section aria-label="البحث عن وظيفة">
      <label className="relative block rounded-[20px] bg-white shadow-[0_9px_30px_rgba(20,100,210,0.12)]">
        <Search className="absolute right-4 top-1/2 z-10 h-6 w-6 -translate-y-1/2 text-[#24558f]" />
        <input value={query} onChange={event => { setQuery(event.target.value); setShowAll(false); }} placeholder="ابحث عن وظيفة (مثلاً: محاسب، مبيعات...)" className="h-[58px] w-full rounded-[20px] border-2 border-[#b8d9ff] bg-white pr-13 pl-24 text-sm font-bold text-[#1d3557] outline-none transition placeholder:text-[#7286a1] focus:border-[var(--accent-primary)] focus:ring-4 focus:ring-[var(--accent-primary)]/10 sm:h-16 sm:text-base" />
        <span className="absolute left-2.5 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-xl bg-[var(--accent-primary)] text-white shadow-[0_5px_14px_rgba(8,124,255,0.32)]" aria-hidden="true"><Mic className="h-5 w-5" /></span>
        {query ? <button type="button" onClick={() => { setQuery(''); setShowAll(false); }} aria-label="مسح البحث" className="absolute left-14 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-xl text-[#7890aa] hover:bg-[#edf6ff] hover:text-[var(--accent-primary)]"><X className="h-4 w-4" /></button> : null}
      </label>
    </section>

    <section aria-label="أنواع الوظائف" className="space-y-3">
      <div className="grid min-w-0 grid-cols-2 gap-2.5 sm:grid-cols-4 sm:gap-4">
        {typeCards.map(({ type, icon: Icon, color, accent }) => {
          const selected = employmentType === type;
          return <article key={type} className={`relative min-w-0 overflow-hidden rounded-[20px] border bg-white px-1.5 py-3 text-center shadow-[0_8px_24px_rgba(30,86,146,0.10)] transition sm:px-3 sm:py-4 ${selected ? `${accent} -translate-y-1 ring-2 ring-[var(--accent-primary)]/15` : 'border-[#e2edf9]'}`}>
            <button type="button" onClick={() => { setEmploymentType(current => current === type ? '' : type); setShowAll(true); }} aria-pressed={selected} className="absolute inset-0 z-0" aria-label={`عرض وظائف ${employmentTypeLabel(type)}`} />
            <span className={`pointer-events-none relative z-[1] mx-auto flex h-10 w-10 items-center justify-center rounded-[14px] sm:h-12 sm:w-12 ${color}`}><Icon className="h-6 w-6 sm:h-7 sm:w-7" /></span>
            <h2 className="pointer-events-none relative z-[1] mt-2 truncate text-[11px] font-black text-[#153458] sm:text-sm">{employmentTypeLabel(type)}</h2>
            <button type="button" onClick={() => setAddType(type)} className="relative z-10 mt-2 inline-flex max-w-full items-center justify-center gap-0.5 rounded-lg bg-[#eef6ff] px-1.5 py-1 text-[9px] font-black text-[var(--accent-primary)] hover:bg-[#dcecff] sm:px-2.5 sm:text-[11px]"><Plus className="h-3 w-3" />انضم الآن</button>
          </article>;
        })}
      </div>
      {employmentType ? <button type="button" onClick={() => setEmploymentType('')} className="mx-auto block text-xs font-black text-[var(--accent-primary)]">إلغاء تصفية {employmentTypeLabel(employmentType)}</button> : null}
    </section>

    <section aria-labelledby="latest-jobs-title" className="space-y-4">
      <div className="flex min-w-0 flex-wrap items-center justify-between gap-3"><div className="min-w-0"><h2 id="latest-jobs-title" className="text-xl font-black text-[#0f2747] sm:text-2xl">{hasFilter ? 'نتائج البحث' : 'أحدث الوظائف'}</h2><p className="mt-0.5 text-[11px] font-bold text-[#8191a7]">{loading ? 'جارٍ التحميل…' : `${filtered.length} فرصة متاحة`}</p></div>{!showAll && !hasFilter ? <button type="button" onClick={() => setShowAll(true)} className="inline-flex shrink-0 items-center gap-1 text-sm font-black text-[var(--accent-primary)]">عرض الكل<ArrowLeft className="h-4 w-4" /></button> : null}</div>
      {loading ? <div className="grid gap-3 md:grid-cols-2"><div className="h-32 animate-pulse rounded-[22px] bg-white" /><div className="h-32 animate-pulse rounded-[22px] bg-white" /></div>
        : !configured ? <div className="rounded-3xl border border-amber-400/30 bg-amber-500/10 p-8 text-center"><BriefcaseBusiness className="mx-auto h-11 w-11 text-amber-500" /><h2 className="mt-3 text-lg font-black">قسم الوظائف جاهز بانتظار تفعيل قاعدة البيانات</h2><p className="mt-2 text-sm font-bold text-[var(--text-secondary)]">نفّذ ملفات SQL الخاصة بالوظائف لبدء استقبال وعرض الفرص.</p></div>
          : error ? <div className="rounded-3xl border border-red-500/20 bg-red-500/10 p-8 text-center"><p className="font-bold">تعذر تحميل الوظائف.</p><button onClick={reload} className="mt-3 font-black text-[var(--accent-primary)]">إعادة المحاولة</button></div>
            : visibleJobs.length ? <div className="grid gap-3 md:grid-cols-2">{visibleJobs.map(job => <JobCard key={job.id} job={job} saved={isSaved(job.id)} onToggleSaved={() => toggleSaved(job.id)} />)}</div>
              : <div className="rounded-[24px] bg-white p-10 text-center shadow-[0_8px_25px_rgba(30,86,146,0.08)]"><BriefcaseBusiness className="mx-auto h-11 w-11 text-[#91a8c3]" /><p className="mt-3 text-base font-black">{debouncedQuery ? 'لا توجد وظائف مطابقة لبحثك حالياً' : 'لا توجد وظائف متاحة حالياً'}</p>{hasFilter ? <button type="button" onClick={() => { setQuery(''); setEmploymentType(''); }} className="mt-3 text-sm font-black text-[var(--accent-primary)]">مسح البحث والتصفية</button> : null}</div>}
    </section>

    {addType ? <AddJobModal initialEmploymentType={addType} categories={presentation.categories} onClose={() => setAddType(undefined)} onSubmit={addJob} /> : null}
    </div>
  </main>;
}
