import { Clock3 } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { Service } from '../types/models';
import { formatServiceRelativeTime, getServicePublicationTimestamp } from '../lib/servicePublicationTime';

export default function ServicePublicationTime({
  service,
  className = '',
}: {
  service: Pick<Service, 'status' | 'reviewedAt' | 'createdAt'>;
  className?: string;
}) {
  const timestamp = getServicePublicationTimestamp(service);
  const [, refresh] = useState(0);

  // يعيد حساب «الآن / منذ دقيقة» دون إعادة تحميل الصفحة.
  useEffect(() => {
    const timer = window.setInterval(() => refresh(value => value + 1), 30_000);
    return () => window.clearInterval(timer);
  }, [timestamp]);

  return (
    <time
      dateTime={new Date(timestamp).toISOString()}
      title={new Intl.DateTimeFormat('ar-IQ', {
        dateStyle: 'long', timeStyle: 'short', timeZone: 'Asia/Baghdad',
      }).format(new Date(timestamp))}
      className={`flex items-center gap-1 ${className}`}
    >
      <Clock3 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      {formatServiceRelativeTime(timestamp)}
    </time>
  );
}
