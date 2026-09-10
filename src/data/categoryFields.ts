import { categories } from './categories';
import type { SectionFieldConfig } from '../types/models';
/**
 * إعدادات حقول نموذج "إضافة خدمة" لكل قسم.
 * الشكل (SectionFieldConfig) مُعرَّف مركزياً في types/models — المصدر الوحيد
 * للأنواع. CategoryFieldConfig هنا اسم بديل للتوافق مع الاستيرادات الحالية.
 *
 * طريقتان لتعريف إعدادات قسم:
 *   1) القديمة: مفتاح في CATEGORY_FIELDS أدناه (الأقسام الموجودة).
 *   2) المفضلة للأقسام الجديدة: تضمين `fields: { ... }` داخل بيانات القسم
 *      نفسه في data/categories.ts — مكان واحد فقط.
 * أولوية القراءة (في getCategoryFieldConfig): CATEGORY_FIELDS ثم fields
 * المضمّنة ثم الإعداد العام.
 */
export type CategoryFieldConfig = SectionFieldConfig;
export type { SectionFieldConfig };

/** الإعداد العام لأي قسم لم يُعرَّف له إعداد خاص */
export const GENERIC_FIELD_CONFIG: CategoryFieldConfig = {
  nameLabel: 'اسم الخدمة / المحل',
  namePlaceholder: 'مثال: اسم الخدمة أو المحل',
  profession: '',
  specialties: [],
};

