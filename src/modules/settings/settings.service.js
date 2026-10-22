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

    if (settings.sessionTimeoutMinutes === undefined) {
      settings.sessionTimeoutMinutes = 60;
      modified = true;
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

    const result = settings.toObject();
    if (!result.supportEmail && result.contactEmail) {
      result.supportEmail = result.contactEmail;
    }
    if (!result.supportPhone && result.contactPhone) {
      result.supportPhone = result.contactPhone;
    }
    if (!result.theme) {
      result.theme = {
        preset: 'purple',
        primaryColor: '#7c3aed',
        name: 'Royal Purple',
      };
    }
    return result;
  },

  async updateSettings(data) {
    let settings = await Settings.findOne();
    if (!settings) {
      settings = new Settings();
    }

    // Clean immutable Mongo keys
    delete data._id;
    delete data.__v;
    delete data.createdAt;
    delete data.updatedAt;

    // Handle address (supports string or object)
    if (data.address !== undefined) {
      if (typeof data.address === 'string') {
        const parts = data.address.split(',').map((s) => s.trim()).filter(Boolean);
        settings.address = {
          street: parts[0] || data.address,
          city: parts[1] || 'Peravurani',
          state: parts[2] || 'Tamil Nadu',
          pincode: parts[3] || '614804',
          country: 'India',
          fullAddress: data.address,
        };
      } else if (data.address && typeof data.address === 'object') {
        const full = data.address.fullAddress || [data.address.street, data.address.city, data.address.state, data.address.pincode].filter(Boolean).join(', ');
        settings.address = {
          ...data.address,
          fullAddress: full,
        };
      } else {
        settings.address = data.address;
      }
      settings.markModified('address');
      delete data.address;
    }

    // Handle support and contact sync
    if (data.supportEmail || data.contactEmail) {
      const email = data.supportEmail || data.contactEmail;
      settings.contactEmail = email;
      settings.supportEmail = email;
    }
    if (data.supportPhone || data.contactPhone) {
      const phone = data.supportPhone || data.contactPhone;
      settings.contactPhone = phone;
      settings.supportPhone = phone;
      if (!data.whatsappNumber) {
        settings.whatsappNumber = phone;
      }
    }

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

    settings.markModified('shipping');
    if (data && data.adminSidebarPages) {
      settings.adminSidebarPages = data.adminSidebarPages;
      settings.markModified('adminSidebarPages');
    }
    if (data && data.theme) {
      settings.theme = data.theme;
      settings.markModified('theme');
      if (settings.branding) {
        settings.branding.primaryColor = data.theme.primaryColor || settings.branding.primaryColor;
        settings.markModified('branding');
      }
    }
    if (data && data.sessionTimeoutMinutes !== undefined) {
      settings.sessionTimeoutMinutes = Math.max(0, parseInt(data.sessionTimeoutMinutes, 10) || 0);
      settings.markModified('sessionTimeoutMinutes');
    }
    await settings.save();
    await Settings.updateOne(
      { _id: settings._id },
      { $unset: { 'shipping.indiaStates': 1, 'shipping.tamilNadu.pincodes': 1 } }
    );
    const finalResult = settings.toObject();
    if (!finalResult.supportEmail && finalResult.contactEmail) {
      finalResult.supportEmail = finalResult.contactEmail;
    }
    if (!finalResult.supportPhone && finalResult.contactPhone) {
      finalResult.supportPhone = finalResult.contactPhone;
    }
    return finalResult;
  },
};

module.exports = SettingsService;
