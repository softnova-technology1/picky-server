// TODO (Dev 3): Implement product business logic
const AppError = require('../../utils/appError');
const ProductRepo = require('./product.repository');
const { uploadImage } = require('../../services/s3.service');
const sharp = require('sharp');
const paginate = require('../../utils/paginate');

const slugify = (name) =>
  name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

const ProductService = {
  async list(query) {
    const { skip, limit, buildPagination } = paginate(query);
    const filter = { isActive: true };
    if (query.category) filter.category = query.category;

    const [data, total] = await Promise.all([
      ProductRepo.find(filter, skip, limit, query.sort),
      ProductRepo.count(filter),
    ]);
    return { data, pagination: buildPagination(total) };
  },

  async getBySlug(slug) {
    const product = await ProductRepo.findBySlug(slug);
    if (!product) throw new AppError('Product not found', 404);
    return product;
  },

  async search(query) {
    const { skip, limit, buildPagination } = paginate(query);
    const [data, total] = await Promise.all([
      ProductRepo.search(query.search, skip, limit),
      ProductRepo.countSearch(query.search),
    ]);
    return { data, pagination: buildPagination(total) };
  },

  async create(body, files) {
    const slug = slugify(body.name);
    const existing = await ProductRepo.findBySlug(slug);
    if (existing) throw new AppError('Product with this name already exists', 400);

    let images = [];
    if (files && files.length > 0) {
      for (const file of files) {
        const buf = await sharp(file.buffer).resize(800, 800, { fit: 'inside' }).webp({ quality: 80 }).toBuffer();
        const { url } = await uploadImage(buf, 'picky/products');
        images.push(url);
      }
    }

    return ProductRepo.create({ ...body, slug, images });
  },

  async update(id, body, files) {
    const product = await ProductRepo.findById(id);
    if (!product) throw new AppError('Product not found', 404);

    let images = body.images || product.images || [];
    if (typeof images === 'string') images = [images];

    if (files && files.length > 0) {
      const newImages = [];
      for (const file of files) {
        const buf = await sharp(file.buffer).resize(800, 800, { fit: 'inside' }).webp({ quality: 80 }).toBuffer();
        const { url } = await uploadImage(buf, 'picky/products');
        newImages.push(url);
      }
      images = [...images, ...newImages];
    }

    const updateData = { ...body, images };
    if (body.name && body.name !== product.name) {
      updateData.slug = slugify(body.name);
    }

    return ProductRepo.update(id, updateData);
  },

  async softDelete(id) {
    const product = await ProductRepo.findById(id);
    if (!product) throw new AppError('Product not found', 404);
    return ProductRepo.update(id, { isActive: false });
  },
};

module.exports = ProductService;
