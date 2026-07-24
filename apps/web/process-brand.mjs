// One-off: key out solid backgrounds from the Mactab brand PNGs.
// Dark artwork (white bg) -> alpha from darkness, pure dark ink.
// Light artwork (black bg) -> alpha from lightness, pure white ink.
import sharp from 'sharp';
import { mkdirSync } from 'node:fs';

const ROOT = '../../';
const OUT = './public/brand/';
mkdirSync(OUT, { recursive: true });

async function key(src, out, mode, maxW) {
  const img = sharp(ROOT + src).ensureAlpha();
  const { data, info } = await img.raw().toBuffer({ resolveWithObject: true });
  const px = Buffer.alloc(info.width * info.height * 4);
  for (let i = 0; i < info.width * info.height; i++) {
    const r = data[i * 4], g = data[i * 4 + 1], b = data[i * 4 + 2];
    const lum = (r + g + b) / 3;
    if (mode === 'darkArt') {
      // ink = near-black; background = white
      const a = Math.max(0, Math.min(255, Math.round(255 - lum)));
      px[i * 4] = 16; px[i * 4 + 1] = 18; px[i * 4 + 2] = 22; px[i * 4 + 3] = a;
    } else {
      // ink = near-white; background = black
      const a = Math.max(0, Math.min(255, Math.round(lum)));
      px[i * 4] = 250; px[i * 4 + 1] = 250; px[i * 4 + 2] = 252; px[i * 4 + 3] = a;
    }
  }
  let pipe = sharp(px, { raw: { width: info.width, height: info.height, channels: 4 } }).trim();
  if (maxW) pipe = pipe.resize({ width: maxW, withoutEnlargement: true });
  await pipe.png().toFile(OUT + out);
  console.log('ok', out);
}

await key('mactab logo dark.png', 'logo-on-light.png', 'darkArt', 800);
await key('mactab logo light.png', 'logo-on-dark.png', 'lightArt', 800);
await key('mactab icon dark.png', 'icon-on-light.png', 'darkArt', 512);
await key('mactab icon light.png', 'icon-on-dark.png', 'lightArt', 512);
// favicon source: dark ink icon, square-padded
await sharp(OUT + 'icon-on-light.png')
  .resize(256, 256, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
  .png()
  .toFile('./src/app/icon.png');
console.log('favicon ok');
