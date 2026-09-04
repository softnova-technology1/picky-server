const { z } = require('zod');

const createDiscountSchema = z.object({
  name: z.string().min(2).max(100).trim(),
  type: z.enum(['percentage', 'flat']),
  value: z.number().positive(),
  minOrderAmount: z.number().min(0).optional().default(0),
  maxDiscountAmount: z.number().positive().nullable().optional(),
  isActive: z.boolean().optional().default(true),
  startsAt: z.string().datetime().nullable().optional(),
  endsAt: z.string().datetime().nullable().optional(),
  appliesTo: z.enum(['all', 'first_order']).optional().default('all'),
});

const updateDiscountSchema = createDiscountSchema.partial();

module.exports = { createDiscountSchema, updateDiscountSchema };
