const dns = require('dns');
dns.setServers(['8.8.8.8', '1.1.1.1']);
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const fs = require('fs');
const path = require('path');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');

const bucket = process.env.AWS_S3_BUCKET_NAME || 'picky-e-com';
const region = process.env.AWS_REGION || 'ap-southeast-1';

const s3Client = new S3Client({
  region,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

const sourceImagePath = path.join(__dirname, '../../picky_client/public/images/blog/blog_hero_slash.jpg');

async function uploadBlogHero() {
  console.log(`Checking source image at: ${sourceImagePath}`);
  if (!fs.existsSync(sourceImagePath)) {
    console.error(`File does not exist at: ${sourceImagePath}`);
    process.exit(1);
  }

  const fileBuffer = fs.readFileSync(sourceImagePath);
  const s3Key = 'picky/blog/blog_hero_slash.jpg';

  console.log(`Uploading to AWS S3: bucket=${bucket}, key=${s3Key}, size=${fileBuffer.length} bytes...`);

  await s3Client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: s3Key,
      Body: fileBuffer,
      ContentType: 'image/jpeg',
      CacheControl: 'public, max-age=31536000, immutable',
    })
  );

  const s3Url = `https://${bucket}.s3.${region}.amazonaws.com/${s3Key}`;
  console.log(`✅ Upload successful! S3 URL: ${s3Url}`);

  // Test reachability
  try {
    const res = await fetch(s3Url, { method: 'HEAD' });
    console.log(`Verified S3 Public Access: HTTP ${res.status} ${res.statusText}`);
  } catch (err) {
    console.warn(`Head request check note: ${err.message}`);
  }

  return s3Url;
}

uploadBlogHero()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Upload failed:', err);
    process.exit(1);
  });
