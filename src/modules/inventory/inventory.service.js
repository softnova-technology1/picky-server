const Inventory = require('../../models/inventory.model');
const Product = require('../../models/product.model');
const Category = require('../../models/category.model');
const Order = require('../../models/order.model');
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

    // Aggregate sold and reserved units from orders
    let orderStatsMap = {};
    try {
      const orderAgg = await Order.aggregate([
        { $match: { status: { $ne: 'cancelled' } } },
        { $unwind: '$items' },
        {
          $group: {
            _id: '$items.product',
            totalSold: {
              $sum: {
                $cond: [{ $in: ['$status', ['delivered', 'shipped', 'out_for_delivery', 'confirmed', 'processing']] }, '$items.quantity', 0],
              },
            },
            totalReserved: {
              $sum: {
                $cond: [{ $in: ['$status', ['pending', 'payment_pending']] }, '$items.quantity', 0],
              },
            },
          },
        },
      ]);
      orderAgg.forEach((stat) => {
        if (stat._id) {
          orderStatsMap[String(stat._id)] = {
            sold: stat.totalSold || 0,
            reserved: stat.totalReserved || 0,
          };
        }
      });
    } catch (e) {
      console.warn('Order aggregation notice:', e.message);
    }

    // Aggregate active in-progress checkout reservations
    let checkoutReservedMap = {};
    try {
      const CheckoutReservation = require('../../models/checkoutReservation.model');
      const activeReservations = await CheckoutReservation.aggregate([
        { $match: { status: 'reserved', expiresAt: { $gt: new Date() } } },
        { $unwind: '$items' },
        {
          $group: {
            _id: '$items.product',
            totalReserved: { $sum: '$items.quantity' },
          },
        },
      ]);
      activeReservations.forEach((r) => {
        if (r._id) checkoutReservedMap[String(r._id)] = r.totalReserved || 0;
      });
    } catch (_) {}

    // Attach sold, reserved, and normalize
    inventoryItems = inventoryItems.map((item) => {
      const pId = String(item.product?._id || item.product);
      const stats = orderStatsMap[pId] || {};
      const checkoutReserved = checkoutReservedMap[pId] || 0;
      const sold = Math.max(Number(item.sold) || 0, stats.sold || 0);
      const reserved = Math.max(Number(item.reserved) || 0, (stats.reserved || 0) + checkoutReserved);
      return {
        ...item,
        sold,
        reserved,
      };
    });

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
    const inStockCount = inventoryItems.filter((item) => item.quantity > item.lowStockThreshold).length;
    const lowStockCount = inventoryItems.filter((item) => item.quantity <= item.lowStockThreshold && item.quantity > 0).length;
    const outOfStockCount = inventoryItems.filter((item) => item.quantity === 0).length;
    const deactivatedCount = inventoryItems.filter((item) => item.product?.isActive === false).length;
    const totalSoldUnits = inventoryItems.reduce((sum, item) => sum + (item.sold || 0), 0);
    const totalReservedUnits = inventoryItems.reduce((sum, item) => sum + (item.reserved || 0), 0);

    return {
      data: paginatedData,
      kpis: {
        totalProducts: total,
        totalUnits,
        inStockCount,
        lowStockCount,
        outOfStockCount,
        deactivatedCount,
        totalSoldUnits,
        totalReservedUnits,
      },
      pagination: buildPagination(total),
    };
  },

  async updateStock(productId, { quantity, lowStockThreshold, reserved, sold, reason }) {
    let pId = productId;
    let product = await Product.findById(productId);
    if (!product) {
      const inv = await Inventory.findById(productId);
      if (inv) {
        pId = inv.product?._id || inv.product;
        product = await Product.findById(pId);
      }
    }
    if (!product) throw new AppError('Product not found', 404);

    const updateFields = {};
    if (quantity !== undefined) updateFields.quantity = Math.max(0, Number(quantity));
    if (lowStockThreshold !== undefined) updateFields.lowStockThreshold = Math.max(0, Number(lowStockThreshold));
    if (reserved !== undefined) updateFields.reserved = Math.max(0, Number(reserved));
    if (sold !== undefined) updateFields.sold = Math.max(0, Number(sold));

    const inventory = await Inventory.findOneAndUpdate(
      { product: pId },
      { $set: updateFields },
      { new: true, upsert: true }
    ).populate('product');

    if (quantity !== undefined) {
      await Product.findByIdAndUpdate(pId, { stock: Math.max(0, Number(quantity)) });
    }

    return inventory;
  },

  async toggleProductStatus(productId) {
    let pId = productId;
    const inv = await Inventory.findById(productId);
    if (inv) {
      pId = inv.product?._id || inv.product;
    }
    const product = await Product.findById(pId);
    if (!product) throw new AppError('Product not found', 404);

    const newStatus = !product.isActive;
    const updated = await Product.findByIdAndUpdate(pId, { isActive: newStatus }, { new: true });

    try {
      const ProductService = require('../product/product.service');
      if (ProductService && ProductService.clearCache) {
        ProductService.clearCache();
      }
    } catch (_) {}

    return { product: updated, isActive: updated.isActive };
  },

  async deleteItem(productId) {
    let pId = productId;
    try {
      const inv = await Inventory.findById(productId);
      if (inv) {
        pId = inv.product?._id || inv.product;
        await Inventory.findByIdAndDelete(productId);
      } else {
        await Inventory.deleteMany({ product: productId });
      }
      if (pId) {
        await Product.findByIdAndDelete(pId);
        await Inventory.deleteMany({ product: pId });
      }
      try {
        const ProductService = require('../product/product.service');
        if (ProductService && ProductService.clearCache) {
          ProductService.clearCache();
        }
      } catch (_) {}
      return true;
    } catch (err) {
      console.error('Error deleting inventory/product item:', err);
      throw err;
    }
  },
};

module.exports = InventoryService;
