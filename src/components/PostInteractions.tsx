import { useEffect, useRef, useState } from 'react';
import { Bookmark, Eye, Send, Loader2, Trash2, MessageCircle, ThumbsUp } from 'lucide-react';
import {
  REACTIONS,
  REACTION_META,
  type ReactionType,
  type ReactionSummary,
  type PostComment,
  commentAuthorName,
} from '../hooks/useFeedInteractions';
import { isOnlineConnection, OFFLINE_ACTION_MESSAGE } from '../lib/connectivity';

interface PostInteractionsProps {
  serviceId: string | number;
  summary: ReactionSummary;
  myReaction: ReactionType | null;
  comments: PostComment[];
  onToggleReaction: (type: ReactionType) => void;
  onAddComment: (content: string) => Promise<void>;
  onDeleteComment: (comment: PostComment) => void;
  views?: number;
  saved: boolean;
  onToggleSaved: () => void;
}

function formatCommentTime(value?: string | null): string {
  if (!value) return '';
  const d = new Date(value);
  if (isNaN(d.getTime())) return '';
  const diff = Date.now() - d.getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'الآن';
  if (min < 60) return `قبل ${min} دقيقة`;
  const hours = Math.floor(min / 60);
  if (hours < 24) return `قبل ${hours} ساعة`;
  return d.toLocaleDateString('ar', { day: 'numeric', month: 'long' });
}

function Avatar({ name, mine }: { name: string; mine: boolean }) {
  const letter = name === 'أنت' ? 'أ' : name.replace('مستخدم ', '').charAt(0);
  return (
    <div
      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold"
      style={{
        backgroundColor: mine ? 'var(--accent-primary)' : 'var(--accent-soft)',
        color: mine ? '#fff' : 'var(--accent-primary)',
      }}
    >
      {letter}
    </div>
  );
}

