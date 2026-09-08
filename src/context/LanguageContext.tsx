import React, { createContext, useContext, useState, ReactNode } from 'react';

type Language = 'ar';

interface Translations {
  [key: string]: {
    [lang in Language]: string;
  };
}

const translations: Translations = {
  'app_name': { ar: 'وصال | WISAL' },
  'emergency_call': { ar: 'اتصال بالطوارئ' },
  'emergency': { ar: 'طوارئ' },
  'admin_panel': { ar: 'لوحة الإدارة' },
  'settings': { ar: 'الإعدادات' },
  'appearance': { ar: 'المظهر' },
  'light': { ar: 'فاتح' },
  'dark': { ar: 'غامق' },
  'neon_color': { ar: 'لون النيون' },
  'language': { ar: 'اللغة' },
  'search_placeholder': { ar: 'ابحث عن قسم (مثال: صيدليات، مطاعم...)' },
  'no_sections_found': { ar: 'لا توجد أقسام مطابقة لبحثك' },
  'services_count': { ar: 'خدمة' },
  'add_service': { ar: 'إضافة خدمة' },
  'join_section': { ar: 'انضمام للقسم' },
  'pending_sync': { ar: 'قيد المزامنة (أوفلاين)' },
  'approved_services': { ar: 'خدمة معتمدة' },
  'no_services_yet': { ar: 'لا توجد خدمات مضافة في هذا القسم بعد' },
  'be_first': { ar: 'كن أول من ينضم ويضيف خدمته هنا!' },
  'call': { ar: 'اتصال' },
  'no_phone': { ar: 'لا يوجد رقم هاتف' },
  'google_maps': { ar: 'جوجل ماب' },
  'waze': { ar: 'ويز (Waze)' },
  'admin_login': { ar: 'تسجيل دخول الإدارة' },
  'password': { ar: 'كلمة المرور' },
  'login': { ar: 'دخول' },
  'cancel': { ar: 'إلغاء' },
  'system_admin': { ar: 'مدير النظام' },
  'full_permissions': { ar: 'صلاحيات كاملة' },
  'main_dashboard': { ar: 'اللوحة الرئيسية' },
  'pending_requests': { ar: 'الطلبات المعلقة' },
  'new_services_review': { ar: 'الخدمات المضافة حديثًا' },
  'slider_management': { ar: 'إدارة السلايدر' },
  'back_to_app': { ar: 'العودة للتطبيق' },
  'approve': { ar: 'موافقة' },
  'reject': { ar: 'رفض' },
  'edit': { ar: 'تعديل' },
  'delete': { ar: 'حذف' },
  'save_data': { ar: 'حفظ البيانات' },
  'profession': { ar: 'المهنة' },
  'experience': { ar: 'الخبرة / الوصف' },
  'location': { ar: 'الموقع' },
  'phone': { ar: 'رقم الهاتف' },
  'image_url': { ar: 'رابط الصورة' },
  'category': { ar: 'القسم' },
  'smart_guide': { ar: 'دليلك الذكي لكل' },
  'services': { ar: 'الخدمات' },
  'loading': { ar: 'جاري التحميل...' },
  'add_new_image': { ar: 'إضافة صورة جديدة' },
  'add_new_ad': { ar: 'إضافة إعلان جديد' },
  'edit_ad': { ar: 'تعديل الإعلان' },
  'save_ad': { ar: 'حفظ الإعلان' },
  'company_or_product_name': { ar: 'اسم الشركة أو المنتج' },
  'company_name_placeholder': { ar: 'مثال: شركة وصال للتجارة، مطعم الأمانة...' },
  'ad_display_date': { ar: 'تاريخ عرض الإعلان' },
  'ad_start_time': { ar: 'وقت بداية العرض' },
  'ad_end_time': { ar: 'وقت نهاية العرض' },
  'ad_images': { ar: 'صور الإعلان (1 إلى 5 صور)' },
  'status_active': { ar: 'نشط' },
  'status_upcoming': { ar: 'قادم' },
  'status_expired': { ar: 'منتهي' },
  'status_disabled': { ar: 'متوقف' },
  'preview': { ar: 'معاينة' },
  'preview_ad': { ar: 'معاينة الإعلان' },
  'confirm_delete_ad': { ar: 'هل أنت متأكد من حذف هذا الإعلان؟' },
  'no_ads_yet': { ar: 'لا توجد إعلانات مسجلة في السلايدر حالياً' },
  'image_title': { ar: 'النص التوضيحي' },
  'image_title_placeholder': { ar: 'عنوان الصورة...' },
  'save_image': { ar: 'حفظ الصورة' },
  'update_data': { ar: 'تحديث البيانات' },
  'incorrect_pin': { ar: 'الرقم السري غير صحيح' },
  'overview': { ar: 'نظرة عامة' },
  'no_pending_requests': { ar: 'لا توجد طلبات معلقة حالياً' },
  'unknown_section': { ar: 'قسم غير معروف' },
  'registered_services': { ar: 'خدمة مسجلة' },
  'add_new_service': { ar: 'إضافة خدمة جديدة' },
  'no_services_in_section': { ar: 'لا توجد خدمات في هذا القسم بعد' },
  'no_description': { ar: 'لا يوجد وصف' },
  'coordinates': { ar: 'الإحداثيات' },
  'move_to_section': { ar: 'نقل إلى قسم آخر' },
  'general_section': { ar: 'القسم العام' },
  'app_sections': { ar: 'أقسام التطبيق' },
  'total_services': { ar: 'إجمالي الخدمات' },
  'total_visits': { ar: 'إجمالي الزيارات' },
  'most_popular_services': { ar: 'الأقسام الأكثر نشاطاً' },
  'no_services_added': { ar: 'لم يتم إضافة أي خدمات بعد' },
  'browse_management': { ar: 'إدارة التصفح' },
  'add_new_section': { ar: 'إضافة قسم جديد' },
  'section': { ar: 'القسم' },
  'service_name_label': { ar: 'اسم الخدمة / المحل' },
  'service_name_placeholder': { ar: 'مثال: صيدلية الأمل' },
  'profession_label': { ar: 'المهنة / التخصص' },
  'profession_placeholder': { ar: 'مثال: صيدلي، طبيب، ميكانيكي...' },
  'experience_label': { ar: 'الوصف / الخبرة' },
  'experience_placeholder': { ar: 'اكتب نبذة عن الخدمة...' },
  'location_label': { ar: 'اسم المنطقة' },
  'location_placeholder': { ar: 'مثال: وسط البلد، حي الزهور...' },
  'coordinates_label': { ar: 'إحداثيات الموقع (اختياري)' },
  'coordinates_placeholder': { ar: 'خط العرض، خط الطول' },
  'get_current_location': { ar: 'تحديد موقعي الحالي' },
  'coordinates_help': { ar: 'يمكنك تحديد موقعك الحالي أو إدخال الإحداثيات يدوياً' },
  'phone_label': { ar: 'رقم الهاتف' },
  'optional': { ar: 'اختياري' },
  'service_image_label': { ar: 'صورة الخدمة' },
  'change_image': { ar: 'تغيير الصورة' },
  'delete_image': { ar: 'حذف الصورة' },
  'add_image_help': { ar: 'اضغط لإضافة صورة' },
  'image_quality_help': { ar: 'يفضل استخدام صور عالية الجودة' },
  'saving': { ar: 'جاري الحفظ...' },
  'edit_service': { ar: 'تعديل الخدمة' },
  'save_changes': { ar: 'حفظ التغييرات' },
  'slug_label': { ar: 'الاسم المعرف (Slug)' },
  'slug_placeholder': { ar: 'مثال: pharmacy-1' },
  'section_name_label': { ar: 'اسم القسم' },
  'section_name_placeholder': { ar: 'مثال: صيدليات' },
  'section_image_label': { ar: 'صورة القسم' },
  'upload_category_image': { ar: 'اضغط على أيقونة الصورة لإضافة صورة القسم' },
  'neon_color_label': { ar: 'لون النيون' },
  'section_icon_label': { ar: 'أيقونة القسم' },
  'add_section': { ar: 'إضافة القسم' },
  'image_too_large': { ar: 'حجم الصورة كبير جداً (الحد الأقصى 2 ميجابايت)' },
  'location_error': { ar: 'فشل في تحديد الموقع' },
  'browser_no_location': { ar: 'متصفحك لا يدعم تحديد الموقع' },
  'location_denied': { ar: 'تم رفض الإذن بالوصول للموقع. يرجى تفعيل الموقع في إعدادات التطبيق.' },
  'location_unavailable': { ar: 'معلومات الموقع غير متوفرة حالياً.' },
  'location_timeout': { ar: 'انتهت مهلة طلب تحديد الموقع.' },
  'supabase_error': { ar: 'خطأ في الاتصال بقاعدة البيانات' },
  'service_added_success': { ar: 'تم إضافة الخدمة بنجاح!' },
  'service_added_pending': { ar: 'تم إرسال الخدمة إلى الإدارة للموافقة عليها' },
  'add_service_error': { ar: 'حدث خطأ أثناء إضافة الخدمة' },
  'unknown_error': { ar: 'خطأ غير معروف' },
  'about_us': { ar: 'من نحن' },
  'project_brief': { ar: 'نبذة عن المشروع' },
  'project_description': { ar: 'وصال | WISAL هو دليل ذكي يهدف إلى تسهيل الوصول لجميع الخدمات الحيوية في منطقتك، من الرعاية الصحية إلى خدمات السيارات والتعليم، في منصة واحدة متكاملة.' },
  'about_goal': { ar: 'هدفنا' },
  'about_goal_desc': { ar: 'نهدف إلى بناء جسر تواصل فعال بين مقدمي الخدمات والمستفيدين، مع التركيز على السرعة، الدقة، وسهولة الوصول في حالات الطوارئ والاحتياجات اليومية.' },
  'about_team': { ar: 'الفريق القائم' },
  'about_team_desc': { ar: 'فريق شغوف من المطورين والمصممين الذين يسعون لتقديم أفضل تجربة مستخدم رقمية لخدمة المجتمع.' },
  'pending_approval': { ar: '⏳ بانتظار موافقة الإدارة' },
  'pending_status': { ar: 'بانتظار الموافقة' },
  'approved_status': { ar: 'معتمدة' },
  'rejected_status': { ar: 'مرفوضة' },
  'rejection_reason': { ar: 'سبب الرفض' },
  'my_services': { ar: 'خدماتي' },
  'rejected_services': { ar: 'الخدمات المرفوضة' },
  'no_rejected_services': { ar: 'لا توجد خدمات مرفوضة' },
  'no_pending_services': { ar: 'لا توجد خدمات بانتظار الموافقة' },
  'service_status': { ar: 'حالة الخدمة' },
};

interface LanguageContextType {
  language: Language;
  t: (key: string) => string;
  isRTL: boolean;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language] = useState<Language>('ar');

  const t = (key: string): string => {
    return translations[key]?.[language] || key;
  };

  const isRTL = true;

  return (
    <LanguageContext.Provider value={{ language, t, isRTL }}>
      <div dir="rtl">
        {children}
      </div>
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}