export const CATEGORY_FIELDS: Record<string, CategoryFieldConfig> = {
  // ===== الصحة =====
  pharmacy: {
    nameLabel: 'اسم الصيدلية',
    namePlaceholder: 'مثال: صيدلية الأمل',
    profession: 'صيدلي',
    professionLabel: 'نوع خدمات الصيدلية',
    experienceLabel: 'نبذة عن الصيدلية وخدماتها',
    experiencePlaceholder: 'عرّف بالصيدلية والخدمات المتوفرة ومواعيد العمل.',
    locationLabel: 'عنوان الصيدلية',
    locationPlaceholder: 'المنطقة، الشارع، وأقرب نقطة دالة',
    phoneLabel: 'رقم التواصل مع الصيدلية',
    registration: {
      phoneRequired: true,
      images: { min: 1, max: 5 },
      fields: [
        { key: 'pharmacistName', label: 'اسم صاحب الصيدلية / الصيدلي', placeholder: 'الاسم الكامل', type: 'text', required: true },
        { key: 'credential', label: 'شهادة أو كتاب ممارسة المهنة', placeholder: 'اسم الشهادة أو رقم الكتاب والجهة المانحة', type: 'text', required: true, attachment: true },
        { key: 'governorate', label: 'المحافظة', placeholder: 'مثال: بغداد', type: 'text', required: true },
        { key: 'area', label: 'المنطقة', placeholder: 'المنطقة، الشارع، وأقرب نقطة دالة', type: 'text', required: true },
        { key: 'experienceYears', label: 'سنوات الخبرة', placeholder: 'مثال: 5', type: 'number', required: true, min: 0 },
        { key: 'features', label: 'مميزات الصيدلية والخدمات التي تقدمها', placeholder: 'اذكر الخدمات المتوفرة ومواعيد العمل وما يميز صيدليتك.', type: 'textarea', required: true },
      ],
    },
    specialties: ['صيدلية عامة', 'صيدلية مجانية', 'مستلزمات طبية', 'مستحضرات تجميل طبية', 'صيدلية مراكز طبية'],
  },
  hospital: {
    nameLabel: 'اسم المستشفى',
    namePlaceholder: 'مثال: مستشفى النور',
    profession: 'طبيب',
    specialties: ['طب عام', 'جراحة عامة', 'طب أطفال', 'طب نسائية وتوليد', 'طب باطني', 'طوارئ'],
  },
  clinic: {
    nameLabel: 'اسم العيادة',
    namePlaceholder: 'مثال: عيادة الشفاء الطبية',
    profession: 'طبيب',
    specialties: ['طب عام', 'طب أطفال', 'جلدية', 'أنف وأذن وحنجرة', 'قلب', 'مخ وأعصاب', 'عظام'],
  },
  dentist: {
    nameLabel: 'اسم العيادة',
    namePlaceholder: 'مثال: عيادة الابتسامة لطب الأسنان',
    profession: 'طبيب أسنان',
    professionLabel: 'تخصص طب الأسنان',
    experienceLabel: 'الخبرات والخدمات الطبية',
    experiencePlaceholder: 'اذكر خبراتك والخدمات التي تقدمها في العيادة ومواعيد استقبال المرضى.',
    locationLabel: 'عنوان العيادة',
    specialties: [
      'تقويم الأسنان',
      'جراحة الفم والأسنان',
      'طب أسنان الأطفال',
      'علاج الجذور',
      'تركيبات الأسنان',
      'تجميل الأسنان',
      'تنظيف وتبييض الأسنان',
    ],
  },
  lab: {
    nameLabel: 'اسم المختبر',
    namePlaceholder: 'مثال: مختبر التحاليل الدقيقة',
    profession: 'أخصائي مختبرات',
    specialties: ['تحاليل دم', 'تحاليل هرمونات', 'فحص بصري', 'أشعة', 'تحاليل وراثية', 'فحص دوري عام'],
  },
  beauty: {
    nameLabel: 'اسم المركز',
    namePlaceholder: 'مثال: مركز الجمال للتجميل',
    profession: 'خبير تجميل',
    specialties: ['عناية بالبشرة', 'مكياج وسهرة', 'قص وتصفيف شعر', 'عناية بالأظافر', 'حمام مغربي'],
  },
  physio: {
    nameLabel: 'اسم المركز',
    namePlaceholder: 'مثال: مركز الحياة للعلاج الطبيعي',
    profession: 'أخصائي علاج طبيعي',
    specialties: ['علاج إصابات رياضية', 'تأهيل ما بعد الجراحة', 'علاج آلام الظهر والرقبة', 'تأهيل حركي للأطفال'],
  },

  // ===== القانونية =====
  lawyer: {
    nameLabel: 'اسم المكتب / المحامي',
    namePlaceholder: 'مثال: مكتب العدل للمحاماة',
    profession: 'محامي',
    specialties: ['قضايا مدنية', 'قضايا تجارية', 'قضايا عمالية', 'قضايا عقارية', 'قضايا أحوال شخصية', 'تحكيم'],
  },
  'legal-consult': {
    nameLabel: 'اسم المكتب الاستشاري',
    namePlaceholder: 'مثال: مكتب الرأي للاستشارات القانونية',
    profession: 'مستشار قانوني',
    specialties: ['استشارات تجارية', 'استشارات عقود', 'صياغة عقود', 'استشارات عمالية', 'تأسيس شركات'],
  },

  // ===== السيارات =====
  'car-sales': {
    nameLabel: 'اسم السيارة / الإعلان',
    namePlaceholder: 'مثال: سيارة للبيع',
    profession: 'كوري',
    professionLabel: 'منشأ السيارة',
    experienceLabel: 'تفاصيل السيارة والإعلان',
    experiencePlaceholder: 'اذكر الموديل وسنة الصنع والحالة وأبرز تفاصيل العرض.',
    allowCustomSpecialty: false,
    specialties: ['كوري', 'ياباني', 'صيني', 'إيراني', 'أمريكي'],
  },
  'bike-sales': {
    nameLabel: 'اسم الدراجة / الإعلان',
    namePlaceholder: 'مثال: دراجة نارية للبيع',
    profession: 'دراجات نارية',
    professionLabel: 'نوع الدراجة',
    specialties: ['دراجات نارية', 'دراجات هوائية', 'سكوترات', 'دراجات كهربائية', 'قطع غيار وإكسسوارات'],
  },
  'car-repair': {
    nameLabel: 'اسم الورشة',
    namePlaceholder: 'مثال: ورشة الأمل لصيانة السيارات',
    profession: 'فني سيارات / ميكانيكي',
    specialties: ['ميكانيك', 'كهرباء سيارات', 'تكييف وتبريد', 'برمجة سيارات', 'تبديل زيوت', 'عجلات وميزان', 'سمكرة ودهان', 'فحص دوري شامل'],
  },

  // ===== سفر واتصالات =====
  airlines: {
    nameLabel: 'اسم الشركة',
    namePlaceholder: 'مثال: شركة الأجنحة للطيران',
    profession: 'وكيل حجوزات طيران',
    specialties: ['تذاكر محلية', 'تذاكر دولية', 'شحن جوي', 'برامج المسافر الدائم'],
  },
  'travel-agency': {
    nameLabel: 'اسم المكتب',
    namePlaceholder: 'مثال: مكتب الرحلات للسياحة والسفر',
    profession: 'مستشار سفر',
    specialties: ['برامج سياحية', 'حج وعمرة', 'تأشيرات سفر', 'حجوزات فنادق', 'رحلات جماعية'],
  },
  insurance: {
    nameLabel: 'اسم الشركة',
    namePlaceholder: 'مثال: شركة الأمان للتأمين',
    profession: 'مندوب تأمين',
    specialties: ['تأمين سيارات', 'تأمين صحي', 'تأمين حياة', 'تأمين عقاري', 'تأمين سفر'],
  },
  telecom: {
    nameLabel: 'اسم الشركة / الفرع',
    namePlaceholder: 'مثال: فرع شركة الاتصالات',
    profession: 'مندوب مبيعات اتصالات',
    specialties: ['خطوط جديدة', 'باقات بيانات', 'دفع فواتير', 'أجهزة وأسعار خاصة'],
  },
  internet: {
    nameLabel: 'اسم الشركة / المزود',
    namePlaceholder: 'مثال: خدمات النت السريع',
    profession: 'فني شبكات',
    specialties: ['اشتراك إنترنت منزلي', 'إنترنت شركات', 'تركيب شبكات WiFi', 'صيانة شبكات'],
  },

  // ===== التعليم =====
  school: {
    nameLabel: 'اسم المدرسة',
    namePlaceholder: 'مثال: مدرسة الفرقان الخاصة',
    profession: 'إدارة مدرسية',
    specialties: ['رياض أطفال', 'تعليم أساسي', 'تعليم ثانوي', 'منهج دولي', 'أنشطة لا صفية'],
  },
  university: {
    nameLabel: 'اسم الجامعة',
    namePlaceholder: 'مثال: جامعة المستقبل',
    profession: 'إدارة جامعية',
    specialties: ['كليات علمية', 'كليات أدبية', 'دراسات عليا', 'برامج دبلوم', 'قبول وتسجيل'],
  },
  institute: {
    nameLabel: 'اسم المعهد',
    namePlaceholder: 'مثال: معهد المهارات للتدريب',
    profession: 'مدرب معتمد',
    specialties: ['دورات لغة إنجليزية', 'دورات حاسوب', 'دورات مهنية', 'تدريب مبرمجين', 'مهارات إدارية'],
  },
  tutor: {
    nameLabel: 'اسم المدرس / المركز',
    namePlaceholder: 'مثال: أ. محمد للرياضيات',
    profession: 'مدرس خصوصي',
    specialties: ['رياضيات', 'فيزياء', 'كيمياء', 'أحياء', 'لغة عربية', 'لغة إنجليزية', 'تحفيظ قرآن'],
  },

  // ===== رياضة وترفيه =====
  football: {
    nameLabel: 'اسم الملعب',
    namePlaceholder: 'مثال: ملعب النجمة',
    profession: 'مشرف ملعب',
    specialties: ['ملعب عشب طبيعي', 'ملعب عشب صناعي', 'ملاعب صالات', 'تدريبات خاصة', 'بطولات'],
  },
  gym: {
    nameLabel: 'اسم الصالة',
    namePlaceholder: 'مثال: صالة القوة الرياضية',
    profession: 'مدرب لياقة',
    specialties: ['كمال أجسام', 'لياقة عامة', 'تمارين نسائية', 'كارديو', 'مدرب شخصي', 'تغذية رياضية'],
  },
  pool: {
    nameLabel: 'اسم المسبح',
    namePlaceholder: 'مثال: مسبح الأزرق',
    profession: 'مشرف مسبح',
    specialties: ['سباحة تعليمية', 'سباحة نسائية', 'سباحة أطفال', 'تأهيل مائي', 'حجز خاص'],
  },
  'kids-area': {
    nameLabel: 'اسم المركز',
    namePlaceholder: 'مثال: مدينة الأطفال الترفيهية',
    profession: 'مشرف ترفيه',
    specialties: ['ألعاب ميكانيكية', 'ألعاب أطفال', 'حفلات أعياد ميلاد', 'ترفيه تعليمي'],
  },
  park: {
    nameLabel: 'اسم الحديقة',
    namePlaceholder: 'مثال: حديقة السلام العامة',
    profession: 'إدارة حديقة',
    specialties: ['مناطق نزهة عائلية', 'مقاهٍ ومطاعم', 'ملاعب أطفال', 'مسارات مشي', 'حجوزات حفلات'],
  },

  // ===== تسوق =====
  supermarket: {
    nameLabel: 'اسم السوبر ماركت',
    namePlaceholder: 'مثال: ماركت الرحمة',
    profession: 'إدارة متجر',
    specialties: ['مواد غذائية', 'خضار وفواكه', 'منظفات', 'معلبات', 'توصيل منازل'],
  },
  mall: {
    nameLabel: 'اسم المول',
    namePlaceholder: 'مثال: مول المدينة',
    profession: 'إدارة مول',
    specialties: ['محلات أزياء', 'مطاعم وكافيهات', 'ترفيه', 'موقف سيارات', 'فعاليات'],
  },
  clothes: {
    nameLabel: 'اسم المحل',
    namePlaceholder: 'مثال: محل الأناقة للملابس',
    profession: 'بائع ملابس',
    specialties: ['ملابس رجالية', 'ملابس نسائية', 'ملابس أطفال', 'أزياء رياضية', 'ملابس تقليدية'],
  },
  electronics: {
    nameLabel: 'اسم المحل',
    namePlaceholder: 'مثال: مركز الإلكترونيات الحديثة',
    profession: 'بائع إلكترونيات',
    specialties: ['حواسيب ولابتوب', 'تلفزيونات', 'أجهزة منزلية', 'ملحقات', 'صيانة إلكترونيات'],
  },
  phones: {
    nameLabel: 'اسم المحل',
    namePlaceholder: 'مثال: معرض الهواتف الذكية',
    profession: 'بائع هواتف',
    specialties: ['بيع هواتف جديدة', 'هواتف مستعملة', 'صيانة هواتف', 'ملحقات', 'شاشات وبطاريات'],
  },

  // ===== مطاعم =====
  restaurant: {
    nameLabel: 'اسم المطعم',
    namePlaceholder: 'مثال: مطعم الأصالة',
    profession: 'مدير مطعم',
    specialties: ['مأكولات شرقية', 'مأكولات غربية', 'مشاوي', 'مأكولات بحرية', 'توصيل طلبات', 'حجوزات عائلية'],
  },
  cafe: {
    nameLabel: 'اسم الكافيه',
    namePlaceholder: 'مثال: كافيه الرصيف',
    profession: 'مدبر كافيه',
    specialties: ['قهوة مختصة', 'شاي ومشروبات ساخنة', 'عصائر طبيعية', 'حلويات', 'جلسات خارجية'],
  },
  'fast-food': {
    nameLabel: 'اسم المحل',
    namePlaceholder: 'مثال: سناك تايم',
    profession: 'مدبر مطعم سريع',
    specialties: ['برجر', 'بيتزا', 'دجاج مقرمش', 'ساندويشات', 'توصيل سريع'],
  },
  sweets: {
    nameLabel: 'اسم المحل',
    namePlaceholder: 'مثال: حلويات الشرق',
    profession: 'حلواني',
    specialties: ['حلويات شرقية', 'حلويات غربية', 'كيك ومناسبات', 'شوكولا', 'بوفيه حلويات'],
  },

  // ===== خدمات منزلية =====
  electrician: {
    nameLabel: 'اسم الخدمة / الفني',
    namePlaceholder: 'مثال: الفني الكهربائي الموثوق',
    profession: 'كهربائي',
    specialties: ['تمديدات كهربائية', 'صيانة أعطال', 'لوحات توزيع', 'إنارة LED', 'مولدات كهربائية'],
  },
  plumber: {
    nameLabel: 'اسم الخدمة / الفني',
    namePlaceholder: 'مثال: الفني للسباكة والتمديدات',
    profession: 'سباك',
    specialties: ['تمديدات مياه', 'كشف تسربات', 'صيانة خزانات', 'علاج انسداد مجاري', 'تركيب سخانات'],
  },
  cleaning: {
    nameLabel: 'اسم الشركة',
    namePlaceholder: 'مثال: شركة النظافة الشاملة',
    profession: 'عامل نظافة محترف',
    specialties: ['تنظيف منازل', 'تنظيف واجهات زجاج', 'تنظيف مكاتب', 'تنظيف سجاد وموكيت', 'تعقيم'],
  },
  'appliance-repair': {
    nameLabel: 'اسم الورشة / الفني',
    namePlaceholder: 'مثال: ورشة صيانة الأجهزة الحديثة',
    profession: 'فني صيانة أجهزة',
    specialties: ['صيانة ثلاجات', 'صيانة غسالات', 'صيانة أفران', 'صيانة مكيفات', 'صيانة شاشات'],
  },
  carpenter: {
    nameLabel: 'اسم الورشة / النجار',
    namePlaceholder: 'مثال: ورشة النجار الماهر',
    profession: 'نجار',
    specialties: ['أثاث منزلي', 'مطابخ خشبية', 'أبواب ونوافذ', 'أدراج وديكور', 'إصلاح أثاث'],
  },

  // ===== خدمات عامة =====
  mosque: {
    nameLabel: 'اسم المسجد',
    namePlaceholder: 'مثال: مسجد الرحمن',
    profession: 'إدارة مسجد',
    specialties: ['صلوات جمعة', 'دورات تحفيظ', 'دروس دينية', 'إفطار صائمين'],
  },
  government: {
    nameLabel: 'اسم المركز',
    namePlaceholder: 'مثال: مركز الخدمات الحكومية',
    profession: 'موظف خدمات',
    specialties: ['وثائق رسمية', 'جوازات وتأشيرات', 'سجل مدني', 'معاملات أراضي'],
  },
  police: {
    nameLabel: 'اسم المركز',
    namePlaceholder: 'مثال: مركز شرطة الحي',
    profession: 'جهاز شرطة',
    specialties: ['بلاغات طوارئ', 'شهادات حسن سيرة وسلوك', 'فقدان وثائق', 'بلاغات مرورية'],
  },
  'gas-station': {
    nameLabel: 'اسم المحطة',
    namePlaceholder: 'مثال: محطة الوقود الوطنية',
    profession: 'مشرف محطة',
    specialties: ['بنزين', 'ديزل', 'تبديل زيوت', 'غسيل سيارات', 'متجر مرفق'],
  },
  'post-office': {
    nameLabel: 'اسم المكتب',
    namePlaceholder: 'مثال: مكتب البريد المركزي',
    profession: 'موظف بريد',
    specialties: ['إرسال بريد', 'طرود سريعة', 'بريد مسجل', 'شحن دولي', 'صناديق بريدية'],
  },

  // ===== أعمال وشركات =====
  construction: {
    nameLabel: 'اسم الشركة',
    namePlaceholder: 'مثال: شركة البناء للمقاولات',
    profession: 'مقاول',
    specialties: ['بناء مباني', 'أعمال حفر', 'خرسانة مسبقة', 'تشطيبات', 'إشراف هندسي'],
  },
  software: {
    nameLabel: 'اسم الشركة',
    namePlaceholder: 'مثال: شركة التقنية للبرمجيات',
    profession: 'مطور برمجيات',
    specialties: ['تطوير مواقع', 'تطبيقات موبايل', 'أنظمة إدارية', 'متاجر إلكترونية', 'دعم فني'],
  },
  design: {
    nameLabel: 'اسم الشركة / المصمم',
    namePlaceholder: 'مثال: استوديو الإبداع للتصميم',
    profession: 'مصمم جرافيك',
    specialties: ['هوية بصرية', 'تصميم شعارات', 'موشن جرافيك', 'تصميم إعلانات', 'تصميم مطبوعات'],
  },
  'real-estate': {
    nameLabel: 'اسم المكتب',
    namePlaceholder: 'مثال: مكتب العقار الموثوق',
    profession: 'وسيط عقاري',
    specialties: ['بيع عقارات', 'إيجار شقق', 'أراضي', 'مكاتب تجارية', 'تقييم عقاري'],
  },
};

/** يعيد إعداد الحقول للقسم المحدد: الخريطة القديمة ثم fields المضمّنة في بيانات القسم ثم الإعداد العام */
// The live category uses clothing; keep its real slug and reuse the clothes form.
CATEGORY_FIELDS.clothing = CATEGORY_FIELDS.clothes;

export function getCategoryFieldConfig(categorySlug?: string, fields?: SectionFieldConfig): CategoryFieldConfig {
  if (!categorySlug) return GENERIC_FIELD_CONFIG;
  const legacy = CATEGORY_FIELDS[categorySlug];
  if (legacy) return legacy;
  // القسم الجديد يُضمِّن إعداده داخل بياناته في data/categories.ts (مكان واحد)
  const embedded = fields ?? categories.find((c) => c.slug === categorySlug)?.fields;
  return embedded ?? GENERIC_FIELD_CONFIG;
}

/** اسم القسم بالعربية (للعرض عند الحاجة) */
export function getCategoryName(categorySlug?: string): string {
  return categories.find((c) => c.slug === categorySlug)?.name ?? '';
}
