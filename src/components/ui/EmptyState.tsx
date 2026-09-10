import { FolderOpen } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

interface Props {
  /** أيقونة الحالة (افتراضية: FolderOpen) */
  icon?: LucideIcon;
  title: string;
  subtitle?: string;
  /** عنصر إجراء اختياري (زر إضافة خدمة مثلاً) */
  action?: ReactNode;
  className?: string;
}

/** حالة فراغ موحدة — أيقونة + عنوان + وصف + إجراء اختياري (بدون صفحات فارغة ميتة). */
export default function EmptyState({ icon: Icon = FolderOpen, title, subtitle, action, className = 'py-20' }: Props) {
  return (
    <div role="status" className={`text-center space-y-4 ${className}`}>
      <div className="w-20 h-20 mx-auto rounded-full flex items-center justify-center bg-[var(--bg-secondary)]">
        <Icon className="w-10 h-10 text-[var(--text-muted)]" aria-hidden="true" />
      </div>
      <h3 className="text-xl font-bold text-[var(--text-primary)]">{title}</h3>
      {subtitle && <p className="font-medium text-[var(--text-muted)]">{subtitle}</p>}
      {action}
    </div>
  );
}
