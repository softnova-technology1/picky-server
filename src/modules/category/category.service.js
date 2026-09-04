// TODO (Dev 3): Implement category business logic
const AppError = require('../../utils/appError');
const CategoryRepo = require('./category.repository');
const { uploadImage } = require('../../services/s3.service');
const sharp = require('sharp');

const slugify = (name) =>
  name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

const CategoryService = {
  async list() {
    return CategoryRepo.findAll();
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
    if (body.name) body.slug = slugify(body.name);
    return CategoryRepo.update(id, { ...body, image });
  },

  async softDelete(id) {
    const category = await CategoryRepo.findById(id);
    if (!category) throw new AppError('Category not found', 404);
    return CategoryRepo.update(id, { isActive: false });
  },
};

module.exports = CategoryService;
