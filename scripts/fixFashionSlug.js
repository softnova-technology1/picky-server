const dns = require('dns');
dns.setServers(['8.8.8.8', '1.1.1.1']);
require('dotenv').config();
const mongoose = require('mongoose');

async function fixSlug() {
  await mongoose.connect(process.env.MONGODB_URI);
  const Category = require('../src/models/category.model');

  const S3_BUCKET = process.env.AWS_S3_BUCKET_NAME || 'picky-media-bucket';
  const AWS_REGION = process.env.AWS_REGION || 'ap-south-1';

  const res = await Category.updateOne(
    { slug: 'womens-fashion' },
    {
      $set: {
        name: 'Fashion',
        slug: 'fashion',
        image: `https://${S3_BUCKET}.s3.${AWS_REGION}.amazonaws.com/picky/categories/fashion.webp`,
      },
    }
  );
  console.log('Update result:', res);

  const updated = await Category.findOne({ slug: 'fashion' });
  console.log('Category now in DB:', {
    _id: updated._id,
    name: updated.name,
    slug: updated.slug,
    image: updated.image,
  });

  await mongoose.disconnect();
}

fixSlug().catch((err) => {
  console.error(err);
  process.exit(1);
});
