import { useCallback, useState } from 'react';
import { supabase } from '../lib/supabase';
import { getOwnerId } from './useServices';
import { requireOnlineConnection } from '../lib/connectivity';

export type ReactionType = 'like' | 'love';

export const REACTIONS: { type: ReactionType; emoji: string; label: string }[] = [
  { type: 'like', emoji: '👍', label: 'إعجاب' },
  { type: 'love', emoji: '❤️', label: 'حب' },
];

export const REACTION_META: Record<ReactionType, { emoji: string; label: string }> = {
  like: { emoji: '👍', label: 'إعجاب' },
  love: { emoji: '❤️', label: 'حب' },
};

export interface SuggestionComment {
  id: number;
  suggestion_id: number;
  content: string;
  owner_id: string;
  created_at: string;
}

export interface ReactionSummary {
  total: number;
  byType: Partial<Record<ReactionType, number>>;
  myReactions: ReactionType[];
}

function logError(context: string, error: any) {
  console.error(`[SuggestionInteractions:${context}]`, {
    message: error?.message,
    code: error?.code,
    details: error?.details,
    hint: error?.hint,
  });
}

export async function fetchReactionSummary(
  suggestionId: number
): Promise<ReactionSummary> {
  const { data, error } = await supabase
    .from('suggestion_reactions')
    .select('reaction_type, owner_id')
    .eq('suggestion_id', suggestionId);

  if (error) {
    logError('fetchReactionSummary', error);
    throw error;
  }

  const myOwnerId = getOwnerId();
  const byType: Partial<Record<ReactionType, number>> = {};
  const myReactions: ReactionType[] = [];

  for (const row of data || []) {
    const t = row.reaction_type as ReactionType;
    byType[t] = (byType[t] || 0) + 1;
    if (row.owner_id === myOwnerId) myReactions.push(t);
  }

  return { total: data?.length || 0, byType, myReactions };
}

export async function toggleReaction(
  suggestionId: number,
  type: ReactionType
): Promise<{ active: boolean }> {
  requireOnlineConnection();
  const ownerId = getOwnerId();

  const { data: existing, error: fetchErr } = await supabase
    .from('suggestion_reactions')
    .select('id')
    .eq('suggestion_id', suggestionId)
    .eq('owner_id', ownerId)
    .eq('reaction_type', type)
    .maybeSingle();

  if (fetchErr) {
    logError('toggleReaction:fetch', fetchErr);
    throw fetchErr;
  }

  if (existing) {
    const { error } = await supabase
      .from('suggestion_reactions')
      .delete()
      .eq('id', existing.id)
      .eq('owner_id', ownerId);
    if (error) {
      logError('toggleReaction:delete', error);
      throw error;
    }
    return { active: false };
  }

  const { error } = await supabase
    .from('suggestion_reactions')
    .insert({ suggestion_id: suggestionId, owner_id: ownerId, reaction_type: type });
  if (error) {
    logError('toggleReaction:insert', error);
    throw error;
  }
  return { active: true };
}

export async function fetchSuggestionComments(
  suggestionId: number
): Promise<SuggestionComment[]> {
  const { data, error } = await supabase
    .from('suggestion_comments')
    .select('id,suggestion_id,content,owner_id,created_at')
    .eq('suggestion_id', suggestionId)
    .order('created_at', { ascending: true });

  if (error) {
    logError('fetchSuggestionComments', error);
    throw error;
  }
  return (data as SuggestionComment[]) || [];
}

export async function addSuggestionComment(
  suggestionId: number,
  content: string
): Promise<SuggestionComment> {
  requireOnlineConnection();
  const trimmed = content.trim();
  if (!trimmed || trimmed.length > 300) {
    throw new Error('التعليق يجب أن يكون بين 1 و 300 حرف.');
  }

  const { data, error } = await supabase
    .from('suggestion_comments')
    .insert({
      suggestion_id: suggestionId,
      content: trimmed,
      owner_id: getOwnerId(),
    })
    .select()
    .single();

  if (error) {
    logError('addSuggestionComment', error);
    throw error;
  }
  return data as SuggestionComment;
}

