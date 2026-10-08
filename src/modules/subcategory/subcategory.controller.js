const SubCategory = require('../../models/subcategory.model');
const { ApiResponse } = require('../../utils/apiResponse');

const list = async (req, res, next) => {
  try {
    const filter = {};
    if (req.query.categoryId) filter.categoryId = req.query.categoryId;
    const subcategories = await SubCategory.find(filter).sort({ displayOrder: 1, createdAt: -1 }).populate('categoryId', 'name slug');
    return res.json(ApiResponse.success(subcategories));
  } catch (err) { next(err); }
};

const create = async (req, res, next) => {
  try {
    const subcategory = await SubCategory.create(req.body);
    const populated = await SubCategory.findById(subcategory._id).populate('categoryId', 'name slug');
    return res.status(201).json(ApiResponse.success(populated, 'Subcategory created'));
  } catch (err) { next(err); }
};

const update = async (req, res, next) => {
  try {
    const subcategory = await SubCategory.findByIdAndUpdate(req.params.id, req.body, { new: true }).populate('categoryId', 'name slug');
    if (!subcategory) return res.status(404).json(ApiResponse.error('Not found', 404));
    return res.json(ApiResponse.success(subcategory, 'Subcategory updated'));
  } catch (err) { next(err); }
};

const remove = async (req, res, next) => {
  try {
    const subcategory = await SubCategory.findByIdAndDelete(req.params.id);
    if (!subcategory) return res.status(404).json(ApiResponse.error('Not found', 404));
    return res.json(ApiResponse.success(null, 'Subcategory deleted'));
  } catch (err) { next(err); }
};

module.exports = { list, create, update, remove };
