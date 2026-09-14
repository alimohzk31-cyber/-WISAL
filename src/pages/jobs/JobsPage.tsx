import { useMemo, useState } from 'react';
import { BriefcaseBusiness, Plus, Search, SlidersHorizontal } from 'lucide-react';
import JobsSlider from '../../features/jobs/JobsSlider';
import JobCard from '../../features/jobs/JobCard';
import AddJobModal from '../../features/jobs/AddJobModal';
import { employmentTypes } from '../../features/jobs/jobData';
import { useJobs } from '../../features/jobs/useJobs';
import { useJobPresentation } from '../../features/jobs/useJobPresentation';

const selectClass = 'min-w-0 rounded-xl border border-[var(--input-border)] bg-[var(--input-bg)] px-3 py-2.5 text-sm font-bold text-[var(--text-primary)] outline-none focus:border-[var(--accent-primary)]';

export default function JobsPage() {
  const { jobs, loading, configured, error, reload, addJob } = useJobs();
  const presentation = useJobPresentation();
  const [addOpen, setAddOpen] = useState(false);
  const [filters, setFilters] = useState({ query: '', governorate: '', area: '', specialty: '', employmentType: '' });
  const options = (field: 'governorate' | 'area' | 'specialty') => [...new Set(jobs.map(job => job[field]).filter(Boolean))];
  const shown = useMemo(() => jobs.filter(job => {
    const query = filters.query.trim().toLowerCase();
    return (!query || `${job.title} ${job.company} ${job.specialty} ${job.governorate} ${job.area}`.toLowerCase().includes(query))
      && (!filters.governorate || job.governorate === filters.governorate)
      && (!filters.area || job.area === filters.area)
      && (!filters.specialty || job.specialty === filters.specialty)
      && (!filters.employmentType || job.employmentType === filters.employmentType);
  }), [jobs, filters]);

  return <main className="mx-auto max-w-6xl space-y-6 pb-12" dir="rtl">
    <JobsSlider managedSlides={presentation.slides} settings={presentation.settings} jobs={jobs} />

    {/* زر + الدائري: يفتح نفس نموذج إضافة الوظيفة الحالي */}
    <button
      type="button"
      onClick={() => setAddOpen(true)}
      aria-label="إضافة وظيفة"
      className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[var(--accent-primary)] text-white shadow-[var(--shadow-lg)] transition hover:brightness-110 active:scale-95 sm:h-14 sm:w-14"
    >
      <Plus className="h-6 w-6 sm:h-7 sm:w-7" />
    </button>

    <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[var(--accent-soft)] text-[var(--accent-primary)]"><BriefcaseBusiness className="h-6 w-6" /></span>
        <div><h1 className="text-2xl font-black text-[var(--text-primary)] sm:text-3xl">البحث عن وظيفة</h1><p className="mt-1 text-sm font-bold text-[var(--text-muted)]">اعثر على الفرصة المناسبة حسب اختصاصك وموقعك</p></div>
      </div>
    </header>


    <section className="rounded-3xl border border-[var(--border)] bg-[var(--surface-elevated)] p-4 shadow-[var(--shadow)] sm:p-5">
      <div className="mb-3 flex items-center gap-2 text-sm font-black text-[var(--text-primary)]"><SlidersHorizontal className="h-4 w-4 text-[var(--accent-primary)]" />البحث والتصفية</div>
      <label className="relative block">
        <Search className="absolute right-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[var(--text-muted)]" />
        <input value={filters.query} onChange={event => setFilters(current => ({ ...current, query: event.target.value }))} placeholder="ابحث بعنوان الوظيفة أو اسم الجهة أو الاختصاص" className="w-full rounded-2xl border border-[var(--input-border)] bg-[var(--input-bg)] py-3 pr-12 pl-4 text-sm font-bold outline-none focus:border-[var(--accent-primary)]" />
      </label>
      <div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-4">
        {(['governorate', 'area', 'specialty'] as const).map((field, index) => <select key={field} value={filters[field]} onChange={event => setFilters(current => ({ ...current, [field]: event.target.value }))} className={selectClass}><option value="">{['كل المحافظات', 'كل المناطق', 'كل الاختصاصات'][index]}</option>{options(field).map(value => <option key={value}>{value}</option>)}</select>)}
        <select value={filters.employmentType} onChange={event => setFilters(current => ({ ...current, employmentType: event.target.value }))} className={selectClass}><option value="">كل أنواع الدوام</option>{employmentTypes.map(value => <option key={value}>{value}</option>)}</select>
      </div>
    </section>

    <section aria-labelledby="jobs-list-title" className="space-y-4">
      <div className="flex items-end justify-between gap-3"><div><h2 id="jobs-list-title" className="text-xl font-black text-[var(--text-primary)]">الوظائف المتاحة</h2><p className="mt-1 text-xs font-bold text-[var(--text-muted)]">{loading ? 'جارٍ التحميل…' : `${shown.length} وظيفة مطابقة`}</p></div>{filters.query || filters.governorate || filters.area || filters.specialty || filters.employmentType ? <button onClick={() => setFilters({ query: '', governorate: '', area: '', specialty: '', employmentType: '' })} className="text-sm font-black text-[var(--accent-primary)]">مسح التصفية</button> : null}</div>
      {loading ? <div className="grid gap-4 md:grid-cols-2"><div className="h-64 animate-pulse rounded-2xl bg-[var(--bg-secondary)]" /><div className="h-64 animate-pulse rounded-2xl bg-[var(--bg-secondary)]" /></div>
        : !configured ? <div className="rounded-3xl border border-amber-400/30 bg-amber-500/10 p-8 text-center"><BriefcaseBusiness className="mx-auto h-11 w-11 text-amber-500" /><h2 className="mt-3 text-lg font-black">قسم الوظائف جاهز بانتظار تفعيل قاعدة البيانات</h2><p className="mt-2 text-sm font-bold text-[var(--text-secondary)]">نفّذ ملف SQL المرفق لبدء استقبال وعرض الوظائف.</p></div>
          : error ? <div className="rounded-3xl border border-red-500/20 bg-red-500/10 p-8 text-center"><p className="font-bold">تعذر تحميل الوظائف.</p><button onClick={reload} className="mt-3 font-black text-[var(--accent-primary)]">إعادة المحاولة</button></div>
            : shown.length ? <div className="grid gap-4 md:grid-cols-2">{shown.map(job => <JobCard key={job.id} job={job} />)}</div>
              : <div className="rounded-3xl bg-[var(--bg-secondary)] p-10 text-center"><BriefcaseBusiness className="mx-auto h-11 w-11 text-[var(--text-muted)]" /><p className="mt-3 text-base font-black">لا توجد وظائف مطابقة حاليًا</p></div>}
    </section>

    {addOpen ? <AddJobModal categories={presentation.categories} onClose={() => setAddOpen(false)} onSubmit={addJob} /> : null}
  </main>;
}
