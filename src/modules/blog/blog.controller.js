const Blog = require('../../models/blog.model');
const { ApiResponse } = require('../../utils/apiResponse');
const { uploadImage } = require('../../services/s3.service');
const logger = require('../../utils/logger');

const DEFAULT_BLOG_HERO = {
  pageSlug: 'blog',
  isBlogPageEnabled: true,
  hero: {
    enabled: true,
    badgeText: 'THE PICKY JOURNAL',
    title: 'Discover Better. Shop Smarter.',
    subtitle: 'Helpful ideas, product guides, shopping tips, and stories to make everyday choices easier.',
    primaryButtonText: 'Explore Stories',
    secondaryButtonText: 'Shop Products',
    imageUrl: 'https://picky-e-com.s3.ap-southeast-1.amazonaws.com/picky/blog/blog_hero_slash.jpg',
  },
};

/**
 * Public: Get blog page data from MongoDB
 */
const getBlogData = async (req, res, next) => {
  try {
    let blogDoc = await Blog.findOne({ pageSlug: 'blog' });
    if (!blogDoc) {
      blogDoc = await Blog.create(DEFAULT_BLOG_HERO);
      logger.info('Created initial Blog document in MongoDB');
    }
    return res.json(ApiResponse.success(blogDoc));
  } catch (err) {
    next(err);
  }
};

/**
 * Admin: Update blog page data in MongoDB
 */
const updateBlogData = async (req, res, next) => {
  try {
    const payload = req.body;
    if (!payload) {
      return res.status(400).json(ApiResponse.error('Payload is required', 400));
    }

    const updatedBlog = await Blog.findOneAndUpdate(
      { pageSlug: 'blog' },
      { $set: payload },
      { new: true, upsert: true }
    );

    logger.info('Updated Blog page data in MongoDB');
    return res.json(ApiResponse.success(updatedBlog, 'Blog data updated successfully'));
  } catch (err) {
    next(err);
  }
};

/**
 * Admin: Upload blog image directly to AWS S3
 */
const uploadBlogImage = async (req, res, next) => {
  try {
    const file = req.file || (req.files && req.files[0]);
    if (!file) {
      return res.status(400).json(ApiResponse.error('No image file provided', 400));
    }

    const buffer = file.buffer;
    const contentType = file.mimetype || 'image/jpeg';

    const result = await uploadImage(buffer, 'blog', contentType);
    logger.info(`Blog image uploaded to S3: ${result.url}`);

    return res.json(ApiResponse.success(result, 'Image uploaded to AWS S3 successfully'));
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getBlogData,
  updateBlogData,
  uploadBlogImage,
};
