const { S3Client, PutObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const logger = require('../utils/logger');
const crypto = require('crypto');

const isRealAWS =
  process.env.AWS_ACCESS_KEY_ID &&
  process.env.AWS_SECRET_ACCESS_KEY &&
  process.env.AWS_S3_BUCKET_NAME &&
  !process.env.AWS_ACCESS_KEY_ID.includes('mock') &&
  !process.env.AWS_ACCESS_KEY_ID.includes('AKIA_DEV');

let s3Client = null;
if (isRealAWS) {
  try {
    s3Client = new S3Client({
      region: process.env.AWS_REGION || 'ap-south-1',
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      },
    });
    logger.info('☁️ AWS S3 Client initialized successfully');
  } catch (err) {
    logger.warn(`AWS S3 init failed: ${err.message}. Using fallback.`);
  }
}

/**
 * Upload an image buffer directly to AWS S3 bucket
 * @param {Buffer} buffer - image buffer from Multer / Sharp
 * @param {string} folder - 'products', 'categories', etc.
 * @param {string} contentType - 'image/webp' or 'image/jpeg'
 * @returns {Promise<{url: string, key: string}>}
 */
const uploadImage = async (buffer, folder = 'products', contentType = 'image/webp') => {
  const fileHash = crypto.randomBytes(8).toString('hex');
  const timestamp = Date.now();
  const key = `picky/${folder}/${timestamp}-${fileHash}.webp`;

  if (s3Client && isRealAWS) {
    const bucket = process.env.AWS_S3_BUCKET_NAME;
    const region = process.env.AWS_REGION || 'ap-south-1';

    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: buffer,
      ContentType: contentType,
    });

    await s3Client.send(command);

    // If CloudFront CDN domain configured, use CDN URL, else standard S3 URL
    const publicUrl = process.env.AWS_CLOUDFRONT_URL
      ? `${process.env.AWS_CLOUDFRONT_URL.replace(/\/$/, '')}/${key}`
      : `https://${bucket}.s3.${region}.amazonaws.com/${key}`;

    logger.info(`✅ Uploaded image to S3: ${key}`);
    return { url: publicUrl, key };
  }

  // Development Fallback
  const fallbackUrl = `https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=800&auto=format&fit=crop&q=60`;
  logger.info(`📸 [DEV S3 MOCK] Stored dummy asset key: ${key}`);
  return { url: fallbackUrl, key };
};

/**
 * Delete an image from AWS S3
 * @param {string} key - S3 object key
 */
const deleteImage = async (key) => {
  if (s3Client && isRealAWS && key && !key.startsWith('mock_')) {
    try {
      const bucket = process.env.AWS_S3_BUCKET_NAME;
      await s3Client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
      logger.info(`🗑️ Deleted S3 object: ${key}`);
    } catch (err) {
      logger.error(`S3 Delete error: ${err.message}`);
    }
  }
};

module.exports = { uploadImage, deleteImage };
