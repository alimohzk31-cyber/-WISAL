import {
  Activity, Cross, Stethoscope, Syringe, TestTube, Sparkles, ActivitySquare,
  Pill, Hospital, Bone, HeartPulse,
  Scale, FileSignature,
  Car, Zap, Droplet, Droplets, Wrench, Key,
  Plane, Briefcase, ShieldCheck, Phone, Wifi,
  GraduationCap, School, BookOpen, PenTool,
  Trophy, Dumbbell, Waves, Gamepad2, TreePine,
  ShoppingCart, Store, Shirt, Monitor, Smartphone,
  Utensils, Coffee, Pizza, Cake,
  PlugZap, Wrench as PlumberWrench, Sparkles as Broom, Hammer,
  Landmark, Building2, Siren, Fuel, Mail,
  HardHat, Code, Palette, Home, Factory, PanelsTopLeft, DoorOpen, SprayCan
} from 'lucide-react';
import type { Section, SectionFieldConfig, SectionRegistrationConfig } from '../types/models';

// ─── Helper Functions for Registration Fields ───
// تقليل التكرار بينما تبقى كل الإعدادات مركزية داخل هذا الملف.
// إضافة قسم جديد مستقبلاً تحتاج فقط: إضافة عنصر واحد للمصفوفة أدناه.

type RegField = SectionRegistrationConfig['fields'][number];

const gov = (): RegField => ({ key: 'governorate', label: 'المحافظة', placeholder: 'مثال: بغداد', type: 'text', required: true });
const area = (label = 'المنطقة', ph = 'المنطقة، الشارع، وأقرب نقطة دالة'): RegField => ({ key: 'area', label, placeholder: ph, type: 'text', required: true });
const exp = (): RegField => ({ key: 'experienceYears', label: 'سنوات الخبرة', placeholder: 'مثال: 5', type: 'number', required: true, min: 0 });
const feat = (label = 'ما يميزك', ph = 'اذكر ما يميز خدمتك وما تقدمه.'): RegField => ({ key: 'features', label, placeholder: ph, type: 'textarea', required: true });
const txt = (key: string, label: string, ph: string): RegField => ({ key, label, placeholder: ph, type: 'text', required: true });
const num = (key: string, label: string, ph: string, min = 0): RegField => ({ key, label, placeholder: ph, type: 'number', required: true, min });
const txa = (key: string, label: string, ph: string): RegField => ({ key, label, placeholder: ph, type: 'textarea', required: true });
const att = (key: string, label: string, ph: string): RegField => ({ key, label, placeholder: ph, type: 'text', required: true, attachment: true });

/** Build a registration config: custom fields first, then shared governorate/area/experience/features */
function reg(
  customFields: RegField[],
  opts: {
    phoneRequired?: boolean; minImages?: number; maxImages?: number;
    includeExperience?: boolean;
    featuresLabel?: string; featuresPlaceholder?: string;
  } = {},
): SectionRegistrationConfig {
  const shared: RegField[] = [gov(), area()];
  if (opts.includeExperience !== false) shared.push(exp());
  shared.push(feat(opts.featuresLabel, opts.featuresPlaceholder));
  return {
    phoneRequired: opts.phoneRequired ?? true,
    images: { min: opts.minImages ?? 1, max: opts.maxImages ?? 5 },
    fields: [...customFields, ...shared],
  };
}

// ─── Field config helper: build a complete SectionFieldConfig ───
function fieldConfig(cfg: Omit<SectionFieldConfig, 'nameLabel' | 'namePlaceholder' | 'profession' | 'specialties'> & {
  nameLabel: string; namePlaceholder: string; profession: string; specialties: string[];
}): SectionFieldConfig {
  return cfg;
}

export type NeonColor = 'green' | 'blue' | 'purple' | 'pink' | 'orange';

// Category تمتد Section (المصدر المركزي) — نفس الشكل السابق + إمكانية
// تضمين keywords و fields (إعدادات نموذج إضافة خدمة) داخل بيانات القسم نفسه،
// بحيث تُضاف القسم الجديد من هذا الملف فقط.
export interface Category extends Section {
  slug: string;
  name: string;
  groupId: string;
  icon: any;
  color: NeonColor;
}

export interface CategoryGroup {
  id: string;
  name: string;
  color: NeonColor;
}

export const categoryGroups: CategoryGroup[] = [
  { id: 'health', name: 'خدمات صحية', color: 'green' },
  { id: 'legal', name: 'خدمات قانونية', color: 'blue' },
  { id: 'cars', name: 'خدمات السيارات', color: 'orange' },
  { id: 'travel', name: 'سفر واتصالات', color: 'purple' },
  { id: 'education', name: 'تعليم', color: 'pink' },
  { id: 'sports', name: 'رياضة وترفيه', color: 'green' },
  { id: 'shopping', name: 'تسوق', color: 'pink' },
  { id: 'food', name: 'مطاعم', color: 'orange' },
  { id: 'home', name: 'خدمات منزلية', color: 'blue' },
  { id: 'public', name: 'خدمات عامة', color: 'purple' },
  { id: 'business', name: 'أعمال وشركات', color: 'blue' },
];

