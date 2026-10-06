const Settings = require('../../models/settings.model');

const SettingsService = {
  async getSettings() {
    let settings = await Settings.findOne().lean();
    if (!settings) {
      // Create initial default settings document if none exists
      settings = await Settings.create({});
    }
    return settings;
  },

  async updateSettings(data) {
    let settings = await Settings.findOne();
    if (!settings) {
      settings = new Settings(data);
      await settings.save();
    } else {
      Object.assign(settings, data);
      await settings.save();
    }
    return settings.toObject();
  },
};

module.exports = SettingsService;
