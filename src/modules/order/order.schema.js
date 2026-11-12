const { z } = require('zod');

const guestItemSchema = z.object({
  productId: z.string(),
  quantity: z.number().int().positive(),
  basePrice: z.number().optional(),
  customizationCost: z.number().optional(),
  isCustomized: z.boolean().optional(),
  customization: z.any().optional(),
});

const checkoutSchema = z.object({
  shippingAddress: z.object({
    street: z.string().min(1),
    city: z.string().min(1),
    state: z.string().min(1),
    pincode: z.string().min(4),
    landmark: z.string().optional(),
  }),
  guestItems: z.array(guestItemSchema).optional(), // for guest cart merge
});

const addTrackingSchema = z.object({
  trackingId: z.string().optional(),
  courier: z.string().optional(),
  courierUrl: z.string().optional(),
});

const updateStatusSchema = z.object({
  status: z.enum(['placed', 'confirmed', 'shipped', 'delivered', 'cancelled']),
  note: z.string().optional(),
  courier: z.string().optional(),
  courierUrl: z.string().optional(),
  trackingId: z.string().optional(),
});

module.exports = { checkoutSchema, addTrackingSchema, updateStatusSchema };
