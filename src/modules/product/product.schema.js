const { z } = require('zod');

const createProductSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().optional(),
  category: z.string().min(1, 'Category ID required'),
  price: z.number().positive(),
  discountPrice: z.number().positive().optional().nullable(),
  characteristics: z.array(z.object({ key: z.string(), value: z.string() })).optional(),
  tags: z.array(z.string()).optional(),
  isFeatured: z.boolean().optional(),
});

const updateProductSchema = createProductSchema.partial();

const listProductsSchema = z.object({
  category: z.string().optional(),
  search: z.string().optional(),
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
  sort: z.enum(['newest', 'price_asc', 'price_desc', 'featured']).optional(),
}).strict().optional();

module.exports = { createProductSchema, updateProductSchema, listProductsSchema };
