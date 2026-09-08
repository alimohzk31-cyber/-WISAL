-- ============================================================
-- Saleen Services: دوال الإدارة للوحة الإدارة (دخول بكلمة مرور/PIN)
-- Run in: Supabase Dashboard → SQL Editor → New Query → Run
-- أو عبر: node scripts/_apply_admin_rpc.cjs
--
-- السبب:
--   لوحة الإدارة تُفتح بكلمة مرور إدارية (بدون حساب Supabase Auth)، لذا
--   عملياتها (قراءة المعلّقة/المرفوضة، الموافقة، الرفض، التعديل، الحذف)
--   تُنفَّذ عبر دوال SECURITY DEFINER بدل تعديل سياسات RLS الحالية.
--
-- ملاحظة أمنية (مهم):
--   بما أن الدخول برمز PIN (سري عميل ضعيف بطبيعته)، فإن هذه الدوال متاحة
--   لأي طلب يحمل مفتاح anon العام — نفس مستوى الثقة الذي يوفره الـ PIN نفسه.
--   سياسات RLS لجدول services لم تتغيّر إطلاقاً.
--   للتراجع لاحقاً: DROP FUNCTION public.admin_list_services(text),
--   admin_set_service_status(integer,text,text), admin_update_service(integer,jsonb),
--   admin_delete_service(integer);
-- ============================================================

-- 1) قائمة الخدمات حسب الحالة (لوحة الإدارة): الأحدث أولاً حسب created_at
CREATE OR REPLACE FUNCTION public.admin_list_services(p_status text DEFAULT NULL)
RETURNS SETOF public.services
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
    SELECT *
    FROM public.services
    WHERE (p_status IS NULL OR status = p_status)
    ORDER BY created_at DESC;
END;
$$;

-- 2) موافقة / رفض: تغيير الحالة + سبب الرفض + وقت المراجعة
CREATE OR REPLACE FUNCTION public.admin_set_service_status(
  p_id integer,
  p_status text,
  p_rejection_reason text DEFAULT NULL
) RETURNS public.services
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  updated public.services%ROWTYPE;
BEGIN
  IF p_status NOT IN ('pending', 'approved', 'rejected') THEN
    RAISE EXCEPTION 'status غير مسموح: %', p_status;
  END IF;

  UPDATE public.services
     SET status = p_status,
         rejection_reason = p_rejection_reason,
         reviewed_at = now(),
         updated_at = now()
   WHERE id = p_id
   RETURNING * INTO updated;

  RETURN updated;
END;
$$;

-- 3) تعديل خدمة (تعديل / نقل قسم): يسمح فقط بأعمدة معروفة (whitelist)
CREATE OR REPLACE FUNCTION public.admin_update_service(
  p_id integer,
  p_payload jsonb
) RETURNS public.services
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  updated public.services%ROWTYPE;
  k text;
BEGIN
  IF p_payload IS NULL OR p_payload = '{}'::jsonb THEN
    RAISE EXCEPTION 'payload must not be empty';
  END IF;

  FOR k IN SELECT jsonb_object_keys(p_payload) LOOP
    IF k NOT IN ('title','description','phone','image_url','status','slug',
                 'profession','address','latitude','longitude',
                 'category_id','category_slug','rejection_reason') THEN
      RAISE EXCEPTION 'عمود غير مسموح: %', k;
    END IF;
  END LOOP;

  UPDATE public.services SET
    title            = CASE WHEN p_payload ? 'title'            THEN p_payload->>'title'            ELSE title            END,
    description      = CASE WHEN p_payload ? 'description'      THEN p_payload->>'description'      ELSE description      END,
    phone            = CASE WHEN p_payload ? 'phone'            THEN p_payload->>'phone'            ELSE phone            END,
    image_url        = CASE WHEN p_payload ? 'image_url'        THEN p_payload->>'image_url'        ELSE image_url        END,
    status           = CASE WHEN p_payload ? 'status'           THEN p_payload->>'status'           ELSE status           END,
    slug             = CASE WHEN p_payload ? 'slug'             THEN p_payload->>'slug'             ELSE slug             END,
    profession       = CASE WHEN p_payload ? 'profession'       THEN p_payload->>'profession'       ELSE profession       END,
    address          = CASE WHEN p_payload ? 'address'          THEN p_payload->>'address'          ELSE address          END,
    latitude         = CASE WHEN p_payload ? 'latitude'         THEN (p_payload->>'latitude')::double precision         ELSE latitude         END,
    longitude        = CASE WHEN p_payload ? 'longitude'        THEN (p_payload->>'longitude')::double precision        ELSE longitude        END,
    category_id      = CASE WHEN p_payload ? 'category_id'      THEN p_payload->>'category_id'      ELSE category_id      END,
    category_slug    = CASE WHEN p_payload ? 'category_slug'    THEN p_payload->>'category_slug'    ELSE category_slug    END,
    rejection_reason = CASE WHEN p_payload ? 'rejection_reason' THEN p_payload->>'rejection_reason' ELSE rejection_reason END,
    updated_at       = now()
   WHERE id = p_id
   RETURNING * INTO updated;

  RETURN updated;
END;
$$;

-- 4) حذف خدمة (يعيد الصف المحذوف للتحقق)
CREATE OR REPLACE FUNCTION public.admin_delete_service(p_id integer)
RETURNS public.services
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  deleted public.services%ROWTYPE;
BEGIN
  DELETE FROM public.services WHERE id = p_id RETURNING * INTO deleted;
  RETURN deleted;
END;
$$;

-- 5) صلاحيات التنفيذ (متاحة للمفتاح العام anon + authenticated)
GRANT EXECUTE ON FUNCTION public.admin_list_services(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_service_status(integer, text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_update_service(integer, jsonb) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_delete_service(integer) TO anon, authenticated;
