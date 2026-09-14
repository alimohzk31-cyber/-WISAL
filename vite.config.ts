import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'url';
import { defineConfig, loadEnv } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');
  return {
    base: './',
    plugins: [
      react(), 
      tailwindcss(), 
      ...(mode === 'standalone' ? [viteSingleFile()] : []),
    ],
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      'import.meta.env.VITE_SERVICE_VIEWS_RPC_ENABLED': JSON.stringify(env.VITE_SERVICE_VIEWS_RPC_ENABLED ?? 'true'),
      'import.meta.env.VITE_SUPABASE_URL': JSON.stringify(env.VITE_SUPABASE_URL || 'https://nnxrjpitjxtceydlcxzm.supabase.co'),
      'import.meta.env.VITE_SUPABASE_ANON_KEY': JSON.stringify(env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5ueHJqcGl0anh0Y2V5ZGxjeHptIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU2NDkyMjMsImV4cCI6MjA5MTIyNTIyM30.Ui1IQ4OOJ8wngBoNIBNe0nTCQgfm0q8P7AjrKhyAU4w'),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    build: {
      target: 'es2015',
      // كان البناء سابقاً عبر vite-plugin-singlefile: كل JS+CSS يُدمج في
      // index.html واحد (~1.1MB) يجب تنزيله وتحليله بالكامل قبل أول رسم،
      // ولا يُخزَّن مؤقتاً جزئياً — وهذا هو سبب البطء الحقيقي على GitHub Pages.
      // الآن: chunks حقيقية (Home/CategoryPage/AdminDashboard تتقسم ديناميكياً)،
      // يوازي المتصفح تحميلها، ويخزّنها مؤقتاً على حدة بين الزيارات.
      assetsInlineLimit: 4096,
      chunkSizeWarningLimit: 900,
      reportCompressedSize: true,
      manifest: true,
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
    },
  };
});
