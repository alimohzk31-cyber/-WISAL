import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { getOwnerId } from './useServices';

// ---------------------------------------------------------------------------
// useFeedInteractions — نظام التفاعلات والتعليقات للتصفح الاجتماعي.
// يربط كل تفاعل/تعليق بالخدمة (service_id) وبمالك الجهاز (owner_id) عبر
// جدولي public.service_reactions و public.service_comments.
// لا يوجد Mock Data: أي خطأ من Supabase يُسجَّل ويُعرض كما هو.
// ---------------------------------------------------------------------------

export type ReactionType =
  | 'like' | 'love' | 'rose' | 'haha' | 'wow' | 'sad' | 'angry'
  // أنواع قديمة بقيت صالحة في القاعدة للتوافق مع البيانات الموجودة
  | 'clap' | 'amazing';

// قائمة التفاعلات المعروضة في منتقي التفاعلات (Long Press)
export const REACTIONS: { type: ReactionType; emoji: string; label: string }[] = [
  { type: 'like', emoji: '👍', label: 'إعجاب' },
  { type: 'love', emoji: '❤️', label: 'أحببت' },
  { type: 'rose', emoji: '🌹', label: 'وردة' },
  { type: 'haha', emoji: '😂', label: 'هاها' },
  { type: 'wow', emoji: '😮', label: 'مدهش' },
  { type: 'sad', emoji: '😢', label: 'حزين' },
  { type: 'angry', emoji: '😡', label: 'غاضب' },
];

// خريطة عرض لكل الأنواع (بما فيها القديمة) لعرض العدادات بشكل صحيح
export const REACTION_META: Record<ReactionType, { emoji: string; label: string }> = {
  like: { emoji: '👍', label: 'إعجاب' },
  love: { emoji: '❤️', label: 'أحببت' },
  rose: { emoji: '🌹', label: 'وردة' },
  haha: { emoji: '😂', label: 'هاها' },
  wow: { emoji: '😮', label: 'مدهش' },
  sad: { emoji: '😢', label: 'حزين' },
  angry: { emoji: '😡', label: 'غاضب' },
  clap: { emoji: '👏', label: 'ممتاز' },
  amazing: { emoji: '😍', label: 'رائع' },
};

export interface PostComment {
  id: number;
  service_id: number;
  content: string;
  owner_id: string;
  created_at: string;
}

export interface ReactionSummary {
  total: number;
  byType: Partial<Record<ReactionType, number>>;
  // أعلى تفاعل (للعرض كرمز بجانب العدد)
  top: { type: ReactionType; emoji: string } | null;
}

function logError(context: string, error: any) {
  console.error(`[FeedInteractions:${context}]`, {
    message: error?.message,
    code: error?.code,
    details: error?.details,
    hint: error?.hint,
  });
}

function buildSummary(rows: { reaction_type: ReactionType }[]): ReactionSummary {
  const byType: Partial<Record<ReactionType, number>> = {};
  for (const row of rows) {
    byType[row.reaction_type] = (byType[row.reaction_type] || 0) + 1;
  }
  let top: ReactionSummary['top'] = null;
  let topCount = 0;
  for (const [type, count] of Object.entries(byType)) {
    if ((count as number) > topCount) {
      topCount = count as number;
      top = { type: type as ReactionType, emoji: REACTION_META[type as ReactionType]?.emoji ?? '👍' };
    }
  }
  return { total: rows.length, byType, top };
}

// ---------------------------------------------------------------------------
// كاش جلسة لنتائج التفاعلات والتعليقات — يمنع إعادة جلب نفس البيانات من
// Supabase عند كل دخول/رجوع للتصفح الاجتماعي (كان يُطلق طلبي شبكة على الأقل
// عند كل تثبيت لـ Home عبر useFeedInteractions الموجود داخل SocialFeed).
//
// المعايير:
//  - TTL 90 ثانية: بعدها يُجلب التحديث في الخلفية وفي نفس لحظة التركيب.
//  - مشاركة الطلب الجاري: لو رُكّبت عدة نسخ من Home/الخطاف في اللحظة نفسها
//    يشتركن في طلب واحد بدل إطلاق طلبات مطابقة مكررة.
//  - أي تفاعل/تعليق ناجح يُبطل الكاش (feedCache = null) حتى لا تعود البيانات
//    القديمة فوق التحديث المتفائل عند التركيب التالي.
// ---------------------------------------------------------------------------
const FEED_CACHE_TTL = 90 * 1000;

interface FeedCacheSnapshot {
  idsKey: string;
  at: number;
  summaries: Record<string, ReactionSummary>;
  myReactions: Record<string, ReactionType | null>;
  commentsByService: Record<string, PostComment[]>;
  unavailable: boolean;
}

let feedCache: FeedCacheSnapshot | null = null;
let feedRequest: { idsKey: string; promise: Promise<void> } | null = null;

