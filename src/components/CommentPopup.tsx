import { useState, useEffect, useRef, useCallback } from 'react';
import {
  MessageCircle, Send, Image as ImageIcon, Loader2, X, Trash2, User,
  Edit2, Check, AlertCircle,
} from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import {
  Comment, fetchComments, addComment,
  updateCommentContent, updateCommentImage, deleteComment,
  uploadCommentImage,
  COMMENT_MIN_LENGTH, COMMENT_MAX_LENGTH,
} from '../hooks/useComments';

interface Props {
  onClose: () => void;
  isAdmin?: boolean;
}

function formatTime(value?: string | null): string {
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

export default function CommentPopup({ onClose, isAdmin = false }: Props) {
  const { theme } = useTheme();
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [text, setText] = useState('');
  const [image, setImage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Admin edit state
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editText, setEditText] = useState('');
  const [editImage, setEditImage] = useState('');
  const [editImageFile, setEditImageFile] = useState<File | null>(null);
  const editFileInputRef = useRef<HTMLInputElement>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editActionError, setEditActionError] = useState('');
  const [editImageRemoved, setEditImageRemoved] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const rows = await fetchComments();
      setComments(rows);
    } catch (e: any) {
      console.error('[CommentPopup] load error:', e?.message, e?.code);
      const code = e?.code;
      const isTableMissing = code === '42P01' || code === 'PGRST205';
      setError(
        isTableMissing
          ? 'جدول التعليقات غير موجود بعد. يرجى تنفيذ supabase_add_comments.sql.'
          : `تعذر تحميل التعليقات: ${e?.message || 'خطأ غير معروف'}`
      );
      setComments([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      alert('حجم الصورة كبير جداً (الحد الأقصى 2 ميجابايت)');
      return;
    }
    const reader = new FileReader();
    reader.onloadend = () => setImage(reader.result as string);
    reader.readAsDataURL(file);
  };

  const trimmed = text.trim();
  const charCount = text.length;
  const canSend =
    trimmed.length >= COMMENT_MIN_LENGTH &&
    trimmed.length <= COMMENT_MAX_LENGTH &&
    !isSubmitting;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    if (trimmed.length < COMMENT_MIN_LENGTH) {
      alert(`الحد الأدنى للتعليق ${COMMENT_MIN_LENGTH} أحرف.`);
      return;
    }
    if (trimmed.length > COMMENT_MAX_LENGTH) {
      alert(`الحد الأقصى للتعليق ${COMMENT_MAX_LENGTH} حرف.`);
      return;
    }

    setIsSubmitting(true); // prevent double submission
    try {
      const newComment = await addComment({ content: trimmed, image_url: image || null });
      setComments(prev => [newComment, ...prev.filter(c => c.id !== newComment.id)]);
      setText('');
      setImage('');
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (e: any) {
      console.error('[CommentPopup] add error:', e?.message, e?.code);
      const code = e?.code;
      let msg: string;
      if (code === '42P01' || code === 'PGRST205') {
        msg = 'جدول التعليقات غير موجود. يرجى تواصل مع المدير.';
      } else if (e?.message) {
        msg = `تعذر إرسال التعليق: ${e.message}`;
      } else {
        msg = 'تعذر إرسال التعليق، حاول مرة أخرى.';
      }
      alert(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  // --- Admin actions ---

  const startEdit = (c: Comment) => {
    setEditingId(c.id);
    setEditText(c.content);
    setEditImage(c.image_url || '');
    setEditImageFile(null);
    setEditImageRemoved(false);
    setEditActionError('');
    setIsEditing(true);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditText('');
    setEditImage('');
    setEditImageFile(null);
    setEditImageRemoved(false);
    setEditActionError('');
    setIsEditing(false);
    if (editFileInputRef.current) editFileInputRef.current.value = '';
  };

  const handleEditImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      alert('حجم الصورة كبير جداً (الحد الأقصى 2 ميجابايت)');
      return;
    }
    setEditImageFile(file);
    const reader = new FileReader();
    reader.onloadend = () => setEditImage(reader.result as string);
    reader.readAsDataURL(file);
  };

  const saveEdit = async () => {
    if (!editingId) return;
    if (!editText.trim()) {
      alert('المحتوى لا يمكن أن يكون فارغًا.');
      return;
    }
    if (editText.trim().length < COMMENT_MIN_LENGTH) {
      alert(`الحد الأدنى للتعليق ${COMMENT_MIN_LENGTH} أحرف.`);
      return;
    }
    if (editText.trim().length > COMMENT_MAX_LENGTH) {
      alert(`الحد الأقصى للتعليق ${COMMENT_MAX_LENGTH} حرف.`);
      return;
    }

    setIsEditing(true);
    setEditActionError('');

    try {
      // 1) Update text content
      await updateCommentContent(editingId, editText.trim());

      // 2) Track the final image url (unchanged, replaced, or removed)
      let finalImageUrl: string | null = editImage || null;

      // Image was removed by the admin inside the edit modal
      if (editImageRemoved && !editImageFile) {
        await updateCommentImage(editingId, null);
        finalImageUrl = null;
      }

      // Replace image if a new one was selected
      if (editImageFile) {
        const uploadedUrl = await uploadCommentImage(editImageFile);
        if (uploadedUrl) {
          await updateCommentImage(editingId, uploadedUrl);
          finalImageUrl = uploadedUrl;
          setEditImageRemoved(false);
        } else {
          setEditActionError('فشل رفع الصورة، لكن تم حفظ النص.');
          return;
        }
      }

      // Update local list ONLY after confirmed Supabase success
      setComments(prev => prev.map(c =>
        c.id === editingId ? { ...c, content: editText.trim(), image_url: finalImageUrl } : c
      ));
      cancelEdit();
    } catch (e: any) {
      console.error('[CommentPopup] edit error:', e?.message, e?.code);
      setEditActionError(e?.message || 'فشل تعديل التعليق.');
    } finally {
      setIsEditing(false);
    }
  };

  const handleDelete = async (c: Comment) => {
    if (window.confirm('هل أنت متأكد من حذف هذا التعليق؟')) {
      try {
        await deleteComment(c.id);
        // Only reached when Supabase confirmed at least one row was removed.
        // Re-fetch from public.comments so this list always mirrors the real
        // database state (also covers deletes done elsewhere concurrently).
        setComments(prev => prev.filter(x => x.id !== c.id));
        await load();
      } catch (e: any) {
        console.error('[CommentPopup] delete error:', e?.message, e?.code);
        alert(e?.message || 'فشل حذف التعليق.');
      }
    }
  };

  const handleRemoveImage = async (c: Comment) => {
    if (!window.confirm('هل تريد إزالة الصورة من هذا التعليق؟')) return;
    try {
      await updateCommentImage(c.id, null);
      setComments(prev => prev.map(x =>
        x.id === c.id ? { ...x, image_url: null } : x
      ));
    } catch (e: any) {
      console.error('[CommentPopup] remove image error:', e?.message, e?.code);
      alert(e?.message || 'فشل إزالة الصورة.');
    }
  };

    const muted = 'text-[var(--text-muted)]';
  const inputBorder = 'border-[var(--input-border)]';
  const inputBg = 'bg-[var(--input-bg)]';
  const inputText = 'text-[var(--text-primary)]';
  const cardBg = 'bg-[var(--card)]';
  const cardBorder = 'border-[var(--border)]';

  return (
    <div
      className="fixed inset-0 z-50 flex justify-center items-start sm:items-center p-4"
      style={{ backgroundColor: 'rgba(0, 0, 0, 0.6)' }}
      onClick={e => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className={`w-full max-w-md border rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200 my-auto bg-[var(--card)] border-[var(--border)]`}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className={`p-4 border-b flex items-center justify-between sticky top-0 z-10 bg-[var(--surface-elevated)] border-[var(--border)]`}>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-[var(--accent-primary)]/20 flex items-center justify-center text-[var(--accent-primary)]">
              <MessageCircle className="w-4 h-4" />
            </div>
            <h2 className={`text-lg font-bold text-[var(--text-primary)]`}>
              تواصل معنا
            </h2>
          </div>
          <button
            onClick={onClose}
            className={`p-1 rounded-lg transition-colors text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--accent-soft)]`}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Comments List */}
        <div className="p-4 space-y-3 overflow-y-auto max-h-[50vh]">
          {loading && (
            <div className="flex justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-[var(--accent-primary)]" />
            </div>
          )}

          {!loading && (
            <>
              {error && (
                <div className={`p-3 rounded-xl flex items-center gap-2 bg-red-500/10 text-[var(--text-primary)]`}>
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span className="text-sm">{error}</span>
                </div>
              )}

              {!error && comments.length === 0 && (
                <div className={`text-center py-6 ${muted} text-sm`}>
                  لا تعليقات بعد. كن أول من يكتب!
                </div>
              )}

              {!error && comments.map(c => (
                <div
                  key={c.id}
                  className={`border rounded-xl p-3 space-y-1 ${cardBg} ${cardBorder}`}
                >
                  <div className="flex items-start gap-2">
                    <div className="w-8 h-8 rounded-full bg-[var(--accent-primary)]/10 flex items-center justify-center shrink-0 mt-0.5">
                      <User className="w-4 h-4 text-[var(--accent-primary)]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className={`text-sm font-bold text-[var(--text-primary)] break-words`}>
                        {c.content}
                      </div>
                      {c.image_url && (
                        <img
                          src={c.image_url}
                          alt="مرفق"
                          className="mt-2 max-h-40 w-full rounded-lg object-cover"
                        />
                      )}
                      <p className={`text-[11px] mt-0.5 px-1 ${muted}`}>
                        {formatTime(c.created_at)}
                      </p>
                    </div>
                  </div>

                  {/* Admin action buttons */}
                  {isAdmin && (
                    <div className="flex gap-2 pt-1 justify-end">
                      <button
                        type="button"
                        onClick={() => handleRemoveImage(c)}
                        className={`text-xs px-2 py-1 rounded-lg transition-colors flex items-center gap-1 text-[var(--text-muted)] hover:text-[var(--accent-primary)] hover:bg-[var(--accent-soft)]`}
                        title="إزالة الصورة"
                      >
                        <Trash2 className="w-3 h-3" /> إزالة الصورة
                      </button>
                      <button
                        type="button"
                        onClick={() => startEdit(c)}
                        className={`text-xs px-2 py-1 rounded-lg transition-colors flex items-center gap-1 text-[var(--text-muted)] hover:text-[var(--accent-primary)] hover:bg-[var(--accent-soft)]`}
                        title="تعديل"
                      >
                        <Edit2 className="w-3 h-3" /> تعديل
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(c)}
                        className={`text-xs px-2 py-1 rounded-lg transition-colors flex items-center gap-1 text-[var(--text-muted)] hover:text-red-600 hover:bg-[var(--accent-soft)]`}
                        title="حذف"
                      >
                        <Trash2 className="w-3 h-3" /> حذف
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </>
          )}
        </div>

        {/* Composer */}
        <form onSubmit={handleSubmit} className={`border-t p-3 space-y-2 border-[var(--border)]`}>
          <div className={`flex items-end gap-2 border rounded-xl p-2 focus-within:border-[var(--accent-primary)] focus-within:shadow-[0_0_12px_var(--glow)] transition-all ${inputBorder}`}>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value.slice(0, COMMENT_MAX_LENGTH))}
              rows={2}
              maxLength={COMMENT_MAX_LENGTH}
              placeholder="اكتب تعليقك هنا (5-100 حرف)..."
              className={`flex-1 bg-transparent resize-none px-1 py-1 text-sm focus:outline-none ${inputText} placeholder-gray-500`}
            />
            {image && (
              <div className="relative shrink-0">
                <img src={image} alt="مرفق" className="w-12 h-12 rounded-lg object-cover" />
                <button
                  type="button"
                  onClick={() => { setImage(''); if (fileInputRef.current) fileInputRef.current.value = ''; }}
                  className="absolute -top-1.5 -right-1.5 p-0.5 rounded-full bg-red-500 text-white"
                  title="إزالة الصورة"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between gap-2">
            <div className={`text-xs font-bold ${charCount > COMMENT_MAX_LENGTH ? 'text-red-500' : muted}`} dir="ltr">
              {charCount} / {COMMENT_MAX_LENGTH}
            </div>
            <div className="flex items-center gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className={`text-xs px-2 py-1 rounded-lg transition-colors flex items-center gap-1 text-[var(--text-muted)] hover:text-[var(--accent-primary)] hover:bg-[var(--accent-soft)]`}
                        title="إرفاق صورة"
              >
                <ImageIcon className="w-5 h-5" />
              </button>
              <button
                type="submit"
                disabled={!canSend}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-bold transition-all ${canSend ? 'bg-[var(--accent-primary)] text-white shadow-[0_0_12px_var(--glow)] hover:shadow-[0_0_18px_var(--glow)]' : 'opacity-50 cursor-not-allowed'}`}
              >
                {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} إرسال
              </button>
            </div>
          </div>
          {trimmed.length > 0 && trimmed.length < COMMENT_MIN_LENGTH && (
            <p className="text-[11px] text-red-500 font-bold">
              الحد الأدنى للتعليق {COMMENT_MIN_LENGTH} أحرف.
            </p>
          )}
        </form>

        {/* Admin Edit Modal Overlay */}
        {isAdmin && isEditing && editingId !== null && (
          <div
            className="fixed inset-0 z-[60] flex justify-center items-center p-4"
            style={{ backgroundColor: 'rgba(0, 0, 0, 0.7)' }}
            onClick={e => {
              if (e.target === e.currentTarget) cancelEdit();
            }}
          >
            <div
              className={`w-full max-w-md border rounded-2xl shadow-2xl animate-in fade-in zoom-in duration-200 bg-[var(--surface-elevated)] border-[var(--border)]`}
              onClick={e => e.stopPropagation()}
            >
              <div className={`p-4 border-b flex items-center justify-between border-[var(--border)] bg-[var(--surface-elevated)]`}>
                <h3 className={`text-lg font-bold text-[var(--text-primary)]`}>تعديل التعليق</h3>
                <button
                  onClick={cancelEdit}
                  className={`p-1 rounded-lg transition-colors text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--accent-soft)]`}
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-4 space-y-4">
                <div>
                  <label className={`text-sm font-bold mb-1 flex items-center gap-1 text-[var(--text-secondary)]`}>
                    النص
                  </label>
                  <textarea
                    value={editText}
                    onChange={e => setEditText(e.target.value.slice(0, COMMENT_MAX_LENGTH))}
                    maxLength={COMMENT_MAX_LENGTH}
                    rows={3}
                    className={`w-full border rounded-xl px-4 py-3 resize-none text-sm focus:outline-none focus:border-[var(--accent-primary)] transition-all ${inputBorder} ${inputBg} ${inputText}`}
                  />
                </div>

                <div>
                  <label className={`text-sm font-bold mb-1 flex items-center gap-1 text-[var(--text-secondary)]`}>
                    الصورة {editImage ? '(مُحدّث)' : '(اختياري)'}
                  </label>
                  {editImage ? (
                    <div className="relative inline-block">
                      <img src={editImage} alt="صورة التعليق" className="w-20 h-20 rounded-lg object-cover" />
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          setEditImage('');
                          setEditImageFile(null);
                          setEditImageRemoved(true);
                          if (editFileInputRef.current) editFileInputRef.current.value = '';
                        }}
                        className="absolute -top-1.5 -right-1.5 p-0.5 rounded-full bg-red-500 text-white"
                        title="إزالة الصورة"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <input
                        ref={editFileInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleEditImageUpload}
                        className="hidden"
                      />
                      <button
                        type="button"
                        onClick={() => editFileInputRef.current?.click()}
                        className={`flex items-center gap-1 px-3 py-1.5 border rounded-xl text-sm transition-colors border-[var(--border)] text-[var(--text-secondary)] hover:text-blue-600 hover:bg-[var(--surface-elevated)]`}
                      >
                        <ImageIcon className="w-4 h-4" />
                        اختيار صورة
                      </button>
                      {editImageFile && (
                        <span className={`text-xs ${muted}`}>{editImageFile.name.split('.').pop()}</span>
                      )}
                    </div>
                  )}
                </div>

                {editActionError && (
                  <div className={`p-2 rounded-xl flex items-center gap-2 text-sm bg-red-50 text-red-600`}>
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{editActionError}</span>
                  </div>
                )}
              </div>

              <div className={`p-4 border-t flex justify-end gap-2 border-[var(--border)] bg-[var(--surface-elevated)]`}>
                <button
                  type="button"
                  onClick={cancelEdit}
                  className={`px-4 py-2 rounded-xl text-sm font-bold transition-colors text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--accent-soft)]`}
                >
                  إلغاء
                </button>
                <button
                  type="button"
                  onClick={saveEdit}
                  disabled={isEditing}
                  className={`px-4 py-2 rounded-xl text-sm font-bold transition-all flex items-center gap-1.5 bg-[var(--accent-primary)] text-white hover:bg-[var(--accent-hover)]`}
                  style={{ boxShadow: '0 0 12px rgba(0, 207, 255, 0.4)' }}
                >
                  {isEditing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  حفظ
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
