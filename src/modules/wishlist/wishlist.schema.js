const { z } = require('zod');

const toggleWishlistSchema = z.object({
  productId: z.string().min(1, 'Product ID is required'),
});

const mergeWishlistSchema = z.object({
  productIds: z.array(z.string()).default([]),
});

module.exports = { toggleWishlistSchema, mergeWishlistSchema };
