// سكربت مساعد: يطبق التصميم الموحد لصفحات الأقسام على CategoryPage.tsx
// (لا يلامس قاعدة البيانات، ويحافظ على الترميز UTF-8 الأصلي)
const fs = require("fs");
const p = "E:/مشاريع/سالين-للخدمات/wisal-upload/src/pages/CategoryPage.tsx";
let s = fs.readFileSync(p, "utf8");

function replaceOnce(str, find, rep) {
  const idx = str.indexOf(find);
  if (idx === -1) {
    console.error("NOT_FOUND: " + JSON.stringify(find).slice(0, 80));
    return str;
  }
  return str.slice(0, idx) + rep + str.slice(idx + find.length);
}

const ops = [];

// 1. استبدال الـ icon + العناوين في EmptyState
const iconNeedle = "icon={Icon && typeof Icon !== 'string' ? Icon : undefined}\n          title={t('no_services_yet')}\n          subtitle={t('be_first')\n        />";
const iconReplacement = "icon={Briefcase as any}\n          title=\"\u0627\u0644\u0627 \u062a\u0648\u0631\u062b \u062e\u062f\u0645\u0627\u062a \u0641\u064a \u0647\u0630\u0627 \u0627\u0644\u0642\u0633\u0645 \u062d\u0627\u0644\u064a\u0627\u0646\u064e \u0645\u0639\u0627\u0646\u064a\u0629\"\n          subtitle=\"\u0643\u0646 \u0623\u0648\u0644 \u0645\u0646 \u064a\u0636\u064a\u0641 \u062e\u062f\u0645\u062a\u0647 \u0641\u064a \u0647\u0630\u0627 \u0627\u0644\u0642\u0633\u0645\"";

if (s.includes(iconNeedle)) {
  s = replaceOnce(s, iconNeedle, iconReplacement);
  ops.push("ICON_TITLE_REPLACED");
} else {
  ops.push("ICON_TITLE_NOT_FOUND");
  // fallback للبحث
  if (s.includes("title={t('no_services_yet')}")) ops.push("title needle exists");
}

fs.writeFileSync(p, s, "utf8");
console.log("OPS:", JSON.stringify(ops));
console.log("WRITTEN chars:", s.length);
console.log("verify title:", s.includes("\u0627\u0644\u0627 \u062a\u0648\u0631\u062b \u062e\u062f\u0645\u0627\u062a"));
console.log("verify icon:", s.includes("Briefcase as any"));
