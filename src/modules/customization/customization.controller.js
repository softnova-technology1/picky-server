const Customization = require('../../models/customization.model');
const { ApiResponse } = require('../../utils/apiResponse');

const getAllCustomizations = async (req, res, next) => {
  try {
    const customizations = await Customization.find();
    
    // Transform array into a record keyed by pageId
    const pageSections = {};
    customizations.forEach((c) => {
      pageSections[c.pageId] = c.sections;
    });

    return res.json(ApiResponse.success(pageSections));
  } catch (err) {
    next(err);
  }
};

const updateCustomization = async (req, res, next) => {
  try {
    const { pageId, sections } = req.body;
    
    if (!pageId || !sections) {
      return res.status(400).json(ApiResponse.error('pageId and sections are required', 400));
    }

    const customization = await Customization.findOneAndUpdate(
      { pageId },
      { $set: { sections } },
      { new: true, upsert: true }
    );

    return res.json(ApiResponse.success(customization, 'Customization updated successfully'));
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getAllCustomizations,
  updateCustomization,
};
