const ProductService = require('./product.service');
const { ApiResponse } = require('../../utils/apiResponse');

const list = async (req, res, next) => {
  try {
    const result = await ProductService.list(req.query);
    return res.json(ApiResponse.paginated(result.data, result.pagination));
  } catch (err) { next(err); }
};

const detail = async (req, res, next) => {
  try {
    const product = await ProductService.getBySlug(req.params.slug);
    return res.json(ApiResponse.success(product));
  } catch (err) { next(err); }
};

const search = async (req, res, next) => {
  try {
    const result = await ProductService.search(req.query);
    return res.json(ApiResponse.paginated(result.data, result.pagination));
  } catch (err) { next(err); }
};

// Admin
const create = async (req, res, next) => {
  try {
    const product = await ProductService.create(req.body, req.files);
    return res.status(201).json(ApiResponse.success(product, 'Product created'));
  } catch (err) { next(err); }
};

const update = async (req, res, next) => {
  try {
    const product = await ProductService.update(req.params.id, req.body, req.files);
    return res.json(ApiResponse.success(product, 'Product updated'));
  } catch (err) { next(err); }
};

const remove = async (req, res, next) => {
  try {
    await ProductService.delete(req.params.id);
    return res.json(ApiResponse.success(null, 'Product deleted'));
  } catch (err) { next(err); }
};

const toggleStatus = async (req, res, next) => {
  try {
    const product = await ProductService.toggleStatus(req.params.id);
    return res.json(ApiResponse.success(product, `Product ${product.isActive ? 'activated' : 'deactivated'}`));
  } catch (err) { next(err); }
};

module.exports = { list, detail, search, create, update, remove, toggleStatus };
