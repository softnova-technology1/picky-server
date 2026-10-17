// TODO (Dev 3): Implement category business logic
const AppError = require('../../utils/appError');
const CategoryRepo = require('./category.repository');
const { uploadImage } = require('../../services/s3.service');
const sharp = require('sharp');

const slugify = (name) =>
  name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

let categoryCache = null;
let categoryCacheTime = 0;
const CAT_CACHE_TTL = 120 * 1000; // 2 minutes

const clearCategoryCache = () => {
  categoryCache = null;
  categoryCacheTime = 0;
};

const CategoryService = {
  clearCache: clearCategoryCache,

  async list(includeInactive = false) {
    if (!includeInactive && categoryCache && Date.now() - categoryCacheTime < CAT_CACHE_TTL) {
      return categoryCache;
    }
    const filter = includeInactive ? {} : { isActive: true };
    const cats = await CategoryRepo.findAll(filter);
    if (!includeInactive) {
      categoryCache = cats;
      categoryCacheTime = Date.now();
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

    let image = null;
    if (file) {
      const buf = await sharp(file.buffer).resize(400, 400, { fit: 'cover' }).webp({ quality: 80 }).toBuffer();
      const result = await uploadImage(buf, 'picky/categories');
      image = result.url;
    }
    clearCategoryCache();
    return CategoryRepo.create({ ...body, slug, image });
  },

  async update(id, body, file) {
    const category = await CategoryRepo.findById(id);
    if (!category) throw new AppError('Category not found', 404);
    let image = category.image;
    if (file) {
      const buf = await sharp(file.buffer).resize(400, 400, { fit: 'cover' }).webp({ quality: 80 }).toBuffer();
      const result = await uploadImage(buf, 'picky/categories');
      image = result.url;
    }
    // Prevent updating the slug so frontend constants don't break
    delete body.slug;
    clearCategoryCache();
    return CategoryRepo.update(id, { ...body, image });
  },

  async updateCharacteristics(id, characteristics) {
    const category = await CategoryRepo.findById(id);
    if (!category) throw new AppError('Category not found', 404);
    clearCategoryCache();
    return CategoryRepo.update(id, { characteristics });
  },

  async softDelete(id) {
    const category = await CategoryRepo.findById(id);
    if (!category) throw new AppError('Category not found', 404);
    clearCategoryCache();
    return CategoryRepo.update(id, { isActive: false });
  },
};

module.exports = CategoryService;