/** يُبطل كاش الجلسة بعد أي عملية كتابة ناجحة (تفاعل/تعليق/حذف). */
function invalidateFeedCache() {
  feedCache = null;
}

function applyFeedCacheSnapshot(snapshot: FeedCacheSnapshot, setters: {
  setSummaries: (value: Record<string, ReactionSummary>) => void;
  setMyReactions: (value: Record<string, ReactionType | null>) => void;
  setCommentsByService: (value: Record<string, PostComment[]>) => void;
  setReactionsUnavailable: (value: boolean) => void;
}) {
  setters.setSummaries(snapshot.summaries);
  setters.setMyReactions(snapshot.myReactions);
  setters.setCommentsByService(snapshot.commentsByService);
  setters.setReactionsUnavailable(snapshot.unavailable);
}

export function useFeedInteractions(serviceIds: (string | number)[]) {
  const [summaries, setSummaries] = useState<Record<string, ReactionSummary>>({});
  const [myReactions, setMyReactions] = useState<Record<string, ReactionType | null>>({});
  const [commentsByService, setCommentsByService] = useState<Record<string, PostComment[]>>({});
  const [reactionsUnavailable, setReactionsUnavailable] = useState(false);

  const idsKey = serviceIds.map(String).join(',');

  const load = useCallback(async () => {
    const ids = idsKey ? idsKey.split(',') : [];
    if (ids.length === 0) {
      setSummaries({});
      setMyReactions({});
      setCommentsByService({});
      return;
    }

    // كاش جلسة سليم: نعيد البيانات فوراً دون أي شبكة في حدود TTL
    if (feedCache && feedCache.idsKey === idsKey && Date.now() - feedCache.at < FEED_CACHE_TTL) {
      applyFeedCacheSnapshot(feedCache, { setSummaries, setMyReactions, setCommentsByService, setReactionsUnavailable });
      return;
    }

    // طلب جارٍ مطابق (تركيب مزدوج في اللحظة نفسها): ننتظر نفس النتيجة فقط
    if (feedRequest && feedRequest.idsKey === idsKey) {
      await feedRequest.promise;
      if (feedCache && feedCache.idsKey === idsKey) {
        applyFeedCacheSnapshot(feedCache, { setSummaries, setMyReactions, setCommentsByService, setReactionsUnavailable });
      }
      return;
    }

    const promise = (async () => {
      try {
        const [reactionsRes, commentsRes] = await Promise.all([
          supabase
            .from('service_reactions')
            .select('service_id, owner_id, reaction_type')
            .in('service_id', ids),
          supabase
            .from('service_comments')
            .select('*')
            .in('service_id', ids)
            .order('created_at', { ascending: true })
            .limit(1000),
        ]);

        if (reactionsRes.error) {
          logError('load(reactions)', reactionsRes.error);
          // 42P01 / PGRST205: الجداول غير موجودة بعد (لم يُنفَّذ supabase_feed_interactions.sql)
          if (reactionsRes.error.code === '42P01' || reactionsRes.error.code === 'PGRST205') {
            feedCache = {
              idsKey, at: Date.now(),
              summaries: {}, myReactions: {}, commentsByService: {}, unavailable: true,
            };
            setReactionsUnavailable(true);
            return;
          }
          throw reactionsRes.error;
        }
        if (commentsRes.error) {
          logError('load(comments)', commentsRes.error);
          throw commentsRes.error;
        }

        const ownerId = getOwnerId();
        const reactionRows = (reactionsRes.data || []) as { service_id: number; owner_id: string; reaction_type: ReactionType }[];
        const commentRows = (commentsRes.data || []) as PostComment[];

        const nextSummaries: Record<string, ReactionSummary> = {};
        const nextMine: Record<string, ReactionType | null> = {};
        for (const id of ids) nextMine[id] = null;

        const grouped: Record<string, { reaction_type: ReactionType }[]> = {};
        for (const row of reactionRows) {
          const key = String(row.service_id);
          (grouped[key] ||= []).push(row);
          if (row.owner_id === ownerId) nextMine[key] = row.reaction_type;
        }
        for (const [key, rows] of Object.entries(grouped)) {
          nextSummaries[key] = buildSummary(rows);
        }

        const nextComments: Record<string, PostComment[]> = {};
        for (const row of commentRows) {
          const key = String(row.service_id);
          (nextComments[key] ||= []).push(row);
        }

        feedCache = {
          idsKey,
          at: Date.now(),
          summaries: nextSummaries,
          myReactions: nextMine,
          commentsByService: nextComments,
          unavailable: false,
        };
        setSummaries(nextSummaries);
        setMyReactions(nextMine);
        setCommentsByService(nextComments);
        setReactionsUnavailable(false);
      } catch (error) {
        logError('load', error);
      }
    })();
    feedRequest = { idsKey, promise };
    try {
      await promise;
    } finally {
      if (feedRequest?.promise === promise) feedRequest = null;
    }
    if (feedCache && feedCache.idsKey === idsKey) {
      applyFeedCacheSnapshot(feedCache, { setSummaries, setMyReactions, setCommentsByService, setReactionsUnavailable });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsKey]);

  useEffect(() => {
    void load();
  }, [load]);

  // اختيار/تغيير/إلغاء التفاعل — تفاعل واحد فقط لكل مستخدم على كل منشور.
  const toggleReaction = useCallback(async (serviceId: string | number, type: ReactionType) => {
    const key = String(serviceId);
    const ownerId = getOwnerId();
    const current = myReactions[key] ?? null;

    // تحديث متفائل فوري للواجهة
    const applyOptimistic = (next: ReactionType | null) => {
      setMyReactions((prev) => ({ ...prev, [key]: next }));
      setSummaries((prev) => {
        const base = prev[key] ?? { total: 0, byType: {}, top: null };
        const byType: Partial<Record<ReactionType, number>> = { ...base.byType };
        if (current) byType[current] = Math.max(0, (byType[current] || 0) - 1);
        if (next) byType[next] = (byType[next] || 0) + 1;
        const rows = Object.entries(byType).flatMap(([t, n]) =>
          Array.from({ length: n as number }, () => ({ reaction_type: t as ReactionType }))
        );
        return { ...prev, [key]: buildSummary(rows) };
      });
    };

    try {
      if (current === type) {
        // إلغاء التفاعل بالضغط عليه مرة أخرى
        applyOptimistic(null);
        const { error } = await supabase
          .from('service_reactions')
          .delete()
          .eq('service_id', Number(serviceId))
          .eq('owner_id', ownerId);
        if (error) throw error;
      } else if (current && current !== type) {
        // تغيير نوع التفاعل
        applyOptimistic(type);
        const { error } = await supabase
          .from('service_reactions')
          .update({ reaction_type: type })
          .eq('service_id', Number(serviceId))
          .eq('owner_id', ownerId);
        if (error) throw error;
      } else {
        // تفاعل جديد (قيد UNIQUE يمنع التكرار على مستوى القاعدة)
        applyOptimistic(type);
        const { error } = await supabase
          .from('service_reactions')
          .insert({ service_id: Number(serviceId), owner_id: ownerId, reaction_type: type });
        if (error) throw error;
      }
      // نجحت الكتابة: أبطل كاش الجلسة حتى لا يعود فوق التحديث المتفائل
      invalidateFeedCache();
    } catch (error) {
      logError('toggleReaction', error);
      // التراجع عن التحديث المتفائل وإعادة الجلب للحالة الصحيحة من القاعدة
      await load();
    }
  }, [myReactions, load]);

  // إضافة تعليق جديد — يعيد الصف المُدرج ليظهر فوراً دون إعادة تحميل.
  const addComment = useCallback(async (serviceId: string | number, content: string): Promise<PostComment> => {
    const trimmed = content.trim();
    if (!trimmed) {
      throw new Error('لا يمكن إرسال تعليق فارغ.');
    }
    const key = String(serviceId);

    const { data, error } = await supabase
      .from('service_comments')
      .insert({
        service_id: Number(serviceId),
        owner_id: getOwnerId(),
        content: trimmed,
      })
      .select()
      .single();

    if (error) {
      logError('addComment', error);
      throw error;
    }

    const row = data as PostComment;
    setCommentsByService((prev) => ({
      ...prev,
      [key]: [...(prev[key] || []), row],
    }));
    invalidateFeedCache();
    return row;
  }, []);

  // حذف تعليق — يُسمح فقط لصاحب الجهاز بحذف تعليقه من الواجهة.
  const deleteComment = useCallback(async (comment: PostComment) => {
    if (comment.owner_id !== getOwnerId()) return;
    const { error } = await supabase
      .from('service_comments')
      .delete()
      .eq('id', comment.id)
      .eq('owner_id', comment.owner_id);
    if (error) {
      logError('deleteComment', error);
      throw error;
    }
    const key = String(comment.service_id);
    setCommentsByService((prev) => ({
      ...prev,
      [key]: (prev[key] || []).filter((c) => c.id !== comment.id),
    }));
    invalidateFeedCache();
  }, []);

  return {
    summaries,
    myReactions,
    commentsByService,
    reactionsUnavailable,
    toggleReaction,
    addComment,
    deleteComment,
    reload: load,
  };
}

// اسم عرض ودّي مشتق من معرّف الجهاز (لا توجد حسابات مستخدمين في التطبيق).
export function commentAuthorName(ownerId: string): string {
  if (ownerId === getOwnerId()) return 'أنت';
  const tail = ownerId.replace(/[^a-z0-9]/gi, '').slice(-4).toUpperCase();
  return `مستخدم ${tail || 'مجهول'}`;
}
