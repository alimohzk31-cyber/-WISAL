import { useEffect, useMemo, useRef, useState } from 'react';
import { BriefcaseBusiness, Check, Eye, Pencil, PlusCircle, Search, Trash2, X } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { employmentTypes, mapJob, whatsappFromSocialLinks } from './jobData';
import type { EmploymentType, Job, JobStatus, NewJob, NewJobMedia } from './types';
import { loadJobCategories, type JobCategory } from './admin/jobAdminApi';
import SafeImage from '../../components/SafeImage';
import AddJobModal from './AddJobModal';
import { removeUploadedJobMedia, uploadJobImage } from '../../lib/jobMediaUpload';

const ADMIN_JOBS_BASE_COLUMNS = 'id,title,company,specialty,category_id,description,governorate,area,employment_type,salary,experience,qualification,phone,image_url,created_at,status,rejection_reason,reviewed_at,reviewed_by,job_categories(name)';
const ADMIN_JOBS_MEDIA_COLUMNS = `${ADMIN_JOBS_BASE_COLUMNS},image_urls,video_url`;
const ADMIN_JOBS_COLUMNS = `${ADMIN_JOBS_MEDIA_COLUMNS},company_about,requirements,benefits,address,salary_negotiable,whatsapp,email,application_deadline,training_duration,training_paid,training_hiring_possible`;

async function loadAdminJobs() {
  let result: any = await supabase.from('jobs').select(ADMIN_JOBS_COLUMNS as any).order('created_at', { ascending: false });
  if (result.error && /company_about|requirements|benefits|salary_negotiable|training_duration|application_deadline/i.test(`${result.error.message} ${result.error.details || ''}`)) {
    result = await supabase.from('jobs').select(ADMIN_JOBS_MEDIA_COLUMNS as any).order('created_at', { ascending: false });
  }
  if (result.error && /image_urls|video_url/i.test(`${result.error.message} ${result.error.details || ''}`)) {
    result = await supabase.from('jobs').select(ADMIN_JOBS_BASE_COLUMNS as any).order('created_at', { ascending: false });
  }
  return result;
}

async function updateAdminJob(form: NewJob, current: Job, media: NewJobMedia) {
  const uploadedPaths: string[] = [];
  try {
    const uploadedImage = media.imageFile ? await uploadJobImage(media.imageFile) : undefined;
    if (uploadedImage) uploadedPaths.push(uploadedImage.path);
    const image = uploadedImage?.publicUrl || (media.removeImage ? null : current.image || null);
    const base = {
      title: form.title.trim(), company: form.company.trim() || form.title.trim(),
      specialty: form.specialty.trim(),
      governorate: form.governorate.trim(), area: form.area.trim(),
      employment_type: form.employmentType, salary: form.salary?.trim() || null,
      experience: form.experience?.trim() || null, phone: form.phone.trim(),
      image_url: image, category_id: form.categoryId || null,
    };
    const socialLinks = form.socialLinks?.trim() || '';
    const detailed = {
      ...base,
      requirements: form.requirements?.trim() || null,
      whatsapp: whatsappFromSocialLinks(socialLinks) || null,
      email: socialLinks || null,
    };
    const mediaColumns = uploadedImage || media.removeImage ? { image_urls: image ? [image] : [] } : {};
    let result = await supabase.from('jobs').update({ ...detailed, ...mediaColumns } as any).eq('id', current.id);
    const errorText = `${result.error?.message || ''} ${result.error?.details || ''}`;
    if (result.error && /image_urls/i.test(errorText)) {
      result = await supabase.from('jobs').update(detailed).eq('id', current.id);
    }
    const detailErrorText = `${result.error?.message || ''} ${result.error?.details || ''}`;
    if (result.error && /requirements|whatsapp|email/i.test(detailErrorText)) {
      result = await supabase.from('jobs').update(base).eq('id', current.id);
    }
    if (result.error) throw result.error;
  } catch (error) {
    await removeUploadedJobMedia(uploadedPaths);
    throw error;
  }
}

function JobMediaGallery({ job }: { job: Job }) {
  const images = job.images?.length ? job.images : job.image ? [job.image] : [];
  if (!images.length && !job.video) return null;
  return <div className="mt-4 space-y-3">
    {images.length ? <div className="grid grid-cols-3 gap-2">{images.map((image, index) => <SafeImage key={`${image}-${index}`} src={image} alt={`صورة الوظيفة ${index + 1}`} className="aspect-square w-full rounded-xl bg-[var(--bg-secondary)] object-contain" />)}</div> : null}
    {job.video ? <video src={job.video} controls preload="none" className="max-h-64 w-full rounded-xl bg-black object-contain" /> : null}
  </div>;
}

function Preview({ job, close }: { job: Job; close: () => void }) {
  return <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/60 p-4" onClick={close}><article className="max-h-[90dvh] w-full max-w-xl overflow-y-auto rounded-3xl bg-[var(--surface-elevated)] p-6" onClick={e=>e.stopPropagation()}><button onClick={close} className="float-left"><X/></button><h3 className="text-2xl font-black">{job.title}</h3><p className="font-bold">{job.company}</p><JobMediaGallery job={job} /><div className="mt-5 space-y-3"><p><b>القسم:</b> {job.categoryName||'غير محدد'}</p><p><b>الاختصاص:</b> {job.specialty}</p><p><b>الموقع:</b> {job.governorate} — {job.area}</p><p><b>الدوام:</b> {job.employmentType}</p><p className="whitespace-pre-wrap leading-8">{job.description}</p></div></article></div>;
}

function Editor({ job, categories, close, saved }: { job: Job; categories: JobCategory[]; close: () => void; saved: () => void }) {
  return <AddJobModal
    mode="edit"
    initialJob={job}
    categories={categories}
    onClose={close}
    onSubmit={async (form, media) => {
      await updateAdminJob(form, job, media);
      saved();
    }}
  />;
}

