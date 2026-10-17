const CategoryService = require('./category.service');
const { ApiResponse } = require('../../utils/apiResponse');

const list = async (req, res, next) => {
  try {
    const includeInactive = req.query.all === 'true' || req.query.includeInactive === 'true';
    const categories = await CategoryService.list(includeInactive);
    return res.json(ApiResponse.success(categories));
  } catch (err) { next(err); }
};

const detail = async (req, res, next) => {
  try {
    const category = await CategoryService.getBySlug(req.params.slug);
    return res.json(ApiResponse.success(category));
  } catch (err) { next(err); }
};

// Admin
const create = async (req, res, next) => {
  try {
    const category = await CategoryService.create(req.body, req.file);
    return res.status(201).json(ApiResponse.success(category, 'Category created'));
  } catch (err) { next(err); }
};

const update = async (req, res, next) => {
  try {
    const category = await CategoryService.update(req.params.id, req.body, req.file);
    return res.json(ApiResponse.success(category, 'Category updated'));
  } catch (err) { next(err); }
};

const updateCharacteristics = async (req, res, next) => {
  try {
    const category = await CategoryService.updateCharacteristics(req.params.id, req.body.characteristics);
    return res.json(ApiResponse.success(category, 'Category characteristics updated'));
  } catch (err) { next(err); }
};

const remove = async (req, res, next) => {
  try {
    await CategoryService.softDelete(req.params.id);
    return res.json(ApiResponse.success(null, 'Category deactivated'));
  } catch (err) { next(err); }
};

module.exports = { list, detail, create, update, updateCharacteristics, remove };

