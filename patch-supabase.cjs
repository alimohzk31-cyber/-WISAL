const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src/lib/supabase.ts');
let content = fs.readFileSync(filePath, 'utf8');

// Add empty PIN check at the start of adminPinLogin function
const oldText = `export async function adminPinLogin(
  pin: string
): Promise<{ ok: true } | { ok: false; code: string }> {
    // A PIN attempt always starts from a blank local auth state.`;

const newText = `export async function adminPinLogin(
  pin: string
): Promise<{ ok: true } | { ok: false; code: string }> {
    // Fail-closed: empty / whitespace-only PIN is rejected immediately,
    // before any network call. This closes the "Enter without PIN" path.
    if (typeof pin !== 'string' || pin.trim().length === 0) {
      return { ok: false, code: 'invalid_pin' };
    }

    // A PIN attempt always starts from a blank local auth state.`;

content = content.replace(oldText, newText);
fs.writeFileSync(filePath, content);
console.log('File updated successfully');
