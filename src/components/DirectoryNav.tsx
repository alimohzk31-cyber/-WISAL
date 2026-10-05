import { BriefcaseBusiness, Compass, PanelsTopLeft } from 'lucide-react';
import { Link } from 'react-router-dom';

export type DirectoryView = 'browse' | 'services' | 'jobs';

interface DirectoryNavProps {
  activeView: DirectoryView;
  onHomeViewChange?: (view: 'browse' | 'services') => void;
}

/** Shared navigation kept directly below the content slider on directory pages. */
export default function DirectoryNav({ activeView, onHomeViewChange }: DirectoryNavProps) {
  const itemClass = (active: boolean) => `flex min-w-0 flex-1 items-center justify-center gap-1 rounded-xl px-1 py-2.5 text-center text-[10px] font-bold leading-tight transition-colors sm:gap-2 sm:px-4 sm:py-3 sm:text-sm ${active ? 'bg-[var(--accent-primary)] text-white shadow-sm' : 'text-[var(--text-muted)] hover:bg-[var(--accent-soft)] hover:text-[var(--text-primary)]'}`;

  return <nav className="relative z-10 mx-auto -mt-4 flex w-full min-w-0 max-w-2xl rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)] p-1.5 shadow-[var(--shadow-lg)]" aria-label="التنقل الرئيسي">
    {onHomeViewChange ? <button type="button" onClick={() => onHomeViewChange('browse')} aria-pressed={activeView === 'browse'} className={itemClass(activeView === 'browse')}><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-current/10 sm:h-8 sm:w-8"><Compass className="h-4 w-4 sm:h-5 sm:w-5" strokeWidth={1.8} aria-hidden="true" /></span>التصفح</button> : <Link to="/?view=browse" aria-current={activeView === 'browse' ? 'page' : undefined} className={itemClass(activeView === 'browse')}><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-current/10 sm:h-8 sm:w-8"><Compass className="h-4 w-4 sm:h-5 sm:w-5" strokeWidth={1.8} aria-hidden="true" /></span>التصفح</Link>}
    {onHomeViewChange ? <button type="button" onClick={() => onHomeViewChange('services')} aria-pressed={activeView === 'services'} className={itemClass(activeView === 'services')}><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-current/10 sm:h-8 sm:w-8"><PanelsTopLeft className="h-4 w-4 sm:h-5 sm:w-5" strokeWidth={1.8} aria-hidden="true" /></span>الخدمات</button> : <Link to="/?view=services" aria-current={activeView === 'services' ? 'page' : undefined} className={itemClass(activeView === 'services')}><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-current/10 sm:h-8 sm:w-8"><PanelsTopLeft className="h-4 w-4 sm:h-5 sm:w-5" strokeWidth={1.8} aria-hidden="true" /></span>الخدمات</Link>}
    <Link to="/jobs" aria-current={activeView === 'jobs' ? 'page' : undefined} className={itemClass(activeView === 'jobs')}><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-current/10 sm:h-8 sm:w-8"><BriefcaseBusiness className="h-4 w-4 sm:h-5 sm:w-5" strokeWidth={1.8} aria-hidden="true" /></span>البحث عن وظيفة</Link>
  </nav>;
}
