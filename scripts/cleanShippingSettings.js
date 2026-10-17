require('dotenv').config();
const mongoose = require('mongoose');
const Settings = require('../src/models/settings.model');

(async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB Atlas');

    const unsetObj = {
      'shipping.indiaStates': 1,
      'shipping.tamilNadu.pincodes': 1,
    };

    await Settings.updateMany({}, { $unset: unsetObj });

    // Also explicitly set clean shipping schema
    const settings = await Settings.findOne();
    if (settings) {
      const tnFee = settings.shipping?.tamilNadu?.shippingFee || 40;
      const tnDays = settings.shipping?.tamilNadu?.estimatedDays || '2-3 Business Days';
      const aiFee = settings.shipping?.allIndia?.shippingFee || 70;
      const aiDays = settings.shipping?.allIndia?.estimatedDays || '4-6 Business Days';

      settings.shipping = {
        freeShippingThreshold: settings.shipping?.freeShippingThreshold || 999,
        codAvailable: Boolean(settings.shipping?.codAvailable),
        tamilNadu: {
          shippingFee: tnFee,
          estimatedDays: tnDays,
        },
        allIndia: {
          shippingFee: aiFee,
          estimatedDays: aiDays,
        },
        standardShippingFee: aiFee,
        estimatedDeliveryDays: aiDays,
      };

      settings.markModified('shipping');
      await settings.save();
    }

    const cleaned = await Settings.findOne().lean();
    console.log('Cleaned Settings in MongoDB Atlas:');
    console.log(JSON.stringify(cleaned.shipping, null, 2));

    await mongoose.disconnect();
    console.log('Disconnected cleanly');
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
})();
