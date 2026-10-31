const mongoose = require('mongoose');

const metricItemSchema = new mongoose.Schema(
  {
    id: { type: String },
    value: { type: String, required: true },
    label: { type: String, required: true },
    iconName: { type: String, default: 'Sparkles' },
  },
  { _id: false }
);

const blogSchema = new mongoose.Schema(
  {
    pageSlug: { type: String, default: 'blog', unique: true },
    isBlogPageEnabled: { type: Boolean, default: true },
    hero: {
      enabled: { type: Boolean, default: true },
      badgeText: { type: String, default: 'THE PICKY JOURNAL' },
      title: { type: String, default: 'Discover Better. Shop Smarter.' },
      subtitle: {
        type: String,
        default: 'Helpful ideas, product guides, shopping tips, and stories to make everyday choices easier.',
      },
      primaryButtonText: { type: String, default: 'Explore Stories' },
      secondaryButtonText: { type: String, default: 'Shop Products' },
      imageUrl: {
        type: String,
        default: 'https://picky-e-com.s3.ap-southeast-1.amazonaws.com/picky/blog/blog_hero_slash.jpg',
      },
    },
    metrics: {
      enabled: { type: Boolean, default: true },
      items: [metricItemSchema],
    },
  },
  {
    timestamps: true,
    strict: false, // Allows additional future sections to be stored without schema locking
  }
);

module.exports = mongoose.model('Blog', blogSchema);
