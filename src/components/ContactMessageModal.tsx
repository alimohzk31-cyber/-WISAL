import { useRef, useState } from 'react';
import { Image as ImageIcon, Lightbulb, Loader2, Send, Trash2, X } from 'lucide-react';
import { sendContactMessage, uploadContactMessageImage } from '../hooks/useContactMessages';

export default function ContactMessageModal({ onClose }: { onClose: () => void }) {
  const [message, setMessage] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState('');
  const [sending, setSending] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const chooseImage = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      alert('حجم الصورة يجب ألا يتجاوز 2 ميجابايت.');
      event.target.value = '';
      return;
    }
    setImageFile(file);
    const reader = new FileReader();
    reader.onload = () => setImagePreview(String(reader.result || ''));
    reader.readAsDataURL(file);
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (sending) return;
    const trimmed = message.trim();
    if (!trimmed) return;
    if (trimmed.length > 1000) {
      alert('نص الاقتراح يجب ألا يتجاوز 1000 حرف.');
      return;
    }
    setSending(true);
    try {
      const imageUrl = imageFile ? await uploadContactMessageImage(imageFile) : null;
      await sendContactMessage({ message_type: 'suggestion', message: trimmed, image_url: imageUrl });
      alert('تم إرسال اقتراحك. شكرًا لك!');
      onClose();
    } catch (error: any) {
      alert(`تعذر إرسال الاقتراح: ${error?.message || 'خطأ غير معروف'}`);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden bg-black/60 p-2 backdrop-blur-sm sm:p-4" onMouseDown={e => e.target === e.currentTarget && onClose()}>
      <div role="dialog" aria-modal="true" aria-labelledby="contact-title" className="flex max-h-[calc(100dvh-1rem)] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)] shadow-2xl sm:max-h-[calc(100dvh-2rem)]">
        <header className="flex shrink-0 items-center justify-between border-b border-[var(--border)] p-4">
          <h2 id="contact-title" className="flex items-center gap-2 text-lg font-bold text-[var(--text-primary)]"><Lightbulb className="h-5 w-5 text-[var(--accent-primary)]" /> إرسال اقتراح</h2>
          <button type="button" onClick={onClose} aria-label="إغلاق" className="flex h-11 w-11 items-center justify-center rounded-xl hover:bg-red-500/10 hover:text-red-500"><X className="h-6 w-6" /></button>
        </header>
        <form onSubmit={submit} className="min-h-0 space-y-4 overflow-y-auto overflow-x-hidden p-4 sm:p-5">
          <textarea required value={message} onChange={e => setMessage(e.target.value)} rows={6} maxLength={1000} placeholder="اكتب اقتراحك أو ملاحظتك هنا..." className="w-full resize-y rounded-xl border border-[var(--input-border)] bg-[var(--input-bg)] px-4 py-3 text-[var(--text-primary)] focus:border-[var(--accent-primary)] focus:outline-none" />
          {imagePreview ? (
            <div className="relative overflow-hidden rounded-xl border border-[var(--border)]"><img src={imagePreview} alt="معاينة المرفق" className="max-h-56 w-full object-contain" /><button type="button" onClick={() => { setImageFile(null); setImagePreview(''); if (fileRef.current) fileRef.current.value = ''; }} className="absolute left-2 top-2 flex h-10 w-10 items-center justify-center rounded-full bg-red-600 text-white" aria-label="حذف الصورة"><Trash2 className="h-5 w-5" /></button></div>
          ) : (
            <button type="button" onClick={() => fileRef.current?.click()} className="flex min-h-20 w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-[var(--border)] font-bold text-[var(--text-secondary)]"><ImageIcon className="h-5 w-5" /> إرفاق صورة</button>
          )}
          <input ref={fileRef} type="file" accept="image/*" onChange={chooseImage} className="hidden" />
          <button type="submit" disabled={sending || !message.trim()} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[var(--accent-primary)] font-bold text-white disabled:opacity-50">{sending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />} إرسال</button>
        </form>
      </div>
    </div>
  );
}
