const SubCategory = require('../../models/subcategory.model');
const { ApiResponse } = require('../../utils/apiResponse');
const { uploadImage, deleteImage } = require('../../services/s3.service');
const sharp = require('sharp');

const processSubcategoryImage = async (imageStr) => {
  if (!imageStr || typeof imageStr !== 'string' || !imageStr.startsWith('data:image')) {
    return imageStr;
  }
  try {
    const match = imageStr.match(/^data:image\/([a-zA-Z0-9+]+);base64,(.+)$/);
    if (!match) return imageStr;
    const buf = Buffer.from(match[2], 'base64');
    const resized = await sharp(buf)
      .resize(320, 320, { fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 80 })
      .toBuffer();
    const result = await uploadImage(resized, 'subcategories');
    return result.url;
  } catch (_) {
    return imageStr;
  }
};

let subcategoryCache = new Map();
const SUB_CACHE_TTL = 120 * 1000;

const clearSubCache = () => {
  subcategoryCache.clear();
};

const list = async (req, res, next) => {
  try {
    const cacheKey = JSON.stringify(req.query || {});
    const cached = subcategoryCache.get(cacheKey);
    if (cached && Date.now() - cached.time < SUB_CACHE_TTL) {
      return res.json(ApiResponse.success(cached.data));
    }

    const filter = {};
    if (req.query.categoryId) filter.categoryId = req.query.categoryId;
    const subcategories = await SubCategory.find(filter)
      .sort({ displayOrder: 1, createdAt: -1 })
      .populate('categoryId', 'name slug')
      .lean();

    subcategoryCache.set(cacheKey, { time: Date.now(), data: subcategories });
    return res.json(ApiResponse.success(subcategories));
  } catch (err) { next(err); }
};

const create = async (req, res, next) => {
  try {
    clearSubCache();
    const body = { ...req.body };
    if (body.image) body.image = await processSubcategoryImage(body.image);
    const subcategory = await SubCategory.create(body);
    const populated = await SubCategory.findById(subcategory._id).populate('categoryId', 'name slug').lean();
    return res.status(201).json(ApiResponse.success(populated, 'Subcategory created'));
  } catch (err) { next(err); }
};

const update = async (req, res, next) => {
  try {
    clearSubCache();
    const existing = await SubCategory.findById(req.params.id);
    if (!existing) return res.status(404).json(ApiResponse.error('Not found', 404));

    const body = { ...req.body };
    if (body.image) {
      body.image = await processSubcategoryImage(body.image);
      if (existing.image && existing.image !== body.image) {
        deleteImage(existing.image).catch(() => {});
      }
    }

    const subcategory = await SubCategory.findByIdAndUpdate(req.params.id, body, { new: true })
      .populate('categoryId', 'name slug')
      .lean();
    return res.json(ApiResponse.success(subcategory, 'Subcategory updated'));
  } catch (err) { next(err); }
};

const remove = async (req, res, next) => {
  try {
    clearSubCache();
    const subcategory = await SubCategory.findByIdAndDelete(req.params.id);
    if (!subcategory) return res.status(404).json(ApiResponse.error('Not found', 404));

    if (subcategory.image) {
      deleteImage(subcategory.image).catch(() => {});
    }

    return res.json(ApiResponse.success(null, 'Subcategory deleted'));
  } catch (err) { next(err); }
};

module.exports = { list, create, update, remove };
