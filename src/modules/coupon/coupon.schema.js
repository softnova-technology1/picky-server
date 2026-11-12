const { z } = require('zod');

const createCouponSchema = z.object({
  code: z.string().min(1, 'Coupon code cannot be empty').max(30).trim().toUpperCase(),
  type: z.enum(['percentage', 'flat']),
  value: z.number().min(0),
  minOrderAmount: z.number().min(0).optional().default(0),
  maxDiscountAmount: z.number().min(0).nullable().optional(),
  maxUsageTotal: z.number().int().min(0).nullable().optional(),
  maxUsagePerUser: z.number().int().min(0).nullable().optional().default(1),
  usageLimitPerCustomer: z.number().int().min(0).nullable().optional(),
  usageCount: z.number().int().min(0).optional().default(0),
  startsAt: z.any().nullable().optional(),
  endsAt: z.any().nullable().optional(),
  validFrom: z.any().nullable().optional(),
  validTill: z.any().nullable().optional(),
  applicableOn: z.any().optional(),
  applicableType: z.any().optional(),
  applicableValue: z.any().optional(),
  isActive: z.boolean().optional().default(true),
});

const updateCouponSchema = createCouponSchema.partial();

module.exports = { createCouponSchema, updateCouponSchema };
