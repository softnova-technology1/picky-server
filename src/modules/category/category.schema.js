const { z } = require('zod');

const characteristicFieldSchema = z.object({
  name: z.string().min(1, 'Characteristic name required').trim(),
  type: z.enum(['select', 'multi_select', 'text', 'number', 'boolean']),
  values: z.array(z.string()).optional(),
  required: z.boolean().optional(),
});

const createCategorySchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().optional(),
  sortOrder: z.coerce.number().int().optional(),
  characteristics: z.array(characteristicFieldSchema).optional(),
});

const updateCategorySchema = createCategorySchema.partial();

const updateCharacteristicsSchema = z.object({
  characteristics: z.array(characteristicFieldSchema),
});

module.exports = {
  createCategorySchema,
  updateCategorySchema,
  updateCharacteristicsSchema,
};