export async function deleteSuggestionComment(
  commentId: number,
  ownerId: string
): Promise<void> {
  requireOnlineConnection();
  const { data, error } = await supabase
    .from('suggestion_comments')
    .delete()
    .eq('id', commentId)
    .eq('owner_id', ownerId)
    .select('id');

  if (error) {
    logError('deleteSuggestionComment', error);
    throw error;
  }
  if (!data || data.length === 0) {
    const err: any = new Error('تعذر حذف التعليق: تم حذف 0 صف.');
    err.code = 'DELETE_AFFECTED_0_ROWS';
    throw err;
  }
}

export function useSuggestionInteractions(suggestionIds: number[]) {
  const [summaries, setSummaries] = useState<Record<number, ReactionSummary>>({});
  const [commentsBySuggestion, setCommentsBySuggestion] = useState<Record<number, SuggestionComment[]>>({});
  const [loadingIds, setLoadingIds] = useState<Set<number>>(new Set());
  const [error, setError] = useState('');

  const loadReactions = useCallback(async () => {
    if (suggestionIds.length === 0) return;
    try {
      const results = await Promise.all(
        suggestionIds.map(id => fetchReactionSummary(id).catch(() => null))
      );
      const map: Record<number, ReactionSummary> = {};
      suggestionIds.forEach((id, i) => {
        if (results[i]) map[id] = results[i]!;
      });
      setSummaries(map);
    } catch (e: any) {
      logError('loadReactions', e);
      setError('تعذر تحميل التفاعلات.');
    }
  }, [suggestionIds]);

  const loadComments = useCallback(async (suggestionId: number) => {
    setLoadingIds(prev => new Set(prev).add(suggestionId));
    try {
      const rows = await fetchSuggestionComments(suggestionId);
      setCommentsBySuggestion(prev => ({ ...prev, [suggestionId]: rows }));
    } catch (e: any) {
      logError('loadComments', e);
      setCommentsBySuggestion(prev => ({ ...prev, [suggestionId]: [] }));
    } finally {
      setLoadingIds(prev => {
        const next = new Set(prev);
        next.delete(suggestionId);
        return next;
      });
    }
  }, []);

  const toggleReactionHandler = useCallback(
    async (suggestionId: number, type: ReactionType) => {
      setSummaries(prev => {
        const current = prev[suggestionId] || { total: 0, byType: {}, myReactions: [] };
        const isActive = current.myReactions.includes(type);
        const newMyReactions = isActive
          ? current.myReactions.filter(r => r !== type)
          : [...current.myReactions, type];
        const newByType = { ...current.byType };
        newByType[type] = Math.max(((newByType[type] || 0) + (isActive ? -1 : 1)), 0);
        const newTotal = Math.max(current.total + (isActive ? -1 : 1), 0);
        return {
          ...prev,
          [suggestionId]: { total: newTotal, byType: newByType, myReactions: newMyReactions },
        };
      });

      try {
        await toggleReaction(suggestionId, type);
      } catch (e) {
        try {
          const fresh = await fetchReactionSummary(suggestionId);
          setSummaries(prev => ({ ...prev, [suggestionId]: fresh }));
        } catch { /* تجاهل */ }
      }
    },
    []
  );

  const addCommentHandler = useCallback(
    async (suggestionId: number, content: string): Promise<SuggestionComment | null> => {
      try {
        const row = await addSuggestionComment(suggestionId, content);
        setCommentsBySuggestion(prev => ({
          ...prev,
          [suggestionId]: [...(prev[suggestionId] || []), row],
        }));
        return row;
      } catch (e) {
        logError('addCommentHandler', e);
        throw e;
      }
    },
    []
  );

  const deleteCommentHandler = useCallback(
    async (suggestionId: number, commentId: number, ownerId: string) => {
      try {
        await deleteSuggestionComment(commentId, ownerId);
        setCommentsBySuggestion(prev => ({
          ...prev,
          [suggestionId]: (prev[suggestionId] || []).filter(c => c.id !== commentId),
        }));
      } catch (e) {
        logError('deleteCommentHandler', e);
        throw e;
      }
    },
    []
  );

  return {
    summaries,
    commentsBySuggestion,
    loadingIds,
    error,
    loadReactions,
    loadComments,
    toggleReaction: toggleReactionHandler,
    addComment: addCommentHandler,
    deleteComment: deleteCommentHandler,
  };
}
