import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useNotifications } from './useNotifications';

interface AdminDashboardCounts {
  pendingJobs: number | null;
  messages: number | null;
  notifications: number;
}

async function countPendingJobs(): Promise<number> {
  const { count, error } = await supabase
    .from('jobs')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'pending');

  if (error) throw error;
  return count ?? 0;
}

async function countSuggestions(): Promise<number> {
  const { count, error } = await supabase
    .from('comments')
    .select('id', { count: 'exact', head: true });

  if (error) throw error;
  return count ?? 0;
}

async function countNewComplaints(): Promise<number> {
  const { count, error } = await supabase
    .from('contact_messages')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'new');

  if (error) throw error;
  return count ?? 0;
}

/** Counts used only by the admin dashboard navigation badges. */
export function useAdminDashboardCounts(): AdminDashboardCounts {
  const { unreadCount: notifications } = useNotifications();
  const [counts, setCounts] = useState<Omit<AdminDashboardCounts, 'notifications'>>({
    pendingJobs: null,
    messages: null,
  });

  const refresh = useCallback(async () => {
    const [jobsResult, suggestionsResult, complaintsResult] = await Promise.allSettled([
      countPendingJobs(),
      countSuggestions(),
      countNewComplaints(),
    ]);

    const getResult = (result: PromiseSettledResult<number>, name: string): number | null => {
      if (result.status === 'fulfilled') return result.value;
      console.warn(`[AdminDashboard] Could not count ${name}:`, result.reason);
      return null;
    };

    const pendingJobs = getResult(jobsResult, 'pending jobs');
    const suggestions = getResult(suggestionsResult, 'suggestions');
    const complaints = getResult(complaintsResult, 'new complaints');

    setCounts({
      pendingJobs,
      // Keep a partial count visible if one source is temporarily unavailable;
      // a completely unavailable section stays without a misleading zero badge.
      messages: suggestions === null && complaints === null
        ? null
        : (suggestions ?? 0) + (complaints ?? 0),
    });
  }, []);

  useEffect(() => {
    let active = true;
    let inFlight = false;
    let refreshAgain = false;

    const runRefresh = async () => {
      if (!active) return;
      if (inFlight) {
        refreshAgain = true;
        return;
      }
      inFlight = true;
      try {
        await refresh();
      } finally {
        inFlight = false;
        if (active && refreshAgain) {
          refreshAgain = false;
          void runRefresh();
        }
      }
    };

    const refreshVisible = () => {
      if (!document.hidden) void runRefresh();
    };

    void runRefresh();
    const timer = window.setInterval(refreshVisible, 30000);
    window.addEventListener('focus', refreshVisible);
    window.addEventListener('online', refreshVisible);
    document.addEventListener('visibilitychange', refreshVisible);

    const channel = supabase
      .channel('admin-dashboard-counts')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'jobs' }, refreshVisible)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'comments' }, refreshVisible)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'contact_messages' }, refreshVisible)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'admin_notifications' }, refreshVisible)
      .subscribe();

    return () => {
      active = false;
      clearInterval(timer);
      window.removeEventListener('focus', refreshVisible);
      window.removeEventListener('online', refreshVisible);
      document.removeEventListener('visibilitychange', refreshVisible);
      void supabase.removeChannel(channel);
    };
  }, [refresh]);

  return { ...counts, notifications };
}
