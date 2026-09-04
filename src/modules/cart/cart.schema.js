const { z } = require('zod');

const addItemSchema = z.object({
  productId: z.string().min(1, 'Product ID required'),
  quantity: z.number().int().positive(),
});

const updateQtySchema = z.object({
  productId: z.string().min(1),
  quantity: z.number().int().min(0), // 0 = remove item
});

const applyCouponSchema = z.object({
  code: z.string().min(1, 'Coupon code required').toUpperCase(),
});

module.exports = { addItemSchema, updateQtySchema, applyCouponSchema };
