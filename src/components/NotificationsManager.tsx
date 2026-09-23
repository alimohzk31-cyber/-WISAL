import { useCallback, useEffect, useRef, useState } from 'react';
import { Send, Trash2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { AdminNotification, fetchNotifications, notifyNotificationsChanged } from '../lib/notifications';

// Reuse the admin session established by the admin dashboard's PIN gate.
// NotificationsManager is only rendered inside AdminDashboard (reachable at /admin
// after passing the PIN gate in Layout.tsx), so no independent auth gate is needed.
export default function NotificationsManager() {
  return <NotificationEditor onSignOut={() => {}} />;
}

function NotificationEditor({ onSignOut }: { onSignOut: () => void }) {
  const [items, setItems] = useState<AdminNotification[]>([]);
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const load = useCallback(async () => {
    setLoading(true);
    try { setItems(await fetchNotifications(true)); setError(''); }
    catch (loadError) { console.error('[NotificationsManager] Notifications could not be loaded:', loadError); setError('تعذر تحميل الإشعارات. تحقق من الاتصال وإعداد نظام الإشعارات.'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const run = async (action: () => Promise<void>, success: string) => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true); setError(''); setStatus('');
    try {
      await action();
      setStatus(success);
      notifyNotificationsChanged();
      await load();
    } catch (actionError) { console.error('[NotificationsManager] Notification action failed:', actionError); setError('تعذر تنفيذ العملية. تحقق من الاتصال وصلاحيات حساب الإدارة.'); }
    finally { busyRef.current = false; setBusy(false); }
  };
  const create = (publish: boolean) => {
    if (!title.trim() || !message.trim()) { setError('أدخل عنوان الإشعار ونصه.'); return; }
    void run(async () => {
      const { error } = await supabase.from('admin_notifications').insert({
        title: title.trim(), message: message.trim(), published_at: publish ? new Date().toISOString() : null,
      }).select('id').single();
      if (error) throw error;
      setTitle(''); setMessage('');
    }, publish ? 'تم إرسال الإشعار لجميع المستخدمين.' : 'تم حفظ المسودة.');
  };
  const publish = (id: string) => void run(async () => {
    const { error } = await supabase.from('admin_notifications').update({ published_at: new Date().toISOString() })
      .eq('id', id).is('published_at', null).select('id').single();
    if (error) throw error;
  }, 'تم إرسال الإشعار لجميع المستخدمين.');
  const remove = (id: string) => {
    if (!window.confirm('هل تريد حذف هذا الإشعار نهائيًا؟')) return;
    void run(async () => {
      const { error } = await supabase.from('admin_notifications').delete().eq('id', id).select('id').single();
      if (error) throw error;
    }, 'تم حذف الإشعار.');
  };
  const inputClass = 'w-full rounded-xl border border-[var(--input-border)] bg-[var(--input-bg)] p-3 text-[var(--text-primary)]';

  return <section className="p-4 pt-20 sm:px-6 space-y-5 min-w-0" dir="rtl">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h2 className="text-xl font-bold text-[var(--text-primary)]">إدارة الإشعارات</h2>
      <button type="button" onClick={onSignOut} disabled={busy} className="text-sm text-[var(--text-muted)]">تسجيل الخروج</button>
    </div>
    <form onSubmit={event => { event.preventDefault(); create(true); }} className="space-y-3">
      <label className="block text-sm text-[var(--text-secondary)]">عنوان الإشعار
        <input required maxLength={120} value={title} disabled={busy} onChange={event => setTitle(event.target.value)} className={inputClass} />
      </label>
      <label className="block text-sm text-[var(--text-secondary)]">نص الإشعار
        <textarea required maxLength={5000} rows={4} value={message} disabled={busy} onChange={event => setMessage(event.target.value)} className={inputClass} />
      </label>
      <div className="flex flex-wrap gap-3">
        <button type="submit" disabled={busy || loading} className="app-btn-accent rounded-xl px-4 py-2 font-bold disabled:opacity-50">إرسال للجميع</button>
        <button type="button" onClick={() => create(false)} disabled={busy || loading} className="rounded-xl px-4 py-2 border border-[var(--border)] text-[var(--text-primary)] disabled:opacity-50">حفظ مسودة</button>
      </div>
    </form>
    {error && <p role="alert" className="text-red-500">{error}</p>}
    {status && <p role="status" className="text-[var(--accent-primary)]">{status}</p>}
    <button type="button" onClick={() => void load()} disabled={busy || loading} className="text-sm font-bold text-[var(--accent-primary)]">تحديث الإشعارات</button>
    {loading ? <p className="text-[var(--text-muted)]">جاري التحميل...</p> : !error && items.length === 0 ? <p className="text-[var(--text-muted)]">لا توجد إشعارات بعد.</p> : items.map(item => (
      <article key={item.id} className="p-4 rounded-xl border border-[var(--border)] space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="font-bold break-words min-w-0 text-[var(--text-primary)]">{item.title}</h3>
          <span className="text-xs text-[var(--text-muted)]">{item.published_at ? 'تم الإرسال' : 'مسودة'}</span>
        </div>
        <p className="whitespace-pre-wrap break-words text-sm text-[var(--text-secondary)]">{item.message}</p>
        <div className="flex gap-4">
          {!item.published_at && <button type="button" onClick={() => publish(item.id)} disabled={busy} className="flex items-center gap-1 text-sm text-[var(--accent-primary)]"><Send className="w-4 h-4" />إرسال</button>}
          <button type="button" onClick={() => remove(item.id)} disabled={busy} className="flex items-center gap-1 text-sm text-red-500"><Trash2 className="w-4 h-4" />حذف</button>
        </div>
      </article>
    ))}
  </section>;
}
