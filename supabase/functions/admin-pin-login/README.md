# admin-pin-login

Edge Function (Server-side) لتحويل PIN الإدارة إلى جلسة Supabase Auth حقيقية.

## ماذا تفعل
1. تستقبل `{ pin }` فقط.
2. تتحقق من الـ PIN ضد Secret `ADMIN_PIN` (خادم فقط، بمقارنة ثابتة الزمن).
3. تسجّل الدخول بحساب الإدارة باستخدام `ADMIN_EMAIL` + `ADMIN_PASSWORD` (Secrets فقط).
4. تتحقق أن `public.profiles.id = session.user.id` و `role = 'admin'` (بالمعرّف، لا بالبريد).
5. عند النجاح تعيد `access_token` + `refresh_token` فقط.

## Secrets المطلوبة
| الاسم | الوصف |
|---|---|
| `ADMIN_PIN` | رمز دخول الإدارة (القيمة نفسها التي كانت في الواجهة — الآن Server-side فقط) |
| `ADMIN_EMAIL` | بريد حساب Supabase Auth الإداري |
| `ADMIN_PASSWORD` | كلمة مرور حساب Supabase Auth الإداري |
| `CORS_ORIGINS` | (اختياري) نطاقات إضافية مفصولة بفواصل، مثال: `https://app.example.com` |

لا تُضف أي قيمة من هذه القيم إلى `VITE_*` أو إلى الكود أو إلى Git.

## النشر (يدوي — مرة واحدة)
```bash
supabase functions deploy admin-pin-login --no-verify-jwt
supabase secrets set --env-file supabase/functions/admin-pin-login/.env.local
```

> - `--no-verify-jwt` ضروري: الواجهة تستدعي الدالة قبل وجود أي جلسة.
> - ملف `.env.local` محلي فقط ولا يُرفع إلى Git (انظر `.gitignore`: يستبعد `.env*`).
> - إنشاء الحساب الإداري: Supabase Dashboard → Authentication → Users → Add user،
>   ثم تأكد أن `public.profiles` يحتوي صفاً بـ `id = auth.uid()` و `role = 'admin'`
>   (أول مستخدم يُسجَّل يصبح admin تلقائياً عبر `handle_new_user`).

## اختبار بعد النشر
```bash
curl -X POST 'https://<project-ref>.supabase.co/functions/v1/admin-pin-login' \
  -H 'apikey: <ANON_KEY>' \
  -H 'Content-Type: application/json' \
  -d '{"pin":"<PIN>"}'
```

## ملاحظات أمنية
- القيم الحقيقية للـ Secrets لا تظهر أبداً في الاستجابة أو في السجلات.
- Rate limiting عبر Deno KV: 5 محاولات فاشلة لكل IP خلال 15 دقيقة → HTTP 429.
- عند فشل التحقق من الصلاحية تُبطل الجلسة المؤقتة (best-effort) ولا تُعاد التوكنات.