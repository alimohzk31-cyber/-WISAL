import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  Lightbulb, Send, Image as ImageIcon, Loader2, X, RefreshCw,
  MessageSquareText, Users, AlertTriangle, ChevronDown, ChevronUp,
} from 'lucide-react';
import {
  Comment, fetchComments, addComment, uploadCommentImage,
} from '../hooks/useComments';
import { getOwnerId } from '../hooks/useServices';
import {
  sendContactMessage, uploadContactMessageImage, removeContactMessageImage,
} from '../hooks/useContactMessages';
import {
  useSuggestionInteractions, REACTIONS, ReactionType, SuggestionComment,
} from '../hooks/useSuggestionInteractions';
import { sanitizeExternalUrl } from '../lib/externalUrl';

const SUGGESTION_MIN_LENGTH = 3;
const SUGGESTION_MAX_LENGTH = 500;
const COMMENT_MAX_LENGTH = 300;
const COMPLAINT_MAX_LENGTH = 1000;
const IMAGE_SIZE_LIMIT = 2 * 1024 * 1024;

interface Props {
  onClose: () => void;
}

function formatRelativeTime(value?: string | null): string {
  if (!value) return '';
  const d = new Date(value);
  if (isNaN(d.getTime())) return '';
  const diff = Date.now() - d.getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'الآن';
  if (min < 60) return `قبل ${min} دقيقة`;
  const hours = Math.floor(min / 60);
  if (hours < 24) return `قبل ${hours} ساعة`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `قبل ${days} يوم`;
  return d.toLocaleDateString('ar', { day: 'numeric', month: 'long', year: 'numeric' });
}

function authorName(ownerId?: string | null): string {
  if (!ownerId) return 'مستخدم مجهول';
  if (ownerId === getOwnerId()) return 'أنت';
  const tail = ownerId.replace(/[^a-z0-9]/gi, '').slice(-4).toUpperCase();
  return `مستخدم ${tail || 'مجهول'}`;
}

const AVATAR_HUES = [199, 160, 262, 24, 340, 45, 210, 130, 285, 10];
function avatarHue(ownerId?: string | null): number {
  const tail = (ownerId || '').replace(/[^a-z0-9]/gi, '');
  let sum = 0;
  for (let i = 0; i < tail.length; i++) sum += tail.charCodeAt(i);
  return AVATAR_HUES[sum % AVATAR_HUES.length];
}

function complaintSubmitError(error: any): string {
  const raw = String(error?.message || '').toLowerCase();
  if (raw.includes('bucket not found') || raw.includes('not found')) {
    return 'تعذر رفع صورة الشكوى حالياً. تخزين صور الشكاوى غير مفعّل بعد.';
  }
  if (raw.includes('row-level security') || raw.includes('permission') || raw.includes('unauthorized')) {
    return 'تعذر رفع صورة الشكوى بسبب صلاحيات التخزين. حاول مرة أخرى لاحقاً.';
  }
  return 'تعذر إرسال الشكوى حالياً. حاول مرة أخرى.';
}

function Avatar({ ownerId, name, size = 'md' }: { ownerId?: string | null; name: string; size?: 'sm' | 'md' }) {
  const isMe = !!ownerId && ownerId === getOwnerId();
  const hue = avatarHue(ownerId);
  const letter = name === 'أنت' ? 'أ' : name.replace('مستخدم ', '').charAt(0);
  const dim = size === 'sm' ? 'w-8 h-8 text-xs' : 'w-10 h-10 text-sm';
  return (
    <div
      className={`relative ${dim} rounded-full flex items-center justify-center shrink-0 font-black text-white shadow-sm`}
      style={{ background: `linear-gradient(135deg, hsl(${hue} 55% 42%), hsl(${hue} 65% 30%))` }}
      aria-hidden="true"
    >
      {letter}
      {isMe && <span className="absolute -bottom-0.5 -left-0.5 w-3 h-3 rounded-full bg-emerald-500 ring-2 ring-[var(--surface-elevated)]" />}
    </div>
  );
}

