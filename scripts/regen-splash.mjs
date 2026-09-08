/**
 * إعادة توليد شاشات Splash بهوية «وصال | WISAL».
 * يقرأ أبعاد كل splash.png موجود ويستبدله بتدرّج نظيف (أبيض → بنفسجي فاتح)
 * بنفس الأبعاد — بدون أي نص أو اسم قديم. PNG writer بسيط بدون مكتبات خارجية.
 */
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const RES = path.resolve('android/app/src/main/res');

function crc32(buf) {
  let table = crc32.table;
  if (!table) {
    table = crc32.table = new Int32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      table[n] = c;
    }
  }
  let crc = -1;
  for (let i = 0; i < buf.length; i++) crc = (crc >>> 8) ^ table[(crc ^ buf[i]) & 0xff];
  return (crc ^ -1) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function makeGradientPng(width, height) {
  // تدرّج قطري: أبيض (أعلى) → بنفسجي فاتح متناسق مع هوية التطبيق (أسفل)
  const top = [255, 255, 255];
  const bottom = [237, 233, 254]; // #EDE9FE
  const raw = Buffer.alloc(height * (width * 3 + 1));
  for (let y = 0; y < height; y++) {
    const t = y / (height - 1);
    const r = Math.round(top[0] + (bottom[0] - top[0]) * t);
    const g = Math.round(top[1] + (bottom[1] - top[1]) * t);
    const b = Math.round(top[2] + (bottom[2] - top[2]) * t);
    const rowStart = y * (width * 3 + 1);
    raw[rowStart] = 0; // filter: none
    for (let x = 0; x < width; x++) {
      const o = rowStart + 1 + x * 3;
      raw[o] = r; raw[o + 1] = g; raw[o + 2] = b;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 2;  // color type: truecolor RGB
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function readPngSize(file) {
  const b = fs.readFileSync(file);
  return { width: b.readUInt32BE(16), height: b.readUInt32BE(20) };
}

const splashes = [];
for (const dir of fs.readdirSync(RES)) {
  const full = path.join(RES, dir);
  if (!fs.statSync(full).isDirectory()) continue;
  const file = path.join(full, 'splash.png');
  if (fs.existsSync(file)) splashes.push(file);
}

let count = 0;
for (const file of splashes) {
  const { width, height } = readPngSize(file);
  fs.writeFileSync(file, makeGradientPng(width, height));
  console.log(`regenerated ${path.relative(RES, file)} (${width}x${height})`);
  count++;
}
console.log(`DONE: ${count} splash files regenerated.`);
