import {
  Activity,
  Bell,
  BriefcaseBusiness,
  Compass,
  FolderOpen,
  Image as ImageIcon,
  Lightbulb,
  Link as LinkIcon,
  Settings,
  XCircle,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import type { AdminOverviewTab } from './AdminOverviewDashboard';

interface AdminSidebarProps {
  activeTab: AdminOverviewTab;
  pendingCount: number;
  rejectedCount: number;
  messageCount: number | null;
  notificationCount: number;
  jobCount: number | null;
  showIcons: boolean;
  onNavigate: (tab: AdminOverviewTab) => void;
  onOpenCategories: () => void;
  onOpenSettings: () => void;
}

function Badge({ count }: { count: number | null | undefined }) {
  if (count == null || count <= 0) return null;
  return <b className="wisal-side-nav__badge">{count > 99 ? '99+' : count}</b>;
}

function Item({
  label,
  icon: Icon,
  active,
  badge,
  onClick,
  showIcons,
}: {
  label: string;
  icon: typeof Activity;
  active?: boolean;
  badge?: number | null;
  onClick: () => void;
  showIcons: boolean;
}) {
  return (
    <button type="button" className={`wisal-side-nav__item${active ? ' is-active' : ''}`} onClick={onClick}>
      <Icon className={`wisal-side-nav__icon${showIcons ? '' : ' is-hidden'}`} size={19} strokeWidth={2} />
      <span>{label}</span>
      <Badge count={badge} />
    </button>
  );
}

export default function AdminSidebar({
  activeTab,
  pendingCount,
  rejectedCount,
  messageCount,
  notificationCount,
  jobCount,
  showIcons,
  onNavigate,
  onOpenCategories,
  onOpenSettings,
}: AdminSidebarProps) {
  return (
    <aside className="wisal-overview__sidebar" aria-label="تنقل الإدارة">
      <div className="wisal-brand">
        <img src={`${(import.meta as any).env.BASE_URL}wisal-header-logo.png`} alt="وصال" />
        <span>لوحة الإدارة</span>
      </div>
      <div className="wisal-sidebar-divider" />
      <nav className="wisal-side-nav">
        <Item label="نظرة عامة" icon={Activity} active={activeTab === 'overview'} showIcons={showIcons} onClick={() => onNavigate('overview')} />
        <Item label="الخدمات" icon={FolderOpen} active={activeTab === 'services'} showIcons={showIcons} onClick={() => onNavigate('services')} />
        <Item label="الخدمات المضافة حديثاً" icon={Bell} active={activeTab === 'pending'} badge={pendingCount} showIcons={showIcons} onClick={() => onNavigate('pending')} />
        <Item label="الخدمات المرفوضة" icon={XCircle} active={activeTab === 'rejected'} badge={rejectedCount} showIcons={showIcons} onClick={() => onNavigate('rejected')} />
        <Item label="إدارة السلايدر" icon={ImageIcon} active={activeTab === 'slider'} showIcons={showIcons} onClick={() => onNavigate('slider')} />
        <Item label="الأقسام" icon={Compass} active={activeTab === 'browse'} showIcons={showIcons} onClick={() => onNavigate('browse')} />
        <Item label="إدارة الأقسام" icon={FolderOpen} showIcons={showIcons} onClick={onOpenCategories} />
        <Item label="الوظائف" icon={BriefcaseBusiness} active={activeTab === 'jobs'} badge={jobCount} showIcons={showIcons} onClick={() => onNavigate('jobs')} />
        <Item label="الاقتراحات والشكاوى" icon={Lightbulb} active={activeTab === 'messages'} badge={messageCount} showIcons={showIcons} onClick={() => onNavigate('messages')} />
        <Item label="الإشعارات" icon={Bell} active={activeTab === 'notifications'} badge={notificationCount} showIcons={showIcons} onClick={() => onNavigate('notifications')} />
        <Item label="الإعدادات" icon={Settings} showIcons={showIcons} onClick={onOpenSettings} />
      </nav>
      <Link className="wisal-logout" to="/">
        <LinkIcon size={18} />
        العودة للتطبيق
      </Link>
    </aside>
  );
}
