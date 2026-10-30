const dns = require('dns');
try {
  dns.setServers(['8.8.8.8', '1.1.1.1']);
} catch (_) {}
const { S3Client, PutObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const logger = require('../utils/logger');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

function isRealAWS() {
  const keyId = (process.env.AWS_ACCESS_KEY_ID || '').toLowerCase();
  const secretKey = (process.env.AWS_SECRET_ACCESS_KEY || '').toLowerCase();
  return (
    Boolean(process.env.AWS_ACCESS_KEY_ID) &&
    Boolean(process.env.AWS_SECRET_ACCESS_KEY) &&
    Boolean(process.env.AWS_S3_BUCKET_NAME) &&
    !keyId.includes('mock') &&
    !keyId.includes('dev') &&
    !secretKey.includes('mock') &&
    !secretKey.includes('dev')
  );
}

let s3ClientInstance = null;
let lastAccessKey = null;

function getS3Client() {
  if (!isRealAWS()) return null;

  const currentAccessKey = process.env.AWS_ACCESS_KEY_ID;
  if (!s3ClientInstance || lastAccessKey !== currentAccessKey) {
    try {
      s3ClientInstance = new S3Client({
        region: process.env.AWS_REGION || 'ap-southeast-1',
        credentials: {
          accessKeyId: process.env.AWS_ACCESS_KEY_ID,
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
        },
      });
      lastAccessKey = currentAccessKey;
      logger.info(`☁️ AWS S3 Client initialized (${process.env.AWS_S3_BUCKET_NAME} in ${process.env.AWS_REGION || 'ap-southeast-1'})`);
    } catch (err) {
      logger.warn(`AWS S3 init failed: ${err.message}. Using fallback.`);
      s3ClientInstance = null;
    }
  }
  return s3ClientInstance;
}

/**
 * Extract S3 object key from a full S3/CloudFront URL or return key if already relative
 * @param {string} urlOrKey - Full URL or relative key
 * @returns {string|null}
 */
function extractKey(urlOrKey) {
  if (!urlOrKey || typeof urlOrKey !== 'string') return null;
  const trimmed = urlOrKey.trim();
  if (trimmed.startsWith('picky/')) return trimmed;

  try {
    const parsed = new URL(trimmed);
    const pathname = parsed.pathname.replace(/^\/+/, '');
    if (pathname.includes('picky/')) {
      return pathname.slice(pathname.indexOf('picky/'));
    }
    return pathname;
  } catch (_) {
    if (trimmed.includes('picky/')) {
      return trimmed.slice(trimmed.indexOf('picky/'));
    }
    return null;
  }
}

/**
 * Upload an image buffer directly to AWS S3 bucket
 * @param {Buffer} buffer - image buffer from Multer / Sharp
 * @param {string} folder - 'products', 'categories', 'subcategories', etc.
 * @param {string} contentType - 'image/webp' or 'image/jpeg'
 * @returns {Promise<{url: string, key: string}>}
 */
const uploadImage = async (buffer, folder = 'products', contentType = 'image/webp') => {
  const fileHash = crypto.randomBytes(8).toString('hex');
  const timestamp = Date.now();

  // Normalize folder to avoid duplicate "picky/picky/..." prefixes
  const cleanFolder = (folder || 'products')
    .toString()
    .replace(/^picky\/?/i, '')
    .replace(/^\/+|\/+$/g, '') || 'products';

  const key = `picky/${cleanFolder}/${timestamp}-${fileHash}.webp`;
  const client = getS3Client();

  if (client && isRealAWS()) {
    try {
      const bucket = process.env.AWS_S3_BUCKET_NAME;
      const region = process.env.AWS_REGION || 'ap-southeast-1';

      const command = new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: buffer,
        ContentType: contentType,
      });

      await client.send(command);

      const publicUrl = process.env.AWS_CLOUDFRONT_URL
        ? `${process.env.AWS_CLOUDFRONT_URL.replace(/\/$/, '')}/${key}`
        : `https://${bucket}.s3.${region}.amazonaws.com/${key}`;

      logger.info(`✅ Uploaded image to S3: ${publicUrl}`);
      return { url: publicUrl, key };
    } catch (err) {
      logger.warn(`AWS S3 Upload failed (${err.name}: ${err.message}). Using local fallback.`);
    }
  }

  // Local Static Storage Fallback (if S3 is offline/unreachable)
  const targetDir = path.join(__dirname, '../../uploads', cleanFolder);
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }
  const filename = `${timestamp}-${fileHash}.webp`;
  const filePath = path.join(targetDir, filename);
  fs.writeFileSync(filePath, buffer);

  const localStaticUrl = `http://localhost:5000/uploads/${cleanFolder}/${filename}`;
  logger.info(`📸 [LOCAL DISK UPLOAD] Saved asset to static disk: ${localStaticUrl}`);
  return { url: localStaticUrl, key };
};

