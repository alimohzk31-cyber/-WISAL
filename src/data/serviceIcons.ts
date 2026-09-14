import type { LucideIcon } from 'lucide-react';
import { getCategoryIcon } from './categoryIcons';
import {
  FolderOpen, Hospital, Pill, Stethoscope, Bone, Ambulance, Microscope,
  Wrench, Hammer, Code, Smartphone, PlugZap, Car, CarFront, Forklift, Fuel, UtensilsCrossed,
  Coffee, ShoppingCart, Store, Banknote, CreditCard, ShieldCheck, Siren,
  Scale, Landmark, GraduationCap, BookOpen, Hotel, Home, Truck, Package,
  Plane, Dumbbell, Trophy, Waves, TreePine, Shirt, Monitor, Sparkles,
  CircleDollarSign, Baby, PawPrint, Cake, Gamepad2, HardHat, HeartPulse,
  Moon, Palette, Wifi, Factory, PanelsTopLeft, DoorOpen, SprayCan,
} from 'lucide-react';

// =============================================================================
// serviceIcons — النظام المركزي لأيقونات الخدمات
// -----------------------------------------------------------------------------
// فكرة النظام: كل نوع خدمة (فئة) يُربط بأيقونة معبّرة عنه + لون فئته، ويتم
// البحث عن الأيقونة عبر مفاتيح متعددة (slug عربي/إنجليزي، الاسم العربي بصيغه
// المختلفة، اسم الأيقونة المحفوظ) حتى تعمل الخدمات القديمة في قاعدة البيانات
// دون أي تعديل يدوي.
//
// ملاحظات مهمة:
// - لا نستخدم Emoji في الواجهة؛ كل الأيقونات من lucide-react (المكتبة الموجودة).
// - دالة التطبيع normalizeServiceKey توحّد الصيغ: (صيدلية / صيدليه / Pharmacy).
// - أي خدمة/فئة جديدة غير موجودة في الخريطة تعود بأيقونة fallback آمنة
//   (FolderOpen) بدل خطأ أو مساحة فارغة.
// =============================================================================

// ألوان متوافقة مع نظام ألوان الفئات الحالي في المشروع (colorMap/categories)
export interface IconColorStyle {
  text: string;
  bg: string;
}

const ICON_COLOR_STYLES: Record<string, IconColorStyle> = {
  red: { text: 'text-red-500', bg: 'bg-red-500/10' },
  blue: { text: 'text-blue-500', bg: 'bg-blue-500/10' },
  green: { text: 'text-green-500', bg: 'bg-green-500/10' },
  yellow: { text: 'text-yellow-500', bg: 'bg-yellow-500/10' },
  purple: { text: 'text-purple-500', bg: 'bg-purple-500/10' },
  orange: { text: 'text-orange-500', bg: 'bg-orange-500/10' },
  teal: { text: 'text-teal-500', bg: 'bg-teal-500/10' },
  pink: { text: 'text-pink-500', bg: 'bg-pink-500/10' },
  cyan: { text: 'text-cyan-500', bg: 'bg-cyan-500/10' },
  indigo: { text: 'text-indigo-500', bg: 'bg-indigo-500/10' },
  amber: { text: 'text-amber-500', bg: 'bg-amber-500/10' },
};

const DEFAULT_COLOR_STYLE: IconColorStyle = {
  text: 'text-slate-400',
  bg: 'bg-slate-500/10',
};

export function getIconColorStyles(color?: string | null): IconColorStyle {
  if (!color) return DEFAULT_COLOR_STYLE;
  return ICON_COLOR_STYLES[String(color).trim().toLowerCase()] ?? DEFAULT_COLOR_STYLE;
}

// الأيقونة العامة الاحتياطية (fallback) لأي خدمة/فئة جديدة غير معروفة
export const FALLBACK_SERVICE_ICON: LucideIcon = FolderOpen;
export const FALLBACK_SERVICE_COLOR: IconColorStyle = DEFAULT_COLOR_STYLE;

interface ServiceIconEntry {
  icon: LucideIcon;
  color: string;
  // كل الصيغ الممكنة: slug + الاسم العربي بالهمزات/بدونها + الاسم الإنجليزي
  aliases: string[];
}

