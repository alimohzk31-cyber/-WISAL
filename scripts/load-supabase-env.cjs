// Shared local configuration for Node-based Supabase diagnostics and tests.
const path = require('node:path');
const dotenv = require('dotenv');
const root = path.resolve(__dirname, '..');
dotenv.config({ path: [path.join(root, '.env.local'), path.join(root, '.env')], quiet: true });
if (!process.env.SUPABASE_ANON_KEY && !process.env.VITE_SUPABASE_ANON_KEY) {
  throw new Error('Missing SUPABASE_ANON_KEY or VITE_SUPABASE_ANON_KEY. Configure .env.local or the environment.');
}
