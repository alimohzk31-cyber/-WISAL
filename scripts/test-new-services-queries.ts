// اختبار سريع للجمل الجديدة (المهمة الثانية) — مؤقت
import { buildCategoryDirectory } from '../src/data/categoryDirectory';
import { searchDirectory, buildDirectorySearchIndex } from '../src/lib/directorySearch';

const d = buildCategoryDirectory([], []);
const idx = buildDirectorySearchIndex(d.sections, d.searchServices);
const qs = [
  'رش حشرات', 'مكافحة صراصير', 'مبيدات', 'بيتي بي حشرات',
  'تركيب ستلايت', 'دش', 'فني مكيفات', 'المكيف ما يبرد', 'السبلت خربان',
  'فني غسالات', 'غسالتي خربانة', 'فني ثلاجات', 'تصليح براد', 'ثلاجتي ما تبرد',
  'فني موبايلات', 'تلفوني انكسر', 'لابتوبي خربان', 'حاسبتي ما تشتغل',
  'نقل غراض البيت', 'أنقل أثاث', 'تنظيف مكاتب',
  'صبغ بيت', 'أريد دولاب', 'قص أشجار', 'تنسيق حديقة', 'خياط', 'تفصيل ملابس',
  'باب حديد', 'شباك حديد', 'شبابيك ألمنيوم',
  'كهربائي', 'الكهرباء طافية', 'مشكلة بالوايرات',
  'أريد واحد يصلح ماي', 'الحنفية تخربط', 'عندي تسريب ماي',
  'محتاج علاج', 'وين صيدلية', 'اقرب صيدلية', 'أريد أصبغ الغرف', 'أعمال خشب',
];
let fails = 0;
for (const q of qs) {
  const r = searchDirectory(idx, q);
  const top = r.length ? r[0].section.name : 'لا نتيجة';
  console.log(`${q} => ${top} (${r.length} نتيجة)`);
  if (!r.length) fails++;
}
console.log(fails === 0 ? 'ALL_OK' : `FAILURES: ${fails}`);