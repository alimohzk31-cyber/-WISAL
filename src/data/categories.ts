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
  HardHat, Code, Palette, Home
} from 'lucide-react';

export type NeonColor = 'green' | 'blue' | 'purple' | 'pink' | 'orange';

export interface Category {
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
  { slug: 'pharmacy', name: 'صيدليات', groupId: 'health', icon: Pill, color: 'green' },
  { slug: 'hospital', name: 'مستشفيات', groupId: 'health', icon: Hospital, color: 'green' },
  { slug: 'clinic', name: 'عيادات', groupId: 'health', icon: Stethoscope, color: 'green' },
  { slug: 'dentist', name: 'أطباء أسنان', groupId: 'health', icon: Bone, color: 'green' },
  { slug: 'lab', name: 'مختبرات تحليل', groupId: 'health', icon: TestTube, color: 'green' },
  { slug: 'beauty', name: 'مراكز تجميل', groupId: 'health', icon: Sparkles, color: 'green' },
  { slug: 'physio', name: 'علاج طبيعي', groupId: 'health', icon: HeartPulse, color: 'green' },

  // Legal
  { slug: 'lawyer', name: 'محامين', groupId: 'legal', icon: Scale, color: 'blue' },
  { slug: 'legal-consult', name: 'استشارات قانونية', groupId: 'legal', icon: FileSignature, color: 'blue' },

  // Cars
  { slug: 'car-repair', name: 'ورش سيارات', groupId: 'cars', icon: Car, color: 'orange' },

  // Travel
  { slug: 'airlines', name: 'شركات الطيران', groupId: 'travel', icon: Plane, color: 'purple' },
  { slug: 'travel-agency', name: 'مكاتب سفر', groupId: 'travel', icon: Briefcase, color: 'purple' },
  { slug: 'insurance', name: 'شركات تأمين', groupId: 'travel', icon: ShieldCheck, color: 'purple' },
  { slug: 'telecom', name: 'شركات الهاتف', groupId: 'travel', icon: Phone, color: 'purple' },
  { slug: 'internet', name: 'انترنت وخدمات WiFi', groupId: 'travel', icon: Wifi, color: 'purple' },

  // Education
  { slug: 'school', name: 'مدارس', groupId: 'education', icon: School, color: 'pink' },
  { slug: 'university', name: 'جامعات', groupId: 'education', icon: GraduationCap, color: 'pink' },
  { slug: 'institute', name: 'معاهد', groupId: 'education', icon: BookOpen, color: 'pink' },
  { slug: 'tutor', name: 'دروس خصوصية', groupId: 'education', icon: PenTool, color: 'pink' },

  // Sports
  { slug: 'football', name: 'ملاعب كرة', groupId: 'sports', icon: Trophy, color: 'green' },
  { slug: 'gym', name: 'صالات رياضية', groupId: 'sports', icon: Dumbbell, color: 'green' },
  { slug: 'pool', name: 'مسابح', groupId: 'sports', icon: Waves, color: 'green' },
  { slug: 'kids-area', name: 'ألعاب أطفال', groupId: 'sports', icon: Gamepad2, color: 'green' },
  { slug: 'park', name: 'حدائق', groupId: 'sports', icon: TreePine, color: 'green' },

  // Shopping
  { slug: 'supermarket', name: 'سوبر ماركت', groupId: 'shopping', icon: ShoppingCart, color: 'pink' },
  { slug: 'mall', name: 'مولات', groupId: 'shopping', icon: Store, color: 'pink' },
  { slug: 'clothes', name: 'محلات ملابس', groupId: 'shopping', icon: Shirt, color: 'pink' },
  { slug: 'electronics', name: 'إلكترونيات', groupId: 'shopping', icon: Monitor, color: 'pink' },
  { slug: 'phones', name: 'هواتف', groupId: 'shopping', icon: Smartphone, color: 'pink' },

  // Food
  { slug: 'restaurant', name: 'مطاعم', groupId: 'food', icon: Utensils, color: 'orange' },
  { slug: 'cafe', name: 'كافيهات', groupId: 'food', icon: Coffee, color: 'orange' },
  { slug: 'fast-food', name: 'وجبات سريعة', groupId: 'food', icon: Pizza, color: 'orange' },
  { slug: 'sweets', name: 'حلويات', groupId: 'food', icon: Cake, color: 'orange' },

  // Home
  { slug: 'electrician', name: 'كهربائي', groupId: 'home', icon: PlugZap, color: 'blue' },
  { slug: 'plumber', name: 'سباك', groupId: 'home', icon: PlumberWrench, color: 'blue' },
  { slug: 'cleaning', name: 'تنظيف منازل', groupId: 'home', icon: Broom, color: 'blue' },
  { slug: 'appliance-repair', name: 'صيانة أجهزة', groupId: 'home', icon: Wrench, color: 'blue' },
  { slug: 'carpenter', name: 'نجار', groupId: 'home', icon: Hammer, color: 'blue' },

  // Public
  { slug: 'mosque', name: 'مساجد', groupId: 'public', icon: Landmark, color: 'purple' },
  { slug: 'government', name: 'مراكز حكومية', groupId: 'public', icon: Building2, color: 'purple' },
  { slug: 'police', name: 'مراكز شرطة', groupId: 'public', icon: Siren, color: 'purple' },
  { slug: 'gas-station', name: 'محطات وقود', groupId: 'public', icon: Fuel, color: 'purple' },
  { slug: 'post-office', name: 'بريد', groupId: 'public', icon: Mail, color: 'purple' },

  // Business
  { slug: 'construction', name: 'شركات مقاولات', groupId: 'business', icon: HardHat, color: 'blue' },
  { slug: 'software', name: 'شركات برمجة', groupId: 'business', icon: Code, color: 'blue' },
  { slug: 'design', name: 'شركات تصميم', groupId: 'business', icon: Palette, color: 'blue' },
  { slug: 'real-estate', name: 'مكاتب عقارات', groupId: 'business', icon: Home, color: 'blue' },
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
