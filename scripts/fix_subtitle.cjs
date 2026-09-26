// إصلاح سطر الـ subtitle الفارغ — يستخدم \u escapes لتجنب كل issues
const fs = require("fs");
const p = "E:/مشاريع/سالين-للخدمات/wisal-upload/src/pages/CategoryPage.tsx";
let s = fs.readFileSync(p, "utf8");

const SUBTITLE_BAD = "subtitle=" + JSON.stringify("\u0643\u0646 \u0623\u0648\u0644 \u0645\u0646 \u064a\u0636\u064a\u0641 \u062e\u062f\u0645\u062a\u0647 \u0641\u064a \u0647\u0630\u0627 \u0627\u0644\u0642\u0633\u0645") + "}";
const SUBTITLE_GOOD = "subtitle=" + JSON.stringify("\u0643\u0646 \u0623\u0648\u0644 \u0645\u0646 \u064a\u0636\u064a\u0641 \u062e\u062f\u0645\u062a\u0647 \u0641\u064a \u0647\u0630\u0627 \u0627\u0644\u0642\u0633\u0645");

if (s.includes(SUBTITLE_BAD)) {
  s = s.replace(SUBTITLE_BAD, SUBTITLE_GOOD);
  fs.writeFileSync(p, s, "utf8");
  console.log("SUBTITLE_BRACE_FIXED OK");
} else {
  console.log("BAD substring not found — قد يكون مُصحّحاً أو بصياغة مختلفة");
  console.log("contains good:", s.includes(SUBTITLE_GOOD));
  console.log("contains bad brace:", s.includes(SUBTITLE_BAD));
}
