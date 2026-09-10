# عداد زيارات الخدمة — مقترح للمراجعة فقط

لم يُنفذ أي SQL، ولم تُعدّل Supabase أو RLS أو migrations.

## الموجود في المشروع

- `src/hooks/useServices.ts` يوثّق وجود `public.services.views` ومعرّف `id` من نوع integer في القاعدة. أصبح العرض يقرأ هذا الحقل الموجود.
- `src/hooks/useStats.ts` يستخدم `stats.visits` و`increment_visits()` لزيارات التطبيق العامة؛ لا يربطها بخدمة محددة، ولذلك بقي كما هو.
- لم نجد RPC لزيادة زيارات الخدمة في ملفات المشروع. تعذر الاتصال بالقاعدة الحية للتحقق من المخطط والدوال المنشورة؛ يجب التحقق قبل إنشاء أي دالة. لا نقترح جدولاً أو عموداً جديداً.

## أقل تغيير مقترح

إذا تأكد وجود `services.views` وعدم وجود دالة مكافئة، فالمطلوب دالة واحدة تزيد الحقل الموجود وتعيد العدد الجديد ذرياً. إذا كانت هناك دالة مكافئة منشورة، نستخدمها بدلاً من إنشاء هذه الدالة.

استعلامات التحقق التالية للقراءة فقط، ولم تُنفذ:

```sql
select column_name, data_type, column_default, is_nullable
from information_schema.columns
where table_schema = 'public' and table_name = 'services'
  and column_name in ('id', 'views');

select p.proname, pg_get_function_identity_arguments(p.oid) as arguments,
       pg_get_functiondef(p.oid) as definition
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.prokind = 'f'
  and (p.proname ilike '%view%' or p.proname ilike '%visit%');
```

الدالة المقترحة للمراجعة، وليست migration أو سكربت تشغيل:

```sql
begin;

create function public.increment_service_views(p_service_id integer)
returns bigint
language sql
security definer
set search_path = ''
as $$
  update public.services
     set views = coalesce(views, 0) + 1
   where id = p_service_id
     and status = 'approved'
  returning views::bigint;
$$;

revoke all on function public.increment_service_views(integer) from public;
grant execute on function public.increment_service_views(integer) to anon, authenticated;

commit;
```

`SECURITY DEFINER` يمنح زيادة محدودة لعداد خدمة معتمدة فقط، دون إعطاء الواجهة صلاحية تحديث بقية حقول الخدمة أو تغيير سياسات RLS. لا تقبل الدالة عدداً يحدده العميل ولا تعدل حالة الموافقة. لا تُنفذ لخدمة غير معتمدة. يجب مراجعة الدوال والمحفزات الموجودة على جدول الخدمات قبل اعتمادها. إذا لم يوجد `views` فعلياً، نتوقف لإعادة تحديد أقل تعديل مطلوب، ولا ننشئ عموداً تلقائياً.

## حالة التفعيل

الزيادة **معطلة افتراضياً**؛ تعرض الواجهة قيمة `views` المتاحة، أو «عدد الزيارات غير متاح» عند غيابها، ولا تخترع صفراً أو عداداً محلياً. بعد مراجعة الدالة وتثبيتها يدوياً فقط، يمكن ضبط `VITE_SERVICE_VIEWS_RPC_ENABLED=true` في بيئة البناء وإعادة البناء لتفعيل الربط المعد مسبقاً.

عند التفعيل: دخول التفاصيل يرسل طلب زيادة واحداً بالمعرّف الحقيقي. إعادة الفتح وRefresh والعودة إلى التفاصيل عبر Forward زيارات جديدة، وإعادة عرض React أو تكرار effects في StrictMode لا يضاعف الزيارة. لا توجد زيادة عند ظهور البطاقة في التصفح. لا نعيد محاولة طلب الزيادة تلقائياً عند فشل الشبكة، لأن الطلب قد يكون نُفذ وفُقد رده؛ لذلك لا يُضمن احتساب الدخول بلا اتصال.

## التنقل

التصفح ← معاينة الخدمة ← `/service/:serviceId` (الخدمة المطابقة فقط).

يوضع مسار القسم الموجود خلف التفاصيل في سجل التنقل، ضمن حدث الضغط نفسه، لتعمل أزرار الرجوع في المتصفح والتطبيق. تُحفظ `categoryId` و`categorySlug` كما وردتا في الخدمة، ومسار القسم يُستخرج من دليل الأقسام الحالي. الرجوع الأول يظهر القسم/الفرع، والرجوع اللاحق يتبع المسار الحالي للتطبيق. الروابط المباشرة دون سجل سابق تستخدم قسم الخدمة كوجهة زر الرجوع داخل التفاصيل.

عداد الزيارات في آخر محتوى `ServiceDetailModal`، أسفل التفاصيل وأزرار الاتصال والموقع، بصيغة مثل `👁 1,250 زيارة`.