export default function JobsManager() {
  const [view,setView]=useState<'menu'|'recent'|'all'>('menu'); const [jobs,setJobs]=useState<Job[]>([]); const [categories,setCategories]=useState<JobCategory[]>([]); const [loading,setLoading]=useState(true); const [preview,setPreview]=useState<Job>(); const [editing,setEditing]=useState<Job>(); const [statusFilter,setStatusFilter]=useState<JobStatus|''>(''); const [categoryFilter,setCategoryFilter]=useState(''); const [typeFilter,setTypeFilter]=useState<EmploymentType|''>(''); const [query,setQuery]=useState(''); const started=useRef(false);
  const load=async()=>{setLoading(true);const[result,cats]=await Promise.all([loadAdminJobs(),loadJobCategories().catch(()=>[])]);setJobs((result.data||[]).map(mapJob));setCategories(cats);setLoading(false);};useEffect(()=>{if(!started.current){started.current=true;void load();}},[]);
  const status=async(job:Job,next:JobStatus)=>{const{error}=await supabase.from('jobs').update({status:next,reviewed_at:new Date().toISOString()}).eq('id',job.id);if(!error)setJobs(list=>list.map(item=>item.id===job.id?{...item,status:next}:item));};
  const shown=useMemo(()=>{const needle=query.trim().toLowerCase();return jobs.filter(job=>(view!=='recent'||job.status==='pending')&&(!statusFilter||job.status===statusFilter)&&(!categoryFilter||String(job.categoryId)===categoryFilter)&&(!typeFilter||job.employmentType===typeFilter)&&(!needle||`${job.title} ${job.company} ${job.specialty} ${job.governorate} ${job.area}`.toLowerCase().includes(needle)));},[jobs,view,statusFilter,categoryFilter,typeFilter,query]);
  if(view==='menu')return <div className="grid gap-4 md:grid-cols-2"><button onClick={()=>setView('recent')} className="rounded-3xl border bg-[var(--card)] p-8 text-right"><PlusCircle className="h-11 w-11 text-amber-500"/><h3 className="mt-4 text-xl font-black">الوظائف المضافة حديثًا</h3><p>{jobs.filter(j=>j.status==='pending').length} بانتظار المراجعة</p></button><button onClick={()=>setView('all')} className="rounded-3xl border bg-[var(--card)] p-8 text-right"><BriefcaseBusiness className="h-11 w-11 text-[var(--accent-primary)]"/><h3 className="mt-4 text-xl font-black">جميع الوظائف</h3><p>المعتمدة والمرفوضة والمعلقة</p></button></div>;
  return <section className="space-y-4"><div className="flex justify-between"><h3 className="text-xl font-black">{view==='recent'?'الوظائف المضافة حديثًا':'جميع الوظائف'}</h3><button onClick={()=>setView('menu')} className="rounded-xl border px-4 py-2">رجوع</button></div><div className="grid gap-2 sm:grid-cols-2"><label className="relative"><Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]"/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="بحث باسم الوظيفة أو الشركة" className="w-full rounded-xl border border-[var(--input-border)] bg-[var(--input-bg)] py-2.5 pr-9 pl-3"/></label><select value={typeFilter} onChange={e=>setTypeFilter(e.target.value as EmploymentType|'')} className="rounded-xl border border-[var(--input-border)] bg-[var(--input-bg)] p-2.5"><option value="">كل أنواع الوظائف</option>{employmentTypes.map(type=><option key={type} value={type}>{type}</option>)}</select></div>{view==='all'&&<div className="flex gap-2"><select value={statusFilter} onChange={e=>setStatusFilter(e.target.value as JobStatus|'')} className="rounded-xl border p-2"><option value="">كل الحالات</option><option value="pending">معلقة</option><option value="approved">معتمدة</option><option value="rejected">مرفوضة</option></select><select value={categoryFilter} onChange={e=>setCategoryFilter(e.target.value)} className="rounded-xl border p-2"><option value="">كل الأقسام</option>{categories.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></div>}{loading?<div className="h-40 animate-pulse rounded-2xl bg-[var(--bg-secondary)]"/>:shown.length===0?<p className="p-8 text-center">لا توجد وظائف.</p>:shown.map(job=><article key={job.id} className="rounded-2xl border bg-[var(--card)] p-4"><h4 className="font-black">{job.title}</h4><p>{job.company} — {job.categoryName||'غير محدد'}</p><div className="mt-3 flex flex-wrap gap-2"><button onClick={()=>setPreview(job)} className="rounded-xl p-2"><Eye/></button><button onClick={()=>setEditing(job)} className="rounded-xl p-2"><Pencil/></button>{job.status==='pending'&&<><button onClick={()=>status(job,'approved')} className="rounded-xl bg-emerald-600 px-3 text-white"><Check/>موافقة</button><button onClick={()=>status(job,'rejected')} className="rounded-xl bg-red-600 px-3 text-white"><X/>رفض</button></>}{view==='all'&&<><select value={job.status} onChange={e=>status(job,e.target.value as JobStatus)}><option value="pending">معلقة</option><option value="approved">معتمدة</option><option value="rejected">مرفوضة</option></select><button onClick={async()=>{if(confirm(`حذف «${job.title}»؟`)){await supabase.from('jobs').delete().eq('id',job.id);setJobs(list=>list.filter(j=>j.id!==job.id));}}}><Trash2 className="text-red-500"/></button></>}</div></article>)}{preview&&<Preview job={preview} close={()=>setPreview(undefined)}/>} {editing&&<Editor job={editing} categories={categories} close={()=>setEditing(undefined)} saved={()=>void load()}/>}</section>;
}
