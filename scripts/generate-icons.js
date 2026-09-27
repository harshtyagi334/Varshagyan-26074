import fs from 'fs';
import zlib from 'zlib';

function createPNG(width, height, drawFn) {
  // Simple uncompressed or deflate PNG builder in pure Node.js
  const rgba = Buffer.alloc(width * height * 4);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const [r, g, b, a] = drawFn(x, y, width, height);
      rgba[idx] = r;
      rgba[idx + 1] = g;
      rgba[idx + 2] = b;
      rgba[idx + 3] = a;
    }
  }

  // PNG Filter type 0 (None) for each row
  const rawData = Buffer.alloc(height * (1 + width * 4));
  for (let y = 0; y < height; y++) {
    const rowStart = y * (1 + width * 4);
    rawData[rowStart] = 0; // Filter None
    rgba.copy(rawData, rowStart + 1, y * width * 4, (y + 1) * width * 4);
  }

  const compressedData = zlib.deflateSync(rawData);

  // PNG Signature
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR chunk
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr.writeUInt8(8, 8); // bit depth
  ihdr.writeUInt8(6, 9); // color type RGBA
  ihdr.writeUInt8(0, 10); // compression
  ihdr.writeUInt8(0, 11); // filter
  ihdr.writeUInt8(0, 12); // interlace

  const ihdrChunk = createChunk('IHDR', ihdr);
  const idatChunk = createChunk('IDAT', compressedData);
  const iendChunk = createChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

function createChunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);

  const typeBuf = Buffer.from(type, 'ascii');
  const body = Buffer.concat([typeBuf, data]);

  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(calculateCRC(body), 0);

  return Buffer.concat([length, body, crc]);
}

// CRC32 table
const crcTable = [];
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    if (c & 1) c = 0xedb88320 ^ (c >>> 1);
    else c = c >>> 1;
  }
  crcTable[n] = c;
}

function calculateCRC(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc = crcTable[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

// Icon Drawer: VarshaGyan brand colors (Dark slate #2E3A46 background, Gold #E29B3C sun/drops, Rain blue #72A5D8, Sprout green #38A169)
function iconDrawer(x, y, w, h) {
  const nx = (x / w) * 2 - 1; // -1 to +1
  const ny = (y / h) * 2 - 1;
  const dist = Math.sqrt(nx * nx + ny * ny);

  // Background Slate #2E3A46 (R:46, G:58, B:70)
  let r = 46, g = 58, b = 70, a = 255;

  // Outer border glow #E29B3C
  if (dist > 0.88 && dist < 0.95) {
    r = 226; g = 155; b = 60;
  }

  // Mountain ridge
  const m1 = 0.3 - Math.abs(nx + 0.3) * 0.8;
  const m2 = 0.2 - Math.abs(nx - 0.4) * 0.7;
  if (ny > m1 && ny < 0.7) {
    r = 32; g = 42; b = 51;
  }
  if (ny > m2 && ny < 0.7) {
    r = 25; g = 34; b = 42;
  }

  // Golden Sun
  const sunDist = Math.sqrt((nx - 0.35) ** 2 + (ny + 0.35) ** 2);
  if (sunDist < 0.25) {
    r = 243; g = 195; b = 99; // #F3C363
  }

  // Cloud
  const c1 = Math.sqrt((nx + 0.1) ** 2 + (ny + 0.05) ** 2);
  const c2 = Math.sqrt((nx - 0.2) ** 2 + (ny - 0.05) ** 2);
  const c3 = Math.sqrt((nx + 0.3) ** 2 + (ny - 0.05) ** 2);
  if (c1 < 0.28 || c2 < 0.22 || c3 < 0.22 || (ny > -0.05 && ny < 0.15 && Math.abs(nx) < 0.45)) {
    r = 232; g = 238; b = 245; // #E8EEF5
  }

  // Rain Drops #72A5D8
  if (ny > 0.25 && ny < 0.55) {
    for (const dropX of [-0.3, -0.1, 0.1, 0.3]) {
      const dropLine = ny - (nx - dropX) * 2;
      if (Math.abs(nx - dropX) < 0.025 && ny > 0.25 && ny < 0.5) {
        r = 114; g = 165; b = 216;
      }
    }
  }

  // Sprout at base
  const sproutDist = Math.sqrt(nx ** 2 + (ny - 0.65) ** 2);
  if (sproutDist < 0.1) {
    r = 56; g = 161; b = 105; // #38A169
  }

  return [r, g, b, a];
}

const sizes = [
  { name: 'public/pwa-192x192.png', size: 192 },
  { name: 'public/pwa-512x512.png', size: 512 },
  { name: 'public/pwa-maskable-512x512.png', size: 512 },
  { name: 'public/apple-touch-icon.png', size: 180 },
  { name: 'public/favicon.ico', size: 64 },
];

if (!fs.existsSync('public')) {
  fs.mkdirSync('public');
}

for (const { name, size } of sizes) {
  const pngBuf = createPNG(size, size, iconDrawer);
  fs.writeFileSync(name, pngBuf);
  console.log(`Generated ${name} (${size}x${size})`);
}
