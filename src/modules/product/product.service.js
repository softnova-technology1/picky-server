const AppError = require('../../utils/appError');
const ProductRepo = require('./product.repository');
const Inventory = require('../../models/inventory.model');
const { uploadImage, deleteImage } = require('../../services/s3.service');
const sharp = require('sharp');
const paginate = require('../../utils/paginate');

const Category = require('../../models/category.model');

const slugify = (name) =>
  name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

const productCache = new Map();
const CACHE_TTL_MS = 60 * 1000; // 60 seconds TTL

const clearProductCache = () => {
  productCache.clear();
};

const ProductService = {
  clearCache: clearProductCache,

  async list(query) {
    const cacheKey = JSON.stringify(query || {});
    const cached = productCache.get(cacheKey);
    if (cached && Date.now() - cached.time < CACHE_TTL_MS) {
      return cached.data;
    }

    const { skip, limit, buildPagination } = paginate(query);
    const filter = {};
    if (query.includeInactive !== 'true' && query.includeInactive !== true) {
      filter.isActive = true;
    }
    if (query.search || query.q) {
      const q = (query.search || query.q).trim();
      filter.$or = [
        { name: { $regex: q, $options: 'i' } },
        { sku: { $regex: q, $options: 'i' } },
        { subCategory: { $regex: q, $options: 'i' } },
      ];
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
    if (query.subCategory) {
      filter.subCategory = { $regex: new RegExp(`^${query.subCategory}$`, 'i') };
    }
    if (query.tag) {
      filter.tags = { $regex: new RegExp(`^${query.tag}$`, 'i') };
    }
    
    // Price filtering
    if (query.minPrice !== undefined || query.maxPrice !== undefined) {
      filter.basePrice = {};
      if (query.minPrice !== undefined) filter.basePrice.$gte = Number(query.minPrice);
      if (query.maxPrice !== undefined) filter.basePrice.$lte = Number(query.maxPrice);
    }

    // Featured & Tag filtering
    if (query.isFeatured !== undefined) {
      filter.isFeatured = query.isFeatured === 'true' || query.isFeatured === true;
    }
    if (query.tag) {
      filter.tags = { $in: [new RegExp(`^${query.tag}$`, 'i'), query.tag] };
    }

    const [data, total] = await Promise.all([
      ProductRepo.find(filter, skip, limit, query.sort),
      ProductRepo.count(filter),
    ]);
    const result = { data, pagination: buildPagination(total) };
    productCache.set(cacheKey, { time: Date.now(), data: result });
    return result;
  },

  async getBySlug(slug) {
    const product = await ProductRepo.findBySlug(slug);
    if (!product) throw new AppError('Product not found', 404);
    return product;
  },

  async search(query) {
    const cacheKey = 'search_' + JSON.stringify(query || {});
    const cached = productCache.get(cacheKey);
    if (cached && Date.now() - cached.time < CACHE_TTL_MS) {
      return cached.data;
    }
    const { skip, limit, buildPagination } = paginate(query);
    const [data, total] = await Promise.all([
      ProductRepo.search(query.search, skip, limit),
      ProductRepo.countSearch(query.search),
    ]);
    const result = { data, pagination: buildPagination(total) };
    productCache.set(cacheKey, { time: Date.now(), data: result });
    return result;
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

    if (!images || images.length === 0) {
      throw new AppError('At least one product image is required. Please upload a product image.', 400);
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

    clearProductCache();
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

    if (!images || images.length === 0) {
      throw new AppError('A product must have at least one image.', 400);
    }

    const { stock, imagePositions: _ip, ...productData } = body;
    const updateData = { ...productData, images };

    // Offer Label & Tag synchronization
    if (body.offerLabel !== undefined) {
      const cleanLabel = String(body.offerLabel || '').trim();
      updateData.offerLabel = cleanLabel;
      if (cleanLabel) {
        // Replace existing tag with assigned offer label
        updateData.tags = [cleanLabel];
      } else {
        // If label is empty, remove/clear tag completely
        updateData.tags = [];
      }
    }

    if (body.isDiscountActive !== undefined) {
      updateData.isDiscountActive = Boolean(body.isDiscountActive === true || body.isDiscountActive === 'true');
    }

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

    // Clean up any images that were removed during this update from S3
    const removedImages = (product.images || []).filter((oldImg) => !images.includes(oldImg));
    if (removedImages.length > 0) {
      for (const remImg of removedImages) {
        deleteImage(remImg).catch(() => {});
      }
    }

    clearProductCache();
    return ProductRepo.update(id, updateData);
  },

  async delete(id) {
    const product = await ProductRepo.findById(id);
    if (!product) throw new AppError('Product not found', 404);

    // Delete all associated images from S3
    if (Array.isArray(product.images) && product.images.length > 0) {
      for (const imgUrl of product.images) {
        deleteImage(imgUrl).catch(() => {});
      }
    }

    await Inventory.deleteMany({ product: id });
    clearProductCache();
    return ProductRepo.delete(id);
  },

  async toggleStatus(id) {
    const product = await ProductRepo.findById(id);
    if (!product) throw new AppError('Product not found', 404);
    const updated = await ProductRepo.update(id, { isActive: !product.isActive });
    clearProductCache();
    return updated;
  },
};

module.exports = ProductService;