const SERVICE_ICON_ENTRIES: ServiceIconEntry[] = [
  { icon: Factory, color: 'blue', aliases: ['steel', 'الحديد والصلب', 'حديد تسليح', 'فولاذ'] },
  { icon: PanelsTopLeft, color: 'blue', aliases: ['aluminum-glass', 'aluminum', 'aluminium', 'الألمنيوم', 'الألمنيوم والزجاج'] },
  { icon: DoorOpen, color: 'blue', aliases: ['pvc', 'upvc', 'بي في سي', 'بيفيسي'] },
  { icon: SprayCan, color: 'pink', aliases: ['perfumes-cosmetics', 'كوزمتك', 'كوزمتك ومستحضرات التجميل'] },
  { icon: Shirt, color: 'pink', aliases: ['clothing', 'womens-clothes', 'kids-clothes', 'mens-clothes', 'محلات الملابس'] },
  // ------------------------- الصحة -------------------------
  { icon: Hospital, color: 'red', aliases: ['hospital', 'hospitals', 'مستشفى', 'مستشفيات', 'المستشفى'] },
  { icon: Pill, color: 'green', aliases: ['pharmacy', 'pharmacies', 'drugstore', 'صيدلية', 'صيدليه', 'صيدليات', 'الصيدلية', 'ادوية', 'أدوية'] },
  { icon: Stethoscope, color: 'blue', aliases: ['doctor', 'doctors', 'clinic', 'clinics', 'طبيب', 'أطباء', 'اطباء', 'عيادة', 'عياده', 'عيادات', 'العيادات'] },
  { icon: Bone, color: 'cyan', aliases: ['dentist', 'dental', 'طبيب اسنان', 'طبيب أسنان', 'اسنان', 'أسنان'] },
  { icon: Ambulance, color: 'red', aliases: ['ambulance', 'ems', 'اسعاف', 'إسعاف', 'الاسعاف'] },
  { icon: Microscope, color: 'purple', aliases: ['lab', 'laboratory', 'labs', 'مختبر', 'مختبرات', 'مخابر', 'تحاليل', 'مختبر طبي'] },
  { icon: Baby, color: 'pink', aliases: ['pediatric', 'pediatrics', 'أطفال', 'اطفال', 'طفل', 'حضانة', 'حضانه'] },
  { icon: PawPrint, color: 'orange', aliases: ['vet', 'veterinary', 'pets', 'بيطري', 'بيطرة', 'حيوانات'] },

  // ------------------------- الصيانة والتقنية -------------------------
  { icon: Wrench, color: 'orange', aliases: ['maintenance', 'صيانة', 'صيانه', 'الصيانة'] },
  { icon: Hammer, color: 'orange', aliases: ['repair', 'fix', 'تصليح', 'اصلاح', 'إصلاح'] },
  { icon: Code, color: 'indigo', aliases: ['programming', 'code', 'developer', 'برمجة', 'برمجه', 'برمجيات'] },
  { icon: Smartphone, color: 'blue', aliases: ['phone', 'phones', 'mobile', 'هاتف', 'هواتف', 'موبايل', 'جوال', 'صيانة هواتف'] },
  { icon: PlugZap, color: 'yellow', aliases: ['electricity', 'electrician', 'كهرباء', 'كهربائي', 'كهربائيات'] },
  { icon: Sparkles, color: 'pink', aliases: ['beauty', 'barber', 'barbershop', 'salon', 'حلاق', 'حلاقة', 'حلاقه', 'صالون', 'تجميل'] },

  // ------------------------- السيارات -------------------------
  { icon: Car, color: 'red', aliases: ['car', 'cars', 'auto', 'سيارة', 'سياره', 'سيارات', 'السيارات'] },
  { icon: Fuel, color: 'orange', aliases: ['fuel', 'gas', 'petrol', 'station', 'محطة وقود', 'محطه وقود', 'محطات وقود', 'وقود', 'بنزين'] },

  // ------------------------- المطاعم والتسوق -------------------------
  { icon: UtensilsCrossed, color: 'orange', aliases: ['restaurant', 'restaurants', 'food', 'مطعم', 'مطاعم', 'وجبات', 'اكل', 'أكل'] },
  { icon: Coffee, color: 'amber', aliases: ['cafe', 'coffee', 'مقهى', 'كافيه', 'مقاهي'] },
  { icon: ShoppingCart, color: 'pink', aliases: ['shopping', 'supermarket', 'grocery', 'تسوق', 'تسويق', 'سوبر ماركت', 'ماركت', 'بقالة', 'بقاله'] },
  { icon: Store, color: 'pink', aliases: ['store', 'shop', 'stores', 'متجر', 'متاجر', 'متجرات'] },
  { icon: Shirt, color: 'pink', aliases: ['clothes', 'fashion', 'ملابس', 'أزياء', 'ازياء'] },
  { icon: Monitor, color: 'blue', aliases: ['electronics', 'إلكترونيات', 'الكترونيات', 'اجهزة', 'أجهزة'] },

  // ------------------------- المال -------------------------
  { icon: Banknote, color: 'green', aliases: ['bank', 'banking', 'مصرف', 'مصارف', 'بنك', 'بنوك'] },
  { icon: CreditCard, color: 'indigo', aliases: ['atm', 'cash machine', 'صراف', 'صراف الي', 'صراف آلي'] },
  { icon: CircleDollarSign, color: 'green', aliases: ['exchange', 'money', 'صرافة', 'صرافه', 'حوالات', 'صرف'] },

  // ------------------------- الأمن والدولة -------------------------
  { icon: ShieldCheck, color: 'blue', aliases: ['police', 'شرطة', 'شرطه', 'شرطي', 'أمن', 'امن'] },
  { icon: Siren, color: 'red', aliases: ['fire', 'firefighter', 'fire station', 'اطفاء', 'إطفاء', 'دفاع مدني', 'الحماية المدنية'] },
  { icon: Scale, color: 'purple', aliases: ['law', 'lawyer', 'legal', 'محاماة', 'محاماه', 'محامي', 'قانون', 'قانوني'] },
  { icon: Landmark, color: 'indigo', aliases: ['government', 'gov', 'دوائر حكومية', 'دوائر حكوميه', 'حكومي', 'بلدية', 'بلديه', 'مجلس', 'دائرة'] },

  // ------------------------- التعليم -------------------------
  { icon: GraduationCap, color: 'pink', aliases: ['education', 'school', 'schools', 'university', 'institute', 'institutes', 'تعليم', 'مدارس', 'مدرسة', 'مدرسه', 'جامعة', 'جامعه', 'جامعات', 'معاهد', 'معهد', 'دروس', 'تدريس'] },
  { icon: BookOpen, color: 'yellow', aliases: ['library', 'libraries', 'books', 'مكتبة', 'مكتبه', 'مكتبات', 'كتب', 'قرطاسية', 'قرطاسيه'] },

  // ------------------------- السكن والسفر -------------------------
  { icon: Hotel, color: 'purple', aliases: ['hotel', 'hotels', 'hostel', 'فندق', 'فنادق'] },
  { icon: Home, color: 'cyan', aliases: ['real estate', 'realestate', 'property', 'house', 'عقارات', 'عقار', 'منزل', 'مسكن'] },
  { icon: Truck, color: 'orange', aliases: ['delivery', 'shipping', 'cargo', 'شحن', 'توصيل', 'نقل'] },
  { icon: Package, color: 'orange', aliases: ['package', 'parcels', 'صندوق', 'طرود', 'اشحن'] },
  { icon: Plane, color: 'cyan', aliases: ['travel', 'flight', 'airline', 'سفر', 'طيران', 'سياحة', 'سياحه'] },

  // ------------------------- الرياضة -------------------------
  { icon: Dumbbell, color: 'green', aliases: ['gym', 'fitness', 'صالة رياضية', 'صاله رياضيه', 'صالات رياضية', 'جيم', 'رياضة', 'رياضه'] },
  { icon: Trophy, color: 'green', aliases: ['football', 'soccer', 'كرة', 'كره', 'ملاعب', 'ملعب'] },
  { icon: Waves, color: 'cyan', aliases: ['pool', 'swimming', 'مسبح', 'مسابح'] },
  { icon: TreePine, color: 'green', aliases: ['park', 'garden', 'حديقة', 'حديقه', 'حدائق'] },

  // ------------------------- تغطية إضافية: كل slugs الفئات الموجودة فعلياً -------------------------
  { icon: HeartPulse, color: 'red', aliases: ['physio', 'physiotherapy', 'علاج طبيعي', 'علاج طبيعى'] },
  { icon: GraduationCap, color: 'pink', aliases: ['tutor', 'دروس خصوصية', 'دروس خصوصيه'] },
  { icon: Gamepad2, color: 'green', aliases: ['kids-area', 'kids', 'ألعاب أطفال', 'لعبة أطفال'] },
  { icon: Store, color: 'pink', aliases: ['mall', 'مولات', 'مول'] },
  { icon: UtensilsCrossed, color: 'orange', aliases: ['fast-food', 'وجبات سريعة', 'وجبات سريعه', 'برجر'] },
  { icon: Cake, color: 'pink', aliases: ['sweets', 'bakery', 'حلويات', 'مخبز', 'كيك'] },
  { icon: Wrench, color: 'orange', aliases: ['plumber', 'appliance-repair', 'سباكة', 'سباك', 'تمديدات', 'صيانة أجهزة', 'مكيفات'] },
  { icon: Sparkles, color: 'teal', aliases: ['cleaning', 'تنظيف', 'نظافة', 'شركة نظافة'] },
  { icon: Hammer, color: 'amber', aliases: ['carpenter', 'نجارة', 'نجار', 'أثاث'] },
  { icon: Moon, color: 'green', aliases: ['mosque', 'مسجد', 'مساجد'] },
  { icon: Fuel, color: 'orange', aliases: ['gas-station', 'محطة بنزين', 'محطه بنزين'] },
  { icon: Package, color: 'indigo', aliases: ['post-office', 'بريد', 'بريد سريع'] },
  { icon: HardHat, color: 'yellow', aliases: ['construction', 'بناء', 'مقاولات', 'إنشاءات', 'انشاءات'] },
  { icon: Code, color: 'indigo', aliases: ['software', 'تطبيقات', 'برامج', 'مواقع'] },
  { icon: Palette, color: 'pink', aliases: ['design', 'تصميم', 'جرافيك'] },
  { icon: Home, color: 'cyan', aliases: ['real-estate', 'عقاري'] },
  { icon: ShieldCheck, color: 'blue', aliases: ['insurance', 'تأمين', 'تامين'] },
  { icon: Smartphone, color: 'blue', aliases: ['telecom', 'اتصالات', 'شبكات'] },
  { icon: Wifi, color: 'cyan', aliases: ['internet', 'انترنت', 'wifi'] },
  { icon: Scale, color: 'purple', aliases: ['legal-consult', 'استشارات قانونية', 'استشارات'] },
  // أقسام السيارات الفرعية (carSubSlugs) → أيقونة السيارة
  { icon: Car, color: 'red', aliases: ['car-repair', 'car-electric', 'oil-change', 'car-wash', 'spare-parts', 'car-tires', 'car-accessories', 'car-filters', 'car-glass', 'ورشة سيارات', 'زيوت', 'غسيل سيارات', 'قطع غيار'] },
  { icon: CarFront, color: 'blue', aliases: ['car-rentals', 'تأجير سيارات', 'تأجير سياره', 'تأجير سيارة', 'إيجار سيارات', 'إيجار سيارة', 'كراء سيارات', 'سيارة للايجار', 'سيارات للتأجير'] },
  { icon: Forklift, color: 'orange', aliases: ['crane-rentals', 'تأجير كرينات', 'تأجير كرين', 'كرين', 'كرينة', 'رافعة شوكية', 'رافعه شوكيه', 'كرين هيدروليكي', 'كرينات'] },
  { icon: Plane, color: 'cyan', aliases: ['airlines', 'travel-agency', 'وكالة سفر', 'وكاله سفر'] },
  { icon: FolderOpen, color: 'slate', aliases: ['general', 'عام', 'أخرى', 'اخرى', 'other'] },
];

