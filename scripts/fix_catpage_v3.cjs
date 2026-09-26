const fs = require('fs');
const p = 'E:/مشاريع/سالين-للخدمات/wisal-upload/src/pages/CategoryPage.tsx';
let raw = fs.readFileSync(p, 'utf8');

// Fix line 276: remove extra ' before }}
raw = raw.replace(
  "hover:bg-[var(--accent-soft)]'}}",
  "hover:bg-[var(--accent-soft)]`}"
);

// Fix line 290: add missing closing } 
// Current: ...hover:bg-[var(--accent-soft)]`}
// Should be: ...hover:bg-[var(--accent-soft)]`}
raw = raw.replace(
  "hover:bg-[var(--accent-soft)]`}",
  "hover:bg-[var(--accent-soft)]`}"
);

fs.writeFileSync(p, raw, 'utf8');
console.log('Done');
