-- ============================================================
-- Saleen Services: secure admin RPC source definitions.
-- Deployment source of truth: supabase_admin_security_hardening.sql
--
-- السبب:
--   لوحة الإدارة تُفتح بكلمة مرور إدارية (بدون حساب Supabase Auth)، لذا
--   عملياتها (قراءة المعلّقة/المرفوضة، الموافقة، الرفض، التعديل، الحذف)
--   تُنفَّذ فقط بجلسة Auth حقيقية تحقق public.is_admin().
--
-- لا تُمنح أي دالة هنا إلى anon. كل دالة تفحص is_admin() صراحةً، وتعمل
-- بصلاحيات المستدعي حتى تبقى RLS فعالة.
-- ============================================================

-- 1) قائمة الخدمات حسب الحالة (لوحة الإدارة): الأحدث أولاً حسب created_at
CREATE OR REPLACE FUNCTION public.admin_list_services(p_status text DEFAULT NULL)
RETURNS SETOF public.services
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'admin authorization required' USING ERRCODE = '42501';
  END IF;
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
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  updated public.services%ROWTYPE;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'admin authorization required' USING ERRCODE = '42501';
  END IF;
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
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  updated public.services%ROWTYPE;
  k text;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'admin authorization required' USING ERRCODE = '42501';
  END IF;
  IF p_payload IS NULL OR p_payload = '{}'::jsonb THEN
    RAISE EXCEPTION 'payload must not be empty';
  END IF;

  FOR k IN SELECT jsonb_object_keys(p_payload) LOOP
    IF k NOT IN ('title','description','phone','image_url','status','slug',
                 'profession','address','latitude','longitude',
                 'category_id','category_slug','rejection_reason',
                 'whatsapp_phone','facebook_url','instagram_url','tiktok_url') THEN
      RAISE EXCEPTION 'عمود غير مسموح: %', k;
    END IF;
  END LOOP;

  UPDATE public.services SET
    title            = CASE WHEN p_payload ? 'title'            THEN p_payload->>'title'            ELSE title            END,
    description      = CASE WHEN p_payload ? 'description'      THEN p_payload->>'description'      ELSE description      END,
    phone            = CASE WHEN p_payload ? 'phone'            THEN p_payload->>'phone'            ELSE phone            END,
    whatsapp_phone   = CASE WHEN p_payload ? 'whatsapp_phone'   THEN p_payload->>'whatsapp_phone'   ELSE whatsapp_phone   END,
    facebook_url     = CASE WHEN p_payload ? 'facebook_url'     THEN p_payload->>'facebook_url'     ELSE facebook_url     END,
    instagram_url    = CASE WHEN p_payload ? 'instagram_url'    THEN p_payload->>'instagram_url'    ELSE instagram_url    END,
    tiktok_url       = CASE WHEN p_payload ? 'tiktok_url'       THEN p_payload->>'tiktok_url'       ELSE tiktok_url       END,
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
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  deleted public.services%ROWTYPE;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'admin authorization required' USING ERRCODE = '42501';
  END IF;
  DELETE FROM public.services WHERE id = p_id RETURNING * INTO deleted;
  RETURN deleted;
END;
$$;

-- 5) التنفيذ متاح فقط لحامل JWT، ثم تتحقق كل دالة من is_admin().
REVOKE ALL ON FUNCTION public.admin_list_services(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_set_service_status(integer, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_update_service(integer, jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_delete_service(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_list_services(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_service_status(integer, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_update_service(integer, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_delete_service(integer) TO authenticated;
