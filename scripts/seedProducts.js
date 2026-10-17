const dns = require('dns');
dns.setServers(['8.8.8.8', '1.1.1.1']);
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const mongoose = require('mongoose');
const Product = require('../src/models/product.model');
const Category = require('../src/models/category.model');
const Inventory = require('../src/models/inventory.model');

const RAW_PRODUCTS = [
  // ── 1. Women's Fashion
  {
    name: 'Pure Cotton Handloom Madurai Sungudi Saree',
    slug: 'pure-cotton-handloom-madurai-sungudi-saree',
    categorySlug: 'womens-fashion',
    subCategory: 'Sarees',
    sku: 'WF-SAR-001',
    price: 1899,
    discountPrice: 1299,
    stock: 42,
    isFeatured: true,
    tags: ['cotton', 'handloom', 'traditional', 'madurai', 'saree', 'bestseller'],
    description: 'Authentic 100% combed cotton Sungudi saree featuring traditional zari border, tie-dye dot body pattern, and complimentary unstitched blouse piece.',
    images: ['https://images.unsplash.com/photo-1610030469983-98e550d6193c?w=800&auto=format&fit=crop&q=80'],
    characteristics: [
      { key: 'Fabric Material', value: 'Pure Cotton' },
      { key: 'Occasion', value: 'Festive' },
      { key: 'Pattern / Design', value: 'Traditional Zari' },
      { key: 'Fit Type', value: 'Regular' },
    ],
  },
  {
    name: 'Embroidered Rayon Anarkali Kurti & Pant Set',
    slug: 'embroidered-rayon-anarkali-kurti-pant-set',
    categorySlug: 'womens-fashion',
    subCategory: 'Kurtis',
    sku: 'WF-KUR-002',
    price: 2499,
    discountPrice: 1499,
    stock: 25,
    isFeatured: true,
    tags: ['anarkali', 'rayon', 'festive', 'kurti', 'trending'],
    description: 'Heavy gold zari neck embroidery on breathable premium 14kg rayon fabric. Includes matching straight pants and lightweight dupatta.',
    images: ['https://images.unsplash.com/photo-1583391733956-3750e0ff4e8b?w=800&auto=format&fit=crop&q=80'],
    characteristics: [
      { key: 'Fabric Material', value: 'Rayon' },
      { key: 'Occasion', value: 'Party' },
      { key: 'Pattern / Design', value: 'Embroidered' },
      { key: 'Fit Type', value: 'Anarkali Flare' },
    ],
  },
  {
    name: 'Women Pure Cotton Straight Fit Cigarette Pant',
    slug: 'women-pure-cotton-straight-fit-cigarette-pant',
    categorySlug: 'womens-fashion',
    subCategory: 'Pants',
    sku: 'WF-PNT-003',
    price: 899,
    discountPrice: 499,
    stock: 50,
    isFeatured: false,
    tags: ['cotton', 'pants', 'bottomwear', 'daily-wear'],
    description: 'Ultra-comfortable 100% stretchable combed cotton cigarette pants with deep dual side pockets and elastic waistband.',
    images: ['https://images.unsplash.com/photo-1594633312681-425c7b97ccd1?w=800&auto=format&fit=crop&q=80'],
    characteristics: [
      { key: 'Fabric Material', value: 'Pure Cotton' },
      { key: 'Occasion', value: 'Daily Wear' },
      { key: 'Fit Type', value: 'Slim Fit' },
    ],
  },
  {
    name: 'Floral Print Georgette Tiered Maxi Dress',
    slug: 'floral-print-georgette-tiered-maxi-dress',
    categorySlug: 'womens-fashion',
    subCategory: 'Dresses',
    sku: 'WF-DRS-004',
    price: 1999,
    discountPrice: 1199,
    stock: 18,
    isFeatured: true,
    tags: ['georgette', 'dress', 'maxi', 'floral', 'summer'],
    description: 'Breezy layered tiered maxi dress in soft georgette with inner crepe lining and bell sleeves.',
    images: ['https://images.unsplash.com/photo-1595777457583-95e059d581b8?w=800&auto=format&fit=crop&q=80'],
    characteristics: [
      { key: 'Fabric Material', value: 'Georgette' },
      { key: 'Occasion', value: 'Party' },
      { key: 'Pattern / Design', value: 'Floral Print' },
      { key: 'Fit Type', value: 'Regular' },
    ],
  },

  // ── 2. Home & Kitchen
  {
    name: 'Quick Pull Manual Food & Vegetable Chopper (650ml)',
    slug: 'quick-pull-manual-food-vegetable-chopper-650ml',
    categorySlug: 'home-kitchen',
    subCategory: 'Choppers',
    sku: 'HK-CHP-001',
    price: 699,
    discountPrice: 349,
    stock: 60,
    isFeatured: true,
    tags: ['kitchen', 'chopper', 'quick-pull', 'bestseller'],
    description: 'Durable 3-blade surgical stainless steel vegetable chopper with unbreakable BPA-free container and heavy-duty pull cord.',
    images: ['https://images.unsplash.com/photo-1590794056226-79ef3a8147e1?w=800&auto=format&fit=crop&q=80'],
    characteristics: [
      { key: 'Material', value: 'Stainless Steel 304' },
      { key: 'Capacity', value: '650 ml' },
      { key: 'Dishwasher Safe', value: 'Hand Wash Only' },
    ],
  },
  {
    name: 'Airtight Stackable Modular Kitchen Storage Container Set (6 Pcs)',
    slug: 'airtight-stackable-modular-kitchen-storage-container-set',
    categorySlug: 'home-kitchen',
    subCategory: 'Storage boxes',
    sku: 'HK-STO-002',
    price: 1499,
    discountPrice: 899,
    stock: 35,
    isFeatured: true,
    tags: ['containers', 'storage', 'airtight', 'kitchen-organizer'],
    description: 'Set of 6 transparent modular kitchen organizer containers with silicone airtight flip-lock lids (1000ml x 6).',
    images: ['https://images.unsplash.com/photo-1584992236310-6edddc08acff?w=800&auto=format&fit=crop&q=80'],
    characteristics: [
      { key: 'Material', value: 'BPA-Free Plastic' },
      { key: 'Capacity', value: '1000 ml x 6' },
      { key: 'Dishwasher Safe', value: 'Yes' },
    ],
  },
  {
    name: 'Pre-Seasoned Heavy Duty Cast Iron Dosa Tawa (28cm)',
    slug: 'pre-seasoned-heavy-duty-cast-iron-dosa-tawa-28cm',
    categorySlug: 'home-kitchen',
    subCategory: 'Cookware',
    sku: 'HK-CKW-003',
    price: 1899,
    discountPrice: 1249,
    stock: 20,
    isFeatured: false,
    tags: ['cast-iron', 'dosa-tawa', 'cookware', 'healthy'],
    description: '100% natural pure cast iron tawa pre-seasoned with gingelly oil. Delivers crispy restaurant style dosas with uniform heat distribution.',
    images: ['https://images.unsplash.com/photo-1556911220-e15b29be8c8f?w=800&auto=format&fit=crop&q=80'],
    characteristics: [
      { key: 'Material', value: 'Pure Cast Iron' },
      { key: 'Capacity', value: '28 cm Diameter' },
      { key: 'Dishwasher Safe', value: 'Hand Wash Only' },
    ],
  },

  // ── 3. Artificial Jewellery
  {
    name: 'Temple Jewellery Kemp Stone Choker Necklace Set',
    slug: 'temple-jewellery-kemp-stone-choker-necklace-set',
    categorySlug: 'artificial-jewellery',
    subCategory: 'Necklaces',
    sku: 'AJ-NEC-001',
    price: 1999,
    discountPrice: 1199,
    stock: 30,
    isFeatured: true,
    tags: ['jewellery', 'kemp', 'temple', 'necklace', 'bridal'],
    description: 'Handcrafted antique matte micro-gold plated temple choker with rich ruby-green kemp stones and matching jhumka earrings.',
    images: ['https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?w=800&auto=format&fit=crop&q=80'],
    characteristics: [
      { key: 'Base Material', value: 'Brass' },
      { key: 'Plating', value: 'Antique Matte Gold' },
      { key: 'Stone Type', value: 'Kemp Stones' },
    ],
  },
  {
    name: 'Silver Oxidized Peacock Jhumka Earrings',
    slug: 'silver-oxidized-peacock-jhumka-earrings',
    categorySlug: 'artificial-jewellery',
    subCategory: 'Earrings',
    sku: 'AJ-JHM-002',
    price: 599,
    discountPrice: 299,
    stock: 45,
    isFeatured: false,
    tags: ['earrings', 'oxidized', 'peacock', 'jhumka'],
    description: 'Intricate German silver oxidized tribal peacock jhumkas with hanging pearl ghungroos.',
    images: ['https://images.unsplash.com/photo-1630019852942-f89202989a59?w=800&auto=format&fit=crop&q=80'],
    characteristics: [
      { key: 'Base Material', value: 'German Silver' },
      { key: 'Plating', value: 'Silver Oxidized' },
      { key: 'Stone Type', value: 'Pearls' },
    ],
  },

  // ── 4. Beauty & Personal Care
  {
    name: 'Herbal Amla Bhringraj Hair Growth Oil (200ml)',
    slug: 'herbal-amla-bhringraj-hair-growth-oil-200ml',
    categorySlug: 'beauty-personal-care',
    subCategory: 'Haircare',
    sku: 'BP-OIL-001',
    price: 599,
    discountPrice: 399,
    stock: 40,
    isFeatured: true,
    tags: ['hair-oil', 'ayurvedic', 'organic', 'haircare'],
    description: 'Authentic cold-pressed herbal hair oil formulated with 18 vital herbs including Amla, Bhringraj, Brahmi, and Hibiscus.',
    images: ['https://images.unsplash.com/photo-1596462502278-27bfdc403348?w=800&auto=format&fit=crop&q=80'],
    characteristics: [
      { key: 'Product Type', value: 'Ayurvedic Herbal' },
      { key: 'Skin Type', value: 'All Skin Types' },
      { key: 'Volume / Weight', value: '200 ml' },
    ],
  },
  {
    name: 'Kumkumadi Radiance Face Glow Oil (30ml)',
    slug: 'kumkumadi-radiance-face-glow-oil-30ml',
    categorySlug: 'beauty-personal-care',
    subCategory: 'Skincare',
    sku: 'BP-OIL-002',
    price: 999,
    discountPrice: 649,
    stock: 25,
    isFeatured: false,
    tags: ['kumkumadi', 'skincare', 'glow-oil', 'saffron'],
    description: 'Pure Kashmiri saffron infused 100% natural facial oil for brightening skin tone and diminishing dark spots.',
    images: ['https://images.unsplash.com/photo-1608248597359-009848520c15?w=800&auto=format&fit=crop&q=80'],
    characteristics: [
      { key: 'Product Type', value: 'Organic Natural' },
      { key: 'Skin Type', value: 'All Skin Types' },
      { key: 'Volume / Weight', value: '30 ml' },
    ],
  },

  // ── 5. Mobile Accessories
  {
    name: 'TWS Wireless Gaming Earbuds with Ultra Low Latency',
    slug: 'tws-wireless-gaming-earbuds-ultra-low-latency',
    categorySlug: 'mobile-accessories',
    subCategory: 'Audio',
    sku: 'MA-AUD-001',
    price: 2499,
    discountPrice: 1299,
    stock: 35,
    isFeatured: true,
    tags: ['earbuds', 'gaming', 'bluetooth', 'tws', 'audio'],
    description: 'Bluetooth 5.3 true wireless earbuds with 40ms ultra low latency mode, environmental noise cancellation (ENC), and 36h total battery life.',
    images: ['https://images.unsplash.com/photo-1590658268037-6bf12165a8df?w=800&auto=format&fit=crop&q=80'],
    characteristics: [
      { key: 'Connectivity', value: 'Bluetooth 5.3' },
      { key: 'Warranty', value: '1 Year Manufacturer' },
      { key: 'Color', value: 'Matte Black' },
    ],
  },
  {
    name: '65W GaN Fast Charger Adapter with Dual Type-C & USB Ports',
    slug: '65w-gan-fast-charger-adapter-dual-type-c-usb-ports',
    categorySlug: 'mobile-accessories',
    subCategory: 'Chargers',
    sku: 'MA-CHG-002',
    price: 1899,
    discountPrice: 999,
    stock: 30,
    isFeatured: false,
    tags: ['charger', 'gan', 'fast-charging', 'type-c'],
    description: 'Compact 65W Gallium Nitride (GaN) fast charger capable of charging laptops, tablets, and smartphones simultaneously.',
    images: ['https://images.unsplash.com/photo-1583394838336-acd977736f90?w=800&auto=format&fit=crop&q=80'],
    characteristics: [
      { key: 'Connectivity', value: 'Type-C Fast Charge' },
      { key: 'Warranty', value: '6 Months Replacement' },
      { key: 'Color', value: 'Arctic White' },
    ],
  },

  // ── 6. Traditional Snacks & Sweets
  {
    name: 'Special Pure Ghee Tirunelveli Halwa (500g)',
    slug: 'special-pure-ghee-tirunelveli-halwa-500g',
    categorySlug: 'snacks-foods',
    subCategory: 'Sweets',
    sku: 'SS-HLW-001',
    price: 499,
    discountPrice: 349,
    stock: 50,
    isFeatured: true,
    tags: ['halwa', 'sweets', 'ghee', 'tirunelveli', 'authentic'],
    description: 'Authentic hot-melting wheat milk halwa prepared with pure cow ghee and rich cashew nuts from the heart of Tirunelveli.',
    images: ['https://images.unsplash.com/photo-1599488615731-7e5c2823ff28?w=800&auto=format&fit=crop&q=80'],
    characteristics: [
      { key: 'Dietary Type', value: 'Pure Ghee' },
      { key: 'Weight Options', value: '500g' },
      { key: 'Shelf Life', value: '25 Days' },
    ],
  },

  // ── 7. Men's Fashion
  {
    name: 'Premium 100% Linen Cotton Formal Shirt',
    slug: 'premium-100-linen-cotton-formal-shirt',
    categorySlug: 'womens-fashion',
    subCategory: 'Shirts',
    sku: 'MF-SHT-001',
    price: 1799,
    discountPrice: 1099,
    stock: 30,
    isFeatured: true,
    tags: ['shirt', 'linen', 'formal', 'men', 'cotton'],
    description: 'Breathable lightweight linen cotton full-sleeve shirt with spread collar and curved hemline for formal and smart-casual wear.',
    images: ['https://images.unsplash.com/photo-1602810318383-e386cc2a3ccf?w=800&auto=format&fit=crop&q=80'],
    characteristics: [
      { key: 'Fabric', value: 'Linen Cotton' },
      { key: 'Fit Type', value: 'Slim Fit' },
      { key: 'Sleeve Length', value: 'Full Sleeve' },
    ],
  },
  {
    name: 'Heavyweight 240 GSM Oversized Cotton T-Shirt',
    slug: 'heavyweight-240-gsm-oversized-cotton-t-shirt',
    categorySlug: 'womens-fashion',
    subCategory: 'T-Shirts',
    sku: 'MF-TSH-002',
    price: 999,
    discountPrice: 599,
    stock: 45,
    isFeatured: false,
    tags: ['oversized', 't-shirt', 'streetwear', 'cotton'],
    description: 'Trendy drop-shoulder streetwear oversized t-shirt crafted with 240 GSM super combed bio-washed cotton.',
    images: ['https://images.unsplash.com/photo-1521572267360-ee0c2909d518?w=800&auto=format&fit=crop&q=80'],
    characteristics: [
      { key: 'Fabric', value: '100% Combed Cotton' },
      { key: 'Fit Type', value: 'Relaxed Oversized' },
      { key: 'Sleeve Length', value: 'Half Sleeve' },
    ],
  },

  // ── 8. Footwear
  {
    name: 'Orthopedic Cushion Comfort Walk Sandals for Women',
    slug: 'orthopedic-cushion-comfort-walk-sandals-women',
    categorySlug: 'womens-fashion',
    subCategory: 'Footwear',
    sku: 'FW-SND-001',
    price: 1299,
    discountPrice: 799,
    stock: 30,
    isFeatured: false,
    tags: ['footwear', 'sandals', 'comfort', 'orthopedic'],
    description: 'Doctor-recommended ultra soft memory foam sole sandals with anti-slip grip and adjustable straps.',
    images: ['https://images.unsplash.com/photo-1549298916-b41d501d3772?w=800&auto=format&fit=crop&q=80'],
    characteristics: [
      { key: 'Material', value: 'EVA Soft Sole' },
      { key: 'Sole Type', value: 'Cushioned Memory Foam' },
    ],
  },

  // ── 9. Toys & Kids
  {
    name: 'Wooden Montessori Learning Puzzle & Sorting Blocks',
    slug: 'wooden-montessori-learning-puzzle-sorting-blocks',
    categorySlug: 'kids-products',
    subCategory: 'Educational Toys',
    sku: 'TK-TOY-001',
    price: 899,
    discountPrice: 549,
    stock: 25,
    isFeatured: false,
    tags: ['montessori', 'wooden-toy', 'kids', 'educational'],
    description: 'Eco-friendly non-toxic natural wood shape sorter and color matching activity block set for toddler sensory development.',
    images: ['https://images.unsplash.com/photo-1558060370-d644479cb6f7?w=800&auto=format&fit=crop&q=80'],
    characteristics: [
      { key: 'Age Group', value: '0-2 Years' },
      { key: 'Safety Certification', value: 'Non-Toxic BPA Free' },
    ],
  },

  // ── 10. Bags & Wallets
  {
    name: 'Waterproof Anti-Theft Laptop Backpack with USB Port (30L)',
    slug: 'waterproof-anti-theft-laptop-backpack-usb-port-30l',
    categorySlug: 'womens-fashion',
    subCategory: 'Backpacks',
    sku: 'BW-BAG-001',
    price: 2499,
    discountPrice: 1399,
    stock: 30,
    isFeatured: true,
    tags: ['backpack', 'laptop-bag', 'waterproof', 'travel'],
    description: 'Heavy duty waterproof nylon travel backpack with dedicated padded 15.6" laptop compartment and external USB charging port.',
    images: ['https://images.unsplash.com/photo-1548036328-c9fa89d128fa?w=800&auto=format&fit=crop&q=80'],
    characteristics: [
      { key: 'Compartments', value: '2 Compartments + Laptop Sleeve' },
      { key: 'Water Resistance', value: 'Waterproof Fabric' },
    ],
  },
];

