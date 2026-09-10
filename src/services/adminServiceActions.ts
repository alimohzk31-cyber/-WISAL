/**
 * services/adminServiceActions — طبقة عمليات الإدارة على الخدمات
 * -----------------------------------------------------------------------------
 * عمليات الموافقة والرفض تمر عبر دالة قاعدة البيانات admin_set_service_status
 * (SECURITY DEFINER) لأن سياسات RLS تمنع الدور العام من قراءة/تعديل الخدمات
 * غير المعتمدة — ولا نغيّر سياسات RLS نفسها.
 *
 * هذه الطبقة هي المكان الوحيد للاستدعاء: لا تكتب supabase.rpc داخل الصفحات.
 * -----------------------------------------------------------------------------
 */

import { supabase } from '../lib/supabase';
import { measureAdminOperation } from '../lib/adminPerformance';
import { isValidServiceId, mapRowToService } from '../hooks/useServices';
import { logSupabaseError } from '../hooks/useServices';
import type { Service } from '../types/models';

interface AdminSetStatusResult {
  error: { message: string; code?: string; details?: unknown; hint?: unknown } | null;
  data: unknown;
}

/** يغيّر حالة خدمة عبر admin_set_service_status ويعيد الصف المؤكد من الخادم. */
async function setServiceStatus(
  id: string | number,
  pStatus: 'approved' | 'rejected',
  pRejectionReason: string | null,
  context: string
): Promise<Service> {
  // تحقق صارم: فقط الـ id الرقمي الحقيقي من public.services — لا slug ولا قيمة فارغة.
  if (!isValidServiceId(id)) {
    const err = new Error(
      `setServiceStatus(${context}): معرّف الخدمة غير صالح (القيمة المستلمة: ${JSON.stringify(id)}). ` +
      'يجب استخدام الـ id الرقمي الحقيقي القادم من صف Supabase.'
    );
    console.error(`[Supabase:${context}]`, err.message);
    throw err;
  }

  const result = await measureAdminOperation(context, () =>
    supabase.rpc('admin_set_service_status', {
      p_id: Number(id),
      p_status: pStatus,
      p_rejection_reason: pRejectionReason,
    })
  ) as AdminSetStatusResult;

  if (result.error) {
    logSupabaseError(context, result.error);
    throw result.error;
  }
  if (!result.data) {
    const err = new Error(
      `${context}: لم يتم تحديث أي صف في public.services بالمعرّف id=${id}. ` +
      'قد يكون الصف غير موجود أو أن صلاحيات قاعدة البيانات (RLS) تمنع التعديل.'
    );
    console.error(`[Supabase:${context}]`, err.message);
    throw err;
  }

  // نطبّق فقط الصف المؤكد من الخادم (بدون إعادة قراءة القائمة كاملة).
  return mapRowToService(result.data);
}

/** الموافقة على خدمة (pending → approved). */
export function adminApproveService(id: string | number): Promise<Service> {
  return setServiceStatus(id, 'approved', null, 'admin.approve');
}

/** رفض خدمة (→ rejected) مع سبب اختياري. */
export function adminRejectService(id: string | number, rejectionReason: string | null = null): Promise<Service> {
  return setServiceStatus(id, 'rejected', rejectionReason, 'admin.reject');
}