// تطبيع المفتاح: إزالة التشكيل، توحيد الهمزات، التاء المربوطة، الألف المقصورة،
// والأحرف اللاتينية إلى lowercase — حتى تتطابق كل الصيغ مع نفس الأيقونة
// (مثال: صيدلية / صيدليه / Pharmacy → نفس الأيقونة).
export function normalizeServiceKey(raw: string): string {
  return String(raw ?? '')
    .trim()
    .toLowerCase()
    .replace(/[\u064B-\u0652\u0670\u0640]/g, '') // التشكيل والتطويل
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/[ىئي]/g, 'ي')
    .replace(/\s+/g, ' ');
}

// خريطة البحث المركزية: مفتاح مُطبَّع → مدخل الأيقونة
const SERVICE_ICON_LOOKUP: Map<string, ServiceIconEntry> = (() => {
  const map = new Map<string, ServiceIconEntry>();
  for (const entry of SERVICE_ICON_ENTRIES) {
    for (const alias of entry.aliases) {
      const key = normalizeServiceKey(alias);
      if (key && !map.has(key)) map.set(key, entry);
    }
  }
  return map;
})();

export interface ResolvedServiceIcon {
  icon: LucideIcon;
  color: string;
  colorStyles: IconColorStyle;
}

// البحث المباشر في الخريطة المركزية. يعيد null إذا لم يوجد تطابق (بدون fallback)
// حتى يستطيع المستدعي التمييز بين "موجود فعلاً" و"fallback".
export function lookupServiceIcon(raw?: string | null): ResolvedServiceIcon | null {
  if (!raw) return null;
  const key = normalizeServiceKey(raw);
  if (!key) return null;
  const entry = SERVICE_ICON_LOOKUP.get(key);
  if (!entry) return null;
  return { icon: entry.icon, color: entry.color, colorStyles: getIconColorStyles(entry.color) };
}