export default function PostInteractions({
  serviceId,
  summary,
  myReaction,
  comments,
  onToggleReaction,
  onAddComment,
  onDeleteComment,
  views,
  saved,
  onToggleSaved,
}: PostInteractionsProps) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const commentsRef = useRef<HTMLDivElement>(null);
  const myOwnerIdKey = 'أنت';

  const tryToggleReaction = (type: ReactionType) => {
    if (!isOnlineConnection()) {
      setError(OFFLINE_ACTION_MESSAGE);
      setCommentsOpen(true);
      return;
    }
    setError('');
    onToggleReaction(type);
  };

  // ---------- فرق الضغطة الواحدة (Like) عن الضغط المطوّل (فتح Reactions) ----------
  const LONG_PRESS_MS = 450;
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressFired = useRef(false);

  const clearPressTimer = () => {
    if (pressTimer.current) {
      clearTimeout(pressTimer.current);
      pressTimer.current = null;
    }
  };

  useEffect(() => clearPressTimer, []);

  const handleLikePointerDown = () => {
    longPressFired.current = false;
    clearPressTimer();
    pressTimer.current = setTimeout(() => {
      longPressFired.current = true;
      setPickerOpen(true);
    }, LONG_PRESS_MS);
  };

  const handleLikePointerEnd = () => clearPressTimer();

  // ضغطة واحدة: إعجاب فوري أو إلغاؤه — الضغط المطوّل لا يضع تفاعلاً عشوائياً
  const handleLikeClick = () => {
    if (longPressFired.current) {
      longPressFired.current = false;
      return;
    }
    if (myReaction) {
      tryToggleReaction(myReaction); // إلغاء التفاعل الحالي
    } else {
      tryToggleReaction('like'); // إعجاب مباشر
    }
  };

  // إغلاق نافذة التعليقات عند الضغط خارجها
  useEffect(() => {
    if (!commentsOpen) return;
    const handlePointerDown = (e: MouseEvent | TouchEvent) => {
      if (commentsRef.current && !commentsRef.current.contains(e.target as Node)) {
        setCommentsOpen(false);
      }
    };
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('touchstart', handlePointerDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('touchstart', handlePointerDown);
    };
  }, [commentsOpen]);

  const myReactionMeta = myReaction ? REACTION_META[myReaction] : undefined;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed || sending) return; // منع إرسال تعليق فارغ
    setSending(true);
    setError('');
    try {
      await onAddComment(trimmed);
      setText('');
    } catch (err: any) {
      setError(err?.message || 'تعذر إضافة التعليق.');
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      {/* شريط التفاعل مباشرة أسفل صورة المنشور */}
      <div className="flex items-center justify-between gap-2 border-t border-[var(--border)] px-2 py-1.5 sm:px-4">
        <div className="flex min-w-0 items-center gap-0.5">
        {/* زر الإعجاب: ضغطة واحدة = Like، ضغط مطوّل = فتح قائمة التفاعلات */}
        <div className="relative">
          <button
            type="button"
            onClick={handleLikeClick}
            onPointerDown={handleLikePointerDown}
            onPointerUp={handleLikePointerEnd}
            onPointerLeave={handleLikePointerEnd}
            onPointerCancel={handleLikePointerEnd}
            onContextMenu={(e) => e.preventDefault()}
            aria-label="إعجاب — اضغط مطولاً لعرض التفاعلات"
            title="اضغط للإعجاب — اضغط مطولاً لعرض التفاعلات"
            draggable={false}
            className={`flex select-none items-center gap-1 rounded-xl px-2 py-2 text-xs font-bold transition-colors hover:bg-[var(--accent-soft)] sm:px-3 sm:text-sm ${myReaction ? 'text-[var(--accent-primary)]' : 'text-[var(--text-secondary)]'}`}
            style={{ WebkitTouchCallout: 'none', WebkitUserSelect: 'none' }}
          >
            {myReactionMeta ? (
              <span className="text-lg leading-none">{myReactionMeta.emoji}</span>
            ) : (
              <ThumbsUp className="h-4 w-4" />
            )}
            <span>{myReactionMeta ? myReactionMeta.label : 'إعجاب'}</span>
          </button>

          {pickerOpen && (
            <>
              <div className="fixed inset-0 z-30" onClick={() => setPickerOpen(false)} />
              <div className="absolute bottom-full z-40 mb-2 flex items-center gap-0.5 rounded-full border border-[var(--border)] bg-[var(--surface-elevated)] px-2 py-1.5 shadow-[var(--shadow-lg)] animate-in fade-in zoom-in-95 slide-in-from-bottom-1 duration-150">
                {REACTIONS.map((r) => (
                  <button
                    key={r.type}
                    type="button"
                    title={r.label}
                    aria-label={r.label}
                    onClick={() => {
                      tryToggleReaction(r.type);
                      setPickerOpen(false);
                    }}
                    className="flex h-9 w-9 items-center justify-center rounded-full text-xl transition-transform duration-150 hover:scale-125 hover:bg-[var(--accent-soft)] active:scale-110"
                    style={{ outline: myReaction === r.type ? '2px solid var(--accent-primary)' : undefined }}
                  >
                    {r.emoji}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        {/* عدد التفاعلات */}
        <span className="flex min-w-0 items-center gap-1 text-xs text-[var(--text-muted)]">
          {summary.top && <span>{summary.top.emoji}</span>}
          {summary.total > 0 && <span>{summary.total}</span>}
        </span>

        {/* زر التعليقات — أيقونة صغيرة متناسقة مع زر الإعجاب */}
        <button
          type="button"
          onClick={() => setCommentsOpen((v) => !v)}
          aria-expanded={commentsOpen}
          aria-label="التعليقات"
          className={`flex items-center gap-1 rounded-xl px-2 py-2 text-xs font-bold transition-colors hover:bg-[var(--accent-soft)] sm:px-3 sm:text-sm ${commentsOpen ? 'text-[var(--accent-primary)]' : 'text-[var(--text-secondary)]'}`}
        >
          <MessageCircle className="h-4 w-4" />
          <span>تعليق</span>
          {comments.length > 0 && (
            <span className="rounded-full bg-[var(--accent-soft)] px-1.5 text-xs text-[var(--accent-primary)]">
              {comments.length}
            </span>
          )}
        </button>
        <button
          type="button"
          onClick={onToggleSaved}
          aria-pressed={saved}
          aria-label={saved ? 'إزالة من الخدمات المحفوظة' : 'حفظ الخدمة'}
          className={`flex items-center gap-1 rounded-xl px-2 py-2 text-xs font-bold transition-colors hover:bg-[var(--accent-soft)] sm:px-3 sm:text-sm ${saved ? 'text-[var(--accent-primary)]' : 'text-[var(--text-secondary)]'}`}
        >
          <Bookmark className={`h-4 w-4 ${saved ? 'fill-current' : ''}`} />
          <span>{saved ? 'محفوظ' : 'حفظ'}</span>
        </button>
        </div>

        <span className="flex shrink-0 items-center gap-1 text-xs font-bold text-[var(--text-muted)]" aria-label={views === undefined ? 'عدد الزيارات غير متاح' : `${views} زيارة`}>
          <Eye className="h-4 w-4" />
          {views === undefined ? '—' : views.toLocaleString('ar-IQ')}
          <span className="hidden sm:inline">زيارة</span>
        </span>
      </div>

      {/* نافذة التعليقات المنسدلة داخل المنشور */}
      {commentsOpen && (
        <div ref={commentsRef} className="border-t border-[var(--border)] bg-[var(--surface-elevated)] px-4 py-3">
          <div className="max-h-64 space-y-3 overflow-y-auto">
            {comments.length === 0 ? (
              <p className="py-2 text-center text-sm text-[var(--text-muted)]">لا توجد تعليقات بعد. كن أول من يعلّق.</p>
            ) : (
              comments.map((comment) => {
                const mine = commentAuthorName(comment.owner_id) === myOwnerIdKey;
                const name = commentAuthorName(comment.owner_id);
                return (
                  <div key={comment.id} className="flex items-start gap-2">
                    <Avatar name={name} mine={mine} />
                    <div className="min-w-0 flex-1 rounded-2xl bg-[var(--card)] px-3 py-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-[var(--text-primary)]">{name}</span>
                        <span className="text-[10px] text-[var(--text-muted)]">{formatCommentTime(comment.created_at)}</span>
                        {mine && (
                          <button
                            type="button"
                            aria-label="حذف تعليقي"
                            title="حذف تعليقي"
                            onClick={() => onDeleteComment(comment)}
                            className="ms-auto text-[var(--text-muted)] transition-colors hover:text-red-500"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                      <p className="mt-0.5 whitespace-pre-wrap break-words text-sm leading-6 text-[var(--text-secondary)]">{comment.content}</p>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {error && <p className="mt-2 text-xs text-red-500">{error}</p>}

          {/* حقل إضافة تعليق جديد */}
          <form onSubmit={handleSubmit} className="mt-3 flex items-center gap-2">
            <input
              type="text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              maxLength={500}
              placeholder="اكتب تعليقاً..."
              className="min-w-0 flex-1 rounded-full border border-[var(--input-border)] bg-[var(--input-bg)] px-4 py-2 text-sm text-[var(--text-primary)] focus:border-[var(--accent-primary)] focus:outline-none"
            />
            <button
              type="submit"
              disabled={!text.trim() || sending}
              aria-label="إرسال التعليق"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white transition-opacity disabled:opacity-40"
              style={{ backgroundColor: 'var(--accent-primary)' }}
            >
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </button>
          </form>
        </div>
      )}
    </>
  );
}