export default function SuggestionsFeedModal({ onClose }: Props) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [text, setText] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const feedEndRef = useRef<HTMLDivElement>(null);
  const suggestionIds = useMemo(() => comments.map(c => c.id), [comments]);
  const {
    summaries, commentsBySuggestion, loadingIds,
    loadReactions, loadComments, toggleReaction, addComment: addCommentHook,
  } = useSuggestionInteractions(suggestionIds);
  const [expandedComments, setExpandedComments] = useState<Set<number>>(new Set());
  const [commentTexts, setCommentTexts] = useState<Record<number, string>>({});
  const [commentSending, setCommentSending] = useState<Set<number>>(new Set());
  const [commentErrors, setCommentErrors] = useState<Record<number, string>>({});
  const [activeTab, setActiveTab] = useState<'suggestions' | 'complaints'>('suggestions');
  const [complaintText, setComplaintText] = useState('');
  const [complaintImageFile, setComplaintImageFile] = useState<File | null>(null);
  const [complaintImagePreview, setComplaintImagePreview] = useState('');
  const [complaintSubmitting, setComplaintSubmitting] = useState(false);
  const [complaintError, setComplaintError] = useState('');
  const [complaintSuccess, setComplaintSuccess] = useState('');
  const complaintFileInputRef = useRef<HTMLInputElement>(null);


  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    setError('');
    try {
      const rows = await fetchComments();
      setComments(rows);
    } catch (e: any) {
      console.error('[SuggestionsFeed] load error:', e?.message, e?.code);
      setError('تعذر تحميل الاقتراحات. تحقق من الاتصال وحاول مجددًا.');
      setComments([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (comments.length > 0) loadReactions();
  }, [comments.length, loadReactions]);

  useEffect(() => {
    return () => {
      if (complaintImagePreview) URL.revokeObjectURL(complaintImagePreview);
    };
  }, [complaintImagePreview]);

  const canSend = text.trim().length >= SUGGESTION_MIN_LENGTH && !submitting;

  const pickComplaintImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > IMAGE_SIZE_LIMIT) {
      setComplaintError('حجم الصورة كبير جداً. الحد الأقصى 2 ميغابايت.');
      e.currentTarget.value = '';
      return;
    }
    if (!file.type.startsWith('image/')) {
      setComplaintError('الملف المحدد ليس صورة.');
      e.currentTarget.value = '';
      return;
    }
    setComplaintImageFile(file);
    setComplaintImagePreview(URL.createObjectURL(file));
    setComplaintError('');
    setComplaintSuccess('');
    e.currentTarget.value = '';
  };

  const clearComplaintImage = () => {
    setComplaintImageFile(null);
    setComplaintImagePreview('');
    if (complaintFileInputRef.current) complaintFileInputRef.current.value = '';
  };

  const pickImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > IMAGE_SIZE_LIMIT) {
      setSubmitError('حجم الصورة كبير جدًا. الحد الأقصى 2 ميغابايت.');
      return;
    }
    if (!file.type.startsWith('image/')) {
      setSubmitError('الملف المحدد ليس صورة.');
      return;
    }
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
    setSubmitError('');
  };

  const clearImage = () => {
    setImageFile(null);
    setImagePreview('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSend || submitting) return;
    setSubmitting(true);
    setSubmitError('');
    try {
      let imageUrl: string | null = null;
      if (imageFile) {
        imageUrl = await uploadCommentImage(imageFile);
        if (!imageUrl) throw new Error('فشل رفع الصورة.');
      }
      await addComment({ content: text.trim(), image_url: imageUrl });
      setText('');
      clearImage();
      await load(true);
      setTimeout(() => feedEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    } catch (e: any) {
      console.error('[SuggestionsFeed] submit error:', e?.message);
      setSubmitError(e?.message || 'تعذر نشر الاقتراح. حاول مرة أخرى.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleComplaintSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const message = complaintText.trim();
    if (!message || complaintSubmitting) return;
    setComplaintSubmitting(true);
    setComplaintError('');
    setComplaintSuccess('');
    let imagePath: string | null = null;
    try {
      if (complaintImageFile) {
        imagePath = await uploadContactMessageImage(complaintImageFile);
      }
      await sendContactMessage({ message_type: 'complaint', message, image_url: imagePath });
      setComplaintText('');
      clearComplaintImage();
      setComplaintSuccess('تم إرسال شكواك إلى الإدارة بنجاح');
    } catch (e: any) {
      console.error('[Complaints] submit error:', e?.message);
      if (imagePath) await removeContactMessageImage(imagePath);
      setComplaintError(complaintSubmitError(e));
    } finally {
      setComplaintSubmitting(false);
    }
  };

  const handleToggleReaction = async (suggestionId: number, type: ReactionType) => {
    try {
      await toggleReaction(suggestionId, type);
    } catch (e) {
      // handled in hook
    }
  };

  const toggleComments = (suggestionId: number) => {
    setExpandedComments(prev => {
      const next = new Set(prev);
      if (next.has(suggestionId)) {
        next.delete(suggestionId);
      } else {
        next.add(suggestionId);
        loadComments(suggestionId);
      }
      return next;
    });
  };

  const handleCommentChange = (suggestionId: number, value: string) => {
    setCommentTexts(prev => ({ ...prev, [suggestionId]: value.slice(0, COMMENT_MAX_LENGTH) }));
    setCommentErrors(prev => ({ ...prev, [suggestionId]: '' }));
  };

  const handleSendComment = async (suggestionId: number) => {
    const content = commentTexts[suggestionId] || '';
    if (!content.trim()) return;
    setCommentSending(prev => new Set(prev).add(suggestionId));
    setCommentErrors(prev => ({ ...prev, [suggestionId]: '' }));
    try {
      await addCommentHook(suggestionId, content);
      setCommentTexts(prev => ({ ...prev, [suggestionId]: '' }));
    } catch (e: any) {
      console.error('[SuggestionsFeed] comment error:', e?.message);
      setCommentErrors(prev => ({ ...prev, [suggestionId]: e?.message || 'تعذر إرسال التعليق.' }));
    } finally {
      setCommentSending(prev => {
        const next = new Set(prev);
        next.delete(suggestionId);
        return next;
      });
    }
  };

  const reactionBtnClass = (isActive: boolean) =>
    `flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
      isActive
        ? 'bg-[var(--accent-soft)] text-[var(--accent-primary)] shadow-sm'
        : 'text-[var(--text-muted)] hover:bg-[var(--surface-hover)]'
    }`;

  const renderReactionBar = (suggestionId: number) => {
    const summary = summaries[suggestionId];
    const total = summary?.total || 0;
    return (
      <div className="flex items-center justify-between flex-wrap gap-2 pt-2 border-t border-[var(--border)]">
        <div className="flex items-center gap-1 flex-wrap">
          {REACTIONS.map(r => {
            const count = summary?.byType[r.type] || 0;
            const isActive = summary?.myReactions.includes(r.type);
            return (
              <button
                key={r.type}
                type="button"
                onClick={() => handleToggleReaction(suggestionId, r.type)}
                className={reactionBtnClass(!!isActive)}
                aria-label={r.label}
                aria-pressed={isActive}
              >
                <span className="text-base">{r.emoji}</span>
                {count > 0 && <span dir="ltr">{count}</span>}
              </button>
            );
          })}
        </div>
        {total > 0 && (
          <span className="text-[10px] font-bold text-[var(--text-muted)]">
            {total} {total === 1 ? 'تفاعل' : 'تفاعلات'}
          </span>
        )}
      </div>
    );
  };

  const renderCommentsSection = (suggestionId: number) => {
    const isExpanded = expandedComments.has(suggestionId);
    const comms = commentsBySuggestion[suggestionId] || [];
    const isLoading = loadingIds.has(suggestionId);
    const txt = commentTexts[suggestionId] || '';
    const sending = commentSending.has(suggestionId);
    const err = commentErrors[suggestionId] || '';
    return (
      <div className="border-t border-[var(--border)]">
        <button
          type="button"
          onClick={() => toggleComments(suggestionId)}
          className="flex items-center justify-between w-full px-4 py-2 text-xs font-bold text-[var(--text-muted)] hover:bg-[var(--surface-hover)] transition-colors"
        >
          <span className="flex items-center gap-1.5">
            <MessageSquareText className="w-3.5 h-3.5" />
            {comms.length > 0 ? `${comms.length} تعليق` : 'كن أول من يعلّق'}
          </span>
          {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>
        {isExpanded && (
          <div className="px-4 pb-3 space-y-3">
            {isLoading ? (
              <div className="flex justify-center py-4">
                <Loader2 className="w-5 h-5 animate-spin text-[var(--text-muted)]" />
              </div>
            ) : comms.length === 0 ? (
              <p className="text-center text-xs text-[var(--text-muted)] py-4">لا توجد تعليقات بعد</p>
            ) : (
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {comms.map(c => {
                  const cName = authorName(c.owner_id);
                  return (
                    <div key={c.id} className="flex gap-2 p-2 rounded-lg bg-[var(--surface-elevated)] border border-[var(--border)]">
                      <Avatar ownerId={c.owner_id} name={cName} size="sm" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-xs font-black text-[var(--text-primary)]">{cName}</span>
                          <span className="text-[10px] text-[var(--text-muted)]">{formatRelativeTime(c.created_at)}</span>
                        </div>
                        <p className="text-sm text-[var(--text-primary)] whitespace-pre-wrap break-words">{c.content}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            <div className="flex gap-2 items-end">
              <textarea
                value={txt}
                onChange={e => handleCommentChange(suggestionId, e.target.value)}
                placeholder="اكتب تعليقك..."
                rows={1}
                className="min-h-[36px] max-h-20 flex-1 resize-none rounded-xl border px-3 py-2 text-sm font-bold focus:outline-none focus:border-[var(--accent-primary)] focus:shadow-[0_0_0_3px_var(--focus-ring)] transition-all bg-[var(--input-bg)] border-[var(--input-border)] text-[var(--text-primary)]"
              />
              <button
                type="button"
                onClick={() => handleSendComment(suggestionId)}
                disabled={!txt.trim() || sending}
                className="app-btn-accent flex h-9 w-9 items-center justify-center rounded-xl disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4 -scale-x-100" />}
              </button>
            </div>
            {err && <p className="text-[10px] font-bold text-red-500">{err}</p>}
            <div className="text-[9px] font-bold text-[var(--text-muted)] text-left" dir="ltr">
              {txt.length}/{COMMENT_MAX_LENGTH}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex min-w-0 items-center justify-center p-2 sm:p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative flex h-[calc(100dvh-1rem)] w-full min-w-0 max-w-2xl flex-col overflow-hidden rounded-3xl border border-[var(--border)] bg-[var(--surface)] shadow-2xl sm:h-[92vh] sm:max-h-[700px]">
        <div className="flex min-w-0 shrink-0 items-center justify-between gap-2 border-b border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-3 sm:px-6">
          <div className="flex min-w-0 items-center gap-2 sm:gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[var(--accent-soft)] flex items-center justify-center">
              <Lightbulb className="w-5 h-5 text-[var(--accent-primary)]" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base font-black text-[var(--text-primary)]">الاقتراحات والشكاوى</h2>
              <p className="text-xs text-[var(--text-muted)]">{activeTab === 'suggestions' ? 'شارك اقتراحك مع الجميع' : 'أرسل شكواك إلى الإدارة بشكل خاص'}</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {activeTab === 'suggestions' && (
              <button type="button" onClick={() => load(true)} disabled={refreshing} aria-label="تحديث" className="p-2 rounded-xl text-[var(--text-muted)] hover:text-[var(--accent-primary)] hover:bg-[var(--surface-hover)] transition-colors disabled:opacity-50">
                <RefreshCw className={`w-5 h-5 ${refreshing ? 'animate-spin' : ''}`} />
              </button>
            )}
            <button type="button" onClick={onClose} aria-label="إغلاق" className="p-2 rounded-xl text-[var(--text-muted)] hover:text-red-500 hover:bg-red-500/10 transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="flex shrink-0 border-b border-[var(--border)] bg-[var(--surface-elevated)] p-2">
          <button
            type="button"
            onClick={() => { setActiveTab('suggestions'); setComplaintError(''); setComplaintSuccess(''); }}
            className={`flex-1 rounded-xl px-3 py-2 text-sm font-black transition-colors ${activeTab === 'suggestions' ? 'bg-[var(--accent-primary)] text-white' : 'text-[var(--text-secondary)] hover:bg-[var(--surface-hover)]'}`}
          >
            ساحة الاقتراحات
          </button>
          <button
            type="button"
            onClick={() => { setActiveTab('complaints'); setSubmitError(''); }}
            className={`flex-1 rounded-xl px-3 py-2 text-sm font-black transition-colors ${activeTab === 'complaints' ? 'bg-[var(--accent-primary)] text-white' : 'text-[var(--text-secondary)] hover:bg-[var(--surface-hover)]'}`}
          >
            الشكاوى
          </button>
        </div>

        {activeTab === 'suggestions' ? (
        <>
        <div className="flex-1 overflow-y-auto">
          {error && (
            <div className="p-4 m-4 rounded-2xl bg-red-500/10 border border-red-500/20 text-center">
              <AlertTriangle className="w-8 h-8 mx-auto mb-2 text-red-500" />
              <p className="text-sm font-bold text-red-500">{error}</p>
              <button type="button" onClick={() => load(true)} className="mt-3 px-4 py-2 rounded-xl text-sm font-bold bg-[var(--accent-primary)] text-white hover:bg-[var(--accent-hover)] transition-colors">إعادة المحاولة</button>
            </div>
          )}
          {!error && loading && (
            <div className="text-center py-16 text-[var(--text-muted)]">
              <RefreshCw className="w-12 h-12 mx-auto mb-4 opacity-30 animate-spin" />
              <p className="text-lg font-bold">جارٍ تحميل الاقتراحات...</p>
            </div>
          )}
          {!error && !loading && comments.length === 0 && (
            <div className="text-center py-16 rounded-2xl border text-[var(--text-muted)] bg-[var(--card)] border-[var(--border)] mx-4 mt-4">
              <Users className="w-12 h-12 mx-auto mb-4 opacity-20" />
              <p className="text-lg font-bold">لا توجد اقتراحات بعد</p>
              <p className="text-sm">كن أول من يشارك اقتراحه!</p>
            </div>
          )}
          {!error && !loading && comments.length > 0 && (
            <div className="divide-y divide-[var(--border)]">
              {comments.map(comment => {
                const name = authorName(comment.owner_id);
                const safeImageUrl = sanitizeExternalUrl(comment.image_url);
                const hasImage = !!safeImageUrl;
                return (
                  <article key={comment.id} className="p-4 space-y-3">
                    <div className="flex gap-3">
                      <Avatar ownerId={comment.owner_id} name={name} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm font-black text-[var(--text-primary)]">{name}</span>
                          <span className="text-xs text-[var(--text-muted)]">{formatRelativeTime(comment.created_at)}</span>
                        </div>
                        <p className="text-sm whitespace-pre-wrap break-words text-[var(--text-primary)] leading-relaxed">{comment.content}</p>
                        {hasImage && (
                          <a href={safeImageUrl} target="_blank" rel="noopener noreferrer" className="block mt-2">
                            <img src={safeImageUrl} alt="مرفق" loading="lazy" className="max-h-64 w-auto max-w-full rounded-xl border object-cover border-[var(--border)]" />
                          </a>
                        )}
                      </div>
                    </div>
                    {renderReactionBar(comment.id)}
                    {renderCommentsSection(comment.id)}
                  </article>
                );
              })}
              <div ref={feedEndRef} />
            </div>
          )}
        </div>

        <form onSubmit={handleSubmit} className="shrink-0 border-t border-[var(--border)] bg-[var(--surface-elevated)] p-4 space-y-3">
          <label htmlFor="suggestion-text" className="block text-sm font-bold text-[var(--text-primary)]">اكتب اقتراحك</label>
          <textarea
            id="suggestion-text"
            value={text}
            onChange={e => setText(e.target.value.slice(0, SUGGESTION_MAX_LENGTH))}
            minLength={SUGGESTION_MIN_LENGTH}
            maxLength={SUGGESTION_MAX_LENGTH}
            required
            disabled={submitting}
            rows={2}
            placeholder="اكتب اقتراحك في جملة..."
            className="w-full resize-none rounded-xl border border-[var(--input-border)] bg-[var(--input-bg)] p-3 text-sm text-[var(--text-primary)]"
          />
          {imagePreview && (
            <div className="relative w-fit">
              <img src={imagePreview} alt="معاينة الصورة المرفقة" className="max-h-28 max-w-full rounded-xl object-contain" />
              <button type="button" onClick={clearImage} disabled={submitting} aria-label="إزالة الصورة" className="absolute left-1 top-1 rounded-full bg-red-600 p-1 text-white"><X className="h-4 w-4" /></button>
            </div>
          )}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs text-[var(--text-muted)]" dir="ltr">{text.length}/{SUGGESTION_MAX_LENGTH}</span>
          <div className="flex min-w-0 flex-wrap items-center justify-end gap-2">
              <input ref={fileInputRef} type="file" accept="image/*" onChange={pickImage} disabled={submitting} className="hidden" />
              <button type="button" onClick={() => fileInputRef.current?.click()} disabled={submitting} className="flex items-center gap-1 rounded-xl px-3 py-2 text-sm text-[var(--text-secondary)]"><ImageIcon className="h-4 w-4" />إضافة صورة</button>
              <button type="submit" disabled={!canSend} className="app-btn-accent flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold disabled:opacity-50">
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} نشر الاقتراح
              </button>
            </div>
          </div>
          {submitError && <p role="alert" className="text-sm text-red-500">{submitError}</p>}
        </form>
        </>
        ) : (
          <form onSubmit={handleComplaintSubmit} dir="rtl" className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4 sm:p-6">
            <div className="sticky top-0 z-10 -mx-4 -mt-4 flex shrink-0 items-start justify-between gap-2 border-b border-[var(--border)] bg-[var(--surface)] px-4 py-4 sm:-mx-6 sm:-mt-6 sm:px-6">
              <div className="min-w-0 flex-1">
                <h3 className="text-lg font-black text-[var(--text-primary)]">إرسال شكوى</h3>
                <p className="mt-1 text-sm leading-6 text-[var(--text-muted)]">ستصل الشكوى إلى الإدارة فقط ولن تظهر للمستخدمين.</p>
              </div>
              <button type="submit" disabled={!complaintText.trim() || complaintSubmitting} className="app-btn-accent flex shrink-0 items-center gap-2 whitespace-nowrap rounded-xl px-4 py-2.5 text-sm font-bold disabled:cursor-not-allowed disabled:opacity-50">
                {complaintSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                إرسال الشكوى
              </button>
            </div>
            <textarea
              value={complaintText}
              onChange={e => { setComplaintText(e.target.value.slice(0, 2000)); setComplaintError(''); setComplaintSuccess(''); }}
              placeholder="اكتب شكواك هنا..."
              maxLength={COMPLAINT_MAX_LENGTH}
              required
              disabled={complaintSubmitting}
              className="min-h-48 w-full flex-1 resize-none rounded-2xl border border-[var(--input-border)] bg-[var(--input-bg)] p-4 text-sm leading-7 text-[var(--text-primary)] outline-none transition-all focus:border-[var(--accent-primary)]"
            />
            {complaintImagePreview && (
              <div className="relative w-fit">
                <img src={complaintImagePreview} alt="معاينة صورة الشكوى" className="max-h-40 max-w-full rounded-xl border border-[var(--border)] object-contain" />
                <button
                  type="button"
                  onClick={clearComplaintImage}
                  disabled={complaintSubmitting}
                  aria-label="حذف صورة الشكوى"
                  className="absolute left-1 top-1 rounded-full bg-red-600 p-1 text-white"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            )}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs text-[var(--text-muted)]" dir="ltr">{complaintText.length}/{COMPLAINT_MAX_LENGTH}</span>
                <input ref={complaintFileInputRef} type="file" accept="image/*" onChange={pickComplaintImage} disabled={complaintSubmitting} className="hidden" />
                <button
                  type="button"
                  onClick={() => complaintFileInputRef.current?.click()}
                  disabled={complaintSubmitting}
                  className="flex items-center gap-1 rounded-xl px-3 py-2 text-sm text-[var(--text-secondary)] hover:bg-[var(--surface-hover)]"
                >
                  <ImageIcon className="h-4 w-4" />
                  {complaintImagePreview ? 'تغيير الصورة' : 'إضافة صورة'}
                </button>
              </div>
            </div>
            {complaintError && <p role="alert" className="text-sm font-bold text-red-500">{complaintError}</p>}
            {complaintSuccess && <p role="status" className="text-sm font-bold text-emerald-600">{complaintSuccess}</p>}
          </form>
        )}
      </div>
    </div>
  );
}
