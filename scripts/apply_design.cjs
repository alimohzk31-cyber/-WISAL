// تطبيق التصميم الموحد لصفحة القسم — استبدال موجع وآمن للـ EmptyState + البحث.
const fs = require("fs");
const p = "E:/مشاريع/سالين-للخدمات/wisal-upload/src/pages/CategoryPage.tsx";
let s = fs.readFileSync(p, "utf8");

const A = String.fromCharCode;
// بناء الـ Arabic strings عبر char codes — يتجنب كل escaping issues
function ar(s) { return s; }

const titleAr = "\u0627\u0644\u0627 \u062a\u0648\u0631\u062b \u062e\u062f\u0645\u0627\u062a \u0641\u064a \u0647\u0630\u0627 \u0627\u0644\u0642\u0633\u0645 \u062d\u0627\u0644\u064a\u0627\u0646\u064e \u0645\u0639\u0627\u0646\u064a\u0629";
const subAr = "\u0643\u0646 \u0623\u0648\u0644 \u0645\u0646 \u064a\u0636\u064a\u0641 \u062e\u062f\u0645\u062a\u0647 \u0641\u064a \u0647\u0630\u0627 \u0627\u0644\u0642\u0633\u0645";

let c = 0;
const swaps = [
  ["title={t('no_services_yet')}", "title=" + JSON.stringify(titleAr)],
  ["subtitle={t('be_first')", "subtitle=" + JSON.stringify(subAr)],
  ["icon={Icon && typeof Icon !== 'string' ? Icon : undefined}", "icon={Briefcase as any}"],
  [": categoryServices.length === 0 ?", ": filteredServices.length === 0 ?"]
];

for (const [find, rep] of swaps) {
  if (s.includes(find)) {
    s = s.replace(find, rep);
    c++;
  } else {
    console.error("MISSING: " + find);
  }
}

fs.writeFileSync(p, s, "utf8");
console.log("SWAPPED " + c + " / 4");
console.log("verify title:", s.includes(titleAr));
console.log("verify subtitle:", s.includes(subAr));
console.log("verify icon:", s.includes("Briefcase as any"));
console.log("verify cond:", s.includes("filteredServices.length === 0"));
