const { z } = require('zod');

const createCouponSchema = z.object({
  code: z.string().min(3).max(20).trim().toUpperCase(),
  type: z.enum(['percentage', 'flat']),
  value: z.number().positive(),
  minOrderAmount: z.number().min(0).optional().default(0),
  maxDiscountAmount: z.number().positive().nullable().optional(),
  maxUsageTotal: z.number().int().positive().nullable().optional(),
  maxUsagePerUser: z.number().int().positive().optional().default(1),
  startsAt: z.string().datetime().nullable().optional(),
  endsAt: z.string().datetime().nullable().optional(),
  isActive: z.boolean().optional().default(true),
});

const updateCouponSchema = createCouponSchema.partial();

module.exports = { createCouponSchema, updateCouponSchema };
