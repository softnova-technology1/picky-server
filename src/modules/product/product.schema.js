const { z } = require('zod');

const parseTags = (val) => {
  if (!val) return [];
  if (Array.isArray(val)) return val.map(String).map((s) => s.trim()).filter(Boolean);
  if (typeof val === 'string') {
    try {
      const parsed = JSON.parse(val);
      if (Array.isArray(parsed)) return parsed.map(String).map((s) => s.trim()).filter(Boolean);
    } catch (_) {}
    return val.split(',').map((t) => t.trim()).filter(Boolean);
  }
  return [];
};

const createProductSchema = z.preprocess(
  (raw) => {
    if (raw && typeof raw === 'object') {
      const copy = { ...raw };
      if (copy['tags[]'] && !copy.tags) {
        copy.tags = copy['tags[]'];
      }
      return copy;
    }
    return raw;
  },
  z.object({
    name: z.string().min(1, 'Product name required').max(200),
    description: z.string().optional(),
    category: z.string().min(1, 'Category ID required'),
    price: z.coerce.number().positive('Price must be greater than 0'),
    discountPrice: z.preprocess(
      (val) => (val === '' || val === undefined || val === null ? null : val),
      z.coerce.number().positive().optional().nullable()
    ),
    stock: z.coerce.number().int().min(0).optional(),
    characteristics: z.preprocess((val) => {
      if (typeof val === 'string') {
        try {
          return JSON.parse(val);
        } catch (_) {
          return [];
        }
      }
      return val;
    }, z.array(z.object({
      key: z.string().min(1),
      value: z.preprocess((v) => Array.isArray(v) ? v.join(', ') : (v === undefined || v === null ? '' : String(v)), z.string()),
    })).optional()),
    tags: z.preprocess(parseTags, z.array(z.string()).optional()),
    isFeatured: z.preprocess(
      (val) => (typeof val === 'string' ? val === 'true' || val === '1' : Boolean(val)),
      z.boolean().optional()
    ),
  })
);

const updateProductSchema = z.preprocess(
  (raw) => {
    if (raw && typeof raw === 'object') {
      const copy = { ...raw };
      if (copy['tags[]'] && !copy.tags) {
        copy.tags = copy['tags[]'];
      }
      return copy;
    }
    return raw;
  },
  z.object({
    name: z.string().min(1).max(200).optional(),
    description: z.string().optional(),
    category: z.string().min(1).optional(),
    price: z.coerce.number().positive().optional(),
    discountPrice: z.preprocess(
      (val) => (val === '' || val === undefined || val === null ? null : val),
      z.coerce.number().positive().optional().nullable()
    ),
    stock: z.coerce.number().int().min(0).optional(),
    characteristics: z.preprocess((val) => {
      if (typeof val === 'string') {
        try {
          return JSON.parse(val);
        } catch (_) {
          return [];
        }
      }
      return val;
    }, z.array(z.object({
      key: z.string().min(1),
      value: z.preprocess((v) => Array.isArray(v) ? v.join(', ') : (v === undefined || v === null ? '' : String(v)), z.string()),
    })).optional()),
    tags: z.preprocess(parseTags, z.array(z.string()).optional()),
    isFeatured: z.preprocess(
      (val) => (typeof val === 'string' ? val === 'true' || val === '1' : Boolean(val)),
      z.boolean().optional()
    ),
  })
);

const listProductsSchema = z.object({
  category: z.string().optional(),
  search: z.string().optional(),
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
  sort: z.enum(['newest', 'price_asc', 'price_desc', 'featured']).optional(),
}).strict().optional();

module.exports = { createProductSchema, updateProductSchema, listProductsSchema };

