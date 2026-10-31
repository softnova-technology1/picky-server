// TODO (Dev 3): Implement category business logic
const AppError = require('../../utils/appError');
const CategoryRepo = require('./category.repository');
const { uploadImage, deleteImage } = require('../../services/s3.service');
const sharp = require('sharp');
const redis = require('../../config/redis');
const { emitCatalogUpdate } = require('../../socket');

const slugify = (name) =>
  name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

const clearCategoryCache = async (mutationType = 'CATEGORY_UPDATED') => {
  try {
    await redis.del('categories:active');
    await redis.del('categories:all');
  } catch (err) {
    // Ignore cache invalidation error
  }
  try {
    emitCatalogUpdate(mutationType);
  } catch (err) {
    // Ignore socket broadcast error
  }
};

const CategoryService = {
  clearCache: clearCategoryCache,

  async list(includeInactive = false) {
    const cacheKey = includeInactive ? 'categories:all' : 'categories:active';
    try {
      const cached = await redis.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }
    } catch (err) {
      // Fall back to database on cache miss or parse failure
    }

    const filter = includeInactive ? {} : { isActive: true };
    const cats = await CategoryRepo.findAll(filter);

    try {
      await redis.set(cacheKey, JSON.stringify(cats), 'EX', 300); // Cache for 5 minutes
    } catch (err) {
      // Ignore cache write error
    }

    return cats;
  },

  async getBySlug(slug) {
    const category = await CategoryRepo.findBySlug(slug);
    if (!category) throw new AppError('Category not found', 404);
    return category;
  },

  async create(body, file) {
    const slug = slugify(body.name);
    const existing = await CategoryRepo.findBySlug(slug);
    if (existing) throw new AppError('Category with this name already exists', 400);

    let image = body.image || null;
    if (file) {
      const buf = await sharp(file.buffer).resize(400, 400, { fit: 'cover' }).webp({ quality: 80 }).toBuffer();
      const result = await uploadImage(buf, 'category');
      image = result.url;
    }
    const created = await CategoryRepo.create({ ...body, slug, image });
    await clearCategoryCache('CATEGORY_CREATED');
    return created;
  },

  async update(id, body, file) {
    const category = await CategoryRepo.findById(id);
    if (!category) throw new AppError('Category not found', 404);
    let image = body.image !== undefined ? body.image : category.image;
    if (file) {
      const buf = await sharp(file.buffer).resize(400, 400, { fit: 'cover' }).webp({ quality: 80 }).toBuffer();
      const result = await uploadImage(buf, 'category');
      if (category.image && category.image !== result.url) {
        deleteImage(category.image).catch(() => {});
      }
      image = result.url;
    }
    // Prevent updating the slug so frontend constants don't break
    delete body.slug;
    const updated = await CategoryRepo.update(id, { ...body, image });
    await clearCategoryCache('CATEGORY_UPDATED');
    return updated;
  },

  async updateCharacteristics(id, characteristics) {
    const category = await CategoryRepo.findById(id);
    if (!category) throw new AppError('Category not found', 404);
    const updated = await CategoryRepo.update(id, { characteristics });
    await clearCategoryCache('CATEGORY_CHARACTERISTICS_UPDATED');
    return updated;
  },

  async softDelete(id) {
    const category = await CategoryRepo.findById(id);
    if (!category) throw new AppError('Category not found', 404);
    const updated = await CategoryRepo.update(id, { isActive: false });
    await clearCategoryCache('CATEGORY_DELETED');
    return updated;
  },
};

module.exports = CategoryService;
