const dns = require('dns');
dns.setServers(['8.8.8.8', '1.1.1.1']);
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const Blog = require('../src/models/blog.model');

const MONGODB_URI = process.env.MONGODB_URI;

const BLOG_DATA = {
  pageSlug: 'blog',
  isBlogPageEnabled: true,
  hero: {
    enabled: true,
    badgeText: 'THE PICKY JOURNAL',
    title: 'Discover Better. Shop Smarter.',
    subtitle: 'Helpful ideas, product guides, shopping tips, and stories to make everyday choices easier.',
    primaryButtonText: 'Explore Stories',
    secondaryButtonText: 'Shop Products',
    imageUrl: 'https://picky-e-com.s3.ap-southeast-1.amazonaws.com/picky/blog/blog_hero_slash.jpg',
  },
  metrics: {
    enabled: true,
    items: [
      { id: 'm-1', value: '50+ Shoppable Guides', label: 'Tested & Curated by Editors', iconName: 'Video' },
      { id: 'm-2', value: '100% Quality Verified', label: 'Hands-on Product Reviews', iconName: 'ShieldCheck' },
      { id: 'm-3', value: '1-Click Direct Bag', label: 'Instant Shelves Checkout', iconName: 'ShoppingBag' },
      { id: 'm-4', value: '4.9/5 Shopper Rating', label: 'Over 12,000+ Verified Buyers', iconName: 'Star' },
    ],
  },
};

async function seedBlogData() {
  console.log('Connecting to MongoDB Atlas...');
  await mongoose.connect(MONGODB_URI);
  console.log('Connected to MongoDB!');

  const updated = await Blog.findOneAndUpdate(
    { pageSlug: 'blog' },
    { $set: BLOG_DATA },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  console.log('✅ Successfully seeded Blog Page Hero & Trust Metrics in MongoDB:');
  console.log(JSON.stringify(updated, null, 2));

  await mongoose.disconnect();
  console.log('Disconnected from MongoDB.');
}

seedBlogData()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Seeding failed:', err);
    process.exit(1);
  });