async function seedProducts() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('❌ MONGODB_URI is not defined in .env');
    process.exit(1);
  }

  console.log('Connecting to MongoDB Atlas to seed products & inventory...');
  try {
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 30000 });
    console.log('✅ Connected to MongoDB Atlas.');

    const categories = await Category.find();
    const catMap = {};
    categories.forEach((c) => {
      catMap[c.slug] = c._id;
    });

    for (const p of RAW_PRODUCTS) {
      const categoryId = catMap[p.categorySlug];
      if (!categoryId) {
        console.warn(`⚠️ Category slug "${p.categorySlug}" not found for product "${p.name}". Skipping.`);
        continue;
      }

      const productData = {
        name: p.name,
        slug: p.slug,
        category: categoryId,
        subCategory: p.subCategory,
        sku: p.sku,
        price: p.price,
        discountPrice: p.discountPrice,
        description: p.description,
        characteristics: p.characteristics,
        tags: p.tags,
        images: p.images,
        isFeatured: p.isFeatured,
        isActive: true,
      };

      const existing = await Product.findOne({ slug: p.slug });
      let savedProduct;

      if (existing) {
        await Product.updateOne({ slug: p.slug }, { $set: productData });
        savedProduct = await Product.findOne({ slug: p.slug });
        console.log(`🔄 Updated product: [${p.sku}] ${p.name}`);
      } else {
        savedProduct = await Product.create(productData);
        console.log(`✨ Created product: [${p.sku}] ${p.name}`);
      }

      // Upsert linked inventory record
      await Inventory.findOneAndUpdate(
        { product: savedProduct._id },
        {
          $set: {
            product: savedProduct._id,
            sku: p.sku,
            quantity: p.stock,
            lowStockThreshold: 5,
          },
        },
        { upsert: true, new: true }
      );
    }

    const totalProducts = await Product.countDocuments();
    const totalInventory = await Inventory.countDocuments();
    console.log(`\n🎉 Total Products in Atlas: ${totalProducts}`);
    console.log(`📦 Total Inventory records in Atlas: ${totalInventory}`);
  } catch (error) {
    console.error('❌ Error seeding products:', error.message);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB.');
    process.exit(0);
  }
}

seedProducts();
