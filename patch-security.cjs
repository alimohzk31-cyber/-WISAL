const fs = require('fs');
const path = require('path');

// Patch supabase.ts - add empty PIN check
const supabasePath = path.join(__dirname, 'src/lib/supabase.ts');
let content = fs.readFileSync(supabasePath, 'utf8');
const oldTextSupabase = `export async function adminPinLogin(
  pin: string
): Promise<{ ok: true } | { ok: false; code: string }> {
    // A PIN attempt always starts from a blank local auth state. Otherwise a
    // previously persisted admin refresh token can make a failed PIN appear
    // successful when the user later opens /admin directly.
    if (!(await clearLocalAuthSession())) {
      return { ok: false, code: 'session_clear_failed' };
    }`;

const newTextSupabase = `export async function adminPinLogin(
  pin: string
): Promise<{ ok: true } | { ok: false; code: string }> {
  // Fail-closed: empty / whitespace-only PIN is rejected immediately,
  // before any network call. This closes the "Enter without PIN" path.
  if (typeof pin !== 'string' || pin.trim().length === 0) {
    return { ok: false, code: 'invalid_pin' };
  }

  // A PIN attempt always starts from a blank local auth state. Otherwise a
  // previously persisted admin refresh token can make a failed PIN appear
  // successful when the user later opens /admin directly.
  if (!(await clearLocalAuthSession())) {
    return { ok: false, code: 'session_clear_failed' };
  }`;

content = content.replace(oldTextSupabase, newTextSupabase);
fs.writeFileSync(supabasePath, content, 'utf8');
console.log('✓ src/lib/supabase.ts updated');


// Patch AdminLoginModal.tsx - add empty PIN check in handleSubmit  
const modalPath = path.join(__dirname, 'src/components/AdminLoginModal.tsx');
content = fs.readFileSync(modalPath, 'utf8');
const oldTextModal = `  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setErrorMsg(null);
    const result = await loginWithPin(pin);`;

const newTextModal = `  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    // Fail-closed: PIN فارغ أو فقط مسافات مرفوض قبل إرسال أي طلب.
    // هذا يغلق مسار "الضغط Enter بدون PIN".
    if (typeof pin !== 'string' || pin.trim().length === 0) {
      setErrorMsg(LOGIN_ERRORS['invalid_pin']);
      return;
    }
    setSubmitting(true);
    setErrorMsg(null);
    const result = await loginWithPin(pin);`;

content = content.replace(oldTextModal, newTextModal);
fs.writeFileSync(modalPath, content, 'utf8');
console.log('✓ src/components/AdminLoginModal.tsx updated');

console.log('All files patched successfully.');
