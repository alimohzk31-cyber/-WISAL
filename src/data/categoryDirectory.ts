import {
  Stethoscope, Hospital, Pill, TestTube, Sparkles, HeartPulse, GraduationCap,
  Car, HardHat, Wrench, Zap, Snowflake, Smartphone, Utensils, House,
  Sun, Monitor, Camera, Building2, Plane, Truck, Sofa, PanelsTopLeft,
  Paintbrush, Droplets, PartyPopper, Flower2, Scissors, BookOpen, Video,
  Calculator, Briefcase, PawPrint, ShieldCheck, Bus, Scale, Wifi,
  Dumbbell, ShoppingCart, Landmark, Code, FolderOpen, Gem, Refrigerator,
  BrickWall, DoorOpen, ArrowUpDown, Gamepad2, SprayCan, Footprints, Printer,
  Megaphone, Network, Grid2X2, Trees, Construction, FileText, Factory,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { Service } from '../hooks/useServices';
import { RAW_CATEGORY_SYNONYMS } from './categorySynonyms';
import { getCategoryFieldConfig } from './categoryFields';
import { resolveCategoryIcon } from './serviceIcons';

// Presentation only. These identifiers are routes/filters, NEVER database IDs.
export interface DirectoryChild { slug: string; name: string; aliases: string[] }
export interface DirectorySection extends DirectoryChild {
  icon: LucideIcon;
  color: 'blue';
  children: DirectoryChild[];
}
export interface SourceCategory {
  slug: string; name: string; dbId?: string | number; groupId?: string;
  icon?: unknown; color?: string;
}
export interface CategoryPlacement { sectionSlug: string; childSlug?: string }
export interface DisplaySection extends DirectorySection {
  sources: SourceCategory[];
  searchText: string;
}
const child = (slug: string, name: string, ...aliases: string[]): DirectoryChild => ({ slug, name, aliases });
const section = (slug: string, name: string, icon: LucideIcon, aliases: string[], children: DirectoryChild[]): DirectorySection =>
  ({ slug, name, icon, aliases, children, color: 'blue' });

// Explicit ownership avoids repeating veterinary care, paintwork, and alarms.
export const directorySections: DirectorySection[] = [
  section('doctors', 'الأطباء', Stethoscope, ['clinic', 'clinics', 'doctor', 'عيادات', 'طبيب', 'دكتور'], [
    child('dentist', 'أسنان', 'dental', 'أطباء أسنان', 'طبيب أسنان', 'تقويم أسنان'),
    child('internal-medicine', 'باطنية', 'باطني', 'طب باطني'), child('pediatrics', 'أطفال', 'pediatric', 'طب أطفال'),
    child('orthopedics', 'عظام', 'طبيب عظام'), child('ophthalmology', 'عيون', 'طبيب عيون'),
    child('dermatology', 'جلدية', 'طبيب جلدية'), child('cardiology', 'قلب', 'طبيب قلب'),
    child('gynecology', 'نسائية وتوليد', 'طب نسائية وتوليد'), child('ent', 'أنف وأذن وحنجرة'),
    child('neurology', 'أعصاب', 'مخ وأعصاب'), child('general-medicine', 'طب عام', 'طبيب عام'),
  ]),
  section('hospitals', 'المستشفيات', Hospital, ['hospital', 'مستشفى', 'مستشفيات'], [
    child('public-hospitals', 'حكومية', 'مستشفيات حكومية', 'مستشفى حكومي'),
    child('private-hospitals', 'أهلية', 'مستشفيات أهلية', 'مستشفى أهلي'),
    child('health-centers', 'مراكز صحية', 'مركز صحي', 'مستوصف', 'مستوصفات'),
  ]),
  section('pharmacies', 'الصيدليات', Pill, ['pharmacy', 'صيدلية', 'صيدليات'], [child('medicines', 'أدوية'), child('medical-supplies', 'مستلزمات طبية')]),
  section('laboratories', 'المختبرات والتحاليل', TestTube, ['lab', 'laboratory', 'مختبرات تحليل', 'مختبر', 'تحاليل'], [child('medical-tests', 'تحاليل طبية'), child('imaging', 'أشعة وسونار', 'سونار', 'أشعة')]),
  section('rehabilitation', 'العلاج الطبيعي', HeartPulse, ['physio', 'علاج طبيعي'], [child('physiotherapy', 'علاج وتأهيل'), child('medical-massage', 'مساج علاجي')]),
  section('beauty-care', 'التجميل والعناية', Sparkles, ['beauty', 'مراكز تجميل', 'تجميل', 'صالونات'], [child('beauty-centers', 'مراكز تجميل'), child('salons', 'صالونات وحلاقة', 'حلاق', 'صالون'), child('skin-care', 'عناية بالبشرة')]),
  section('education', 'الجامعات والتعليم', GraduationCap, ['تعليم', 'university', 'جامعات', 'جامعة', 'التدريب المهني', 'vocational-training'], [
    child('public-universities', 'جامعات حكومية', 'جامعة حكومية'), child('private-universities', 'جامعات أهلية', 'جامعة أهلية'),
    child('colleges', 'كليات', 'كلية'), child('institute', 'معاهد', 'معهد'), child('school', 'مدارس', 'مدرسة'), child('tutor', 'دروس خصوصية', 'مدرس خصوصي'),
    child('computer-training', 'دورات حاسوب'), child('language-training', 'دورات لغات'), child('vocational-training', 'دورات مهنية', 'تدريب مهني'),
    child('skills-training', 'تطوير مهارات'), child('technical-training', 'دورات تقنية'),
  ]),
  section('cars', 'السيارات', Car, ['سيارات', 'car'], [
    child('car-sales', 'بيع وشراء', 'بيع وشراء سيارات', 'معارض سيارات', 'car-dealer'),
    child('car-repair', 'صيانة وورش', 'ورش سيارات', 'صيانة سيارات', 'ورشة سيارات'),
    child('car-mechanic', 'ميكانيك', 'ميكانيكي', 'ميكانيك سيارات'), child('car-electric', 'كهرباء سيارات'),
    child('oil-change', 'تبديل زيوت', 'تبديل زيت'), child('car-tires', 'إطارات', 'إطارات سيارات', 'بنجرجي'),
    child('spare-parts', 'قطع غيار', 'قطع غيار سيارات'), child('car-wash', 'غسيل وتلميع', 'غسيل سيارات', 'تلميع سيارات'),
    child('car-accessories', 'كماليات', 'كماليات سيارات'), child('car-filters', 'فلاتر سيارات'), child('car-glass', 'زجاج سيارات'), child('car-rental', 'تأجير سيارات'),
  ]),
  section('construction', 'البناء والإنشاءات', HardHat, ['شركات مقاولات', 'بناء', 'مقاولات', 'بناء البيوت'], [
    child('building', 'بناء', 'بناء منازل', 'بناء بيوت'), child('contracting', 'مقاولات', 'مقاول'), child('renovation', 'ترميم', 'ترميم منازل'),
  ]),
  section('plumbing', 'السباكة والصحيات', Wrench, ['plumber', 'سباك', 'سباكة', 'صحيات'], [
    child('plumber-services', 'سباك'), child('plumbing-installation', 'تأسيس صحي'), child('plumbing-repair', 'صيانة صحيات', 'صيانة سباكة'),
  ]),
  section('electrical', 'الكهرباء', Zap, ['electrician', 'كهربائي', 'كهرباء'], [
    child('home-electrician', 'كهربائي منازل'), child('electrical-installation', 'تأسيس كهربائي'), child('electrical-repair', 'صيانة كهربائية'),
  ]),
  section('cooling', 'التبريد والتكييف', Snowflake, ['air-conditioning', 'ac-repair', 'تبريد', 'تكييف', 'مكيفات', 'ثلاجات'], [
    child('ac-installation', 'تركيب مكيفات'), child('ac-maintenance', 'صيانة مكيفات', 'تصليح مكيفات'), child('refrigerator-repair', 'صيانة ثلاجات', 'تصليح ثلاجات'),
  ]),
  section('home-services', 'الخدمات المنزلية', House, ['خدمات منزلية', 'الصيانة العامة', 'general-maintenance'], [
    child('cleaning', 'تنظيف', 'تنظيف منازل'), child('carpenter', 'نجارة', 'نجار'),
    child('appliance-repair', 'صيانة أجهزة', 'صيانة أجهزة منزلية'), child('daily-services', 'خدمات يومية'),
    child('home-maintenance', 'صيانة منازل'), child('shop-maintenance', 'صيانة محلات'), child('general-maintenance', 'أعمال صيانة متنوعة'), child('emergency-maintenance', 'خدمات طوارئ منزلية'),
  ]),
  section('solar-energy', 'الطاقة الشمسية', Sun, ['solar', 'solar-panels', 'طاقة شمسية'], [
    child('solar-panels', 'ألواح شمسية'), child('solar-batteries', 'بطاريات'), child('solar-inverters', 'إنفرترات', 'انفرتر', 'inverter'), child('solar-maintenance', 'تركيب وصيانة'),
  ]),
  section('computers', 'الحاسبات والكمبيوتر', Monitor, ['computer', 'حاسبات', 'كمبيوتر', 'حاسوب'], [
    child('computer-sales', 'بيع حاسبات'), child('computer-repair', 'صيانة حاسبات'), child('computer-parts', 'قطع غيار'), child('printers-accessories', 'طابعات وإكسسوارات', 'طابعات'),
  ]),
  section('mobile-electronics', 'الموبايلات والإلكترونيات', Smartphone, ['phones', 'electronics', 'هواتف', 'إلكترونيات', 'موبايلات'], [
    child('phone-sales', 'بيع موبايلات', 'بيع هواتف'), child('phone-repair', 'صيانة موبايلات', 'صيانة هواتف'),
    child('phone-accessories', 'إكسسوارات'), child('electronic-devices', 'أجهزة إلكترونية'),
  ]),
  section('surveillance', 'الكاميرات وأنظمة المراقبة', Camera, ['cctv', 'security-cameras', 'كاميرات مراقبة', 'أنظمة مراقبة'], [
    child('cameras', 'كاميرات'), child('recorders', 'DVR/NVR', 'dvr', 'nvr'), child('surveillance-installation', 'تركيب وصيانة المراقبة'),
  ]),
  section('security-safety', 'الأمن والسلامة', ShieldCheck, ['safety', 'security', 'أمن وسلامة', 'حماية'], [
    child('alarms', 'أجهزة إنذار', 'إنذارات', 'إنذار'), child('fire-equipment', 'معدات إطفاء', 'إطفاء'), child('occupational-safety', 'سلامة مهنية'), child('protection-systems', 'أنظمة حماية'),
  ]),
  section('real-estate', 'العقارات', Building2, ['عقار', 'عقارات', 'مكاتب عقارات'], [
    child('property-sale', 'بيع'), child('property-purchase', 'شراء'), child('property-rent', 'إيجار'), child('property-offices', 'مكاتب عقارية'), child('property-management', 'إدارة أملاك'),
  ]),
  section('travel-tourism', 'السفر والسياحة', Plane, ['travel', 'سفر', 'سياحة'], [
    child('travel-agency', 'مكاتب سفر'), child('airlines', 'حجوزات طيران', 'شركات الطيران'), child('hotels', 'فنادق', 'hotel', 'فندق'), child('tours', 'رحلات سياحية'),
  ]),
  section('shipping-delivery', 'الشحن والتوصيل', Truck, ['shipping', 'delivery', 'شحن', 'توصيل'], [
    child('local-delivery', 'توصيل محلي'), child('freight', 'نقل بضائع'), child('intercity-shipping', 'شحن بين المحافظات'), child('post-office', 'بريد'),
  ]),
  section('transport', 'النقل والمواصلات', Bus, ['transportation', 'نقل', 'مواصلات'], [
    child('taxi', 'سيارات أجرة', 'تكسي', 'تاكسي'), child('buses', 'باصات'), child('private-transport', 'نقل خاص'), child('staff-transport', 'نقل موظفين'), child('student-transport', 'نقل طلاب'),
  ]),
  section('furniture', 'الأثاث والمفروشات', Sofa, ['أثاث', 'مفروشات', 'الستائر والمفروشات', 'curtains-furnishings'], [
    child('home-furniture', 'أثاث منزلي'), child('bedrooms', 'غرف نوم'), child('curtains', 'ستائر'), child('carpets', 'سجاد'), child('bedding', 'مفروشات'),
    child('upholstery', 'تنجيد'), child('floor-coverings', 'فرش أرضيات'),
  ]),
  section('aluminum-glass', 'الألمنيوم والزجاج', PanelsTopLeft, ['aluminium', 'aluminum', 'glass', 'ألمنيوم', 'زجاج'], [
    child('glass-facades', 'واجهات زجاجية'), child('aluminum-work', 'أعمال ألمنيوم'),
  ]),
  section('painting-decor', 'الصبغ والديكور', Paintbrush, ['painting', 'decor', 'صبغ', 'ديكور', 'صبغ وترميم'], [
    child('house-painting', 'صبغ منازل', 'صباغ'), child('gypsum', 'جبس', 'جبسن بورد'), child('wallpaper', 'ورق جدران'), child('interior-design', 'ديكور داخلي'),
  ]),
  section('water-treatment', 'تنقية ومعالجة المياه', Droplets, ['water-filters', 'تنقية مياه', 'معالجة مياه'], [
    child('water-filters', 'فلاتر مياه'), child('reverse-osmosis', 'RO'), child('water-maintenance', 'صيانة منظومات المياه'),
  ]),
  section('food', 'المطاعم والأغذية', Utensils, ['مطاعم وأغذية', 'أغذية'], [
    child('restaurant', 'مطاعم', 'مطعم'), child('cafe', 'كافيهات', 'كافيه'), child('fast-food', 'وجبات سريعة'), child('bakery', 'مخابز', 'مخبز', 'أفران'), child('sweets', 'حلويات'),
  ]),
  section('events', 'خدمات المناسبات', PartyPopper, ['مناسبات', 'حفلات'], [
    child('event-halls', 'قاعات', 'قاعة'), child('event-planning', 'تنظيم حفلات'), child('event-decor', 'ديكور مناسبات'), child('weddings', 'تجهيز أعراس'),
  ]),
  section('flowers-gifts', 'الزهور والهدايا', Flower2, ['زهور', 'هدايا', 'flowers', 'gifts'], [
    child('flowers', 'ورد', 'ورود'), child('gifts', 'هدايا'), child('gift-wrapping', 'تغليف'), child('occasion-flowers', 'تنسيق ورد للمناسبات'),
  ]),
  section('tailoring', 'الخياطة والتفصيل', Scissors, ['خياطة', 'تفصيل'], [
    child('mens-tailor', 'خياط رجالي'), child('womens-tailor', 'خياط نسائي'), child('embroidery', 'تطريز'), child('alterations', 'تعديل ملابس'),
  ]),
  section('books-stationery', 'المكتبات والقرطاسية', BookOpen, ['مكتبات', 'قرطاسية', 'مكتبة'], [
    child('books', 'كتب'), child('stationery', 'قرطاسية'),
  ]),
  section('media-production', 'التصوير والإنتاج الإعلامي', Video, ['photography', 'تصوير', 'إنتاج إعلامي', 'مصور'], [
    child('event-photography', 'تصوير مناسبات'), child('product-photography', 'تصوير منتجات'), child('editing', 'مونتاج'), child('video-production', 'إنتاج فيديو'),
  ]),
  section('accounting-finance', 'المحاسبة والخدمات المالية', Calculator, ['accounting', 'finance', 'محاسبة', 'خدمات مالية'], [
    child('accountants', 'محاسبون', 'محاسب'), child('accounting-offices', 'مكاتب محاسبة'), child('auditing', 'تدقيق'), child('financial-advice', 'استشارات مالية'), child('insurance', 'تأمين', 'شركات تأمين'),
  ]),
  section('employment', 'التوظيف والخدمات المهنية', Briefcase, ['jobs', 'توظيف'], [
    child('job-opportunities', 'فرص عمل'), child('recruitment', 'مكاتب توظيف'), child('professional-services', 'خدمات مهنية'),
  ]),
  section('pet-care', 'رعاية الحيوانات', PawPrint, ['pets', 'حيوانات', 'بيطرة'], [
    child('veterinary', 'عيادات بيطرية', 'vet', 'بيطري', 'طبيب بيطري', 'عيادة بيطرية'), child('pet-supplies', 'مستلزمات حيوانات'), child('pet-grooming', 'عناية وتنظيف'),
  ]),
  section('legal', 'الخدمات القانونية', Scale, ['قانون', 'قانونية'], [child('lawyer', 'محامون', 'محامي', 'محامين'), child('legal-consult', 'استشارات قانونية')]),
  section('communications', 'الاتصالات والإنترنت', Wifi, ['اتصالات', 'إنترنت'], [child('telecom', 'شركات الهاتف'), child('internet', 'إنترنت وWiFi', 'انترنت وخدمات WiFi')]),
  section('sports', 'الرياضة والترفيه', Dumbbell, ['رياضة', 'ترفيه'], [child('football', 'ملاعب كرة'), child('gym', 'صالات رياضية'), child('pool', 'مسابح'), child('kids-area', 'ألعاب أطفال'), child('park', 'حدائق')]),
  section('shopping', 'التسوق والملابس', ShoppingCart, ['تسوق'], [child('supermarket', 'سوبر ماركت'), child('mall', 'مولات'), child('clothes', 'ملابس', 'محلات ملابس')]),
  section('public', 'الخدمات العامة', Landmark, ['خدمات عامة'], [child('mosque', 'مساجد'), child('government', 'مراكز حكومية'), child('police', 'مراكز شرطة'), child('gas-station', 'محطات وقود')]),
  section('digital-services', 'البرامج والأنظمة', Code, ['خدمات رقمية', 'البرمجة والتصميم', 'برمجة', 'programs-systems'], [
    child('software', 'برمجة مخصصة', 'شركات برمجة'), child('accounting-software', 'برامج محاسبة'), child('pos-systems', 'أنظمة نقاط بيع', 'كاشير', 'POS'), child('applications', 'تطبيقات'), child('websites', 'مواقع إلكترونية'),
  ]),
  section('building-materials', 'مواد البناء', BrickWall, ['مواد إنشائية', 'تجهيز مواد بناء'], [
    child('cement', 'سمنت', 'أسمنت', 'اسمنت'), child('steel', 'حديد'), child('bricks', 'طابوق', 'طوب'),
    child('sand', 'رمل'), child('gravel', 'حصى'), child('construction-materials', 'مواد إنشائية'),
  ]),
  section('elevators', 'المصاعد', ArrowUpDown, ['مصعد', 'مصاعد'], [
    child('elevator-installation', 'تركيب مصاعد'), child('elevator-maintenance', 'صيانة مصاعد'), child('elevator-parts', 'قطع غيار مصاعد'), child('home-elevators', 'مصاعد منزلية'),
  ]),
  // Appliance retail is separate from existing repair/cooling services.
  section('home-appliances', 'الأجهزة المنزلية', Refrigerator, ['بيع أجهزة منزلية', 'appliances'], [
    child('refrigerators', 'ثلاجات للبيع'), child('washing-machines', 'غسالات'), child('ovens', 'أفران منزلية'), child('vacuum-cleaners', 'مكانس'), child('kitchen-appliances', 'أجهزة مطبخ'),
  ]),
  section('doors-windows', 'الأبواب والشبابيك', DoorOpen, ['أبواب', 'شبابيك', 'doors'], [
    child('wooden-doors', 'أبواب خشب'), child('iron-doors', 'أبواب حديد'), child('pvc', 'PVC'), child('windows', 'شبابيك'), child('door-window-repair', 'صيانة أبواب وشبابيك'),
  ]),
  section('marble-ceramics', 'الرخام والسيراميك', Grid2X2, ['رخام', 'سيراميك', 'كاشي'], [
    child('ceramic-installation', 'تركيب سيراميك'), child('marble', 'رخام'), child('tiles', 'كاشي'), child('stone-cutting', 'قص وصيانة'),
  ]),
  section('gardening', 'الحدائق والتشجير', Trees, ['بستنة', 'تشجير', 'بستاني'], [
    child('landscaping', 'تنسيق حدائق'), child('tree-planting', 'زراعة أشجار'), child('grass', 'عشب'), child('irrigation', 'ري'), child('garden-maintenance', 'صيانة حدائق'),
  ]),
  section('equipment-rental', 'تأجير المعدات', Construction, ['تأجير معدات', 'إيجار معدات'], [
    child('building-equipment-rental', 'معدات بناء'), child('generator-rental', 'مولدات'), child('crane-rental', 'رافعات'), child('tool-rental', 'أدوات'), child('party-equipment-rental', 'معدات حفلات'),
  ]),
  section('printing-services', 'خدمات الطباعة', Printer, ['مطابع', 'مطبعة', 'printing', 'طباعة'], [
    child('paper-printing', 'طباعة ورقية'), child('banners', 'بنرات'), child('business-cards', 'كروت'), child('photocopy', 'استنساخ'), child('commercial-printing', 'طباعة تجارية'),
  ]),
  section('office-services', 'المكاتب والخدمات الإدارية', FileText, ['خدمات مكتبية', 'مكاتب خدمات', 'معاملات'], [
    child('document-preparation', 'طباعة معاملات'), child('translation', 'ترجمة'), child('office-support', 'خدمات مكتبية'),
  ]),
  section('network-services', 'خدمات الإنترنت التقنية', Network, ['تقنيات إنترنت', 'تقني إنترنت'], [
    child('networks', 'شبكات'), child('routers', 'راوترات'), child('internet-cabling', 'تمديد إنترنت'), child('technical-support', 'دعم تقني'), child('servers', 'سيرفرات', 'خوادم'),
  ]),
  section('games-hobbies', 'الألعاب والهوايات', Gamepad2, ['ألعاب', 'هوايات'], [
    child('toys', 'ألعاب أطفال للبيع'), child('video-games', 'ألعاب إلكترونية'), child('hobbies', 'هوايات'), child('sports-supplies', 'مستلزمات رياضية'),
  ]),
  section('jewelry', 'الذهب والمجوهرات', Gem, ['ذهب', 'مجوهرات', 'صياغة', 'صائغ'], [
    child('gold', 'ذهب'), child('silver', 'فضة'), child('watches', 'ساعات'), child('jewelry-accessories', 'إكسسوارات مجوهرات'), child('jewelry-repair', 'صيانة مجوهرات'),
  ]),
  section('perfumes-cosmetics', 'العطور ومستحضرات التجميل', SprayCan, ['عطور', 'مستحضرات تجميل'], [
    child('perfumes', 'عطور'), child('makeup', 'مكياج'), child('skincare-products', 'مستحضرات عناية بالبشرة'), child('haircare-products', 'عناية بالشعر'),
  ]),
  section('shoes-bags', 'الأحذية والحقائب', Footprints, ['أحذية', 'حقائب', 'حذاء', 'جنط'], [
    child('mens-shoes', 'أحذية رجالية'), child('womens-shoes', 'أحذية نسائية'), child('kids-shoes', 'أحذية أطفال'), child('bags', 'حقائب'), child('shoe-accessories', 'إكسسوارات أحذية'),
  ]),
  section('marketing', 'التسويق والإعلانات', Megaphone, ['تسويق', 'إعلانات', 'دعاية'], [
    child('digital-marketing', 'تسويق إلكتروني'), child('social-management', 'إدارة صفحات'), child('paid-ads', 'إعلانات ممولة'), child('content-writing', 'كتابة محتوى'), child('design', 'تصميم جرافيك', 'شركات تصميم'),
  ]),
  section('industrial-services', 'الخدمات الصناعية', Factory, ['صناعة', 'خدمات صناعية'], [
    child('machines', 'مكائن', 'ماكينات'), child('industrial-maintenance', 'صيانة معدات صناعية'), child('industrial-parts', 'قطع صناعية'), child('production-workshops', 'ورش إنتاج'), child('factory-supplies', 'تجهيزات مصانع'),
  ]),
];

// Keep neighboring fields together even when new local sections are added.
const sectionOrder = [
  'doctors', 'hospitals', 'pharmacies', 'laboratories', 'rehabilitation', 'pet-care',
  'education', 'employment', 'legal', 'accounting-finance', 'office-services',
  'cars', 'transport', 'shipping-delivery', 'travel-tourism', 'real-estate',
  'construction', 'building-materials', 'plumbing', 'electrical', 'cooling', 'solar-energy',
  'home-services', 'home-appliances', 'furniture', 'doors-windows', 'aluminum-glass',
  'painting-decor', 'marble-ceramics', 'elevators', 'water-treatment', 'gardening',
  'equipment-rental', 'industrial-services', 'computers', 'mobile-electronics',
  'communications', 'network-services', 'digital-services', 'surveillance', 'security-safety',
  'food', 'shopping', 'jewelry', 'shoes-bags', 'tailoring', 'beauty-care', 'perfumes-cosmetics',
  'books-stationery', 'printing-services', 'marketing', 'media-production',
  'events', 'flowers-gifts', 'sports', 'games-hobbies', 'public',
];
directorySections.sort((a, b) => sectionOrder.indexOf(a.slug) - sectionOrder.indexOf(b.slug));

export function normalizeCategoryKey(value: string): string {
  return value.toLowerCase().replace(/[أإآٱ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه')
    .replace(/[\u064B-\u065F\u0670ـ]/g, '').replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim().split(/\s+/).map(word => word.replace(/^ال/, '')).join(' ');
}
const keys = (item: DirectoryChild) => [item.slug, item.name, ...item.aliases].map(normalizeCategoryKey);
const placements = new Map<string, CategoryPlacement>();
const slugPlacements = new Map<string, CategoryPlacement>();
// Canonical specialization IDs take precedence over a parent's search aliases.
for (const item of directorySections) {
  slugPlacements.set(item.slug, { sectionSlug: item.slug });
  for (const sub of item.children) slugPlacements.set(sub.slug, { sectionSlug: item.slug, childSlug: sub.slug });
}
const displayTransfers: Record<string, string[]> = {
  doctors: ['pet-care'], 'home-services': ['cooling'], construction: ['painting-decor'],
  surveillance: ['security-safety'], 'aluminum-glass': ['doors-windows'],
  'books-stationery': ['printing-services'], 'digital-services': ['marketing'],
  'mobile-electronics': ['computers', 'home-appliances'],
};
// Parent aliases have priority over generic child labels such as بيع or صيانة.
for (const item of directorySections) for (const key of keys(item)) placements.set(key, { sectionSlug: item.slug });
for (const item of directorySections) for (const sub of item.children) {
  for (const key of keys(sub)) if (!placements.has(key)) placements.set(key, { sectionSlug: item.slug, childSlug: sub.slug });
}

export function resolveDirectoryCategory(category: Pick<SourceCategory, 'slug' | 'name'>): CategoryPlacement | undefined {
  const direct = slugPlacements.get(String(category.slug)) ?? placements.get(normalizeCategoryKey(String(category.slug))) ?? placements.get(normalizeCategoryKey(category.name));
  if (direct) return direct;
  // Recognize qualified labels such as أطباء الباطنية / محلات بيع حاسبات.
  const shortName = normalizeCategoryKey(category.name)
    .replace(/^(?:(?:محلات|محل|شركات|شركه|مكاتب|مكتب|مراكز|مركز|خدمات|خدمه) )+/, '');
  const medicalName = shortName.replace(/^(?:(?:اطباء|طبيب|دكتور|دكتوره|عيادات|عياده|اخصائي|اختصاص|طب) )+/, '');
  const medical = placements.get(medicalName);
  return placements.get(shortName) ?? (medical && ['doctors', 'pet-care'].includes(medical.sectionSlug) ? medical : undefined);
}

export function buildCategoryDirectory(categories: SourceCategory[]) {
  const sections: DisplaySection[] = directorySections.map(item => ({ ...item, children: [...item.children], sources: [], searchText: '' }));
  const bySource = new Map<string, CategoryPlacement>();
  const unknownNames = new Map<string, CategoryPlacement>();
  for (const source of categories) {
    const nameKey = normalizeCategoryKey(source.name);
    let placement = resolveDirectoryCategory(source) ?? unknownNames.get(nameKey);
    if (!placement) {
      // Preserve unrecognized custom categories. Group metadata is used only
      // where it unambiguously identifies a single main field.
      const groupSlug = ({ legal: 'legal', cars: 'cars', education: 'education', sports: 'sports', food: 'food', home: 'home-services', public: 'public' } as Record<string, string>)[source.groupId ?? ''];
      placement = { sectionSlug: groupSlug ?? source.slug, ...(groupSlug ? { childSlug: source.slug } : {}) };
      if (groupSlug) sections.find(item => item.slug === groupSlug)!.children.push(child(source.slug, source.name));
      else sections.push({ ...section(source.slug, source.name, resolveCategoryIcon(source).icon ?? FolderOpen, [], []), sources: [], searchText: '' });
      unknownNames.set(nameKey, placement);
    }
    bySource.set(String(source.slug), placement);
    if (source.dbId != null) bySource.set(`id:${source.dbId}`, placement);
    sections.find(item => item.slug === placement.sectionSlug)!.sources.push(source);
  }
  for (const item of sections) {
    item.searchText = [item.name, ...item.aliases, ...item.children.flatMap(sub => [sub.name, sub.slug, ...sub.aliases]),
      ...item.sources.flatMap(source => {
        const config = getCategoryFieldConfig(source.slug);
        return [source.name, ...(RAW_CATEGORY_SYNONYMS[source.slug] ?? []), config.profession, ...config.specialties];
      })].join(' ');
  }
  const locateCategory = (slug: string): CategoryPlacement | undefined => bySource.get(slug) ?? slugPlacements.get(slug) ?? placements.get(normalizeCategoryKey(slug));
  const resolveRoute = (slug: string, requestedChild?: string): CategoryPlacement | undefined => {
    const base = sections.some(section => section.slug === slug) ? { sectionSlug: slug } : locateCategory(slug);
    if (!base) return undefined;
    const subSlug = requestedChild ?? (slug === 'car-repair' ? undefined : base.childSlug);
    const parent = sections.find(section => section.slug === base.sectionSlug);
    if (subSlug && subSlug !== 'all') {
      if (parent?.children.some(child => child.slug === subSlug)) return { sectionSlug: base.sectionSlug, childSlug: subSlug };
      const moved = locateCategory(subSlug);
      if (moved && displayTransfers[base.sectionSlug]?.includes(moved.sectionSlug)) return moved;
    }
    return { sectionSlug: base.sectionSlug };
  };
  const locateService = (service: Pick<Service, 'categorySlug' | 'categoryId' | 'subCategory' | 'profession'>): CategoryPlacement | undefined => {
    let base = locateCategory(service.categorySlug) ?? (service.categoryId != null ? bySource.get(`id:${service.categoryId}`) : undefined);
    if (!base) return undefined;
    const permitted = [base.sectionSlug, ...(displayTransfers[base.sectionSlug] ?? [])];
    // Existing car services may already have been folded into car-repair by
    // the service hook. Recover the original display specialization only.
    const explicit = service.subCategory ? locateCategory(service.subCategory) : undefined;
    if (explicit && permitted.includes(explicit.sectionSlug)) base = explicit;
    const profession = normalizeCategoryKey(service.profession ?? '');
    if (profession && (!base.childSlug || base.childSlug === 'car-repair' || base.childSlug === 'appliance-repair')) {
      for (const item of sections.filter(item => permitted.includes(item.slug))) {
        const sub = item.children.find(candidate => keys(candidate).includes(profession));
        if (sub) return { sectionSlug: item.slug, childSlug: sub.slug };
      }
      const qualified = resolveDirectoryCategory({ slug: '', name: service.profession ?? '' });
      if (qualified && permitted.includes(qualified.sectionSlug)) return qualified;
    }
    return base;
  };
  return { sections, locateCategory, locateService, resolveRoute };
}
