const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const src = 'C:/Users/DeepakGopika/.gemini/antigravity-ide/brain/7c756e61-d611-4b5a-af64-f19aed761b41/.tempmediaStorage/media_1791811040577.png';
const heroDir = 'c:/projects/picky/picky_client/public/images/new-arrivals-hero';

async function perfectClean() {
  // 1. Fashion Box (remove emoji at x:210, y:14)
  const fW = 255, fH = 215;
  const rawFashion = await sharp(src).extract({ left: 55, top: 75, width: fW, height: fH }).toBuffer();
  
  // Alpha mask feathering border + erasing emoji completely with smooth feathering
  const fashionMask = `
    <svg width="${fW}" height="${fH}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <filter id="fblur"><feGaussianBlur stdDeviation="7" /></filter>
        <mask id="holeMask">
          <rect width="100%" height="100%" fill="white" />
          <circle cx="210" cy="14" r="16" fill="black" />
        </mask>
      </defs>
      <rect x="12" y="12" width="${fW - 24}" height="${fH - 24}" rx="28" ry="28" fill="white" filter="url(#fblur)" mask="url(#holeMask)" />
    </svg>
  `;

  await sharp(rawFashion)
    .composite([{ input: Buffer.from(fashionMask), blend: 'dest-in' }])
    .png()
    .toFile(path.join(heroDir, 'cluster-fashion-box.png'));
  console.log('Fashion box emoji removed!');

  // 2. Snacks (remove emoji at x:43, y:68)
  const sW = 220, sH = 185;
  const rawSnacks = await sharp(src).extract({ left: 715, top: 210, width: sW, height: sH }).toBuffer();

  const snacksMask = `
    <svg width="${sW}" height="${sH}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <filter id="sblur"><feGaussianBlur stdDeviation="7" /></filter>
        <mask id="holeSnacks">
          <rect width="100%" height="100%" fill="white" />
          <circle cx="43" cy="68" r="15" fill="black" />
        </mask>
      </defs>
      <rect x="12" y="12" width="${sW - 24}" height="${fH - 24}" rx="28" ry="28" fill="white" filter="url(#sblur)" mask="url(#holeSnacks)" />
    </svg>
  `;

  await sharp(rawSnacks)
    .composite([{ input: Buffer.from(snacksMask), blend: 'dest-in' }])
    .png()
    .toFile(path.join(heroDir, 'cluster-snacks.png'));
  console.log('Snacks emoji removed!');
}

perfectClean().catch(console.error);