export const categories: Category[] = [
    // Health
  { slug: 'pharmacy', name: 'صيدليات', groupId: 'health', icon: Pill, color: 'green',
    fields: {
      nameLabel: 'اسم الصيدلية', namePlaceholder: 'مثال: صيدلية الأمل',
      profession: 'صيدلي', professionLabel: 'نوع خدمات الصيدلية',
      experienceLabel: 'نبذة عن الصيدلية وخدماتها', experiencePlaceholder: 'عرّف بالصيدلية والخدمات المتوفرة ومواعيد العمل.',
      locationLabel: 'عنوان الصيدلية', phoneLabel: 'رقم التواصل مع الصيدلية',
      registration: {
        phoneRequired: true, images: { min: 1, max: 5 },
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
  },
  { slug: 'hospital', name: 'مستشفيات', groupId: 'health', icon: Hospital, color: 'green',
    fields: {
      nameLabel: 'اسم المستشفى', namePlaceholder: 'مثال: مستشفى النور',
      profession: 'طبيب', professionLabel: 'اختصاص الطبيب',
      locationLabel: 'عنوان المستشفى', phoneLabel: 'رقم التواصل مع المستشفى',
      registration: reg([
        att('credential', 'الشهادة الطبية', 'اسم الشهادة وتخصص الطبيب'),
      ], { featuresLabel: 'مميزات المستشفى والخدمات', featuresPlaceholder: 'اذكر التخصصات الطبية والخدمات المتوفرة وأوقات العمل.' }),
      specialties: ['طب عام', 'جراحة عامة', 'طب أطفال', 'طب نسائية وتوليد', 'طب باطني', 'طوارئ'],
    },
  },
    { slug: 'clinic', name: 'عيادات', groupId: 'health', icon: Stethoscope, color: 'green',
    fields: {
      nameLabel: 'اسم العيادة', namePlaceholder: 'مثال: عيادة الشفاء الطبية',
      profession: 'طبيب', professionLabel: 'تخصص الطبيب',
      experienceLabel: 'التخصصات الطبية', experiencePlaceholder: 'اذكر تخصصاتك وما تقدمه.',
      locationLabel: 'عنوان العيادة', phoneLabel: 'رقم التواصل مع العيادة',
      registration: reg([
        att('credential', 'الشهادة الطبية', 'اسم الشهادة وتخصص الطبيب'),
        txt('clinicName', 'اسم العيادة', 'مثال: عيادة الابتسامة'),
      ], { featuresLabel: 'ما يميز العيادة', featuresPlaceholder: 'اذكر خبراتك والخدمات التي تقدمها وأوقات استقبال المرضى.' }),
      specialties: ['طب عام', 'طب أطفال', 'جلدية', 'أنف وأذن وحنجرة', 'قلب', 'مخ وأعصاب', 'عظام'],
    },
  },
  { slug: 'dentist', name: 'أطباء أسنان', groupId: 'health', icon: Bone, color: 'green',
    fields: {
      nameLabel: 'اسم العيادة', namePlaceholder: 'مثال: عيادة الابتسامة لطب الأسنان',
      profession: 'طبيب أسنان', professionLabel: 'تخصص طب الأسنان',
      experienceLabel: 'الخبرات والخدمات الطبية', experiencePlaceholder: 'اذكر خبراتك والخدمات التي تقدمها في العيادة ومواعيد استقبال المرضى.',
      locationLabel: 'عنوان العيادة', phoneLabel: 'رقم التواصل مع العيادة',
      registration: reg([
        att('credential', 'الشهادة الطبية', 'اسم الشهادة وتخصص طب الأسنان'),
      ], { featuresLabel: 'ما يميز العيادة', featuresPlaceholder: 'اذكر تخصصاتك وما تقدمه.' }),
      specialties: ['تقويم الأسنان', 'جراحة الفم والأسنان', 'طب أسنان الأطفال', 'علاج الجذور', 'تركيبات الأسنان', 'تجميل الأسنان', 'تنظيف وتبييض الأسنان'],
    },
  },
    { slug: 'lab', name: 'مختبرات تحليل', groupId: 'health', icon: TestTube, color: 'green',
    fields: {
      nameLabel: 'اسم المختبر', namePlaceholder: 'مثال: مختبر التحاليل الدقيقة',
      profession: 'أخصائي مختبرات', professionLabel: 'نوع الخدمات',
      locationLabel: 'عنوان المختبر', phoneLabel: 'رقم التواصل مع المختبر',
      registration: reg([
        txt('serviceType', 'نوع الخدمات المعمول بها', 'مثال: تحاليل دم، أشعة، تحاليل هرمونات'),
      ], { featuresLabel: 'ما يميز المختبر', featuresPlaceholder: 'اذكر أدوات الاختبار ومواعيد العمل.' }),
      specialties: ['تحاليل دم', 'تحاليل هرمونات', 'فحص بصري', 'أشعة', 'تحاليل وراثية', 'فحص دوري عام'],
    },
  },
  { slug: 'beauty', name: 'مراكز تجميل', groupId: 'health', icon: Sparkles, color: 'green',
    fields: {
      nameLabel: 'اسم المركز', namePlaceholder: 'مثال: مركز الجمال للتجميل',
      profession: 'خبير تجميل', professionLabel: 'تخصص التجميل',
      locationLabel: 'عنوان المركز', phoneLabel: 'رقم التواصل مع المركز',
      registration: reg([
        txt('serviceType', 'نوع الخدمات', 'مثال: عناية بالبشرة، مكياج وسهرة، قص وتصفيف شعر'),
        att('credential', 'الشهادة المهنية', 'اسم الشهادة وجهة التخصص'),
      ], { featuresLabel: 'ما يميز المركز', featuresPlaceholder: 'اذكر خبراتك والعلاجات التي تقدمها.' }),
      specialties: ['عناية بالبشرة', 'مكياج وسهرة', 'قص وتصفيف شعر', 'عناية بالأظافر', 'حمام مغربي'],
    },
  },
  { slug: 'physio', name: 'علاج طبيعي', groupId: 'health', icon: HeartPulse, color: 'green',
    fields: {
      nameLabel: 'اسم المركز', namePlaceholder: 'مثال: مركز الحياة للعلاج الطبيعي',
      profession: 'أخصائي علاج طبيعي', professionLabel: 'التخصص',
      locationLabel: 'عنوان المركز', phoneLabel: 'رقم التواصل مع المركز',
      registration: reg([
        att('credential', 'الشهادة المهنية', 'اسم الشهادة وتخصص العلاج الطبيعي'),
        txt('specialty', 'التخصص', 'مثال: علاج إصابات رياضية، تأهيل ما بعد الجراحة'),
      ], { featuresLabel: 'ما يميز المركز', featuresPlaceholder: 'اذكر طرق العلاج والجلسات التي تقدمها.' }),
      specialties: ['علاج إصابات رياضية', 'تأهيل ما بعد الجراحة', 'علاج آلام الظهر والرقبة', 'تأهيل حركي للأطفال'],
    },
  },

  // Legal
  { slug: 'lawyer', name: 'محامين', groupId: 'legal', icon: Scale, color: 'blue',
    fields: {
      nameLabel: 'اسم المكتب / المحامي', namePlaceholder: 'مثال: مكتب العدل للمحاماة',
      profession: 'محامي', professionLabel: 'التخصص المهني',
      locationLabel: 'عنوان المكتب', phoneLabel: 'رقم التواصل مع المحامي',
      registration: reg([
        att('barRegistration', 'رقم التسجيل في نادي المحامين', 'الرقم أو اسم النادي المانع له'),
        txt('specialty', 'التخصص القانوني', 'مثال: قضايا مدنية، قضايا تجارية'),
      ], { featuresLabel: 'ما يميز المكتب', featuresPlaceholder: 'اذكر خبراتك ونوع القضايا المعتادة عليها.' }),
      specialties: ['قضايا مدنية', 'قضايا تجارية', 'قضايا عمالية', 'قضايا عقارية', 'قضايا أحوال شخصية', 'تحكيم'],
    },
  },
  { slug: 'legal-consult', name: 'استشارات قانونية', groupId: 'legal', icon: FileSignature, color: 'blue',
    fields: {
      nameLabel: 'اسم المكتب الاستشاري', namePlaceholder: 'مثال: مكتب الرأي للاستشارات القانونية',
            profession: 'مستشار قانوني', professionLabel: 'التخصص الاستشاري',
      locationLabel: 'عنوان المكتب', phoneLabel: 'رقم التواصل مع المستشار',
      registration: reg([
        txt('specialization', 'التخصص الاستشاري', 'مثال: استشارات تجارية، صياغة عقود'),
      ], { featuresLabel: 'ما يميز الاستشارات', featuresPlaceholder: 'اذكر مجالات الخبرتك وطرق الاستشارة.' }),
      specialties: ['استشارات تجارية', 'استشارات عقود', 'صياغة عقود', 'استشارات عمالية', 'تأسيس شركات'],
    },
  },

  // Cars
  { slug: 'car-repair', name: 'ورش سيارات', groupId: 'cars', icon: Car, color: 'orange',
    fields: {
      nameLabel: 'اسم الورشة', namePlaceholder: 'مثال: ورشة الأمل لصيانة السيارات',
      profession: 'فني سيارات / ميكانيكي', professionLabel: 'اختصاص الفني',
      locationLabel: 'عنوان الورشة', phoneLabel: 'رقم التواصل مع الورشة',
      registration: reg([
        txt('workType', 'نوع الأعمال', 'مثال: صيانة شاملة، تركيب باطورى، برمجة إلكترونية'),
      ], { featuresLabel: 'خدمات الورشة', featuresPlaceholder: 'اذكر الأعمال والصيانات التي تقدمها.' }),
      specialties: ['ميكانيك', 'كهرباء سيارات', 'تكييف وتبريد', 'برمجة سيارات', 'تبديل زيوات', 'عجلات وميزان', 'سمكرة ودهان', 'فحص دوري شامل'],
    },
  },
  { slug: 'car-sales', name: 'سيارات للبيع', groupId: 'cars', icon: Car, color: 'orange',
    fields: {
      nameLabel: 'اسم السيارة / الإعلان', namePlaceholder: 'مثال: سيارة للبيع',
      profession: 'كوري', professionLabel: 'منشأ السيارة',
      experienceLabel: 'تفاصيل السيارة والإعلان', experiencePlaceholder: 'اذكر الموديل وسنة الصنع والحالة وأبرز تفاصيل العرض.',
      allowCustomSpecialty: false,
      registration: reg([
        txt('make', 'شركة الصنع', 'مثال: تويوتا، ميزوبوشي، هيونداي'),
        txt('model', 'الموديل', 'مثال: كامري 2022، أهريس 2021'),
        num('year', 'سنة الصنع', 'مثال: 2023', 1990),
      ], { featuresLabel: 'تفاصيل إضافية', featuresPlaceholder: 'اذكر الحالة العامة، اللون، المميزات، وسعر البيع.', includeExperience: false }),
      specialties: ['كوري', 'ياباني', 'صيني', 'إيراني', 'أمريكي'],
    },
  },
  { slug: 'bike-sales', name: 'دراجات نارية', groupId: 'cars', icon: Car, color: 'orange',
    fields: {
      nameLabel: 'اسم الدراجة / الإعلان', namePlaceholder: 'مثال: دراجة نارية للبيع',
      profession: 'دراجات نارية', professionLabel: 'نوع الدراجة',
      experienceLabel: 'تفاصيل الدراجة', experiencePlaceholder: 'اذكر الموديل وسنة الصنع والحالة وأبرز تفاصيل العرض.',
      allowCustomSpecialty: false,
      registration: reg([
        txt('bikeType', 'نوع الدراجة', 'مثال: نارية، هوائية، كهربائية، سكوتر'),
        txt('make', 'شركة الصنع', 'مثال: يامaha، هوندا، بيجيو'),
        txt('model', 'الموديل', 'مثال: R1، CB500'),
      ], { featuresLabel: 'تفاصيل إضافية', featuresPlaceholder: 'اذكر الحالة العامة، اللون، المميزات، وسعر البيع.', includeExperience: false }),
      specialties: ['دراجات نارية', 'دراجات هوائية', 'سكوترات', 'دراجات كهربائية', 'قطع غيار وإكسسوارات'],
    },
  },

    // Travel
  { slug: 'airlines', name: 'شركات الطيران', groupId: 'travel', icon: Plane, color: 'purple',
    fields: {
      nameLabel: 'اسم الشركة', namePlaceholder: 'مثال: شركة الأجنحة للطيران',
      profession: 'وكيل حجوزات طيران', professionLabel: 'نوع الخدمات',
      locationLabel: 'الموقع', phoneLabel: 'رقم التواصل',
      registration: reg([
        txt('routes', 'مسارات ووجهات الطيران', 'مثال: بغداد - دبي - جدة'),
      ], { featuresLabel: 'مميزات الشركة', featuresPlaceholder: 'اذكر العروض والخدمات المتوفرة.', includeExperience: false }),
      specialties: ['تذاكر محلية', 'تذاكر دولية', 'شحن جوي', 'برامج المسافر الدائم'],
    },
  },
  { slug: 'travel-agency', name: 'مكاتب سفر', groupId: 'travel', icon: Briefcase, color: 'purple',
    fields: {
      nameLabel: 'اسم المكتب', namePlaceholder: 'مثال: مكتب الرحلات للسياحة والسفر',
      profession: 'مستشار سفر', professionLabel: 'التخصص',
      locationLabel: 'عنوان المكتب', phoneLabel: 'رقم التواصل',
      registration: reg([
        txt('specialties', 'التخصصات السياحية', 'مثال: رحلات داخلية، حج وعمرة، تأشيرات'),
      ], { featuresLabel: 'ما يميز المكتب', featuresPlaceholder: 'اذكر العروض والخدمات السياحية.' }),
      specialties: ['برامج سياحية', 'حج وعمرة', 'تأشيرات سفر', 'حجوزات فنادق', 'رحلات جماعية'],
    },
  },
  { slug: 'insurance', name: 'شركات تأمين', groupId: 'travel', icon: ShieldCheck, color: 'purple',
    fields: {
      nameLabel: 'اسم الشركة', namePlaceholder: 'مثال: شركة الأمان للتأمين',
      profession: 'مندوب تأمين', professionLabel: 'نوع التأمين',
      locationLabel: 'عنوان الشركة', phoneLabel: 'رقم التواصل',
      registration: reg([
        txt('coverageTypes', 'أنواع التغطية', 'مثال: تأمين سيارات، تأمين صحي، تأمين حياة'),
      ], { featuresLabel: 'ما يميز شركة التأمين', featuresPlaceholder: 'اذكر شروط التأمين والخدمات.' }),
      specialties: ['تأمين سيارات', 'تأمين صحي', 'تأمين حياة', 'تأمين عقاري', 'تأمين سفر'],
    },
  },
  { slug: 'telecom', name: 'شركات الهاتف', groupId: 'travel', icon: Phone, color: 'purple',
    fields: {
      nameLabel: 'اسم الشركة / الفرع', namePlaceholder: 'مثال: فرع شركة الاتصالات',
      profession: 'مندوب مبيعات اتصالات', professionLabel: 'نوع الخدمات',
      locationLabel: 'عنوان الفرع', phoneLabel: 'رقم التواصل',
      registration: reg([
        txt('services', 'الخدمات المقدمة', 'مثال: خطوط جديدة، باقات بيانات، دفع فواتير'),
      ], { featuresLabel: 'ما يميز الفرع', featuresPlaceholder: 'اذكر العرواض والباقات المتوفرة.' }),
      specialties: ['خطوط جديدة', 'باقات بيانات', 'دفع فواتير', 'أجهزة وأسعار خاصة'],
    },
  },
  { slug: 'internet', name: 'انترنت وخدمات WiFi', groupId: 'travel', icon: Wifi, color: 'purple',
    fields: {
      nameLabel: 'اسم الشركة / المزود', namePlaceholder: 'مثال: خدمات النت السريع',
      profession: 'فني شبكات', professionLabel: 'نوع الخدمات',
      locationLabel: 'الموقع', phoneLabel: 'رقم التواصل',
      registration: reg([
        txt('serviceTypes', 'أنوع الخدمات', 'مثال: إنترنت منزلي، إنترنت شركات، شبكات WiFi'),
      ], { featuresLabel: 'ما يميز الخدمة', featuresPlaceholder: 'اذكر الأسرع والباقات المتوفرة.' }),
      specialties: ['اشتراك إنترنت منزلي', 'إنترنت شركات', 'تركيب شبكات WiFi', 'صيانة شبكات'],
    },
  },

  // Education
  { slug: 'school', name: 'مدارس', groupId: 'education', icon: School, color: 'pink',
    fields: {
      nameLabel: 'اسم المدرسة', namePlaceholder: 'مثال: مدرسة الفرقان الخاصة',
      profession: 'إدارة مدرسية', professionLabel: 'المرحلة التعليمية',
      locationLabel: 'عنوان المدرسة', phoneLabel: 'رقم التواصل',
      registration: reg([
        txt('educationLevel', 'المرحلة التعليمية', 'مثال: رياض أطفال، إبتدائية، ثانوية'),
      ], { featuresLabel: 'ما يميز المدرسة', featuresPlaceholder: 'اذكر المناهج والأنشطة والتخصصات.', includeExperience: false }),
      specialties: ['رياض أطفال', 'تعليم أساسي', 'تعليم ثانوي', 'منهج دولي', 'أنشطة لا صفية'],
    },
  },
  { slug: 'university', name: 'جامعات', groupId: 'education', icon: GraduationCap, color: 'pink',
    fields: {
      nameLabel: 'اسم الجامعة', namePlaceholder: 'مثال: جامعة المستقبل',
      profession: 'إدارة جامعية', professionLabel: 'الكلية أو القسم',
      locationLabel: 'عنوان الجامعة', phoneLabel: 'رقم التواصل',
      registration: reg([
        txt('faculties', 'الكليات المتوفرة', 'مثال: طب، هندسة، آداب، تجارة'),
      ], { featuresLabel: 'ما يميز الجامعة', featuresPlaceholder: 'اذكر البرامج وفرص الدراسة.', includeExperience: false }),
      specialties: ['كليات علمية', 'كليات أدبية', 'دراسات عليا', 'برامج دبلوم', 'قبول وتسجيل'],
    },
  },
  { slug: 'institute', name: 'معاهد', groupId: 'education', icon: BookOpen, color: 'pink',
    fields: {
      nameLabel: 'اسم المعهد', namePlaceholder: 'مثال: معهد المهارات للتدريب',
      profession: 'مدرب معتمد', professionLabel: 'مجال التدريب',
      locationLabel: 'عنوان المعهد', phoneLabel: 'رقم التواصل',
      registration: reg([
        txt('courses', 'الدورات المقدمة', 'مثال: لغة إنجليزية، برمجيات، مهارات إدارية'),
      ], { featuresLabel: 'ما يميز المعهد', featuresPlaceholder: 'اذكر أساليب التدريس وشهادات المدربين.' }),
      specialties: ['دورات لغة إنجليزية', 'دورات حاسوب', 'دورات مهنية', 'تدريب مبرمجين', 'مهارات إدارية'],
    },
  },
  { slug: 'tutor', name: 'دروس خصوصية', groupId: 'education', icon: PenTool, color: 'pink',
    fields: {
      nameLabel: 'اسم المدرس / المركز', namePlaceholder: 'مثال: أ. محمد للرياضيات',
      profession: 'مدرس خصوصي', professionLabel: 'التخصص',
      locationLabel: 'الموقع', phoneLabel: 'رقم التواصل',
      registration: reg([
        txt('subject', 'المادة الدراسية', 'مثال: رياضيات، فيزياء، لغة إنجليزية'),
        txt('educationLevel', 'الصف أو المرحلة', 'مثال: ثانوية أولى، جامعي أول'),
      ], { featuresLabel: 'ما يميز المدرس', featuresPlaceholder: 'اذكر أسلوب التدريس والنتائج.' }),
      specialties: ['رياضيات', 'فيزياء', 'كيمياء', 'أحياء', 'لغة عربية', 'لغة إنجليزية', 'تحفيظ قرآن'],
    },
  },

    // Sports
  { slug: 'football', name: 'ملاعب كرة', groupId: 'sports', icon: Trophy, color: 'green',
    fields: {
      nameLabel: 'اسم الملعب', namePlaceholder: 'مثال: ملعب النجمة',
      profession: 'مشرف ملعب', professionLabel: 'نوع الملعب',
      locationLabel: 'عنوان الملعب', phoneLabel: 'رقم التواصل',
      registration: reg([
        txt('fieldType', 'نوع الملعب', 'مثال: عشب طبيعي، عشب صناعي، صالات'),
      ], { featuresLabel: 'ما يميز الملعب', featuresPlaceholder: 'اذكر المرافق والخدمات.' }),
      specialties: ['ملعب عشب طبيعي', 'ملعب عشب صناعي', 'ملاعب صالات', 'تدريبات خاصة', 'بطولات'],
    },
  },
  { slug: 'gym', name: 'صالات رياضية', groupId: 'sports', icon: Dumbbell, color: 'green',
    fields: {
      nameLabel: 'اسم الصالة', namePlaceholder: 'مثال: صالة القوة الرياضية',
      profession: 'مدرب لياقة', professionLabel: 'التخصص',
      locationLabel: 'عنوان الصالة', phoneLabel: 'رقم التواصل',
      registration: reg([
        txt('focusAreas', 'مجالات التدريب', 'مثال: كمال أجسام، لياقة عامة، مدرب شخصي'),
      ], { featuresLabel: 'ما يميز الصالة', featuresPlaceholder: 'اذكر الأدوات وخبرات المدربين.' }),
      specialties: ['كمال أجسام', 'لياقة عامة', 'تمارين نسائية', 'كارديو', 'مدرب شخصي', 'تغذية رياضية'],
    },
  },
  { slug: 'pool', name: 'مسابح', groupId: 'sports', icon: Waves, color: 'green',
    fields: {
      nameLabel: 'اسم المسبح', namePlaceholder: 'مثال: مسبح الأزرق',
      profession: 'مشرف مسبح', professionLabel: 'نوع المسبح',
      locationLabel: 'عنوان المسبح', phoneLabel: 'رقم التواصل',
      registration: reg([
        txt('poolType', 'نوع المسبح', 'مثال: سباحة تعليمية، سباحة نسائية، حجز خاص'),
      ], { featuresLabel: 'ما يميز المسبح', featuresPlaceholder: 'اذكر أبعاد المسبح ومواعيد العمل.' }),
      specialties: ['سباحة تعليمية', 'سباحة نسائية', 'سباحة أطفال', 'تأهيل مائي', 'حجز خاص'],
    },
  },
  { slug: 'kids-area', name: 'ألعاب أطفال', groupId: 'sports', icon: Gamepad2, color: 'green',
    fields: {
      nameLabel: 'اسم المركز', namePlaceholder: 'مثال: مدينة الأطفال الترفيهية',
      profession: 'مشرف ترفيه', professionLabel: 'نوع الأنشطة',
      locationLabel: 'عنوان المركز', phoneLabel: 'رقم التواصل',
      registration: reg([
        txt('activities', 'الأنشطة المتوفرة', 'مثال: ألعاب ميكانيكية، ألعاب أطفال، حفلات أعياد'),
      ], { featuresLabel: 'ما يميز المركز', featuresPlaceholder: 'اذكر الفئات العمرية والأمان.' }),
      specialties: ['ألعاب ميكانيكية', 'ألعاب أطفال', 'حفلات أعياد ميلاد', 'ترفيه تعليمي'],
    },
  },
  { slug: 'park', name: 'حدائق', groupId: 'sports', icon: TreePine, color: 'green',
    fields: {
      nameLabel: 'اسم الحديقة', namePlaceholder: 'مثال: حديقة السلام العامة',
      profession: 'إدارة حديقة', professionLabel: 'نوع الحديقة',
      locationLabel: 'عنوان الحديقة', phoneLabel: 'رقم التواصل',
      registration: reg([
        txt('facilities', 'المرافق المتوفرة', 'مثال: مقاعر نزهة، مطاعم، ملاعب أطفال، مسارات مشي'),
      ], { featuresLabel: 'ما يميز الحديقة', featuresPlaceholder: 'اذكر ساعات الفتح والأنشطة.', includeExperience: false }),
      specialties: ['مناطق نزهة عائلية', 'مقاهٍ ومطاعم', 'ملاعب أطفال', 'مسارات مشي', 'حجوزات حفلات'],
    },
  },

    // Shopping
  { slug: 'supermarket', name: 'سوبر ماركت', groupId: 'shopping', icon: ShoppingCart, color: 'pink',
    fields: {
      nameLabel: 'اسم السوبر ماركت', namePlaceholder: 'مثال: ماركت الرحمة',
      profession: 'إدارة متجر', professionLabel: 'نوع المنتجات',
      locationLabel: 'عنوان المتجر', phoneLabel: 'رقم التواصل',
      registration: reg([
        txt('categories', 'فئات المنتجات', 'مثال: مواد غذائية، منظفات، معلبات، خضار وفواكه'),
      ], { featuresLabel: 'ما يميز السوبر ماركت', featuresPlaceholder: 'اذكر ساعات العمل والتوصيل.' }),
      specialties: ['مواد غذائية', 'خضار وفواكه', 'منظفات', 'معلبات', 'توصيل منازل'],
    },
  },
  { slug: 'mall', name: 'مولات', groupId: 'shopping', icon: Store, color: 'pink',
    fields: {
      nameLabel: 'اسم المول', namePlaceholder: 'مثال: مول المدينة',
      profession: 'إدارة مول', professionLabel: 'نوع المرافق',
      locationLabel: 'عنوان المول', phoneLabel: 'رقم التواصل',
      registration: reg([
        txt('facilities', 'الخدمات والمرافق', 'مثال: محلات أزياء، مطاعم، ترفيه، موقف سيارات'),
      ], { featuresLabel: 'ما يميز المول', featuresPlaceholder: 'اذكر عدد المحلات والمرافق.', includeExperience: false }),
      specialties: ['محلات أزياء', 'مطاعم وكافيهات', 'ترفيه', 'موقف سيارات', 'فعاليات'],
    },
  },
  { slug: 'clothes', name: 'محلات ملابس', groupId: 'shopping', icon: Shirt, color: 'pink',
    fields: {
      nameLabel: 'اسم المحل', namePlaceholder: 'مثال: محل الأناقة للملابس',
      profession: 'بائع ملابس', professionLabel: 'فئة الجمهور',
      locationLabel: 'عنوان المحل', phoneLabel: 'رقم التواصل',
      registration: reg([
        txt('target', 'فئة الجمهور', 'مثال: نسائية، رجالية، أطفال، مخصصة'),
        txt('products', 'المنتجات المقدمة', 'مثال: ملابس رياضية، أزياء تقليدية، ملابس شتوية'),
      ], { featuresLabel: 'ما يميز المحل', featuresPlaceholder: 'اذكر العلامات التجارية والتصاميم.' }),
      specialties: ['ملابس رجالية', 'ملابس نسائية', 'ملابس أطفال', 'أزياء رياضية', 'ملابس تقليدية'],
    },
  },
  { slug: 'electronics', name: 'إلكترونيات', groupId: 'shopping', icon: Monitor, color: 'pink',
    fields: {
      nameLabel: 'اسم المحل', namePlaceholder: 'مثال: مركز الإلكترونيات الحديثة',
      profession: 'بائع إلكترونيات', professionLabel: 'نوع الأجهزة',
      locationLabel: 'عنوان المحل', phoneLabel: 'رقم التواصل',
      registration: reg([
        txt('categories', 'فئات الإلكترونيات', 'مثال: حواسيب، تلفزيونات، أجهزة منزلية، ملحقات'),
      ], { featuresLabel: 'ما يميز المحل', featuresPlaceholder: 'اذكر العلامات التجارية والضمان.' }),
      specialties: ['حواسيب ولابتوب', 'تلفزيونات', 'أجهزة منزلية', 'ملحقات', 'صيانة إلكترونيات'],
    },
  },
  { slug: 'phones', name: 'هواتف', groupId: 'shopping', icon: Smartphone, color: 'pink',
    fields: {
      nameLabel: 'اسم المحل', namePlaceholder: 'مثال: معرض الهواتف الذكية',
      profession: 'بائع هواتف', professionLabel: 'نوع الهواتف',
      locationLabel: 'عنوان المحل', phoneLabel: 'رقم التواصل',
      registration: reg([
        txt('brands', 'العلامات التجارية', 'مثال: أيفون، سامسونج، شاومي، هواوي'),
      ], { featuresLabel: 'ما يميز المحل', featuresPlaceholder: 'اذكر خدمة الضمان والصيانة.' }),
      specialties: ['بيع هواتف جديدة', 'هواتف مستعملة', 'صيانة هواتف', 'ملحقات', 'شاشات وبطاريات'],
    },
  },

      // Food
  { slug: 'restaurant', name: 'مطاعم', groupId: 'food', icon: Utensils, color: 'orange',
    fields: {
      nameLabel: 'اسم المطعم', namePlaceholder: 'مثال: مطعم الشاملة',
      profession: 'مطبخ', professionLabel: 'نوع المأكولات',
      experienceLabel: 'أوقات العمل', experiencePlaceholder: 'مثال: الفطور 7–11 ص، العشاء 5–10 م',
      locationLabel: 'عنوان المطعم', phoneLabel: 'رقم التواصل',
      registration: reg([
        txt('cuisine', 'نوع الطعام', 'مثال: عراقي، لبناني، إيطالي، شاورما، مأكولات بحرية'),
        txt('workingHours', 'أوقات العمل', 'مثال: الاثنين–الجمعة 8 ص – 11 م، السبت 9 ص – 12 م'),
      ], { featuresLabel: 'ما يميز المطعم', featuresPlaceholder: 'اذكر الخاصية الأخاصة (توصيل، أرصفة، قهوة...).' }),
      specialties: ['عراقي', 'لبناني', 'إيطالي', 'شاورما', 'مأكولات بحرية', 'حلويات'],
    },
  },
  { slug: 'cafe', name: 'كافيهات', groupId: 'food', icon: Coffee, color: 'orange',
    fields: {
      nameLabel: 'اسم الكافيه', namePlaceholder: 'مثال: كافيه القهوة الذهبية',
      profession: 'صاحب كافيه', professionLabel: 'نوع الكافيه',
      experienceLabel: 'أوقات العمل', experiencePlaceholder: 'مثال: 8 ص – 11 م يومياً',
      locationLabel: 'عنوان الكافيه', phoneLabel: 'رقم التواصل',
      registration: reg([
        txt('cafeType', 'نوع الكافيه', 'مثال: قهوة عربية، إسبريسو، كيك، ترامي'),
        txt('workingHours', 'أوقات العمل', 'مثال: 7 ص – 12 ليل'),
      ], { featuresLabel: 'ما يميز الكافيه', featuresPlaceholder: 'اذكر القهوة المميزة والواجهة.' }),
      specialties: ['قهوة عربية', 'إسبريسو', 'كيك', 'شاي', 'حلويات باردة'],
    },
  },
  { slug: 'fast-food', name: 'وجبات سريعة', groupId: 'food', icon: Pizza, color: 'orange',
    fields: {
      nameLabel: 'اسم المحل', namePlaceholder: 'مثال: برجر هادي',
      profession: 'طاهاة/مالك مطعم فاست فود', professionLabel: 'نوع الوجبات',
      experienceLabel: 'أوقات العمل', experiencePlaceholder: 'مثال: 11 ص – 11 م',
      locationLabel: 'عنوان المطعم', phoneLabel: 'رقم التواصل',
      registration: reg([
        txt('foodTypes', 'أنواع الوجبات', 'مثال: برجر، بيتزا، شاورما، فطائر'),
        txt('workingHours', 'أوقات العمل', 'مثال: 11 ص – 11 م'),
      ], { featuresLabel: 'ما يميز المطعم', featuresPlaceholder: 'اذكر التوصيل والخاصة.' }),
      specialties: ['برجر', 'بيتزا', 'شاورما', 'فطائر', 'وجبات جانبي', 'مشروبات'],
    },
  },
  { slug: 'sweets', name: 'حلويات', groupId: 'food', icon: Cake, color: 'orange',
    fields: {
      nameLabel: 'اسم المحل', namePlaceholder: 'مثال: محل الحلويات النحلة',
      profession: 'خباز/صانع حلويات', professionLabel: 'نوع الحلويات',
      experienceLabel: 'أوقات العمل', experiencePlaceholder: 'مثال: 8 ص – 8 م',
      locationLabel: 'عنوان المحل', phoneLabel: 'رقم التواصل',
      registration: reg([
        txt('sweetTypes', 'أنواع الحلويات', 'مثال: ترت، كيك، معجنات، شيشة، كنافة'),
        txt('workingHours', 'أوقات العمل', 'مثال: 8 ص – 8 م'),
      ], { featuresLabel: 'ما يميز المحل', featuresPlaceholder: 'اذكر التخصصات والتصاميم الخاصة.' }),
      specialties: ['كنافة', 'كيك', 'معجنات', 'شيشة', 'ترت', 'دونات', 'حلى منزلي'],
    },
  },

  // Home
  { slug: 'electrician', name: 'كهربائي', groupId: 'home', icon: PlugZap, color: 'blue',
    fields: {
      nameLabel: 'اسم الورشة', namePlaceholder: 'مثال: ورشة الكهرباء السريعة',
      profession: 'كهربائي', professionLabel: 'نوع الأعمال',
      locationLabel: 'عنوان الورشة', phoneLabel: 'رقم التواصل',
      registration: reg([
        txt('workTypes', 'أنواع الأعمال', 'مثال: تركيبات، تمديدات، إضاءة خارجية، إلكترونيات منزلية'),
      ], { featuresLabel: 'ما يميز الورشة', featuresPlaceholder: 'اذكر التخصصات والمهارات.' }),
      specialties: ['تركيبات كهرباء', 'تمديدات منزلية', 'إضاءة ديكورية', 'كهرباء صناعية', 'توصيلات إلكترونية'],
    },
  },
  { slug: 'plumber', name: 'سباك', groupId: 'home', icon: PlumberWrench, color: 'blue',
    fields: {
      nameLabel: 'اسم الورشة', namePlaceholder: 'مثال: ورشة السباك مازن',
      profession: 'سباك', professionLabel: 'نوع الأعمال',
      locationLabel: 'عنوان الورشة', phoneLabel: 'رقم التواصل',
      registration: reg([
        txt('workTypes', 'أنواع المهام', 'مثال: إصلاح تسريبات، تركيب أدوات، صيانة سخانات، محطات مياه'),
      ], { featuresLabel: 'ما يميز الورشة', featuresPlaceholder: 'اذكر التخصصات والمهارات.' }),
      specialties: ['إصلاح تسريبات مياه', 'تركيب أدوات صحية', 'صيانة سخانات', 'تركيب مضخات مياه', 'عدادات مياه'],
    },
  },
  { slug: 'cleaning', name: 'تنظيف منازل', groupId: 'home', icon: Broom, color: 'blue',
    fields: {
      nameLabel: 'اسم الشركة / الخادمة', namePlaceholder: 'مثال: شركة النظافة الاحترافية',
      profession: 'عاملة تنظيف', professionLabel: 'نوع الخدمة',
      locationLabel: 'الموقع', phoneLabel: 'رقم التواصل',
      registration: reg([
        txt('serviceTypes', 'أنواع الخدمات', 'مثال: تنظيف شامل، غسيل مراتب، تنظيف أثاث، تعقيم'),
      ], { featuresLabel: 'ما يميز الخدمة', featuresPlaceholder: 'اذكر المواد المستخدمة والضمان.' }),
      specialties: ['تنظيف شامل', 'غسيل مراتب', 'تنظيف أثاث خشبي', 'تعقيم ومعقمات', 'تنظيف موكيت'],
    },
  },
  { slug: 'appliance-repair', name: 'صيانة أجهزة', groupId: 'home', icon: Wrench, color: 'blue',
    fields: {
      nameLabel: 'اسم الورشة', namePlaceholder: 'مثال: ورشة صيانة الأجهزة الكهربائية',
      profession: 'فني صيانة', professionLabel: 'نوع الأجهزة',
      locationLabel: 'عنوان الورشة', phoneLabel: 'رقم التواصل',
      registration: reg([
        txt('deviceTypes', 'أنواع الأجهزة', 'مثال: تكييفات، غسالات، ثلاجات، فرن، ديش'),
      ], { featuresLabel: 'ما يميز الورشة', featuresPlaceholder: 'اذكر الضمان وأسعار الصيانة.' }),
      specialties: ['صيانة تكييفات', 'صيانة غسالات', 'صيانة ثلاجات', 'صيانة فرن وديش', 'قطع غيار أصلية'],
    },
  },
  { slug: 'carpenter', name: 'نجار', groupId: 'home', icon: Hammer, color: 'blue',
    fields: {
      nameLabel: 'اسم الورشة', namePlaceholder: 'مثال: ورشة النجار مهند',
      profession: 'نجار', professionLabel: 'نوع الأعمال',
      locationLabel: 'عنوان الورشة', phoneLabel: 'رقم التواصل',
      registration: reg([
        txt('workTypes', 'أنواع الأعمال', 'مثال: أبواب، نوافذ، أثاث خشبي، مطابخ خشبية، أرفف'),
      ], { featuresLabel: 'ما يميز الورشة', featuresPlaceholder: 'اذكر أنواع الخشب والتصاميم.' }),
      specialties: ['أبواب ونوافذ خشبية', 'أثاث منزلي', 'مطابخ خشبية', 'صلبان وأرفف', 'نجارة منزلية'],
    },
  },

  // Public
  { slug: 'mosque', name: 'مساجد', groupId: 'public', icon: Landmark, color: 'purple',
    fields: {
      nameLabel: 'اسم المسجد', namePlaceholder: 'مثال: مسجد الفاتح',
      profession: 'إمام / خطيب', professionLabel: 'الدور الإداري',
      locationLabel: 'عنوان المسجد', phoneLabel: 'رقم التواصل',
      registration: reg([
        txt('affiliation', 'توحيد المسجد', 'مثال: مسجد جامعي، مسجد مجتمعي، مسجد خاص'),
      ], { featuresLabel: 'ما يميز المسجد', featuresPlaceholder: 'اذكر ساعات الصلوات والخدمات المتوفرة.', includeExperience: false }),
      specialties: ['جوامع', 'مساجد مجتمعية', 'مساجد خاصة', 'مرافق أطفال', 'مكتبة'],
    },
  },
  { slug: 'government', name: 'مراكز حكومية', groupId: 'public', icon: Building2, color: 'purple',
    fields: {
      nameLabel: 'اسم الدائرة / المركز', namePlaceholder: 'مثال: دائرة الأشغال المحليّة - فرع بغداد',
      profession: 'موظف حكومي', professionLabel: 'نوع الخدمة',
      locationLabel: 'عنوان الدائرة', phoneLabel: 'رقم التواصل',
      registration: reg([
        txt('services', 'الخدمات المقدمة', 'مثال: إقرارات، ترخيص، مناقصات، خدمات مواطنين'),
      ], { featuresLabel: 'ما يميز المركز', featuresPlaceholder: 'اذكر إجراءات الوثائق المطلوبة.', includeExperience: false }),
      specialties: ['خدمات مواطنين', 'تسجيلات رسمية', 'ترخيص', 'مناقصات', 'أرشفة وثائق'],
    },
  },
  { slug: 'police', name: 'مراكز شرطة', groupId: 'public', icon: Siren, color: 'purple',
    fields: {
      nameLabel: 'اسم مركز الشرطة', namePlaceholder: 'مثال: مركز شرطة الكرادة',
      profession: 'ضابط شرطة', professionLabel: 'الوحدة',
      locationLabel: 'عنوان المركز', phoneLabel: 'رقم التواصل',
      registration: reg([
        txt('jurisdiction', 'منطقة الاختصاص', 'مثال: الكرادة، الأعمال، الحي الجديد'),
      ], { featuresLabel: 'ما يميز المركز', featuresPlaceholder: 'اذكر ساعات العمل والخدمات العامة.', includeExperience: false }),
      specialties: ['مركز شرطة عام', 'إقليم أمني', 'مكتب ترحيلي', 'وحدة خاصة'],
    },
  },
  { slug: 'gas-station', name: 'محطات وقود', groupId: 'public', icon: Fuel, color: 'purple',
    fields: {
      nameLabel: 'اسم محطة الوقود', namePlaceholder: 'مثال: محطة بنزين الأمل',
      profession: 'مدير محطة وقود', professionLabel: 'نوع الوقود',
      locationLabel: 'عنوان المحطة', phoneLabel: 'رقم التواصل',
      registration: reg([
        txt('fuelTypes', 'أنواع الوقود', 'مثال: بنزين، ديزل، غاز سريع الغلاق، بنزين أزرق'),
      ], { featuresLabel: 'ما يميز المحطة', featuresPlaceholder: 'اذكر الخدمات الإضافية (محطة شحن، مطبخ...).' }),
      specialties: ['بنزين عادي وفاخر', 'ديزل', 'غاز سريع الغلاق', 'محطة شحن كهربائية'],
    },
  },
  { slug: 'post-office', name: 'بريد', groupId: 'public', icon: Mail, color: 'purple',
    fields: {
      nameLabel: 'اسم مكتب البريد', namePlaceholder: 'مثال: مكتب بريد المنصورية الرئيسي',
      profession: 'موظف بريد', professionLabel: 'نوع الخدمات',
      locationLabel: 'عنوان المكتب', phoneLabel: 'رقم التواصل',
      registration: reg([
        txt('services', 'الخدمات المقدمة', 'مثال: إرسال بريد، تسليم طرود، تحويل أموال، صرافة'),
      ], { featuresLabel: 'ما يميز المكتب', featuresPlaceholder: 'اذكر ساعات العمل والحزم.', includeExperience: false }),
      specialties: ['إرسال بريد', 'تسليم طرود وشحنات', 'تحويل أموال', 'صرافة', 'خدمات إلكترونية'],
    },
  },

  // Business
  { slug: 'construction', name: 'شركات مقاولات', groupId: 'business', icon: HardHat, color: 'blue',
    fields: {
      nameLabel: 'اسم الشركة', namePlaceholder: 'مثال: شركة البناء المتكاملة',
      profession: 'مهندس مقاول', professionLabel: 'المجال',
      locationLabel: 'عنوان الشركة', phoneLabel: 'رقم التواصل',
      registration: reg([
        txt('specialties', 'التخصصات', 'مثال: بناء منازل، تشطير، ترميم، بناء مباني تجارية'),
      ], { featuresLabel: 'ما يميز الشركة', featuresPlaceholder: 'اذكر الخبرات والمشاريع السابقة.' }),
      specialties: ['بناء منازل', 'ترميم وتشطير', 'مباني تجارية', 'بناء فلل', 'تشطير وتصميم ديكور'],
    },
  },
  { slug: 'software', name: 'شركات برمجة', groupId: 'business', icon: Code, color: 'blue',
    fields: {
      nameLabel: 'اسم الشركة', namePlaceholder: 'مثال: شركة البرمجيات المتقدمة',
      profession: 'مطوّر برامج', professionLabel: 'نوع التطبيقات',
      locationLabel: 'عنوان الشركة', phoneLabel: 'رقم التواصل',
      registration: reg([
        txt('devTypes', 'أنواع التطبيقات', 'مثال: تطبيقات موبايل، مواقع ويب، أنظمة ERP، متاجر إلكترونية'),
      ], { featuresLabel: 'ما يميز الشركة', featuresPlaceholder: 'اذكر التقنيات وأطر العمل.' }),
      specialties: ['تطبيقات موبايل', 'مواقع ويب', 'أنظمة ERP', 'متاجر إلكترونية', 'تطبيقات سطح مكتب'],
    },
  },
  { slug: 'design', name: 'شركات تصميم', groupId: 'business', icon: Palette, color: 'blue',
    fields: {
      nameLabel: 'اسم الشركة', namePlaceholder: 'مثال: شركة التصميم الإبداعي',
      profession: 'مصمم جرافيك', professionLabel: 'مجال التصميم',
      locationLabel: 'عنوان الشركة', phoneLabel: 'رقم التواصل',
      registration: reg([
        txt('designTypes', 'نوع التصاميم', 'مثال: هوية بصرية، تصميم مواقع، تصميم منتجات، كتيبات'),
      ], { featuresLabel: 'ما يميز الشركة', featuresPlaceholder: 'اذكر الخبرات والأسلوب الإبداعي.' }),
      specialties: ['هوية بصرية', 'تصميم مواقع ويب', 'تصميم منتجات', 'كتيبات دعائية', 'تصميم هواتف لوحية'],
    },
  },
  { slug: 'real-estate', name: 'مكاتب عقارات', groupId: 'business', icon: Home, color: 'blue',
    fields: {
      nameLabel: 'اسم المكتب', namePlaceholder: 'مثال: مكتب عقارات السليماني',
      profession: 'وسيط عقاري', professionLabel: 'نوع العقارات',
      locationLabel: 'عنوان المكتب', phoneLabel: 'رقم التواصل',
      registration: reg([
        txt('propertyTypes', 'أنواع العقارات', 'مثال: شقق، فيلات، أراضي، مكاتب، مستودعات'),
      ], { featuresLabel: 'ما يميز المكتب', featuresPlaceholder: 'اذكر المناطق والخبرات.' }),
      specialties: ['تأجير شقق', 'بيع فيلات', 'تأجير مكاتب', 'مبيعات أراضي', 'إدارة مستثمرات عقارية'],
    },
  },

    // Reuse the directory's existing slugs; database IDs are resolved by useCategories.
  {
    slug: 'steel', name: 'الحديد والصلب', groupId: 'business', icon: Factory, color: 'blue',
    keywords: ['حديد', 'صلب', 'حديد تسليح', 'ستيل', 'فولاذ', 'steel', 'iron'],
    fields: {
      nameLabel: 'اسم المحل / الشركة', namePlaceholder: 'مثال: محل الحديد والصلب',
      profession: 'تجارة الحديد والصلب',
      registration: reg([
        txt('workType', 'نوع العمل', 'مثال: بيع حديد تسليم، تشكيم، قص وتمليص، توريق'),
      ], { featuresLabel: 'ما يميز المحل', featuresPlaceholder: 'اذكر الأسعار والخدمات.' }),
      specialties: ['حديد تسليح', 'صفائح حديد', 'أنابيب حديد', 'فولاذ وستيل'],
    },
  },
  {
    slug: 'aluminum-glass', name: 'الألمنيوم', groupId: 'business', icon: PanelsTopLeft, color: 'blue',
    keywords: ['ألمنيوم', 'المنيوم', 'ألمنيون', 'الومنيوم', 'شبابيك ألمنيوم', 'aluminum', 'aluminium'],
    fields: {
      nameLabel: 'اسم الورشة / المحل', namePlaceholder: 'مثال: ورشة الألمنيوم',
      profession: 'أعمال ألمنيوم',
      registration: reg([
        txt('workType', 'نوع الأعمال', 'مثال: أبواب، شبابيك، واجهات زجاجية، نوافذ ديكور'),
      ], { featuresLabel: 'ما يميز الورشة', featuresPlaceholder: 'اذكر التصاميم والمواد.' }),
      specialties: ['أعمال ألمنيوم', 'واجهات زجاجية', 'أبواب ألمنيوم', 'مطابخ ألمنيوم'],
    },
  },
  {
    slug: 'pvc', name: 'PVC', groupId: 'business', icon: DoorOpen, color: 'blue',
    keywords: ['بي في سي', 'بيفي سي', 'بيفيسي', 'يو بي في سي', 'upvc', 'أبواب PVC', 'شبابيك PVC'],
    fields: {
      nameLabel: 'اسم الورشة / المحل', namePlaceholder: 'مثال: ورشة PVC',
      profession: 'أعمال PVC',
      registration: reg([
        txt('workType', 'نوع الأعمال', 'مثال: أبواب PVC، شبابيك PVC، أبواب UPVC، نوافذ ديكور'),
      ], { featuresLabel: 'ما يميز الورشة', featuresPlaceholder: 'اذكر الأنواع والمقاسات.' }),
      specialties: ['أبواب PVC', 'شبابيك PVC', 'أبواب UPVC', 'شبابيك UPVC'],
    },
  },
  {
    slug: 'perfumes-cosmetics', name: 'كوزمتك ومستحضرات التجميل', groupId: 'shopping', icon: SprayCan, color: 'pink',
    keywords: ['كوزمتك', 'كوزمتكس', 'كوزماتك', 'مستحضرات التجميل', 'مكياج', 'ميك اب', 'ميك أب', 'cosmetics', 'makeup'],
    fields: {
      nameLabel: 'اسم المحل', namePlaceholder: 'مثال: محل مستحضرات التجميل',
      profession: 'بائع مستحضرات تجميل',
      registration: reg([
        txt('productTypes', 'أنواع المنتجات', 'مثال: عطور، مكياج، مستحضرات عناية، مكياج شفاه'),
        txt('brands', 'العلامات التجارية', 'مثال: نويبويا، مي بالاي، خوش مون، إيانيولا'),
      ], { featuresLabel: 'ما يميز المحل', featuresPlaceholder: 'اذكر العلامات التجارية الساخنة.' }),
      specialties: ['مكياج', 'مستحضرات عناية بالبشرة', 'عناية بالشعر', 'عطور'],
    },
  },
];

/* Unified theme-aware palette — follows the active theme accent via CSS variables
   (بنفسجي في Light/Royal، أحمر #D90429 في ثيم الأبيض والأحمر) */
export const colorMap = {
  green: { text: 'text-[var(--accent-primary)]', border: 'border-[var(--accent-primary)]', bg: 'bg-[var(--accent-primary)]', shadow: 'shadow-[0_4px_14px_var(--glow)]', hover: 'hover:shadow-[0_6px_20px_var(--focus-ring)]' },
  blue: { text: 'text-[var(--accent-primary)]', border: 'border-[var(--accent-primary)]', bg: 'bg-[var(--accent-primary)]', shadow: 'shadow-[0_4px_14px_var(--glow)]', hover: 'hover:shadow-[0_6px_20px_var(--focus-ring)]' },
  purple: { text: 'text-[var(--accent-primary)]', border: 'border-[var(--accent-primary)]', bg: 'bg-[var(--accent-primary)]', shadow: 'shadow-[0_4px_14px_var(--glow)]', hover: 'hover:shadow-[0_6px_20px_var(--focus-ring)]' },
  pink: { text: 'text-[var(--accent-primary)]', border: 'border-[var(--accent-primary)]', bg: 'bg-[var(--accent-primary)]', shadow: 'shadow-[0_4px_14px_var(--glow)]', hover: 'hover:shadow-[0_6px_20px_var(--focus-ring)]' },
  orange: { text: 'text-[var(--accent-primary)]', border: 'border-[var(--accent-primary)]', bg: 'bg-[var(--accent-primary)]', shadow: 'shadow-[0_4px_14px_var(--glow)]', hover: 'hover:shadow-[0_6px_20px_var(--focus-ring)]' },
};

/* Red & White palette for category icons ONLY (as requested):
   - icon glyph, border and icon frame in red #D90429
   - clean white icon background
   - no neon, no glow, no gradients, no multi-colors
   This is intentionally a SEPARATE export so the original `colorMap`,
   the theme system and AdminDashboard remain completely untouched. */
export const colorMapRedWhite = {
  green: { text: 'text-[#D90429]', border: 'border-[#D90429]', bg: 'bg-[#D90429]', shadow: '', hover: '' },
  blue: { text: 'text-[#D90429]', border: 'border-[#D90429]', bg: 'bg-[#D90429]', shadow: '', hover: '' },
  purple: { text: 'text-[#D90429]', border: 'border-[#D90429]', bg: 'bg-[#D90429]', shadow: '', hover: '' },
  pink: { text: 'text-[#D90429]', border: 'border-[#D90429]', bg: 'bg-[#D90429]', shadow: '', hover: '' },
  orange: { text: 'text-[#D90429]', border: 'border-[#D90429]', bg: 'bg-[#D90429]', shadow: '', hover: '' },
};
