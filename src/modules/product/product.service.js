const AppError = require('../../utils/appError');
const ProductRepo = require('./product.repository');
const Inventory = require('../../models/inventory.model');
const { uploadImage } = require('../../services/s3.service');
const sharp = require('sharp');
const paginate = require('../../utils/paginate');

const Category = require('../../models/category.model');

const slugify = (name) =>
  name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

const ProductService = {
  async list(query) {
    const { skip, limit, buildPagination } = paginate(query);
    const filter = {};
    if (query.includeInactive !== 'true' && query.includeInactive !== true) {
      filter.isActive = true;
    }
    if (query.category) {
      if (query.category.match(/^[0-9a-fA-F]{24}$/)) {
        filter.category = query.category;
      } else {
        const cat = await Category.findOne({ slug: query.category }).select('_id').lean();
        if (cat) filter.category = cat._id;
        else filter.category = '000000000000000000000000'; // Force 0 results if slug not found
      }
    }

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
    let imagePositions = body.imagePositions || [];
    if (typeof imagePositions === 'string') imagePositions = [imagePositions];

    if (imagePositions.length > 0) {
      let fileIndex = 0;
      for (const pos of imagePositions) {
        if (pos === 'file') {
          if (files && files[fileIndex]) {
            const file = files[fileIndex];
            const buf = await sharp(file.buffer).resize(800, 800, { fit: 'inside' }).webp({ quality: 80 }).toBuffer();
            const { url } = await uploadImage(buf, 'picky/products');
            images.push(url);
            fileIndex++;
          }
        } else {
          images.push(pos);
        }
      }
    } else if (files && files.length > 0) {
      // Fallback
      for (const file of files) {
        const buf = await sharp(file.buffer).resize(800, 800, { fit: 'inside' }).webp({ quality: 80 }).toBuffer();
        const { url } = await uploadImage(buf, 'picky/products');
        images.push(url);
      }
    }

    const stock = body.stock !== undefined && !isNaN(Number(body.stock)) ? Math.max(0, Number(body.stock)) : 50;
    const { stock: _stock, ...productData } = body;

    const sku = (body.sku || '').trim().toUpperCase() || `PK-${Date.now().toString(36).toUpperCase()}`;

    const product = await ProductRepo.create({ ...productData, sku, slug, images, stock });

    // Automatically initialize inventory record
    await Inventory.create({
      product: product._id,
      sku: product.sku,
      quantity: stock,
    });

    return product;
  },

  async update(id, body, files) {
    const product = await ProductRepo.findById(id);
    if (!product) throw new AppError('Product not found', 404);

    let imagePositions = body.imagePositions || [];
    if (typeof imagePositions === 'string') imagePositions = [imagePositions];
    
    let images = [];
    if (imagePositions.length > 0) {
      let fileIndex = 0;
      for (const pos of imagePositions) {
        if (pos === 'file') {
          if (files && files[fileIndex]) {
            const file = files[fileIndex];
            const buf = await sharp(file.buffer).resize(800, 800, { fit: 'inside' }).webp({ quality: 80 }).toBuffer();
            const { url } = await uploadImage(buf, 'picky/products');
            images.push(url);
            fileIndex++;
          }
        } else {
          images.push(pos);
        }
      }
    } else {
      images = product.images || []; // Fallback
    }

    const { stock, imagePositions: _ip, ...productData } = body;
    const updateData = { ...productData, images };
    if (stock !== undefined && !isNaN(Number(stock))) {
      updateData.stock = Math.max(0, Number(stock));
    }
    if (body.name && body.name !== product.name) {
      updateData.slug = slugify(body.name);
    }

    if (stock !== undefined && !isNaN(Number(stock))) {
      await Inventory.findOneAndUpdate(
        { product: id },
        { $set: { quantity: Math.max(0, Number(stock)) } },
        { upsert: true, new: true }
      );
    }

    return ProductRepo.update(id, updateData);
  },

  async delete(id) {
    const product = await ProductRepo.findById(id);
    if (!product) throw new AppError('Product not found', 404);
    return ProductRepo.delete(id);
  },
};

module.exports = ProductService;
