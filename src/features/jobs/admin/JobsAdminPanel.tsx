import { useState } from 'react';
import { BriefcaseBusiness, FileUser, Images, LayoutGrid } from 'lucide-react';
import JobsManager from '../JobsManager';
import JobSlidesAdmin from './JobSlidesAdmin';
import JobCategoriesAdmin from './JobCategoriesAdmin';
import JobApplicationsAdmin from './JobApplicationsAdmin';
export default function JobsAdminPanel(){const[tab,setTab]=useState<'slides'|'categories'|'jobs'|'applications'>('slides');const tabs=[['slides','السلايدر',Images],['categories','الأقسام',LayoutGrid],['jobs','الوظائف',BriefcaseBusiness],['applications','الطلبات',FileUser]] as const;return <section className="space-y-5"><h2 className="text-2xl font-black">إدارة الوظائف</h2><div className="grid grid-cols-2 gap-2 rounded-2xl bg-[var(--bg-secondary)] p-2 sm:grid-cols-4">{tabs.map(([id,label,Icon])=><button key={id} onClick={()=>setTab(id)} className={`flex items-center justify-center gap-2 rounded-xl px-3 py-3 font-bold ${tab===id?'bg-[var(--accent-primary)] text-white':'text-[var(--text-secondary)]'}`}><Icon className="h-5 w-5"/>{label}</button>)}</div>{tab==='slides'?<JobSlidesAdmin/>:tab==='categories'?<JobCategoriesAdmin/>:tab==='applications'?<JobApplicationsAdmin/>:<JobsManager/>}</section>}
