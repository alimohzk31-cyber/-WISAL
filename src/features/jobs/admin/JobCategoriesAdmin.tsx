import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, Pencil, Trash2 } from 'lucide-react';
import { deleteJobCategory, loadJobCategories, reorderJobCategory, saveJobCategory, type JobCategory } from './jobAdminApi';

export default function JobCategoriesAdmin() {
  const [items, setItems] = useState<JobCategory[]>([]);
  const [draft, setDraft] = useState<Partial<JobCategory>>({ name: '', icon: 'briefcase' });
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const load = async () => {
    try { setItems(await loadJobCategories()); setMessage(''); }
    catch (loadError) { console.error('[JobCategoriesAdmin] Categories could not be loaded:', loadError); setMessage('نفّذ SQL الخاص بالوظائف أولًا.'); }
  };
  useEffect(() => { void load(); }, []);
  const run = async (action: () => Promise<void>) => {
    if (busy) return;
    setBusy(true);
    try { await action(); }
    catch (actionError) { console.error('[JobCategoriesAdmin] Category action failed:', actionError); setMessage('تعذر تنفيذ العملية. تحقق من الاتصال وصلاحيات الإدارة.'); }
    finally { setBusy(false); }
  };
  const move = async (i: number, d: number) => {
    const o = i + d;
    if (o < 0 || o >= items.length) return;
    await run(async () => {
      await Promise.all([
        reorderJobCategory(items[i], items[o].sortOrder),
        reorderJobCategory(items[o], items[i].sortOrder),
      ]);
      await load();
    });
  };

  return <div className="min-w-0 space-y-4">
    <form onSubmit={async event => {
      event.preventDefault();
      await run(async () => {
        await saveJobCategory(draft);
        setDraft({ name: '', icon: 'briefcase' });
        await load();
      });
    }} className="grid min-w-0 gap-2 rounded-2xl bg-[var(--bg-secondary)] p-3 sm:grid-cols-2 sm:p-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
      <input required value={draft.name || ''} onChange={event => setDraft({ ...draft, name: event.target.value })} placeholder="اسم القسم" className="w-full min-w-0 rounded-xl border p-3" />
      <input value={draft.icon || ''} onChange={event => setDraft({ ...draft, icon: event.target.value })} placeholder="اسم الأيقونة" className="w-full min-w-0 rounded-xl border p-3" />
      <button disabled={busy} className="w-full min-w-0 rounded-xl bg-[var(--accent-primary)] px-5 py-3 font-bold text-white disabled:opacity-50 sm:col-span-2 lg:col-span-1">{draft.id ? 'حفظ' : 'إضافة قسم'}</button>
    </form>
    {message && <p>{message}</p>}
    {items.map((item, i) => <div key={item.id} className="flex min-w-0 flex-wrap items-center gap-2 rounded-2xl border p-3 sm:gap-3 sm:p-4">
      <b className="min-w-0 flex-1 basis-40 break-words">{item.name}</b>
      <span className="min-w-0 break-all text-xs">{item.icon}</span>
      <div className="flex min-w-0 flex-wrap items-center gap-3">
        <button disabled={busy} onClick={() => setDraft(item)} aria-label="تعديل"><Pencil /></button>
        <button disabled={busy} onClick={() => void run(async () => { await saveJobCategory({ ...item, isVisible: !item.isVisible }); await load(); })} className="text-xs font-bold">{item.isVisible ? 'إخفاء' : 'إظهار'}</button>
        <button disabled={busy} onClick={() => void move(i, -1)} aria-label="نقل للأعلى"><ChevronUp /></button>
        <button disabled={busy} onClick={() => void move(i, 1)} aria-label="نقل للأسفل"><ChevronDown /></button>
        <button disabled={busy} onClick={() => void run(async () => { await deleteJobCategory(item.id); await load(); })} aria-label="حذف"><Trash2 className="text-red-500" /></button>
      </div>
    </div>)}
  </div>;
}
