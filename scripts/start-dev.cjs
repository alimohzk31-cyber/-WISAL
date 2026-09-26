const { spawn } = require('child_process');

const cwd = 'E:/مشاريع/سالين-للخدمات/wisal-upload';
const vite = spawn('npx', ['vite', '--port=3000', '--host=0.0.0.0'], { cwd, stdio: 'pipe' });

let started = false;
const timeout = setTimeout(() => {
  if (!started) {
    console.log('TIMEOUT: server did not start within 30s');
    process.exit(1);
  }
}, 30000);

vite.stderr.on('data', d => process.stderr.write(d));
vite.stdout.on('data', d => {
  const line = d.toString();
  process.stdout.write(line);
  if (line.includes('Local:') || line.includes('http://')) {
    started = true;
    clearTimeout(timeout);
    console.log('\nDEV SERVER READY');
    process.exit(0);
  }
});

vite.on('error', err => {
  console.error('Failed to start:', err.message);
  process.exit(1);
});
