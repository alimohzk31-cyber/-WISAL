import { Hourglass, XCircle } from 'lucide-react';
import type { ServiceStatus } from '../types/models';

type Variant = 'card' | 'detail';

interface Props {
  status: ServiceStatus;
  /** card: بادج صغير أعلى بطاقة الخدمة | detail: بادج فوق صورة صفحة التفاصيل */
  variant?: Variant;
  className?: string;
}

/**
 * شارة حالة الخدمة (بانتظار الموافقة / مرفوضة) — مكان وحيد للتصميم بدل
 * تكرار نفس الأصناف في CategoryPage و ServiceDetailModal وغيرهما.
 * تُعرض فقط للحالتين pending/rejected؛ المعتمدة بلا شارة.
 */
export default function ServiceStatusBadge({ status, variant = 'card', className = '' }: Props) {
  if (status !== 'pending' && status !== 'rejected') return null;

  const pending = status === 'pending';
  const position = variant === 'card'
    ? 'absolute top-2 right-2 z-20 text-[8px] md:text-[10px] px-1.5 py-0.5 rounded-md gap-1'
    : 'absolute top-4 left-4 z-10 text-xs md:text-sm px-3 py-1.5 rounded-xl gap-1.5 shadow-lg';
  const iconSize = variant === 'card' ? 'w-3 h-3' : 'w-4 h-4';

  return (
    <div
      className={`${position} ${pending ? 'bg-yellow-500/90' : 'bg-red-500/90'} text-white font-bold backdrop-blur-sm flex items-center ${className}`}
    >
      {pending
        ? <><Hourglass className={iconSize} aria-hidden="true" /> ⏳ بانتظار موافقة الإدارة</>
        : <><XCircle className={iconSize} aria-hidden="true" /> مرفوضة</>}
    </div>
  );
}
