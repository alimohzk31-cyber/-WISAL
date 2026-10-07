import type { FormEvent, RefObject } from 'react';
import { AlertTriangle, Image as ImageIcon, Lightbulb, Loader2, Plus, Send, Settings, X } from 'lucide-react';

export type RequestType = 'suggestion' | 'complaint' | 'bug' | 'other';
const requestTypes = [
  { value: 'suggestion', label: 'اقتراح', description: 'لتحسين التطبيق', Icon: Lightbulb, color: '#2563eb' },
  { value: 'complaint', label: 'شكوى', description: 'مشكلة أو عدم رضا', Icon: AlertTriangle, color: '#e11d48' },
  { value: 'bug', label: 'مشكلة تقنية', description: 'خلل في التطبيق', Icon: Settings, color: '#9333ea' },
  { value: 'other', label: 'طلب إضافي', description: 'إضافة خدمة أو ميزة', Icon: Plus, color: '#059669' },
] as const;

interface Props {
  requestType: RequestType;
  onTypeChange: (type: RequestType) => void;
  title: string;
  onTitleChange: (value: string) => void;
  text: string;
  onTextChange: (value: string) => void;
  maxLength: number;
  minLength: number;
  preview: string;
  fileInputRef: RefObject<HTMLInputElement | null>;
  onPickImage: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onClearImage: () => void;
  busy: boolean;
  canSend: boolean;
  error: string;
  success: string;
  onSubmit: (event: FormEvent) => void;
}

export default function SuggestionsRequestForm(props: Props) {
  const fieldClass = 'mt-2 w-full rounded-xl border border-[var(--input-border)] bg-[var(--input-bg)] px-3 py-3 text-sm font-normal text-[var(--text-primary)] outline-none transition focus:border-[var(--accent-primary)] focus:ring-2 focus:ring-[var(--focus-ring)]';
  return <form onSubmit={props.onSubmit} className="min-h-0 flex-1 overflow-y-auto px-0.5 pb-1" dir="rtl">
    <input type="hidden" name="message_type" value={props.requestType} />
    <div className="space-y-4 rounded-2xl border border-[var(--theme-border)] bg-[var(--theme-surface)] p-3 sm:p-5">
      <fieldset disabled={props.busy}>
        <legend className="mb-2 text-sm font-bold">نوع الطلب <span className="text-red-500">*</span></legend>
        <div className="grid grid-cols-2 gap-2 sm:gap-3">
          {requestTypes.map(({ value, label, description, Icon, color }) => <button key={value} type="button" data-request-type={value} aria-pressed={props.requestType === value}
            onClick={() => props.onTypeChange(value)}
            className="flex min-h-20 items-center justify-between gap-2 rounded-2xl border px-3 py-2 text-right transition hover:brightness-105 focus-visible:outline-2 focus-visible:outline-offset-2"
            style={{ color, background: `color-mix(in srgb, ${color} 9%, var(--theme-surface))`, borderColor: props.requestType === value ? color : `color-mix(in srgb, ${color} 22%, var(--theme-border))`, boxShadow: props.requestType === value ? `0 0 0 1px ${color}` : undefined }}>
            <span className="min-w-0"><span className="block text-sm font-black sm:text-base">{label}</span><span className="mt-1 block text-[10px] text-[var(--theme-muted)] sm:text-xs">{description}</span></span>
            <Icon className="h-6 w-6 shrink-0 sm:h-7 sm:w-7" aria-hidden="true" />
          </button>)}
        </div>
      </fieldset>
      <p className="text-[11px] leading-5 text-[var(--theme-muted)]">{props.requestType === 'suggestion' ? 'يُنشر الاقتراح في ساحة الاقتراحات الحالية.' : 'تصل الرسالة إلى الإدارة بشكل خاص ولا تظهر للمستخدمين.'}</p>
      <label htmlFor="request-title" className="block text-sm font-bold">عنوان الرسالة <span className="text-red-500">*</span>
        <input id="request-title" value={props.title} onChange={event => props.onTitleChange(event.target.value)} required maxLength={100} disabled={props.busy} placeholder="اكتب عنواناً مختصراً..." className={fieldClass} />
      </label>
      <label htmlFor="request-details" className="block text-sm font-bold">تفاصيل الرسالة <span className="text-red-500">*</span>
        <textarea id="request-details" value={props.text} onChange={event => props.onTextChange(event.target.value)} required minLength={props.minLength} maxLength={props.maxLength} disabled={props.busy}
          rows={4} placeholder="اكتب تفاصيل اقتراحك أو شكواك هنا..." className={`${fieldClass} min-h-28 resize-y leading-7`} />
      </label>
      <div className="text-left text-[10px] text-[var(--theme-muted)]" dir="ltr">{props.text.length}/{props.maxLength}</div>
      <input ref={props.fileInputRef} type="file" accept="image/*" onChange={props.onPickImage} disabled={props.busy} className="hidden" />
      {props.preview ? <div className="relative rounded-xl border border-[var(--theme-border)] p-2">
        <img src={props.preview} alt="معاينة الصورة المرفقة" className="max-h-32 w-full rounded-lg object-contain" />
        <button type="button" onClick={props.onClearImage} disabled={props.busy} aria-label="إزالة الصورة" className="absolute left-2 top-2 rounded-full bg-red-600 p-1.5 text-white"><X className="h-4 w-4" /></button>
      </div> : <button type="button" onClick={() => props.fileInputRef.current?.click()} disabled={props.busy}
        className="flex w-full items-center gap-3 rounded-xl border border-dashed border-[var(--accent-primary)] bg-[var(--theme-primary-soft)] p-3 text-right">
        <span className="rounded-lg bg-[var(--theme-surface)] p-2 text-[var(--accent-primary)]"><ImageIcon className="h-6 w-6" /></span>
        <span className="min-w-0 flex-1"><span className="block text-sm font-bold">إضافة صورة <span className="font-normal">(اختياري)</span></span><span className="mt-1 block text-[11px] text-[var(--theme-muted)]">يمكن إضافة صورة واحدة فقط</span></span>
        <Plus className="h-7 w-7 shrink-0 rounded-full bg-[var(--accent-primary)] p-1 text-white" />
      </button>}
      {props.error && <p role="alert" className="text-sm text-red-500">{props.error}</p>}
      {props.success && <p role="status" className="text-sm text-emerald-600">{props.success}</p>}
      <button type="submit" disabled={!props.canSend || props.busy} className="app-btn-accent flex min-h-12 w-full items-center justify-center gap-3 rounded-2xl px-4 py-3 text-base font-black shadow-sm disabled:cursor-not-allowed disabled:opacity-50">
        {props.busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />} إرسال الرسالة
      </button>
    </div>
  </form>;
}
