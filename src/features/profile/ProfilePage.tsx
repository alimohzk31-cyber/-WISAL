import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import {
  BriefcaseBusiness,
  Camera,
  Edit3,
  ExternalLink,
  Image as ImageIcon,
  Info,
  MapPin,
  Phone,
  Plus,
  Save,
  X,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import ProfileImageEditor from './ProfileImageEditor';
import {
  loadProfile,
  loadProfileJobs,
  loadProfileServices,
  saveProfileImage,
  saveProfileText,
  type ProfileImageKind,
  type ProfileJob,
  type ProfileService,
  type UserProfile,
} from './profileData';
import AddJobModal from '../jobs/AddJobModal';
import { useJobs } from '../jobs/useJobs';
import { useJobPresentation } from '../jobs/useJobPresentation';

const AddServiceModal = lazy(() => import('../../components/AddServiceModal'));

type EditorState = { kind: ProfileImageKind; src: string } | null;
type PostTab = 'services' | 'jobs';

const emptyDraft = {
  full_name: '', profession: '', governorate: '', area: '', phone: '', bio: '',
  whatsapp_url: '', facebook_url: '', instagram_url: '', tiktok_url: '',
};

function Field({ label, value, onChange, multiline = false, type = 'text' }: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  multiline?: boolean;
  type?: string;
}) {
  const common = {
    value,
    onChange: (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => onChange(event.target.value),
    className: 'w-full rounded-xl border border-[var(--input-border)] bg-[var(--input-bg)] px-3 py-2.5 text-sm font-bold text-[var(--text-primary)] outline-none transition focus:border-[#1978c7] focus:ring-2 focus:ring-[#1978c7]/15',
  };
  return <label className="block space-y-1 text-sm font-bold text-[var(--text-secondary)]"><span>{label}</span>{multiline ? <textarea {...common} rows={4} /> : <input {...common} type={type} />}</label>;
}

function ImageButton({ label, onClick, accent = false }: { label: string; onClick: () => void; accent?: boolean }) {
  return <button
    type="button"
    onClick={onClick}
    className={`absolute bottom-0 left-0 z-10 flex h-9 w-9 items-center justify-center rounded-full border-2 border-white shadow-lg transition hover:scale-105 ${accent ? 'bg-[#1978c7] text-white' : 'bg-white text-slate-700'}`}
    aria-label={label}
  ><Camera size={16} /></button>;
}

function ProfileInfoCard({ profile }: { profile: UserProfile }) {
  const location = [profile.governorate, profile.area].filter(Boolean).join(' - ');
  const contacts = [
    { label: 'واتساب', url: profile.whatsapp_url },
    { label: 'فيسبوك', url: profile.facebook_url },
    { label: 'إنستغرام', url: profile.instagram_url },
    { label: 'تيك توك', url: profile.tiktok_url },
  ].filter((item): item is { label: string; url: string } => Boolean(item.url?.trim()));

  return <section dir="rtl" className="rounded-[16px] border border-[#e4eaf1] bg-white p-4 shadow-[0_5px_18px_rgba(20,55,90,0.05)] sm:p-5">
    <div className="mb-5 flex items-center gap-2 border-b border-[#edf1f5] pb-3">
      <h2 className="text-lg font-black text-[#1b3552]">نبذة عني</h2>
      <Info className="h-4 w-4 text-[#7d91a6]" aria-hidden="true" />
    </div>
    <div className="space-y-3 text-sm font-bold text-[#61758b]">
      {profile.profession && <p className="flex items-center gap-2"><BriefcaseBusiness className="h-4 w-4 shrink-0 text-[#1978c7]" />{profile.profession}</p>}
      {location && <p className="flex items-center gap-2"><MapPin className="h-4 w-4 shrink-0 text-[#1978c7]" />{location}</p>}
      {profile.phone && <p className="flex items-center gap-2"><Phone className="h-4 w-4 shrink-0 text-[#1978c7]" /><span dir="ltr">{profile.phone}</span></p>}
      {profile.bio && <p className="whitespace-pre-wrap leading-7 text-[#6d7f91]">{profile.bio}</p>}
      {contacts.length > 0 && <div className="flex flex-wrap gap-2 border-t border-[#edf1f5] pt-4">
        {contacts.map(contact => <a key={contact.label} href={contact.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-full bg-[#eaf4ff] px-3 py-1.5 text-xs font-black text-[#1978c7] transition hover:bg-[#d9ecff]"><ExternalLink className="h-3.5 w-3.5" />{contact.label}</a>)}
      </div>}
      {!profile.profession && !location && !profile.phone && !profile.bio && contacts.length === 0 && <p className="text-[#8a9aaa]">لا توجد معلومات مضافة بعد.</p>}
    </div>
  </section>;
}

function ServiceCard({ service }: { service: ProfileService }) {
  return <article className="flex min-w-0 gap-3 rounded-[14px] border border-[#e7edf3] bg-[#fbfdff] p-3 transition hover:border-[#b9d9f4] hover:shadow-sm">
    <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-[#eaf4ff] text-[#1978c7]">{service.image_url ? <img src={service.image_url} alt="" className="h-full w-full object-cover" /> : <BriefcaseBusiness className="h-7 w-7" />}</div>
    <div className="min-w-0 flex-1">
      <h3 className="truncate text-sm font-black text-[#1b3552]">{service.title}</h3>
      {service.profession && <p className="mt-1 truncate text-xs font-bold text-[#6f8296]">{service.profession}</p>}
      {service.address && <p className="mt-1 flex items-center gap-1 truncate text-[11px] font-bold text-[#8a9aaa]"><MapPin className="h-3 w-3 shrink-0" />{service.address}</p>}
      {service.status && service.status !== 'approved' && <span className="mt-2 inline-flex rounded-full bg-[#fff5df] px-2 py-0.5 text-[10px] font-black text-[#a06b00]">بانتظار المراجعة</span>}
    </div>
  </article>;
}

function JobCard({ job }: { job: ProfileJob }) {
  const location = [job.governorate, job.area].filter(Boolean).join(' - ');
  const content = <article className="flex min-w-0 gap-3 rounded-[14px] border border-[#e7edf3] bg-[#fbfdff] p-3 transition hover:border-[#b9d9f4] hover:shadow-sm">
    <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-[#eaf4ff] text-[#1978c7]">{job.image ? <img src={job.image} alt="" className="h-full w-full object-cover" /> : <BriefcaseBusiness className="h-7 w-7" />}</div>
    <div className="min-w-0 flex-1">
      <h3 className="truncate text-sm font-black text-[#1b3552]">{job.title}</h3>
      <p className="mt-1 truncate text-xs font-bold text-[#6f8296]">{job.company}</p>
      {location && <p className="mt-1 flex items-center gap-1 truncate text-[11px] font-bold text-[#8a9aaa]"><MapPin className="h-3 w-3 shrink-0" />{location}</p>}
      {job.status !== 'approved' && <span className="mt-2 inline-flex rounded-full bg-[#fff5df] px-2 py-0.5 text-[10px] font-black text-[#a06b00]">بانتظار المراجعة</span>}
    </div>
  </article>;
  return job.status === 'approved' ? <a href={`#/jobs/${job.id}`} className="block">{content}</a> : content;
}

function EmptyPosts({ icon, message }: {
  icon: React.ReactNode;
  message: string;
}) {
  return <div className="flex min-h-[190px] flex-col items-center justify-center rounded-[14px] bg-[#fbfcfd] px-4 py-8 text-center">
    <span className="text-[#a8b7c5]">{icon}</span>
    <p className="mt-3 text-sm font-bold text-[#7b8d9f]">{message}</p>
  </div>;
}

function PostsCard({ services, jobs, postTab, setPostTab }: {
  services: ProfileService[];
  jobs: ProfileJob[];
  postTab: PostTab;
  setPostTab: (tab: PostTab) => void;
}) {
  return <section dir="rtl" className="rounded-[16px] border border-[#e4eaf1] bg-white p-4 shadow-[0_5px_18px_rgba(20,55,90,0.05)] sm:p-5">
    <div className="flex items-center border-b border-[#e6edf3]">
      {([['services', 'الخدمات'], ['jobs', 'الوظائف']] as const).map(([value, label]) => <button key={value} type="button" onClick={() => setPostTab(value)} className={`relative flex-1 py-3 text-sm font-black transition ${postTab === value ? 'text-[#1978c7]' : 'text-[#7e8fa1] hover:text-[#1b3552]'}`}>{label}{postTab === value && <span className="absolute inset-x-0 -bottom-px h-[3px] rounded-full bg-[#1978c7]" />}</button>)}
    </div>
    <div className="pt-5">
      {postTab === 'services' && (services.length > 0 ? <div className="grid gap-3 sm:grid-cols-2">{services.map(service => <ServiceCard key={service.id} service={service} />)}</div> : <EmptyPosts icon={<BriefcaseBusiness className="h-8 w-8" />} message="لا توجد خدمات بعد" />)}
      {postTab === 'jobs' && (jobs.length > 0 ? <div className="grid gap-3 sm:grid-cols-2">{jobs.map(job => <JobCard key={job.id} job={job} />)}</div> : <EmptyPosts icon={<BriefcaseBusiness className="h-8 w-8" />} message="لا توجد وظائف بعد" />)}
    </div>
  </section>;
}

export default function ProfilePage() {
  const [userId, setUserId] = useState<string | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [services, setServices] = useState<ProfileService[]>([]);
  const [jobs, setJobs] = useState<ProfileJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [editing, setEditing] = useState(false);
  const [addingPost, setAddingPost] = useState<PostTab | null>(null);
  const [postTab, setPostTab] = useState<PostTab>('services');
  const [draft, setDraft] = useState(emptyDraft);
  const [savingText, setSavingText] = useState(false);
  const [editor, setEditor] = useState<EditorState>(null);
  const [savingImage, setSavingImage] = useState(false);
  const avatarInput = useRef<HTMLInputElement>(null);
  const coverInput = useRef<HTMLInputElement>(null);
  const { addJob } = useJobs(false);
  const jobPresentation = useJobPresentation(addingPost === 'jobs');

  const loadPosts = useCallback(async (id: string) => {
    const [serviceResult, jobResult] = await Promise.all([loadProfileServices(id), loadProfileJobs(id)]);
    setServices(serviceResult.items);
    setJobs(jobResult.items);
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const { data, error } = await supabase.auth.getUser();
        if (error || !data.user) throw error ?? new Error('يجب تسجيل الدخول لعرض الملف الشخصي.');
        if (!active) return;
        setUserId(data.user.id);
        const loaded = await loadProfile(data.user.id);
        if (!active) return;
        setProfile(loaded);
        if (loaded) {
          setDraft({ full_name: loaded.full_name ?? '', profession: loaded.profession ?? '', governorate: loaded.governorate ?? '', area: loaded.area ?? '', phone: loaded.phone ?? '', bio: loaded.bio ?? '', whatsapp_url: loaded.whatsapp_url ?? '', facebook_url: loaded.facebook_url ?? '', instagram_url: loaded.instagram_url ?? '', tiktok_url: loaded.tiktok_url ?? '' });
          await loadPosts(data.user.id);
        }
      } catch (error) {
        if (active) setLoadError(error instanceof Error ? error.message : 'تعذر تحميل الملف الشخصي.');
      } finally { if (active) setLoading(false); }
    })();
    return () => { active = false; };
  }, [loadPosts]);

  const openPicker = (kind: ProfileImageKind) => { (kind === 'avatar' ? avatarInput : coverInput).current?.click(); };
  const onFileChange = (kind: ProfileImageKind, event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || !file.type.startsWith('image/')) return;
    if (editor) URL.revokeObjectURL(editor.src);
    setEditor({ kind, src: URL.createObjectURL(file) });
  };
  const closeEditor = () => { if (editor) URL.revokeObjectURL(editor.src); setEditor(null); };
  const saveImage = async (file: File) => {
    if (!userId || !editor) return;
    setSavingImage(true);
    try {
      const url = await saveProfileImage(userId, editor.kind, file);
      setProfile(current => current ? { ...current, [editor.kind === 'avatar' ? 'avatar_url' : 'cover_url']: url } : current);
      closeEditor();
    } catch (error) { window.alert(error instanceof Error ? error.message : 'تعذر حفظ الصورة.'); }
    finally { setSavingImage(false); }
  };
  const saveText = async (event: FormEvent) => {
    event.preventDefault();
    if (!userId) return;
    setSavingText(true);
    try { setProfile(await saveProfileText(userId, draft)); setEditing(false); }
    catch (error) { window.alert(error instanceof Error ? error.message : 'تعذر حفظ البيانات.'); }
    finally { setSavingText(false); }
  };

  if (loading) return <div className="mx-auto max-w-5xl px-4 py-10" dir="rtl"><div className="h-64 animate-pulse rounded-3xl bg-[var(--bg-secondary)]" /></div>;
  if (loadError) return <div className="mx-auto max-w-2xl px-4 py-14 text-center" dir="rtl"><div className="rounded-2xl border border-red-100 bg-red-50 p-6 font-bold text-red-700">{loadError}</div></div>;
  if (!profile) return <div className="mx-auto max-w-2xl px-4 py-14 text-center" dir="rtl"><div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-8 shadow-sm"><h1 className="text-xl font-black text-[var(--text-primary)]">لا يوجد ملف شخصي حالياً</h1><p className="mt-2 text-sm text-[var(--text-secondary)]">سيظهر الملف بعد إنشاء بياناته من النظام.</p></div></div>;

  const location = [profile.governorate, profile.area].filter(Boolean).join(' - ');
  const photos = (profile.portfolio_images ?? []).filter(Boolean);
  const initials = (profile.full_name ?? '؟').trim().slice(0, 1) || '؟';

  return <div className="w-full overflow-x-hidden bg-[var(--bg-primary)]" dir="rtl">
    <section className="border-b border-[#e3e9ef] bg-white">
      <div className="relative h-[180px] w-full overflow-hidden bg-[#e5edf5] sm:h-[260px] lg:h-[300px]">
        {profile.cover_url ? <img key={profile.cover_url} src={profile.cover_url} alt="غلاف الملف الشخصي" className="h-full w-full object-cover" /> : <div className="h-full w-full bg-gradient-to-l from-[#173b67] via-[#277ebc] to-[#a6d5ed]" />}
        <ImageButton label="تغيير صورة الغلاف" onClick={() => openPicker('cover')} />
      </div>
      <div className="mx-auto max-w-6xl px-4 sm:px-7">
        <div className="flex flex-col gap-4 pb-5 sm:-mt-20 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex min-w-0 items-end gap-3 sm:gap-4">
            <div className="relative shrink-0"><div className="h-28 w-28 overflow-hidden rounded-full border-4 border-white bg-[#eaf4ff] shadow-[0_5px_20px_rgba(22,66,110,0.2)] sm:h-36 sm:w-36">{profile.avatar_url ? <img key={profile.avatar_url} src={profile.avatar_url} alt="الصورة الشخصية" className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center text-4xl font-black text-[#1978c7]">{initials}</div>}</div><ImageButton label="تغيير الصورة الشخصية" onClick={() => openPicker('avatar')} accent /></div>
            <div className="min-w-0 pb-1 sm:pb-3"><h1 className="truncate text-xl font-black text-[#1b3552] sm:text-2xl">{profile.full_name || 'بدون اسم'}</h1>{location && <p className="mt-1 flex items-center gap-1 text-sm font-bold text-[#6f8296]"><MapPin className="h-4 w-4 shrink-0" />{location}</p>}{profile.profession && <p className="mt-1 truncate text-sm font-bold text-[#6f8296]">{profile.profession}</p>}</div>
          </div>
          <div className="flex items-center gap-2 sm:mb-3"><button type="button" onClick={() => setEditing(true)} className="inline-flex h-10 items-center gap-2 rounded-xl bg-[#1978c7] px-4 text-xs font-black text-white shadow-sm transition hover:bg-[#1266aa] sm:px-5 sm:text-sm"><Edit3 className="h-4 w-4" />تعديل الملف الشخصي</button><button type="button" onClick={() => setAddingPost(postTab)} className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#1978c7] text-white shadow-sm transition hover:bg-[#1266aa]" aria-label={postTab === 'services' ? 'إضافة خدمة' : 'إضافة وظيفة'} title={postTab === 'services' ? 'إضافة خدمة' : 'إضافة وظيفة'}><Plus className="h-5 w-5" /></button></div>
        </div>
      </div>
    </section>

    {photos.length > 0 && <section className="border-b border-[#e3e9ef] bg-white"><div className="mx-auto max-w-6xl px-4 py-3 sm:px-7"><div className="flex items-center gap-2"><ImageIcon className="h-4 w-4 text-[#1978c7]" /><h2 className="text-sm font-black text-[#1b3552]">الصور</h2></div><div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-5">{photos.map((url, index) => <img key={`${url}-${index}`} src={url} alt={`صورة ${index + 1}`} className="aspect-square w-full rounded-lg object-cover" />)}</div></div></section>}

    <main className="bg-[#f7f9fb] py-5 sm:py-7"><div className="mx-auto max-w-6xl px-3 sm:px-5"><div dir="ltr" className="grid items-start gap-5 lg:grid-cols-[minmax(280px,0.78fr)_minmax(0,1.7fr)]"><PostsCard services={services} jobs={jobs} postTab={postTab} setPostTab={setPostTab} /><aside dir="rtl" className="order-2 self-start lg:order-1"><ProfileInfoCard profile={profile} /></aside></div></div></main>

    <input ref={avatarInput} type="file" accept="image/*" className="sr-only" onChange={event => onFileChange('avatar', event)} /><input ref={coverInput} type="file" accept="image/*" className="sr-only" onChange={event => onFileChange('cover', event)} />
    {addingPost === 'services' && <Suspense fallback={null}><AddServiceModal onClose={() => setAddingPost(null)} onSaved={() => { if (userId) void loadPosts(userId); }} /></Suspense>}
    {addingPost === 'jobs' && <AddJobModal initialEmploymentType="كامل" categories={jobPresentation.categories} onClose={() => setAddingPost(null)} onSubmit={(job, media) => addJob(job, media, { requireOwner: true })} />}
    {editing && <div className="fixed inset-0 z-[400] flex items-center justify-center bg-slate-950/60 p-4" dir="rtl"><form onSubmit={saveText} className="max-h-[90dvh] w-full max-w-2xl overflow-auto rounded-3xl bg-[var(--surface)] p-5 shadow-2xl"><div className="mb-5 flex items-center justify-between"><h2 className="text-xl font-black text-[var(--text-primary)]">تعديل الملف الشخصي</h2><button type="button" onClick={() => setEditing(false)} className="text-[var(--text-secondary)]"><X /></button></div><div className="grid gap-4 sm:grid-cols-2"><Field label="الاسم" value={draft.full_name} onChange={value => setDraft({ ...draft, full_name: value })} /><Field label="المهنة" value={draft.profession} onChange={value => setDraft({ ...draft, profession: value })} /><Field label="المحافظة" value={draft.governorate} onChange={value => setDraft({ ...draft, governorate: value })} /><Field label="المنطقة" value={draft.area} onChange={value => setDraft({ ...draft, area: value })} /><Field label="الهاتف" value={draft.phone} onChange={value => setDraft({ ...draft, phone: value })} type="tel" /><Field label="WhatsApp" value={draft.whatsapp_url} onChange={value => setDraft({ ...draft, whatsapp_url: value })} /><Field label="Facebook" value={draft.facebook_url} onChange={value => setDraft({ ...draft, facebook_url: value })} /><Field label="Instagram" value={draft.instagram_url} onChange={value => setDraft({ ...draft, instagram_url: value })} /><Field label="TikTok" value={draft.tiktok_url} onChange={value => setDraft({ ...draft, tiktok_url: value })} /><div className="sm:col-span-2"><Field label="النبذة" value={draft.bio} onChange={value => setDraft({ ...draft, bio: value })} multiline /></div></div><div className="mt-5 flex justify-end"><button type="submit" disabled={savingText} className="inline-flex items-center gap-2 rounded-xl bg-[#1978c7] px-5 py-2.5 font-black text-white disabled:opacity-60"><Save size={16} />{savingText ? 'جارٍ الحفظ...' : 'حفظ التغييرات'}</button></div></form></div>}
    {editor && <ProfileImageEditor src={editor.src} kind={editor.kind} onCancel={closeEditor} onSave={saveImage} />}
    {savingImage && <div className="fixed bottom-5 left-5 z-[600] rounded-xl bg-slate-900 px-4 py-3 text-sm font-bold text-white">جارٍ حفظ الصورة...</div>}
  </div>;
}
