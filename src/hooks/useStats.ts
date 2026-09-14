import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { isOnlineConnection } from '../lib/connectivity';

export function useStats(loadStats = true) {
  const [stats, setStats] = useState({ visits: 0, downloads: 0 });

  useEffect(() => {
    if (loadStats) fetchStats();
  }, [loadStats]);

  const fetchStats = async () => {
    try {
      const { data, error } = await supabase
        .from('stats')
        .select('id,visits,downloads')
        .eq('id', 1)
        .single();
        
      if (error) {
        if (error.code === 'PGRST116') return; // Ignore not found error
        if (error.code === 'PGRST205') {
          console.warn('Stats table not found, skipping stats fetch.');
          return;
        }
        throw error;
      }
      
      if (data) {
        setStats({ visits: data.visits, downloads: data.downloads });
      }
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const incrementVisits = async () => {
    if (!isOnlineConnection()) return;
    try {
      const { error } = await supabase.rpc('increment_visits');
      if (error) {
        if (error.code === 'PGRST202') {
          console.warn('increment_visits function not found, skipping increment.');
          return;
        }
        throw error;
      }
      
      // Optimistic update
      setStats(prev => ({ ...prev, visits: prev.visits + 1 }));
    } catch (error) {
      console.error('Error incrementing visits:', error);
    }
  };

  return { stats, incrementVisits };
}
