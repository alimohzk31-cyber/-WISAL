import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { mapJob, newJobRow } from './jobData';
import type { Job, NewJob } from './types';
import { offlineStore, OFFLINE_KEYS } from '../../lib/offlineStore';
import { APP_ONLINE_EVENT, requireOnlineConnection } from '../../lib/connectivity';
import { removeUploadedJobMedia, uploadJobImage, uploadJobVideo } from '../../lib/jobMediaUpload';
import type { NewJobMedia } from './types';

const JOBS_CACHE_TTL = 60_000;
let jobsCache: { jobs: Job[]; at: number; configured: boolean; error: boolean } | null = null;
let jobsRequest: Promise<typeof jobsCache> | null = null;
let jobMediaColumnsSupported: boolean | null = null;
let jobDetailColumnsSupported: boolean | null = null;

const JOBS_BASE_COLUMNS = 'id,title,company,specialty,category_id,description,governorate,area,employment_type,salary,experience,qualification,phone,image_url,created_at,status,job_categories(name)';
const JOBS_MEDIA_COLUMNS = 'image_urls,video_url';
const JOBS_DETAIL_COLUMNS = 'company_about,requirements,benefits,address,salary_negotiable,whatsapp,email,application_deadline,training_duration,training_paid,training_hiring_possible';

function isMissingMediaColumns(error: any): boolean {
  const detail = `${error?.message || ''} ${error?.details || ''}`;
  return /image_urls|video_url/i.test(detail) && ['42703', 'PGRST100', 'PGRST204'].includes(String(error?.code || ''));
}

function isMissingDetailColumns(error: any): boolean {
  const detail = `${error?.message || ''} ${error?.details || ''}`;
  return /company_about|requirements|benefits|salary_negotiable|application_deadline|training_duration|training_paid|training_hiring_possible|whatsapp|address/i.test(detail)
    && ['42703', 'PGRST100', 'PGRST204'].includes(String(error?.code || ''));
}

function selectedJobColumns() {
  return [
    JOBS_BASE_COLUMNS,
    jobMediaColumnsSupported === false ? '' : JOBS_MEDIA_COLUMNS,
    jobDetailColumnsSupported === false ? '' : JOBS_DETAIL_COLUMNS,
  ].filter(Boolean).join(',');
}

async function fetchApprovedJobs(force = false) {
  if (typeof navigator !== 'undefined' && !navigator.onLine) return jobsCache;
  if (!force && jobsCache && Date.now() - jobsCache.at < JOBS_CACHE_TTL) return jobsCache;
  if (jobsRequest) return jobsRequest;
  jobsRequest = (async () => {
    let result: any = await supabase.from('jobs')
      .select(selectedJobColumns() as any)
      .eq('status', 'approved').order('created_at', { ascending: false });
    if (result.error && jobDetailColumnsSupported !== false && isMissingDetailColumns(result.error)) {
      jobDetailColumnsSupported = false;
      result = await supabase.from('jobs').select(selectedJobColumns() as any)
        .eq('status', 'approved').order('created_at', { ascending: false });
    }
    if (result.error && jobMediaColumnsSupported !== false && isMissingMediaColumns(result.error)) {
      jobMediaColumnsSupported = false;
      result = await supabase.from('jobs').select(selectedJobColumns() as any)
        .eq('status', 'approved').order('created_at', { ascending: false });
    }
    if (!result.error) {
      if (jobMediaColumnsSupported !== false) jobMediaColumnsSupported = true;
      if (jobDetailColumnsSupported !== false) jobDetailColumnsSupported = true;
    }
    const { data, error } = result;
    const missing = error?.code === '42P01' || error?.code === 'PGRST205';
    jobsCache = {
      jobs: error ? jobsCache?.jobs ?? [] : (data || []).map(mapJob),
      at: error ? 0 : Date.now(),
      configured: !missing,
      error: Boolean(error && !missing),
    };
    if (!error) void offlineStore.setItem(OFFLINE_KEYS.JOBS, jobsCache)
      .catch(cacheError => console.warn('[Jobs] Cache write failed:', cacheError));
    return jobsCache;
  })();
  try { return await jobsRequest; } finally { jobsRequest = null; }
}

