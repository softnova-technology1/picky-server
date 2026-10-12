const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const src = 'C:/Users/DeepakGopika/.gemini/antigravity-ide/brain/7c756e61-d611-4b5a-af64-f19aed761b41/.tempmediaStorage/media_1791811040577.png';
const outDir = 'c:/projects/picky/picky_client/public/images/new-arrivals-hero';

if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

// 5 Glass Orbs with precise centers and radiuses
const circles = [
  { name: 'beauty', cx: 132, cy: 458, r: 62 },
  { name: 'accessories', cx: 320, cy: 458, r: 62 },
  { name: 'tamil', cx: 507, cy: 458, r: 62 },
  { name: 'snacks', cx: 695, cy: 458, r: 62 },
  { name: 'jewellery', cx: 882, cy: 458, r: 62 }
];

async function run() {
  for (const c of circles) {
    const size = c.r * 2;
    const left = Math.round(c.cx - c.r);
    const top = Math.round(c.cy - c.r);

    const circleSvg = `<svg width="${size}" height="${size}"><circle cx="${c.r}" cy="${c.r}" r="${c.r}" fill="#fff" /></svg>`;

    const cropped = await sharp(src)
      .extract({ left, top, width: size, height: size })
      .toBuffer();

    await sharp(cropped)
      .composite([{ input: Buffer.from(circleSvg), blend: 'dest-in' }])
      .png()
      .toFile(path.join(outDir, `orb-${c.name}.png`));
  }

  // Clusters with feathered edge masks for seamless blending into any background
  const clusters = [
    { name: 'fashion-box', rect: { left: 55, top: 75, width: 255, height: 215 } },
    { name: 'phones', rect: { left: 720, top: 80, width: 215, height: 165 } },
    { name: 'pooja', rect: { left: 140, top: 260, width: 185, height: 135 } },
    { name: 'snacks', rect: { left: 715, top: 210, width: 220, height: 185 } }
  ];

  for (const cl of clusters) {
    const w = cl.rect.width;
    const h = cl.rect.height;
    // Elliptical feather mask with blur
    const maskSvg = `
      <svg width="${w}" height="${h}">
        <defs>
          <filter id="blur">
            <feGaussianBlur stdDeviation="8" />
          </filter>
        </defs>
        <rect x="12" y="12" width="${w - 24}" height="${h - 24}" rx="30" ry="30" fill="#fff" filter="url(#blur)" />
      </svg>
    `;

    const cropped = await sharp(src)
      .extract(cl.rect)
      .toBuffer();

    await sharp(cropped)
      .composite([{ input: Buffer.from(maskSvg), blend: 'dest-in' }])
      .png()
      .toFile(path.join(outDir, `cluster-${cl.name}.png`));
  }

  console.log('Successfully regenerated all assets with feathered alpha blending!');
}

run().catch(console.error);
