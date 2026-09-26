const fs = require('fs');
const p = 'E:/مشاريع/سالين-للخدمات/wisal-upload/src/pages/CategoryPage.tsx';
let raw = fs.readFileSync(p, 'utf8');

// Fix 1: Extra } in line 276 className (all button)
raw = raw.replace(
  "hover:bg-[var(--accent-soft)]'}}",
  "hover:bg-[var(--accent-soft)]`}"
);

// Fix 2: Extra } in line 290 className (sub button) 
raw = raw.replace(
  "hover:bg-[var(--accent-soft)]'}`}}",
  "hover:bg-[var(--accent-soft)]`}"
);

fs.writeFileSync(p, raw, 'utf8');
console.log('Fixed both className lines');
