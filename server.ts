import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3000;

// Hashed bundles are immutable; the shell and worker always revalidate so an
// older offline cache can never pin a newer version of وصال.
app.use(express.static(path.join(__dirname, 'dist'), {
  setHeaders(res, filePath) {
    const name = path.basename(filePath);
    if (name === 'index.html' || name === 'sw.js' || name === 'manifest.webmanifest') {
      res.setHeader('Cache-Control', 'no-cache, must-revalidate');
    } else if (filePath.includes(`${path.sep}assets${path.sep}`)) {
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    }
  },
}));

// Handle SPA routing - send all requests to index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server is running on port ${PORT}`);
});
