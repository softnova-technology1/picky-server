const sharp = require('sharp');
const path = require('path');

const src = 'C:/Users/DeepakGopika/.gemini/antigravity-ide/brain/7c756e61-d611-4b5a-af64-f19aed761b41/bubble_beauty_clean_1791815068127.jpg';
const outDir = 'c:/projects/picky/picky_client/public/images/new-arrivals-hero';

async function processBeauty() {
  const size = 400;
  const circleMask = `<svg width="${size}" height="${size}"><circle cx="${size/2}" cy="${size/2}" r="${size/2}" fill="#fff" /></svg>`;

  await sharp(src)
    .resize(size, size, { fit: 'cover', position: 'center' })
    .composite([{ input: Buffer.from(circleMask), blend: 'dest-in' }])
    .png()
    .toFile(path.join(outDir, 'orb-beauty.png'));

  await sharp(src)
    .resize(size, size, { fit: 'cover', position: 'center' })
    .composite([{ input: Buffer.from(circleMask), blend: 'dest-in' }])
    .png()
    .toFile(path.join(outDir, 'orb-beauty-v2.png'));

  console.log('Successfully processed new clean beauty orb in public directory!');
}

processBeauty().catch(console.error);
