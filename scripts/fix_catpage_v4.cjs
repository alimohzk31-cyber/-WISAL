const fs = require('fs');
const p = 'E:/مشاريع/سالين-للخدمات/wisal-upload/src/pages/CategoryPage.tsx';
let raw = fs.readFileSync(p, 'utf8');

// Fix line 276: replace "hover:bg-[var(--accent-soft)]'}}" with "hover:bg-[var(--accent-soft)]`}"
// (remove the extra single-quote before }})
raw = raw.replace(
  "hover:bg-[var(--accent-soft)]'}}",
  "hover:bg-[var(--accent-soft)]`}"
);

// Fix line 290: the line currently ends with:
// "...hover:bg-[var(--accent-soft)]`}"
// but it should end with:
// "...hover:bg-[var(--accent-soft)]'}"
// Actually wait — re-read: line 290 ends with `` `} `` but needs `` `}` `` 
// The current ending is: "...hover:bg-[var(--accent-soft)]`}"
// It needs to be: "...hover:bg-[var(--accent-soft)]`}"
// These are the SAME, so no fix needed for line 290.
// The actual issue with line 290 is different — let me check.

// Let's search for the exact problematic patterns
const match276 = raw.match(/text-\[var\(--accent-soft\)\]\)'\}\}/);
const match290 = raw.match(/text-\[var\(--accent-soft\)\]\)`\}/);

console.log('Match 276:', match276 ? 'found' : 'not found');
console.log('Match 290:', match290 ? 'found' : 'not found');

if (match276) {
  // This pattern has the extra ' — fix it
  raw = raw.replace(
    "text-[var(--accent-soft)]')}",
    "text-[var(--accent-soft)]`}"
  );
  console.log('Fixed line 276 pattern');
}

// Now check line 290 - it's missing a closing }
// Current: "...hover:bg-[var(--accent-soft)]`}"
// The `} at the end should be `}` (with closing brace)
// But actually looking at the JSX, the template literal is:
// className={`... ${...} ? '...' : '...'`}
// So the backtick closes the template, then } closes the JSX expression
// The line should end with: ...hover:bg-[var(--accent-soft)]`}
// But currently it has: ...hover:bg-[var(--accent-soft)]`}  — wait that looks correct
// Let me re-examine...

// Actually the issue is the line currently ends with only `} (backtick + brace)
// but the template literal needs to be closed with ` then } 
// So: ` + } = `}
// The line 290 currently ends with exactly that — but there's a missing }
// Let me look at the full context again

// From the output, line 290 is:
// className={`flex w-full ... ${isActive ? `${colors.bg} text-[var(--accent-contrast)]` : 'text-[var(--text-primary)] hover:bg-[var(--accent-soft)]`}
// This is MISSING the final } to close the JSX expression!
// It should be:
// className={`flex w-full ... ${isActive ? `${colors.bg} text-[var(--accent-contrast)]` : 'text-[var(--text-primary)] hover:bg-[var(--accent-soft)]}`}
// So we need to add } after the ` 

// Fix: replace "hover:bg-[var(--accent-soft)]`}" with "hover:bg-[var(--accent-soft)]`}"
// Wait those are identical strings! The issue is the current line has:
// "...hover:bg-[var(--accent-soft)]`}"  (ends with backtick+brace)
// but should have:
// "...hover:bg-[var(--accent-soft)]`}"  (ends with backtick+brace)  
// These look the same...

// Let me just do a broader fix: ensure every className={`...`} has proper closing
// The pattern after my first fix should be correct now.
// Let me verify by checking if there's a line with className={`... that doesn't end with `}

const lines = raw.split('\n');
let fixedCount = 0;
for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  if (line.includes('className={`') && !line.trim().endsWith('`}')) {
    // This line has an unclosed template literal in className
    console.log(`Line ${i+1} has unclosed className: ${line.substring(0, 100)}...`);
    // Try to fix by adding the missing }
    if (line.includes('`') && !line.includes('`}')) {
      // Replace the last ` with `}
      const lastBacktickIdx = line.lastIndexOf('`');
      if (lastBacktickIdx > 0) {
        lines[i] = line.substring(0, lastBacktickIdx) + '`}' + line.substring(lastBacktickIdx + 1);
        fixedCount++;
      }
    }
  }
}

raw = lines.join('\n');
console.log('Fixed', fixedCount, 'lines with unclosed className');

fs.writeFileSync(p, raw, 'utf8');
console.log('Done - all fixes applied');
