import { useRef, useState } from 'react';
import { FileText, Paperclip, X } from 'lucide-react';
import type { SectionRegistrationConfig, ServiceRegistrationAttachment } from '../types/models';

interface Props {
  config: SectionRegistrationConfig;
  values: Record<string, string>;
  onChange: (values: Record<string, string>) => void;
  attachment?: ServiceRegistrationAttachment;
  onAttachment: (attachment?: ServiceRegistrationAttachment) => void;
  onBusy: (busy: boolean) => void;
}

const inputClass = 'w-full rounded-xl border border-[var(--input-border)] bg-[var(--input-bg)] px-4 py-3 text-sm text-[var(--text-primary)] outline-none transition focus:border-[var(--accent-primary)] focus:ring-2 focus:ring-[var(--focus-ring)]';

export default function ServiceRegistrationFields({ config, values, onChange, attachment, onAttachment, onBusy }: Props) {
  const [error, setError] = useState('');
  const fileInput = useRef<HTMLInputElement>(null);
  const readAttachment = async (file?: File) => {
    setError('');
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp', 'application/pdf'].includes(file.type)) {
      setError('اختر صورة JPG أو PNG أو WebP، أو مستند PDF.'); return;
    }
    if (file.size > 5 * 1024 * 1024) { setError('حجم المرفق يجب ألا يتجاوز 5 ميغابايت.'); return; }
    onBusy(true);
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error('read failed'));
        reader.readAsDataURL(file);
      });
      onAttachment({ name: file.name, type: file.type, dataUrl });
    } catch { setError('تعذر قراءة المرفق. أعد المحاولة.'); }
    finally { onBusy(false); }
  };

  return <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
    {config.fields.map(field => <div key={field.key} className={['governorate', 'area'].includes(field.key) ? 'space-y-2' : 'space-y-2 sm:col-span-2'}>
      <label htmlFor={`registration-${field.key}`} className="block text-sm font-bold text-[var(--text-primary)]">
        {field.label} {field.required && <span aria-hidden="true" className="text-[var(--accent-primary)]">*</span>}
      </label>
      {field.type === 'textarea' ? <textarea
        id={`registration-${field.key}`} required={field.required} value={values[field.key] ?? ''}
        onChange={event => onChange({ ...values, [field.key]: event.target.value })}
        placeholder={field.placeholder} className={`${inputClass} min-h-28 resize-y`} rows={4}
      /> : <input
        id={`registration-${field.key}`} type={field.type} required={field.required}
        min={field.min} step={field.type === 'number' ? 1 : undefined}
        inputMode={field.type === 'number' ? 'numeric' : undefined}
        value={values[field.key] ?? ''} onChange={event => onChange({ ...values, [field.key]: event.target.value })}
        placeholder={field.placeholder} className={inputClass}
      />}
      {field.attachment && <div className="rounded-xl border border-dashed border-[var(--border)] p-3">
        {attachment ? <div className="flex min-w-0 items-center gap-3">
          {attachment.type.startsWith('image/') ? <img src={attachment.dataUrl} alt="معاينة مستند الممارسة" className="h-14 w-14 shrink-0 rounded-lg object-cover" /> : <FileText className="h-8 w-8 shrink-0 text-[var(--accent-primary)]" />}
          <span className="min-w-0 flex-1 break-words text-xs text-[var(--text-primary)]">{attachment.name}</span>
          <button type="button" aria-label="إزالة مستند الممارسة" onClick={() => { onAttachment(undefined); if (fileInput.current) fileInput.current.value = ''; }} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-red-600 hover:bg-red-50"><X className="h-5 w-5" /></button>
        </div> : <button type="button" onClick={() => fileInput.current?.click()} className="flex min-h-11 w-full items-center justify-center gap-2 rounded-lg text-sm font-bold text-[var(--accent-primary)]"><Paperclip className="h-4 w-4" />إرفاق صورة أو مستند (اختياري)</button>}
        <p className="mt-2 text-xs leading-5 text-[var(--text-muted)]">صورة أو PDF، حتى 5 ميغابايت. المرفق منفصل عن صور الصيدلية.</p>
        <input ref={fileInput} type="file" aria-label="مستند ممارسة المهنة" accept="image/jpeg,image/png,image/webp,application/pdf" className="hidden" onChange={event => { void readAttachment(event.target.files?.[0]); event.target.value = ''; }} />
        {error && <p role="alert" className="mt-2 text-sm text-red-600">{error}</p>}
      </div>}
    </div>)}
  </div>;
}
