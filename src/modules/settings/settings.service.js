const Settings = require('../../models/settings.model');

const SettingsService = {
  async getSettings() {
    let settings = await Settings.findOne();
    if (!settings) {
      settings = await Settings.create({
        shipping: {
          freeShippingThreshold: 999,
          codAvailable: false,
          tamilNadu: {
            shippingFee: 40,
            estimatedDays: '2-3 Business Days',
          },
          allIndia: {
            shippingFee: 70,
            estimatedDays: '4-6 Business Days',
          },
          standardShippingFee: 70,
          estimatedDeliveryDays: '4-6 Business Days',
        },
      });
      return settings.toObject();
    }

    // Ensure shipping configuration exists in DB with clean Tamil Nadu and All India rates
    let modified = false;
    if (!settings.shipping) {
      settings.shipping = {
        freeShippingThreshold: 999,
        codAvailable: false,
        tamilNadu: {
          shippingFee: 40,
          estimatedDays: '2-3 Business Days',
        },
        allIndia: {
          shippingFee: 70,
          estimatedDays: '4-6 Business Days',
        },
        standardShippingFee: 70,
        estimatedDeliveryDays: '4-6 Business Days',
      };
      modified = true;
    } else {
      if (!settings.shipping.tamilNadu) {
        settings.shipping.tamilNadu = {
          shippingFee: 40,
          estimatedDays: '2-3 Business Days',
        };
        modified = true;
      }
      if (!settings.shipping.allIndia) {
        settings.shipping.allIndia = {
          shippingFee: Number(settings.shipping.standardShippingFee) || 70,
          estimatedDays: settings.shipping.estimatedDeliveryDays || '4-6 Business Days',
        };
        modified = true;
      }
      if (!settings.shipping.giftWrap) {
        settings.shipping.giftWrap = {
          enabled: true,
          fee: 30,
        };
        modified = true;
      }
    }

    // Clean up legacy pincodes and state lists from DB if present
    if (settings.shipping) {
      if (settings.shipping.tamilNadu && settings.shipping.tamilNadu.pincodes) {
        delete settings.shipping.tamilNadu.pincodes;
        modified = true;
      }
      if (settings.shipping.indiaStates) {
        delete settings.shipping.indiaStates;
        modified = true;
      }
    }

    if (modified) {
      settings.markModified('shipping');
      await settings.save();
      // Ensure MongoDB collection unsets legacy fields
      await Settings.updateOne(
        { _id: settings._id },
        { $unset: { 'shipping.indiaStates': 1, 'shipping.tamilNadu.pincodes': 1 } }
      );
    }

    return settings.toObject();
  },

  async updateSettings(data) {
    let settings = await Settings.findOne();
    if (!settings) {
      settings = new Settings(data);
    } else {
      // Handle shipping updates cleanly without legacy pincode lists
      if (data.shipping) {
        const currentShipping = settings.shipping ? (settings.shipping.toObject ? settings.shipping.toObject() : settings.shipping) : {};
        const tnFee = Number(data.shipping.tamilNadu?.shippingFee !== undefined ? data.shipping.tamilNadu.shippingFee : currentShipping.tamilNadu?.shippingFee);
        const tnDays = data.shipping.tamilNadu?.estimatedDays || currentShipping.tamilNadu?.estimatedDays || '2-3 Business Days';
        const aiFee = Number(data.shipping.allIndia?.shippingFee !== undefined ? data.shipping.allIndia.shippingFee : (currentShipping.allIndia?.shippingFee || data.shipping.standardShippingFee || currentShipping.standardShippingFee));
        const aiDays = data.shipping.allIndia?.estimatedDays || currentShipping.allIndia?.estimatedDays || data.shipping.estimatedDeliveryDays || currentShipping.estimatedDeliveryDays || '4-6 Business Days';

        const giftWrapData = data.shipping.giftWrap || currentShipping.giftWrap || {};
        const giftWrapEnabled = giftWrapData.enabled !== undefined ? Boolean(giftWrapData.enabled) : true;
        const giftWrapFee = Number(giftWrapData.fee !== undefined ? giftWrapData.fee : 30);

        settings.shipping = {
          freeShippingThreshold: Number(data.shipping.freeShippingThreshold !== undefined ? data.shipping.freeShippingThreshold : currentShipping.freeShippingThreshold) || 999,
          codAvailable: data.shipping.codAvailable !== undefined ? Boolean(data.shipping.codAvailable) : Boolean(currentShipping.codAvailable),
          tamilNadu: {
            shippingFee: !isNaN(tnFee) ? tnFee : 40,
            estimatedDays: tnDays,
          },
          allIndia: {
            shippingFee: !isNaN(aiFee) ? aiFee : 70,
            estimatedDays: aiDays,
          },
          standardShippingFee: !isNaN(aiFee) ? aiFee : 70,
          estimatedDeliveryDays: aiDays,
          giftWrap: {
            enabled: giftWrapEnabled,
            fee: !isNaN(giftWrapFee) ? giftWrapFee : 30,
          },
        };
        delete data.shipping;
      }

      Object.assign(settings, data);
    }

    settings.markModified('shipping');
    await settings.save();
    await Settings.updateOne(
      { _id: settings._id },
      { $unset: { 'shipping.indiaStates': 1, 'shipping.tamilNadu.pincodes': 1 } }
    );
    return settings.toObject();
  },
};

module.exports = SettingsService;