// الحل الشامل لأيقونة فئة/خدمة: يُستخدم في كل مكان يُعرض فيه نوع الخدمة.
// الترتيب:
//   1) الأيقونة المحفوظة على الفئة إن كانت مكوّن React جاهزاً (الفئات الثابتة).
//   2) الخريطة المركزية عبر slug الفئة.
//   3) الخريطة المركزية عبر اسم الفئة العربي (كل صيغه).
//   4) الخريطة المركزية عبر اسم الأيقونة المحفوظ (نص) — مثل 'Pill'.
//   5) fallback آمن: FolderOpen — بدون خطأ أو مساحة فارغة.
export function resolveCategoryIcon(category?: {
  icon?: unknown;
  slug?: string;
  name?: string;
  color?: string;
} | null): ResolvedServiceIcon {
  if (category) {
    // 1) الفئات الثابتة تحمل مكوّن الأيقونة مباشرة — نحترمه ونستخدم لون الفئة
    if (typeof category.icon === 'function') {
      return {
        icon: category.icon as LucideIcon,
        color: category.color ?? 'slate',
        colorStyles: getIconColorStyles(category.color),
      };
    }
    // 2) slug → أيقونة
    const bySlug = lookupServiceIcon(category.slug);
    if (bySlug) return bySlug;
    // 3) الاسم العربي (كل الصيغ) → أيقونة
    const byName = lookupServiceIcon(category.name);
    if (byName) return byName;
    // 4) اسم الأيقونة المحفوظ نصياً → أيقونة (يغطي قيم قديمة مثل 'Pill')
    if (typeof category.icon === 'string' && category.icon.trim()) {
      const byIconName = lookupServiceIcon(category.icon);
      if (byIconName) return byIconName;
      // 4-ب) خريطة الأيقونات القديمة categoryIcons (بما فيها الأيقونات
      //      المعبرية المضافة حديثاً) قبل الوقوع في الـ fallback العام
      const legacy = getCategoryIcon(category.icon);
      const generic = getCategoryIcon(undefined);
      if (legacy && legacy !== generic) {
        return {
          icon: legacy,
          color: category.color ?? 'slate',
          colorStyles: getIconColorStyles(category.color),
        };
      }
    }
  }
  // 5) Fallback
  return { icon: FALLBACK_SERVICE_ICON, color: 'slate', colorStyles: FALLBACK_SERVICE_COLOR };
}

// اختصار شائع: أيقونة فقط (مع fallback) — للفئات التي تُعرض في واجهات بسيطة
export function getServiceIcon(slugOrName?: string | null): LucideIcon {
  return lookupServiceIcon(slugOrName)?.icon ?? FALLBACK_SERVICE_ICON;
}
