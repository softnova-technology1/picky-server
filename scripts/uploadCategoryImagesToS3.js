const dns = require('dns');
dns.setServers(['8.8.8.8', '1.1.1.1']);
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const Category = require('../src/models/category.model');

const bucket = process.env.AWS_S3_BUCKET_NAME || 'picky-e-com';
const region = process.env.AWS_REGION || 'ap-southeast-1';

const s3Client = new S3Client({
  region,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

const uploadsDir = path.join(__dirname, '../uploads/categories');

// Categories to upload
const CATEGORIES_TO_UPLOAD = [
  { slug: 'fashion', file: 'fashion.webp', catSlug: 'fashion' },
  { slug: 'womens-fashion', file: 'womens-fashion.webp', catSlug: 'fashion' },
  { slug: 'home-kitchen', file: 'home-kitchen.webp', catSlug: 'home-kitchen' },
  { slug: 'artificial-jewellery', file: 'artificial-jewellery.webp', catSlug: 'artificial-jewellery' },
  { slug: 'beauty-personal-care', file: 'beauty-personal-care.webp', catSlug: 'beauty-personal-care' },
  { slug: 'mobile-accessories', file: 'mobile-accessories.webp', catSlug: 'mobile-accessories' },
  { slug: 'traditional-tamil-products', file: 'traditional-tamil-products.webp', catSlug: 'traditional-tamil-products' },
  { slug: 'snacks-foods', file: 'snacks-foods.webp', catSlug: 'snacks-foods' },
  { slug: 'home-decor', file: 'home-decor.webp', catSlug: 'home-decor' },
  { slug: 'kids-products', file: 'kids-products.webp', catSlug: 'kids-products' },
  { slug: 'fitness-products', file: 'fitness-products.webp', catSlug: 'fitness-products' },
];

async function main() {
  console.log(`🚀 Starting S3 Upload of Category Images to bucket "${bucket}" (${region})...\n`);

  const uploadedUrls = {};

  // 1. Upload each image to S3
  for (const item of CATEGORIES_TO_UPLOAD) {
    const filePath = path.join(uploadsDir, item.file);
    if (!fs.existsSync(filePath)) {
      console.error(`❌ File not found: ${filePath}`);
      continue;
    }

    const fileBuffer = fs.readFileSync(filePath);
    const s3Key = `picky/categories/${item.slug}.webp`;

    console.log(`Uploading ${item.file} (${fileBuffer.length} bytes) -> s3://${bucket}/${s3Key}...`);

    await s3Client.send(new PutObjectCommand({
      Bucket: bucket,
      Key: s3Key,
      Body: fileBuffer,
      ContentType: 'image/webp',
      CacheControl: 'public, max-age=31536000, immutable',
    }));

    const s3Url = `https://${bucket}.s3.${region}.amazonaws.com/${s3Key}`;
    uploadedUrls[item.slug] = s3Url;

    // Verify HTTP access
    try {
      const resp = await fetch(s3Url, { method: 'HEAD' });
      if (resp.status === 200) {
        console.log(`  ✅ Verified public access (HTTP 200): ${s3Url}\n`);
      } else {
        console.warn(`  ⚠️ Verification returned status: ${resp.status} for ${s3Url}\n`);
      }
    } catch (e) {
      console.warn(`  ⚠️ Verification fetch error: ${e.message}\n`);
    }
  }

  // 2. Update MongoDB Category Documents
  console.log('Connecting to MongoDB Atlas...');
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('✅ Connected to MongoDB Atlas\n');

  console.log('Updating Category documents in database with live S3 URLs...');

  const dbUpdates = [
    { slug: 'fashion', s3Url: uploadedUrls['fashion'] || uploadedUrls['womens-fashion'] },
    { slug: 'home-kitchen', s3Url: uploadedUrls['home-kitchen'] },
    { slug: 'artificial-jewellery', s3Url: uploadedUrls['artificial-jewellery'] },
    { slug: 'beauty-personal-care', s3Url: uploadedUrls['beauty-personal-care'] },
    { slug: 'mobile-accessories', s3Url: uploadedUrls['mobile-accessories'] },
    { slug: 'traditional-tamil-products', s3Url: uploadedUrls['traditional-tamil-products'] },
    { slug: 'snacks-foods', s3Url: uploadedUrls['snacks-foods'] },
    { slug: 'home-decor', s3Url: uploadedUrls['home-decor'] },
    { slug: 'kids-products', s3Url: uploadedUrls['kids-products'] },
    { slug: 'fitness-products', s3Url: uploadedUrls['fitness-products'] },
  ];

  for (const u of dbUpdates) {
    const res = await Category.updateOne(
      { slug: u.slug },
      { $set: { image: u.s3Url } }
    );
    console.log(`  ✓ Updated [${u.slug}] -> ${u.s3Url} (matched: ${res.matchedCount}, modified: ${res.modifiedCount})`);
  }

  const allCats = await Category.find({}, 'name slug image').lean();
  console.log('\n=============================================');
  console.log('       ALL CATEGORIES IN DATABASE            ');
  console.log('=============================================');
  allCats.forEach(c => {
    console.log(`• ${c.name.padEnd(28)} | ${c.slug.padEnd(28)} | ${c.image}`);
  });
  console.log('=============================================\n');

  await mongoose.disconnect();
  console.log('🎉 Done! All category images uploaded to S3 and updated in MongoDB.');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
