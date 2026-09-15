import { useEffect, useMemo, useState } from 'react';
import { Download, FileText, RefreshCw, Search, UserRound } from 'lucide-react';
import { loadJobApplications, openApplicationCv } from '../jobApplications';
import type { JobApplication } from '../types';

export default function JobApplicationsAdmin() {
  const [items, setItems] = useState<JobApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const load = async () => {
    setLoading(true); setError('');
    try { setItems(await loadJobApplications()); }
    catch (loadError: any) {
      const missing = ['42P01', 'PGRST205'].includes(String(loadError?.code || '')) || /job_applications/i.test(loadError?.message || '');
      setError(missing ? 'نفّذ ملف supabase_job_applications.sql لتفعيل طلبات التقديم.' : 'تعذر تحميل طلبات التقديم.');
    } finally { setLoading(false); }
  };
  useEffect(() => { void load(); }, []);
  const shown = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return items.filter(item => !needle || `${item.fullName} ${item.phone} ${item.jobTitle} ${item.company} ${item.governorate} ${item.area}`.toLowerCase().includes(needle));
  }, [items, query]);
  return <section className="space-y-4">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><h3 className="text-xl font-black">طلبات التقديم</h3><p className="text-sm font-bold text-[var(--text-muted)]">{items.length} طلب محفوظ بصورة خاصة</p></div><button type="button" onClick={() => void load()} className="inline-flex items-center justify-center gap-2 rounded-xl border border-[var(--border)] px-3 py-2 font-bold"><RefreshCw className="h-4 w-4" />تحديث</button></div>
    <label className="relative block"><Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]" /><input value={query} onChange={event => setQuery(event.target.value)} placeholder="ابحث باسم المتقدم أو الوظيفة" className="w-full rounded-xl border border-[var(--input-border)] bg-[var(--input-bg)] py-3 pr-10 pl-3 font-bold outline-none" /></label>
    {loading ? <div className="h-40 animate-pulse rounded-2xl bg-[var(--bg-secondary)]" /> : error ? <div className="rounded-2xl bg-amber-500/10 p-6 text-center font-bold text-amber-700">{error}</div> : shown.length === 0 ? <div className="rounded-2xl bg-[var(--bg-secondary)] p-8 text-center"><UserRound className="mx-auto h-9 w-9 text-[var(--text-muted)]" /><p className="mt-2 font-black">لا توجد طلبات مطابقة</p></div> : <div className="space-y-3">{shown.map(item => <article key={item.id} className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4 shadow-[var(--shadow)]"><div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><p className="text-xs font-bold text-[var(--accent-primary)]">{item.jobTitle || `وظيفة #${item.jobId}`} — {item.company || 'جهة غير معروفة'}</p><h4 className="mt-1 text-lg font-black">{item.fullName}</h4><p className="text-sm font-bold text-[var(--text-secondary)]">{item.phone}{item.email ? ` • ${item.email}` : ''}</p><p className="mt-1 text-sm text-[var(--text-secondary)]">{item.governorate} — {item.area}{item.experience ? ` • ${item.experience}` : ''}</p></div><button type="button" onClick={() => void openApplicationCv(item.cvPath)} className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-[var(--accent-primary)] px-3 py-2 text-sm font-black text-white"><Download className="h-4 w-4" />فتح السيرة</button></div>{item.message ? <p className="mt-3 rounded-xl bg-[var(--bg-secondary)] p-3 text-sm leading-7">{item.message}</p> : null}<div className="mt-3 flex items-center justify-between text-xs font-bold text-[var(--text-muted)]"><span className="inline-flex items-center gap-1"><FileText className="h-4 w-4" />{item.cvName}</span><time>{new Intl.DateTimeFormat('ar-IQ', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(item.createdAt))}</time></div></article>)}</div>}
  </section>;
}
