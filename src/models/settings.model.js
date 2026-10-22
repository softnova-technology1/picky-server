const mongoose = require('mongoose');

const settingsSchema = new mongoose.Schema(
  {
    storeName: { type: String, default: 'Picky' },
    storeTagline: { type: String, default: 'Curated Fashion & Lifestyle Essentials' },
    contactEmail: { type: String, default: 'support@picky.com' },
    contactPhone: { type: String, default: '+91 98765 43210' },
    whatsappNumber: { type: String, default: '+91 98765 43210' },
    address: {
      type: mongoose.Schema.Types.Mixed,
      default: () => ({
        street: 'Main Road, Peravurani',
        city: 'Thanjavur District',
        state: 'Tamil Nadu',
        pincode: '614804',
        country: 'India',
        fullAddress: 'Main Road, Peravurani, Thanjavur District, Tamil Nadu, 614804',
      }),
    },
    announcementBar: {
      enabled: { type: Boolean, default: true },
      text: { type: String, default: '✨ Free Delivery on all orders above ₹999 | Use code PICKY10 for 10% OFF' },
      link: { type: String, default: '/products' },
      bgColor: { type: String, default: '#7c3aed' },
      textColor: { type: String, default: '#ffffff' },
    },
    heroBanners: [
      {
        id: String,
        eyebrow: String,
        title: String,
        subtitle: String,
        leftImage: String,
        rightImage: String,
        ctaText: String,
        ctaLink: String,
      },
    ],
    socialLinks: {
      instagram: { type: String, default: 'https://instagram.com/picky' },
      facebook: { type: String, default: 'https://facebook.com/picky' },
      youtube: { type: String, default: '' },
      twitter: { type: String, default: '' },
    },
    shipping: {
      freeShippingThreshold: { type: Number, default: 999 },
      codAvailable: { type: Boolean, default: false },
      // All Over Tamil Nadu
      tamilNadu: {
        shippingFee: { type: Number, default: 40 },
        estimatedDays: { type: String, default: '2-3 Business Days' },
      },
      // All Over India (Other States)
      allIndia: {
        shippingFee: { type: Number, default: 70 },
        estimatedDays: { type: String, default: '4-6 Business Days' },
      },
      standardShippingFee: { type: Number, default: 70 },
      estimatedDeliveryDays: { type: String, default: '4-6 Business Days' },
      // Gift Wrapping Service
      giftWrap: {
        enabled: { type: Boolean, default: true },
        fee: { type: Number, default: 30 },
      },
    },
    branding: {
      logoUrl: { type: String, default: '/images/logo.png' },
      primaryColor: { type: String, default: '#7c3aed' },
      accentColor: { type: String, default: '#ec4899' },
    },
    theme: {
      type: mongoose.Schema.Types.Mixed,
      default: () => ({
        preset: 'purple',
        primaryColor: '#7c3aed',
        name: 'Royal Purple',
      }),
    },
  },
  { timestamps: true, strict: false }
);

module.exports = mongoose.model('Settings', settingsSchema);
