const SettingsService = require('./settings.service');
const { sendSuccess } = require('../../utils/apiResponse');

const SettingsController = {
  async get(req, res, next) {
    try {
      const settings = await SettingsService.getSettings();
      return sendSuccess(res, settings);
    } catch (err) {
      next(err);
    }
  },

  async update(req, res, next) {
    try {
      const updated = await SettingsService.updateSettings(req.body);
      return sendSuccess(res, updated, 200, null, 'Settings updated successfully');
    } catch (err) {
      next(err);
    }
  },
};

module.exports = SettingsController;
