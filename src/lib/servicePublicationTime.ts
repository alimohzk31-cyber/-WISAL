import type { Service } from '../types/models';

/**
 * وقت ظهور الخدمة للعامة. reviewed_at هو وقت قرار الإدارة الموجود حاليًا في
 * public.services؛ للخدمة المعتمدة يمثّل وقت النشر الفعلي. نبقي created_at
 * احتياطًا للصفوف القديمة التي سبقت إضافة reviewed_at.
 */
export function getServicePublicationTimestamp(service: Pick<Service, 'status' | 'reviewedAt' | 'createdAt'>): number {
  return service.status === 'approved' && Number.isFinite(service.reviewedAt)
    ? service.reviewedAt!
    : service.createdAt;
}

export function formatServiceRelativeTime(timestamp: number, now = Date.now()): string {
  if (!Number.isFinite(timestamp)) return 'الآن';
  // Epoch milliseconds represent the same instant in UTC and Iraq time؛ no
  // manual +3 hour adjustment is needed. Clamp future clock skew to "الآن".
  const elapsedSeconds = Math.max(0, Math.floor((now - timestamp) / 1000));
  if (elapsedSeconds < 45) return 'الآن';

  const minutes = Math.floor(elapsedSeconds / 60);
  if (minutes < 60) {
    if (minutes <= 1) return 'منذ دقيقة';
    if (minutes === 2) return 'منذ دقيقتين';
    if (minutes <= 10) return `منذ ${minutes} دقائق`;
    return `منذ ${minutes} دقيقة`;
  }

  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    if (hours === 1) return 'منذ ساعة';
    if (hours === 2) return 'منذ ساعتين';
    if (hours <= 10) return `منذ ${hours} ساعات`;
    return `منذ ${hours} ساعة`;
  }

  const days = Math.floor(hours / 24);
  if (days === 1) return 'أمس';
  if (days === 2) return 'منذ يومين';
  if (days <= 10) return `منذ ${days} أيام`;
  if (days < 30) return `منذ ${days} يومًا`;

  return new Intl.DateTimeFormat('ar-IQ', {
    day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Baghdad',
  }).format(new Date(timestamp));
}
