// توليد مفتاح توقيع Release آمن خارج مسار Git
// يُخزَّن مساره وكلمة مروره في android/keystore.properties (غير مرفوع)
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ksDir = path.join(__dirname, '..', 'android', 'keystore');
fs.mkdirSync(ksDir, { recursive: true });

const ksPath = path.join(ksDir, 'saleen-release.keystore');
const propsPath = path.join(__dirname, '..', 'android', 'keystore.properties');

const pass = [...crypto.getRandomValues(new Uint8Array(18))]
  .map((b) => 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'[b % 57])
  .join('');

const keytool = 'C:\\Program Files\\Android\\Android Studio\\jbr\\bin\\keytool.exe';
const args = [
  '-genkeypair', '-v',
  '-keystore', ksPath,
  '-alias', 'saleen',
  '-keyalg', 'RSA', '-keysize', '2048',
  '-validity', '10000',
  '-storepass', pass,
  '-keypass', pass,
  '-dname', 'CN=Saleen Service, OU=Mobile, O=Saleen, L=Baghdad, ST=Baghdad, C=IQ',
];

import { execFileSync } from 'child_process';
try {
  execFileSync(keytool, args, { stdio: 'inherit' });
} catch (e) {
  console.error('keytool failed:', e.message);
  process.exit(1);
}

fs.writeFileSync(propsPath, `storeFile=${ksPath.replace(/\\/g, '\\\\')}\nstorePassword=${pass}\nkeyAlias=saleen\nkeyPassword=${pass}\n`);
console.log('Keystore created:', ksPath);
console.log('Properties written:', propsPath);