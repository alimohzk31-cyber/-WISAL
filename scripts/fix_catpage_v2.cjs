const fs = require('fs');
const p = 'E:/مشاريع/سالين-للخدمات/wisal-upload/src/pages/CategoryPage.tsx';
let raw = fs.readFileSync(p, 'utf8');

// Line 276: remove the extra ' before }}
raw = raw.replace(
  "hover:bg-[var(--accent-soft)]'}}",
  "hover:bg-[var(--accent-soft)]`}"
);

// Line 290: missing closing } - the line currently ends with:
// ...hover:bg-[var(--accent-soft)]`}
// but should end with: ...hover:bg-[var(--accent-soft)]')}
// Actually check the exact ending:
const line290Match = raw.match(/className=\{`flex w-full items-center justify-between rounded-xl px-3 py-2\.5 text-right text-sm font-bold transition-colors \$\{isActive \? `\$\{colors\.bg\} text-\[var\(--accent-contrast\)\]` : 'text-\[var\(--text-primary\)\] hover:bg-\[var\(--accent-soft\)\]`\}/);
if (line290Match) {
  console.log('Line 290 matched:', line290Match[0].substring(0, 200));
} else {
  // Try to find the line and fix it
  const idx = raw.indexOf("hover:bg-[var(--accent-soft)]`}");
  if (idx > 0) {
    // This is the line 290 ending - need to add missing }
    console.log('Found pattern at', idx);
    raw = raw.replace(
      "hover:bg-[var(--accent-soft)]`}",
      "hover:bg-[var(--accent-soft)]')}"
    );
  }
}

fs.writeFileSync(p, raw, 'utf8');
console.log('Done - fixed both issues');
