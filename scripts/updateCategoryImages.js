const dns = require('dns');
dns.setServers(['8.8.8.8', '1.1.1.1']);
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const mongoose = require('mongoose');
const Category = require('../src/models/category.model');

const S3_BUCKET = process.env.AWS_S3_BUCKET_NAME || 'picky-e-com';
const AWS_REGION = process.env.AWS_REGION || 'ap-southeast-1';

const CATEGORY_IMAGE_MAP = {
  'fashion': `https://${S3_BUCKET}.s3.${AWS_REGION}.amazonaws.com/picky/categories/fashion.webp`,
  'womens-fashion': `https://${S3_BUCKET}.s3.${AWS_REGION}.amazonaws.com/picky/categories/womens-fashion.webp`,
  'home-kitchen': `https://${S3_BUCKET}.s3.${AWS_REGION}.amazonaws.com/picky/categories/home-kitchen.webp`,
  'artificial-jewellery': `https://${S3_BUCKET}.s3.${AWS_REGION}.amazonaws.com/picky/categories/artificial-jewellery.webp`,
  'beauty-personal-care': `https://${S3_BUCKET}.s3.${AWS_REGION}.amazonaws.com/picky/categories/beauty-personal-care.webp`,
  'mobile-accessories': `https://${S3_BUCKET}.s3.${AWS_REGION}.amazonaws.com/picky/categories/mobile-accessories.webp`,
  'traditional-tamil-products': `https://${S3_BUCKET}.s3.${AWS_REGION}.amazonaws.com/picky/categories/traditional-tamil-products.webp`,
  'snacks-foods': `https://${S3_BUCKET}.s3.${AWS_REGION}.amazonaws.com/picky/categories/snacks-foods.webp`,
  'home-decor': `https://${S3_BUCKET}.s3.${AWS_REGION}.amazonaws.com/picky/categories/home-decor.webp`,
  'kids-products': `https://${S3_BUCKET}.s3.${AWS_REGION}.amazonaws.com/picky/categories/kids-products.webp`,
  'fitness-products': `https://${S3_BUCKET}.s3.${AWS_REGION}.amazonaws.com/picky/categories/fitness-products.webp`,
};

async function updateDbCategoryImages() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('❌ MONGODB_URI not found');
    process.exit(1);
  }

  await mongoose.connect(uri, { serverSelectionTimeoutMS: 30000 });
  console.log('✅ Connected to MongoDB Atlas');

  for (const [slug, s3Url] of Object.entries(CATEGORY_IMAGE_MAP)) {
    const res = await Category.updateOne(
      { slug },
      { $set: { image: s3Url } }
    );
    console.log(`Updated [${slug}] -> ${s3Url} (matched: ${res.matchedCount}, modified: ${res.modifiedCount})`);
  }

  const allCats = await Category.find({}, 'name slug image').lean();
  console.log('\n--- VERIFIED CATEGORIES IN DATABASE ---');
  allCats.forEach(c => console.log(`• ${c.name} (${c.slug}): ${c.image}`));

  await mongoose.disconnect();
  console.log('✅ Disconnected cleanly');
}

updateDbCategoryImages().catch(err => {
  console.error('Error updating category images:', err);
  process.exit(1);
});
