const Inventory = require('../../models/inventory.model');
const Product = require('../../models/product.model');
const Category = require('../../models/category.model');
const AppError = require('../../utils/appError');
const paginate = require('../../utils/paginate');

const InventoryService = {
  async list(query = {}) {
    const { skip, limit, buildPagination } = paginate(query);
    const filter = {};

    if (query.lowStock === 'true' || query.lowStock === true) {
      filter.$expr = { $lte: ['$quantity', '$lowStockThreshold'] };
    }

    // Build population and search
    let inventoryItems = await Inventory.find(filter)
      .populate({
        path: 'product',
        select: 'name slug price discountPrice images category subCategory sku isActive isFeatured',
        populate: { path: 'category', select: 'name slug' },
      })
      .sort({ updatedAt: -1 })
      .lean();

    // Filter out orphaned records if product was deleted
    inventoryItems = inventoryItems.filter((item) => item.product);

    // Apply text search on product name or SKU in memory if search query provided
    if (query.search) {
      const q = query.search.trim().toLowerCase();
      inventoryItems = inventoryItems.filter(
        (item) =>
          (item.sku && item.sku.toLowerCase().includes(q)) ||
          (item.product?.name && item.product.name.toLowerCase().includes(q)) ||
          (item.product?.subCategory && item.product.subCategory.toLowerCase().includes(q))
      );
    }

    const total = inventoryItems.length;
    const paginatedData = inventoryItems.slice(skip, skip + limit);

    // Calculate Summary KPIs
    const totalUnits = inventoryItems.reduce((sum, item) => sum + (item.quantity || 0), 0);
    const lowStockCount = inventoryItems.filter((item) => item.quantity <= item.lowStockThreshold && item.quantity > 0).length;
    const outOfStockCount = inventoryItems.filter((item) => item.quantity === 0).length;

    return {
      data: paginatedData,
      kpis: {
        totalProducts: total,
        totalUnits,
        lowStockCount,
        outOfStockCount,
      },
      pagination: buildPagination(total),
    };
  },

  async updateStock(productId, { quantity, lowStockThreshold, reason }) {
    const product = await Product.findById(productId);
    if (!product) throw new AppError('Product not found', 404);

    const updateFields = {};
    if (quantity !== undefined) updateFields.quantity = Math.max(0, Number(quantity));
    if (lowStockThreshold !== undefined) updateFields.lowStockThreshold = Math.max(0, Number(lowStockThreshold));

    const inventory = await Inventory.findOneAndUpdate(
      { product: productId },
      { $set: updateFields },
      { new: true, upsert: true }
    ).populate('product');

    if (quantity !== undefined) {
      await Product.findByIdAndUpdate(productId, { stock: Math.max(0, Number(quantity)) });
    }

    return inventory;
  },
};

module.exports = InventoryService;
