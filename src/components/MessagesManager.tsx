import { useState, useEffect, useCallback } from 'react';
import { Lightbulb, RefreshCw, Inbox, Calendar, Trash2, Users } from 'lucide-react';
import {
  Comment, fetchComments, deleteComment,
} from '../hooks/useComments';
import {
  ContactMessage, fetchContactMessages, deleteContactMessage,
} from '../hooks/useContactMessages';
import { createComplaintImageUrl } from '../lib/complaintMediaStorage';
import { getOwnerId } from '../hooks/useServices';

// ---------------------------------------------------------------------------
// MessagesManager — تبويب "اقتراحات المستخدمين" في لوحة الإدارة.
// المصدر: جدول public.comments العام (نفس ساحة الاقتراحات في واجهة المستخدم)
// عبر useComments مباشرة — بدون أي RPC إدارية (كانت admin_list_contact_messages
// و admin_set_contact_message_status و admin_delete_contact_message غير موجودة
// في قاعدة البيانات أصلًا، وهي خاصية بنظام المراسلات الخاصة القديم).
// الحذف يتم مباشرة على الجدول: سياسة comments_delete_policy تسمح به،
// وجلسة الإدارة (admin-login) حقيقية ومتحقق منها من قاعدة البيانات.
// ---------------------------------------------------------------------------