/**
 * Upload any file (documents, pdf, doc, images, etc.) directly to AWS S3 bucket
 * @param {Buffer} buffer - file buffer from Multer
 * @param {string} folder - target folder, e.g. 'inquiries'
 * @param {string} originalName - original filename to extract clean extension
 * @param {string} mimeType - content MIME type
 * @returns {Promise<{url: string, key: string}>}
 */
const uploadFile = async (
  buffer,
  folder = 'inquiries',
  originalName = '',
  mimeType = 'application/octet-stream'
) => {
  const fileHash = crypto.randomBytes(8).toString('hex');
  const timestamp = Date.now();

  // Normalize folder to avoid duplicate "picky/picky/..." prefixes
  const cleanFolder = (folder || 'inquiries')
    .toString()
    .replace(/^picky\/?/i, '')
    .replace(/^\/+|\/+$/g, '') || 'inquiries';

  // Determine file extension
  let ext = '';
  if (originalName) {
    ext = path.extname(originalName).toLowerCase();
  }
  if (!ext) {
    const mimeToExt = {
      'image/jpeg': '.jpg',
      'image/jpg': '.jpg',
      'image/png': '.png',
      'image/webp': '.webp',
      'image/gif': '.gif',
      'image/svg+xml': '.svg',
      'application/pdf': '.pdf',
      'application/msword': '.doc',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
      'text/plain': '.txt',
    };
    ext = mimeToExt[mimeType] || '';
  }

  const key = `picky/${cleanFolder}/${timestamp}-${fileHash}${ext}`;
  const client = getS3Client();

  if (client && isRealAWS()) {
    try {
      const bucket = process.env.AWS_S3_BUCKET_NAME;
      const region = process.env.AWS_REGION || 'ap-southeast-1';

      const command = new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: buffer,
        ContentType: mimeType || 'application/octet-stream',
      });

      await client.send(command);

      const publicUrl = process.env.AWS_CLOUDFRONT_URL
        ? `${process.env.AWS_CLOUDFRONT_URL.replace(/\/$/, '')}/${key}`
        : `https://${bucket}.s3.${region}.amazonaws.com/${key}`;

      logger.info(`✅ Uploaded file directly to S3: ${publicUrl}`);
      return { url: publicUrl, key };
    } catch (err) {
      logger.warn(`AWS S3 Upload failed (${err.name}: ${err.message}). Using local fallback.`);
    }
  }

  // Local Static Storage Fallback (if S3 is offline/unreachable)
  const targetDir = path.join(__dirname, '../../uploads', cleanFolder);
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }
  const filename = `${timestamp}-${fileHash}${ext}`;
  const filePath = path.join(targetDir, filename);
  fs.writeFileSync(filePath, buffer);

  const localStaticUrl = `http://localhost:5000/uploads/${cleanFolder}/${filename}`;
  logger.info(`📸 [LOCAL DISK UPLOAD] Saved inquiry file to static disk: ${localStaticUrl}`);
  return { url: localStaticUrl, key };
};

/**
 * Delete an image from AWS S3 (or local disk if stored locally)
 * @param {string} urlOrKey - Full URL or S3 object key
 */
const deleteImage = async (urlOrKey) => {
  if (!urlOrKey) return;
  // Skip external third-party CDNs or static public bundle assets
  if (
    typeof urlOrKey === 'string' &&
    (urlOrKey.includes('unsplash.com') ||
      urlOrKey.includes('placeholder.com') ||
      (urlOrKey.startsWith('/') && !urlOrKey.includes('/uploads/')))
  ) {
    return;
  }
  const key = extractKey(urlOrKey);

  const client = getS3Client();
  if (client && isRealAWS() && key && !key.startsWith('mock_')) {
    try {
      const bucket = process.env.AWS_S3_BUCKET_NAME;
      await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
      logger.info(`🗑️ Deleted S3 object: ${key}`);
      return;
    } catch (err) {
      logger.error(`S3 Delete error (${key}): ${err.message}`);
    }
  }

  // Local file cleanup fallback
  try {
    if (typeof urlOrKey === 'string' && urlOrKey.includes('/uploads/')) {
      const subPath = urlOrKey.slice(urlOrKey.indexOf('/uploads/') + 9);
      const localPath = path.join(__dirname, '../../uploads', subPath);
      if (fs.existsSync(localPath)) {
        fs.unlinkSync(localPath);
        logger.info(`🗑️ Deleted local disk file: ${localPath}`);
      }
    }
  } catch (_) {}
};

module.exports = { uploadImage, uploadFile, deleteImage, extractKey, isRealAWS };
