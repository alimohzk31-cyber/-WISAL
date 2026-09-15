import { useEffect, useRef, useState } from 'react';
import { BriefcaseBusiness, FileText, Send, Upload, X } from 'lucide-react';
import SafeImage from '../../components/SafeImage';
import { useToast } from '../../components/ToastProvider';
import { CV_MIME_TYPES, MAX_CV_BYTES, submitJobApplication } from './jobApplications';
import { employmentTypeLabel } from './jobData';
import type { Job, JobApplicationDraft } from './types';

const inputClass = 'w-full rounded-[15px] border border-[#d9e8f7] bg-white px-4 py-3.5 text-sm font-bold text-[#17324f] outline-none transition placeholder:text-[#91a2b7] focus:border-[var(--accent-primary)] focus:ring-4 focus:ring-[var(--accent-primary)]/10';

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return <label className="space-y-1.5"><span className="block text-sm font-bold text-[#405b7a]">{label}{required ? <span className="text-red-500"> *</span> : null}</span>{children}</label>;
}

export default function JobApplicationModal({ job, onClose }: { job: Job; onClose: () => void }) {
  const toast = useToast();
  const fileInput = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState<JobApplicationDraft>({ fullName: '', phone: '', email: '', governorate: '', area: '', experience: '', message: '' });
  const [cv, setCv] = useState<File>();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = overflow; };
  }, []);
  const patch = (key: keyof JobApplicationDraft, value: string) => setForm(current => ({ ...current, [key]: value }));
  const chooseCv = (file?: File) => {
    setError('');
    if (!file) return;
    if (!CV_MIME_TYPES.includes(file.type)) { setError('صيغة السيرة الذاتية يجب أن تكون PDF أو JPG أو PNG أو WebP.'); return; }
    if (file.size > MAX_CV_BYTES) { setError('حجم السيرة الذاتية يجب ألا يتجاوز 5 ميغابايت.'); return; }
    setCv(file);
  };
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (saving || !cv) { if (!cv) setError('يرجى إرفاق السيرة الذاتية.'); return; }
    setSaving(true); setError('');
    try {
      await submitJobApplication(job.id, form, cv);
      toast('success', '✓ تم إرسال طلبك بنجاح');
      onClose();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'تعذر إرسال الطلب. حاول مجددًا.');
    } finally { setSaving(false); }
  };
  return <div className="fixed inset-0 z-[130] flex items-end justify-center bg-[#071a33]/70 sm:items-center sm:p-4" role="presentation">
    <section role="dialog" aria-modal="true" aria-labelledby="application-title" dir="rtl" className="flex h-[100dvh] w-full max-w-2xl flex-col overflow-hidden bg-[#f3f8ff] text-[#12233f] sm:max-h-[94dvh] sm:rounded-[28px] sm:border-[5px] sm:border-white sm:shadow-2xl">
      <header className="flex items-center justify-between border-b border-[#deebf8] bg-white px-4 py-3.5 sm:px-6"><div><h2 id="application-title" className="text-xl font-black text-[#10243e]">التقديم على الوظيفة</h2><p className="text-xs font-bold text-[#7b8ea6]">أكمل بياناتك وأرفق سيرتك الذاتية</p></div><button type="button" disabled={saving} onClick={onClose} aria-label="إغلاق" className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#edf6ff] text-[#173b67]"><X /></button></header>
      <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
        <div className="flex-1 space-y-5 overflow-y-auto p-4 sm:p-6">
          <article className="flex items-center gap-3 rounded-[20px] border border-[#cfe4fb] bg-white p-3.5 shadow-[0_8px_24px_rgba(31,83,142,0.08)]"><div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-[15px] bg-[#e8f3ff]">{job.image ? <SafeImage src={job.image} alt={job.company} className="h-full w-full object-cover" /> : <BriefcaseBusiness className="text-[var(--accent-primary)]" />}</div><div className="min-w-0"><p className="truncate text-xs font-bold text-[#7287a0]">{job.company}</p><h3 className="truncate text-lg font-black text-[#10243e]">{job.title}</h3><span className="inline-flex rounded-lg bg-[#d5f6ee] px-2 py-1 text-[11px] font-black text-[#07876c]">{employmentTypeLabel(job.employmentType)}</span></div></article>
          <div className="grid gap-4 sm:grid-cols-2"><Field label="الاسم الكامل" required><input required autoComplete="name" value={form.fullName} onChange={event => patch('fullName', event.target.value)} className={inputClass} /></Field><Field label="رقم الهاتف" required><input required type="tel" minLength={7} dir="ltr" autoComplete="tel" value={form.phone} onChange={event => patch('phone', event.target.value)} className={`${inputClass} text-left`} /></Field><Field label="البريد الإلكتروني (اختياري)"><input type="email" dir="ltr" autoComplete="email" value={form.email} onChange={event => patch('email', event.target.value)} className={`${inputClass} text-left`} /></Field><Field label="المحافظة" required><input required value={form.governorate} onChange={event => patch('governorate', event.target.value)} className={inputClass} /></Field><Field label="المنطقة" required><input required value={form.area} onChange={event => patch('area', event.target.value)} className={inputClass} /></Field><Field label="الخبرة أو الاختصاص (اختياري)"><input value={form.experience} onChange={event => patch('experience', event.target.value)} className={inputClass} /></Field></div>
          <section className="space-y-2"><h3 className="font-black text-[#10243e]">السيرة الذاتية <span className="text-red-500">*</span></h3><button type="button" onClick={() => fileInput.current?.click()} disabled={saving} className="flex min-h-28 w-full flex-col items-center justify-center gap-2 rounded-[20px] border-2 border-dashed border-[#79b8ff] bg-white p-4 font-black text-[var(--accent-primary)] shadow-[0_7px_20px_rgba(31,83,142,0.06)]">{cv ? <FileText className="h-7 w-7" /> : <Upload className="h-7 w-7" />}<span className="min-w-0 max-w-full truncate">{cv ? cv.name : 'رفع CV بصيغة PDF أو صورة'}</span></button><input ref={fileInput} type="file" accept="application/pdf,image/jpeg,image/png,image/webp" className="hidden" onChange={event => { chooseCv(event.target.files?.[0]); event.target.value = ''; }} /><p className="text-xs font-bold text-[#7b8ea6]">الحد الأقصى 5 ميغابايت. الملف خاص ولا يظهر للعامة.</p></section>
          <Field label="رسالة إضافية — اختيارية"><textarea value={form.message} onChange={event => patch('message', event.target.value)} className={`${inputClass} min-h-28 resize-y leading-7`} placeholder="اكتب نبذة قصيرة عن نفسك" /></Field>
        </div>
        <footer className="border-t border-[#deebf8] bg-white p-4 sm:px-6">{error ? <p role="alert" className="mb-3 rounded-xl bg-red-500/10 px-3 py-2 text-sm font-bold text-red-600">{error}</p> : null}<button type="submit" disabled={saving} className="flex w-full items-center justify-center gap-2 rounded-[16px] bg-[var(--accent-primary)] px-4 py-4 font-black text-white shadow-[0_8px_22px_rgba(8,124,255,0.28)] disabled:opacity-60">{saving ? 'جارٍ إرسال الطلب…' : <><Send className="h-5 w-5" />إرسال الطلب</>}</button></footer>
      </form>
    </section>
  </div>;
}
