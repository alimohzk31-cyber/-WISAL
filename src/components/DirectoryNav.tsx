import { BriefcaseBusiness, Compass, LayoutGrid } from 'lucide-react';
import { Link } from 'react-router-dom';

export type DirectoryView = 'browse' | 'services' | 'jobs';

interface DirectoryNavProps {
  activeView: DirectoryView;
  onHomeViewChange?: (view: 'browse' | 'services') => void;
}

/** Shared navigation kept directly below the content slider on directory pages. */
export default function DirectoryNav({ activeView, onHomeViewChange }: DirectoryNavProps) {
  const itemClass = (active: boolean) => `flex flex-1 items-center justify-center gap-1 whitespace-nowrap rounded-xl px-1.5 py-3 text-[11px] font-bold transition-colors sm:gap-2 sm:px-4 sm:text-sm ${active ? 'bg-[var(--accent-primary)] text-white shadow-sm' : 'text-[var(--text-muted)] hover:bg-[var(--accent-soft)] hover:text-[var(--text-primary)]'}`;

  return <nav className="relative z-10 mx-auto -mt-4 flex w-full max-w-2xl rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)] p-1.5 shadow-[var(--shadow-lg)]" aria-label="التنقل الرئيسي">
    {onHomeViewChange ? <button type="button" onClick={() => onHomeViewChange('browse')} aria-pressed={activeView === 'browse'} className={itemClass(activeView === 'browse')}><Compass className="h-4 w-4 shrink-0 sm:h-5 sm:w-5" />التصفح</button> : <Link to="/?view=browse" aria-current={activeView === 'browse' ? 'page' : undefined} className={itemClass(activeView === 'browse')}><Compass className="h-4 w-4 shrink-0 sm:h-5 sm:w-5" />التصفح</Link>}
    {onHomeViewChange ? <button type="button" onClick={() => onHomeViewChange('services')} aria-pressed={activeView === 'services'} className={itemClass(activeView === 'services')}><LayoutGrid className="h-4 w-4 shrink-0 sm:h-5 sm:w-5" />الخدمات</button> : <Link to="/?view=services" aria-current={activeView === 'services' ? 'page' : undefined} className={itemClass(activeView === 'services')}><LayoutGrid className="h-4 w-4 shrink-0 sm:h-5 sm:w-5" />الخدمات</Link>}
    <Link to="/jobs" aria-current={activeView === 'jobs' ? 'page' : undefined} className={itemClass(activeView === 'jobs')}><BriefcaseBusiness className="h-4 w-4 shrink-0 sm:h-5 sm:w-5" />البحث عن وظيفة</Link>
  </nav>;
}
