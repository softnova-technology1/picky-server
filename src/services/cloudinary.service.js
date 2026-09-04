const cloudinary = require('cloudinary').v2;
const logger = require('../utils/logger');

const isRealCloudinary =
  process.env.CLOUDINARY_CLOUD_NAME &&
  process.env.CLOUDINARY_API_KEY &&
  !process.env.CLOUDINARY_CLOUD_NAME.includes('mock') &&
  !process.env.CLOUDINARY_CLOUD_NAME.includes('dev');

if (isRealCloudinary) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });
}

/**
 * Upload a file buffer to Cloudinary (with dev fallback)
 * @param {Buffer} buffer - image buffer from Multer
 * @param {string} folder - e.g. 'picky/products', 'picky/categories'
 * @returns {Promise<{url: string, publicId: string}>}
 */
const uploadImage = (buffer, folder = 'picky') => {
  return new Promise((resolve, reject) => {
    if (!isRealCloudinary) {
      // Dev placeholder fallback
      const randomId = Math.random().toString(36).substring(7);
      const fallbackUrl = `https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=800&auto=format&fit=crop&q=60&ixlib=rb-4.0.3`;
      logger.info(`📸 [DEV CLOUDINARY MOCK] Uploaded dummy asset for ${folder}`);
      return resolve({ url: fallbackUrl, publicId: `mock_${randomId}` });
    }

    cloudinary.uploader
      .upload_stream({ folder, resource_type: 'image' }, (error, result) => {
        if (error) {
          logger.error(`Cloudinary upload failed: ${error.message}`);
          return resolve({
            url: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800',
            publicId: 'mock_fallback',
          });
        }
        resolve({ url: result.secure_url, publicId: result.public_id });
      })
      .end(buffer);
  });
};

const deleteImage = async (publicId) => {
  if (isRealCloudinary && publicId && !publicId.startsWith('mock_')) {
    try {
      await cloudinary.uploader.destroy(publicId);
    } catch (_) {}
  }
};

module.exports = { uploadImage, deleteImage };