export function useJobs() {
  const [jobs, setJobs] = useState<Job[]>(() => jobsCache?.jobs ?? []);
  const [loading, setLoading] = useState(() => jobsCache === null);
  const [configured, setConfigured] = useState(() => jobsCache?.configured ?? true);
  const [error, setError] = useState(() => jobsCache?.error ?? false);
  const load = useCallback(async (force = false) => {
    if (!jobsCache) setLoading(true);
    try {
    const result = await fetchApprovedJobs(force);
    if (!result) return;
    setJobs(result.jobs); setConfigured(result.configured); setError(result.error); setLoading(false);
    } catch { setError(true); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => {
    let active = true;
    const initialize = async () => {
      if (!jobsCache) {
        const cached = await offlineStore.getItem<typeof jobsCache>(OFFLINE_KEYS.JOBS).catch(() => null);
        if (!active) return;
        if (cached) {
          jobsCache = cached;
          setJobs(cached.jobs); setConfigured(cached.configured); setError(false); setLoading(false);
        }
      }
      if (active) void load(true);
    };
    void initialize();
    const refreshOnline = () => { void load(true); };
    window.addEventListener('online', refreshOnline);
    window.addEventListener(APP_ONLINE_EVENT, refreshOnline);
    return () => {
      active = false;
      window.removeEventListener('online', refreshOnline);
      window.removeEventListener(APP_ONLINE_EVENT, refreshOnline);
    };
  }, [load]);
  useEffect(() => {
    const channel = supabase.channel(`public-jobs-live-${Math.random().toString(36).slice(2)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'jobs' }, () => { void load(true); })
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [load]);
  const addJob = async (job: NewJob, media: NewJobMedia = { imageFiles: [] }) => {
    requireOnlineConnection();
    if ((media.imageFiles.length || media.videoFile) && jobMediaColumnsSupported === false) {
      throw new Error('يلزم تنفيذ supabase_jobs_media_upgrade.sql لتفعيل صور وفيديو الوظائف.');
    }
    const uploadedPaths: string[] = [];
    try {
      const uploadedImages = await Promise.all(media.imageFiles.map(uploadJobImage));
      uploadedPaths.push(...uploadedImages.map(item => item.path));
      const uploadedVideo = media.videoFile ? await uploadJobVideo(media.videoFile) : undefined;
      if (uploadedVideo) uploadedPaths.push(uploadedVideo.path);
      const savedJob: NewJob = {
        ...job,
        image: uploadedImages[0]?.publicUrl,
        images: uploadedImages.map(item => item.publicUrl),
        video: uploadedVideo?.publicUrl,
      };
      let { error } = await supabase.from('jobs').insert(newJobRow(savedJob, true, true));
      if (error && isMissingDetailColumns(error)) {
        jobDetailColumnsSupported = false;
        ({ error } = await supabase.from('jobs').insert(newJobRow(savedJob, true, false)));
      }
      if (error && isMissingMediaColumns(error)) {
        jobMediaColumnsSupported = false;
        if (uploadedPaths.length) throw new Error('يلزم تنفيذ supabase_jobs_media_upgrade.sql لتفعيل صور وفيديو الوظائف.');
        ({ error } = await supabase.from('jobs').insert(newJobRow(savedJob, false, jobDetailColumnsSupported !== false)));
      }
      if (error) throw error;
      if (jobMediaColumnsSupported !== false) jobMediaColumnsSupported = true;
      if (jobDetailColumnsSupported !== false) jobDetailColumnsSupported = true;
    } catch (error) {
      await removeUploadedJobMedia(uploadedPaths);
      throw error;
    }
  };
  return { jobs, loading, configured, error, reload: () => load(true), addJob };
}
