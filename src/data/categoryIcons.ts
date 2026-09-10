// ============================================================
// أيقونات التصنيفات — استيراد مُحدَّد (مسمّى) للأيقونات المستخدمة فقط.
// بديل `import * as Icons from 'lucide-react'` الذي كان يسحب مكتبة
// lucide-react الكاملة (~1500 أيقونة) إلى الحزمة لأن الوصول كان ديناميكياً
// `(Icons as any)[name]` فتعذّر على Rollup قصّ الأجزاء غير المستخدمة.
// جميع الأسماء هنا تُستورد تصريحياً فتتم شجرة-القص (tree-shaking) تماماً.
// ============================================================
import {
  Factory, PanelsTopLeft, DoorOpen, SprayCan,
  Activity, Anchor, Aperture, Archive, Award, Book, Bookmark, Briefcase, Camera, Cast,
  Cloud, Coffee, Compass, Crosshair, Database, Droplet, Droplets, Feather, Flag, Folder,
  FolderOpen, Gift, Globe, Headphones, Heart, Home, Image as ImageIcon, Key, Layers,
  Layout, LifeBuoy, Link, Map, Mic, Monitor, Moon, Music, Navigation, Package,
  Paperclip, PenTool, Phone, Printer, Radio, Scissors, Settings, Shield, ShoppingBag,
  ShoppingCart, Smartphone, Speaker, Star, Sun, Target, Trash, Truck, Tv,
  Umbrella, Unlock, User, Video, Watch, Wifi,
  Cross, Stethoscope, Syringe, TestTube, Sparkles, ActivitySquare, Scale, FileSignature,
  Car, Zap, Wrench, Plane, ShieldCheck, GraduationCap, School, BookOpen, Trophy,
  Dumbbell, Waves, Gamepad2, TreePine, Store, Shirt, Utensils, Pizza, Cake, PlugZap,
  Hammer, Landmark, Building2, Siren, Fuel, Mail, HardHat, Code, Palette,
  // أيقونات معبرية إضافية (نظام أيقونات الخدمات المركزي)
  Pill, Hospital, Bone, Ambulance, Microscope, UtensilsCrossed, Banknote, CreditCard,
  Hotel, HeartPulse, Baby, PawPrint, CircleDollarSign,
} from 'lucide-react';

/** أسماء الأيقونات القابلة للاختيار في نافذة "إضافة قسم". */
export const CATEGORY_ICON_NAMES = [
  'Factory', 'PanelsTopLeft', 'DoorOpen', 'SprayCan',
  'Activity', 'Anchor', 'Aperture', 'Archive', 'Award', 'Book', 'Bookmark', 'Briefcase', 'Camera', 'Cast',
  'Cloud', 'Coffee', 'Compass', 'Crosshair', 'Database', 'Droplet', 'Feather', 'Flag', 'Folder', 'Gift',
  'Globe', 'Headphones', 'Heart', 'Home', 'Image', 'Key', 'Layers', 'Layout', 'LifeBuoy', 'Link',
  // 'Tool' لم تعد موجودة في نسخة lucide-react المثبتة، فحُذفت من القائمة
  // (كانت تظهر بصمت كمربع فارغ في الماضي، والأيقونة لا تُستخدم من لوحة الإدارة).
  'Map', 'Mic', 'Monitor', 'Moon', 'Music', 'Navigation', 'Package', 'Paperclip', 'PenTool', 'Phone',
  'Printer', 'Radio', 'Scissors', 'Settings', 'Shield', 'ShoppingBag', 'ShoppingCart', 'Smartphone', 'Speaker', 'Star',
  'Sun', 'Target', 'Trash', 'Truck', 'Tv', 'Umbrella', 'Unlock', 'User', 'Video', 'Watch', 'Wifi',
  'Cross', 'Stethoscope', 'Syringe', 'TestTube', 'Sparkles', 'ActivitySquare', 'Scale', 'FileSignature',
  'Car', 'Zap', 'Wrench', 'Plane', 'ShieldCheck', 'GraduationCap', 'School', 'BookOpen', 'Trophy',
  'Dumbbell', 'Waves', 'Gamepad2', 'TreePine', 'Store', 'Shirt', 'Utensils', 'Pizza', 'Cake', 'PlugZap',
  'Hammer', 'Landmark', 'Building2', 'Siren', 'Fuel', 'Mail', 'HardHat', 'Code', 'Palette',
  // أيقونات معبرية إضافية (نظام أيقونات الخدمات المركزي)
  'Pill', 'Hospital', 'Bone', 'Ambulance', 'Microscope', 'UtensilsCrossed', 'Banknote',
  'CreditCard', 'Hotel', 'HeartPulse', 'Baby', 'PawPrint', 'CircleDollarSign',
] as const;

/** خريطة اسم ← مكوّن أيقونة (لتحويل أيقونات قاعدة البيانات النصية إلى مكوّنات عند العرض). */
export const CATEGORY_ICON_MAP: Record<string, any> = {
  Factory, PanelsTopLeft, DoorOpen, SprayCan,
  Activity, Anchor, Aperture, Archive, Award, Book, Bookmark, Briefcase, Camera, Cast,
  Cloud, Coffee, Compass, Crosshair, Database, Droplet, Droplets, Feather, Flag, Folder,
  FolderOpen, Gift, Globe, Headphones, Heart, Home, Image: ImageIcon, Key, Layers,
  Layout, LifeBuoy, Link, Map, Mic, Monitor, Moon, Music, Navigation, Package,
  Paperclip, PenTool, Phone, Printer, Radio, Scissors, Settings, Shield, ShoppingBag,
  ShoppingCart, Smartphone, Speaker, Star, Sun, Target, Trash, Truck, Tv,
  Umbrella, Unlock, User, Video, Watch, Wifi,
  Cross, Stethoscope, Syringe, TestTube, Sparkles, ActivitySquare, Scale, FileSignature,
  Car, Zap, Wrench, Plane, ShieldCheck, GraduationCap, School, BookOpen, Trophy,
  Dumbbell, Waves, Gamepad2, TreePine, Store, Shirt, Utensils, Pizza, Cake, PlugZap,
  Hammer, Landmark, Building2, Siren, Fuel, Mail, HardHat, Code, Palette,
  // أيقونات معبرية إضافية (نظام أيقونات الخدمات المركزي)
  Pill, Hospital, Bone, Ambulance, Microscope, UtensilsCrossed, Banknote, CreditCard,
  Hotel, HeartPulse, Baby, PawPrint, CircleDollarSign,
};

/** يحل اسم أيقونة نصي (من قاعدة البيانات) إلى مكوّن، مع توفير Folder الأيقونة الاحتياطية. */
export function getCategoryIcon(name?: string): any {
  return (name && CATEGORY_ICON_MAP[name]) || FolderOpen;
}