function formatDate(value?: string | null): string {
  if (!value) return '-';
  const d = new Date(value);
  if (isNaN(d.getTime())) return value;
  return d.toLocaleString('ar', {
    year: 'numeric', month: 'long', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function authorName(ownerId?: string | null): string {
  if (!ownerId) return 'مستخدم مجهول';
  if (ownerId === getOwnerId()) return 'أنت';
  const tail = ownerId.replace(/[^a-z0-9]/gi, '').slice(-4).toUpperCase();
  return `مستخدم ${tail || 'مجهول'}`;
}

function authorHue(ownerId?: string | null): number {
  const tail = (ownerId || '').replace(/[^a-z0-9]/gi, '');
  let sum = 0;
  for (let i = 0; i < tail.length; i++) sum += tail.charCodeAt(i);
  return sum % 360;
}

function complaintSender(ownerId?: string | null): string {
  if (!ownerId) return 'زائر';
  const tail = ownerId.replace(/[^a-z0-9]/gi, '').slice(-4).toUpperCase();
  return `زائر ${tail || 'مجهول'}`;
}

export default function MessagesManager() {
  const [messages, setMessages] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [updatingId, setUpdatingId] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<'suggestions' | 'complaints'>('suggestions');
  const [complaints, setComplaints] = useState<ContactMessage[]>([]);
  const [complaintsLoading, setComplaintsLoading] = useState(false);
  const [complaintsError, setComplaintsError] = useState('');
  const [deletingComplaintId, setDeletingComplaintId] = useState<number | null>(null);
  const [complaintImageUrls, setComplaintImageUrls] = useState<Record<number, string>>({});

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const rows = await fetchComments();
      setMessages(rows);
    } catch (e: any) {
      console.error('[MessagesManager] load error:', e?.message, e?.code);
      const code = e?.code;
      const isTableMissing = code === '42P01' || code === 'PGRST205';
      setError(
        isTableMissing
          ? 'جدول الاقتراحات العامة (comments) غير موجود بعد في قاعدة البيانات.'
          : 'تعذر تحميل الاقتراحات. تحقق من الاتصال وحاول مجددًا.'
      );
      setMessages([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const loadComplaints = useCallback(async () => {
    setComplaintsLoading(true);
    setComplaintsError('');
    try {
      const rows = await fetchContactMessages();
      setComplaints(rows);
      const imageEntries = await Promise.all(rows.map(async row => {
        if (!row.image_url) return null;
        try {
          const url = await createComplaintImageUrl(row.image_url);
          return url ? [row.id, url] as const : null;
        } catch (e: any) {
          console.warn('[MessagesManager] complaint image unavailable:', e?.message);
          return null;
        }
      }));
      setComplaintImageUrls(Object.fromEntries(imageEntries.filter((entry): entry is readonly [number, string] => !!entry)));
    } catch (e: any) {
      console.error('[MessagesManager] complaints load error:', e?.message, e?.code);
      const detail = [e?.message, e?.code && `code: ${e.code}`, e?.details, e?.hint]
        .filter(Boolean)
        .join(' — ');
      setComplaintsError(detail
        ? `تعذر تحميل الشكاوى: ${detail}`
        : 'تعذر تحميل الشكاوى. تحقق من صلاحيات الإدارة والاتصال.');
      setComplaints([]);
    } finally {
      setComplaintsLoading(false);
    }
  }, []);

  const remove = async (msg: Comment) => {
    if (!msg.id || updatingId !== null) return;
    if (!confirm('هل تريد حذف هذا الاقتراح نهائيًا؟ سيختفي من الساحة العامة.')) return;
    setUpdatingId(msg.id);
    try {
      await deleteComment(msg.id);
      setMessages(prev => prev.filter(item => item.id !== msg.id));
    } catch (e: any) {
      console.error('[MessagesManager] delete error:', e?.message, e?.code);
      alert(`تعذر حذف الاقتراح: ${e?.message || 'خطأ غير معروف'}`);
    } finally {
      setUpdatingId(null);
    }
  };

  const removeComplaint = async (message: ContactMessage) => {
    if (!message.id || deletingComplaintId !== null) return;
    if (!confirm('هل تريد حذف هذه الشكوى نهائياً بعد التعامل معها؟')) return;
    setDeletingComplaintId(message.id);
    try {
      await deleteContactMessage(message.id);
      setComplaints(prev => prev.filter(item => item.id !== message.id));
      setComplaintImageUrls(prev => {
        const next = { ...prev };
        delete next[message.id];
        return next;
      });
    } catch (e: any) {
      console.error('[MessagesManager] complaint delete error:', e?.message, e?.code);
      alert(`تعذر حذف الشكوى: ${e?.message || 'خطأ غير معروف'}`);
    } finally {
      setDeletingComplaintId(null);
    }
  };

  const card = `border rounded-2xl p-4 transition-colors bg-[var(--card)] border-[var(--border)] shadow-sm`;

  return (
    <div className="h-full overflow-y-auto p-6 lg:p-8 space-y-6">
      <div className={`flex items-center justify-between border-b pb-4 border-[var(--border)]`}>
        <div className="flex items-center gap-3">
          <Lightbulb className="w-6 h-6 text-amber-400" style={{ filter: `drop-shadow(0 0 5px rgba(251,191,36,0.4))` }} />
          <div>
            <h2 className="text-xl font-black text-[var(--text-primary)]">الاقتراحات والشكاوى</h2>
            <p className="flex items-center gap-1 text-xs font-bold text-[var(--text-muted)]">
              <Users className="w-3 h-3" />
              الاقتراحات العامة في ساحة المستخدمين — الحذف يزيلها من الواجهة للجميع
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm font-bold text-[var(--text-muted)]">
            {activeTab === 'suggestions'
              ? (loading ? '...' : `${messages.length} اقتراح`)
              : (complaintsLoading ? '...' : `${complaints.length} شكوى`)}
          </span>
          <button
            type="button"
            onClick={() => { if (activeTab === 'suggestions') void load(); else void loadComplaints(); }}
            disabled={activeTab === 'suggestions' ? loading : complaintsLoading}
            title="تحديث"
            className="p-2 rounded-xl transition-colors text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-secondary)] disabled:opacity-50"
          >
            <RefreshCw className={`w-5 h-5 ${(activeTab === 'suggestions' ? loading : complaintsLoading) ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      <div className="flex gap-2 rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)] p-2">
        <button
          type="button"
          onClick={() => setActiveTab('suggestions')}
          className={`flex-1 rounded-xl px-3 py-2 text-sm font-black transition-colors ${activeTab === 'suggestions' ? 'bg-[var(--accent-primary)] text-white' : 'text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)]'}`}
        >
          الاقتراحات
        </button>
        <button
          type="button"
          onClick={() => { setActiveTab('complaints'); if (complaints.length === 0 && !complaintsLoading) void loadComplaints(); }}
          className={`flex-1 rounded-xl px-3 py-2 text-sm font-black transition-colors ${activeTab === 'complaints' ? 'bg-[var(--accent-primary)] text-white' : 'text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)]'}`}
        >
          الشكاوى
        </button>
      </div>

      {activeTab === 'suggestions' ? (
      <>

      {error && (
        <div className="text-center py-12 rounded-2xl border bg-red-500/5 border-red-500/20">
          <p className="text-sm font-bold text-red-500 mb-3">{error}</p>
          <button
            type="button"
            onClick={load}
            className="px-4 py-2 rounded-xl text-sm font-bold bg-[var(--accent-primary)] text-white hover:bg-[var(--accent-hover)] transition-colors"
          >
            إعادة المحاولة
          </button>
        </div>
      )}

      {!error && loading && (
        <div className="text-center py-16 text-[var(--text-muted)]">
          <RefreshCw className="w-12 h-12 mx-auto mb-4 opacity-30 animate-spin" />
          <p className="text-lg font-bold">جارٍ تحميل الاقتراحات...</p>
        </div>
      )}

      {!error && !loading && messages.length === 0 && (
        <div className={`text-center py-16 rounded-2xl border text-[var(--text-muted)] bg-[var(--card)] border-[var(--border)]`}>
          <Inbox className="w-12 h-12 mx-auto mb-4 opacity-20" />
          <p className="text-lg font-bold">لا توجد اقتراحات بعد</p>
        </div>
      )}

      {!error && !loading && messages.length > 0 && (
        <div className="grid grid-cols-1 gap-4">
          {messages.map(msg => {
            const name = authorName(msg.owner_id);
            const hue = authorHue(msg.owner_id);
            const hasImage = !!msg.image_url;
            return (
              <div key={String(msg.id)} className={card}>
                <div className="flex flex-col sm:flex-row gap-4">
                  {hasImage && (
                    <div className="shrink-0">
                      <a href={msg.image_url!} target="_blank" rel="noopener noreferrer">
                        <img src={msg.image_url!} alt="مرفق الاقتراح" loading="lazy" decoding="async" className="w-full sm:w-36 h-28 object-cover rounded-xl border border-[var(--border)]" />
                      </a>
                    </div>
                  )}
                  <div className="flex-1 min-w-0 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-black text-white shrink-0"
                        style={{ background: `linear-gradient(135deg, hsl(${hue} 55% 42%), hsl(${hue} 65% 30%))` }}
                        aria-hidden="true"
                      >
                        {name === 'أنت' ? 'أ' : name.replace('مستخدم ', '').charAt(0)}
                      </span>
                      <span className="text-sm font-black text-[var(--text-primary)]">{name}</span>
                      <div className={`flex items-center gap-1 text-xs text-[var(--text-muted)]`}>
                        <Calendar className="w-3 h-3" />
                        <span>{formatDate(msg.created_at)}</span>
                      </div>
                    </div>
                    <p className={`text-sm whitespace-pre-wrap break-words text-[var(--text-primary)]`}>
                      {msg.content}
                    </p>
                  </div>
                  <div className="flex sm:flex-col gap-2 shrink-0 justify-center">
                    <button
                      type="button"
                      onClick={() => remove(msg)}
                      disabled={updatingId !== null}
                      className="flex items-center justify-center gap-1 rounded-xl bg-red-500/10 px-3 py-2 text-sm font-bold text-red-500 hover:bg-red-500/20 disabled:opacity-50"
                    >
                      <Trash2 className="h-4 w-4" /> حذف
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
      </>
      ) : (
        <>
          {complaintsError && (
            <div className="text-center py-12 rounded-2xl border bg-red-500/5 border-red-500/20">
              <p className="text-sm font-bold text-red-500 mb-3">{complaintsError}</p>
              <button
                type="button"
                onClick={() => void loadComplaints()}
                className="px-4 py-2 rounded-xl text-sm font-bold bg-[var(--accent-primary)] text-white hover:bg-[var(--accent-hover)] transition-colors"
              >
                إعادة المحاولة
              </button>
            </div>
          )}

          {!complaintsError && complaintsLoading && (
            <div className="text-center py-16 text-[var(--text-muted)]">
              <RefreshCw className="w-12 h-12 mx-auto mb-4 opacity-30 animate-spin" />
              <p className="text-lg font-bold">جارٍ تحميل الشكاوى...</p>
            </div>
          )}

          {!complaintsError && !complaintsLoading && complaints.length === 0 && (
            <div className="text-center py-16 rounded-2xl border text-[var(--text-muted)] bg-[var(--card)] border-[var(--border)]">
              <Inbox className="w-12 h-12 mx-auto mb-4 opacity-20" />
              <p className="text-lg font-bold">لا توجد شكاوى بعد</p>
            </div>
          )}

          {!complaintsError && !complaintsLoading && complaints.length > 0 && (
            <div className="grid grid-cols-1 gap-4">
              {complaints.map(complaint => (
                <div key={String(complaint.id)} className={card}>
                  <div className="flex flex-col gap-3">
                    <div className="flex flex-wrap items-center gap-2 text-xs font-bold text-[var(--text-muted)]">
                      <span>{complaintSender(complaint.owner_id ?? complaint.owner_uid)}</span>
                      <span>•</span>
                      <Calendar className="h-3 w-3" />
                      <span>{formatDate(complaint.created_at)}</span>
                    </div>
                    {complaintImageUrls[complaint.id] && (
                      <a href={complaintImageUrls[complaint.id]} target="_blank" rel="noopener noreferrer" className="block w-fit">
                        <img src={complaintImageUrls[complaint.id]} alt="الصورة المرفقة بالشكوى" loading="lazy" decoding="async" className="max-h-56 max-w-full rounded-xl border border-[var(--border)] object-contain" />
                      </a>
                    )}
                    <p className="whitespace-pre-wrap break-words text-sm leading-7 text-[var(--text-primary)]">{complaint.message}</p>
                    <div className="flex justify-end">
                      <button
                        type="button"
                        onClick={() => void removeComplaint(complaint)}
                        disabled={deletingComplaintId !== null}
                        className="flex items-center justify-center gap-1 rounded-xl bg-red-500/10 px-3 py-2 text-sm font-bold text-red-500 hover:bg-red-500/20 disabled:opacity-50"
                      >
                        <Trash2 className="h-4 w-4" /> حذف
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
