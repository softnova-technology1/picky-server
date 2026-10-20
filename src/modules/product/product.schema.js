const { z } = require('zod');

const parseTags = (val) => {
  if (!val) return [];
  const clean = (arr) => {
    const seen = new Set();
    const result = [];
    for (const item of arr) {
      const s = String(item).trim();
      const lower = s.toLowerCase();
      if (s && !seen.has(lower)) {
        seen.add(lower);
        result.push(s);
      }
    }
    return result;
  };
  if (Array.isArray(val)) return clean(val);
  if (typeof val === 'string') {
    try {
      const parsed = JSON.parse(val);
      if (Array.isArray(parsed)) return clean(parsed);
    } catch (_) {}
    return clean(val.split(','));
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
      if (copy['imagePositions[]'] && !copy.imagePositions) {
        copy.imagePositions = copy['imagePositions[]'];
      }
      return copy;
    }
    return raw;
  },
  z.object({
    name: z.string().min(1, 'Product name required').max(200),
    description: z.string().optional(),
    shortDescription: z.string().optional(),
    category: z.string().min(1, 'Category ID required'),
    subCategory: z.string().optional(),
    sku: z.string().optional(),
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
    variants: z.preprocess((val) => {
      if (typeof val === 'string') {
        try {
          return JSON.parse(val);
        } catch (_) {
          return { type: 'none', options: [] };
        }
      }
      return val;
    }, z.object({
      type: z.string().optional(),
      options: z.array(z.string()).optional(),
      default: z.string().optional(),
      colors: z.array(z.any()).optional(),
    }).optional()),
    tags: z.preprocess(parseTags, z.array(z.string()).optional()),
    offerLabel: z.preprocess((val) => (val === undefined || val === null ? '' : String(val).trim()), z.string().optional()),
    offerStartDate: z.preprocess((val) => (!val ? null : new Date(val)), z.date().optional().nullable()),
    offerEndDate: z.preprocess((val) => (!val ? null : new Date(val)), z.date().optional().nullable()),
    imagePositions: z.preprocess((val) => {
      if (!val) return [];
      return Array.isArray(val) ? val : [val];
    }, z.array(z.string()).optional()),
    isFeatured: z.preprocess(
      (val) => (typeof val === 'string' ? val === 'true' || val === '1' : Boolean(val)),
      z.boolean().optional()
    ),
    isDiscountActive: z.preprocess(
      (val) => (typeof val === 'string' ? val === 'true' || val === '1' : Boolean(val)),
      z.boolean().default(false)
    ),
    isActive: z.preprocess(
      (val) => (val === undefined || val === '' ? true : (typeof val === 'string' ? val === 'true' || val === '1' : Boolean(val))),
      z.boolean().default(true)
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
      if (copy['imagePositions[]'] && !copy.imagePositions) {
        copy.imagePositions = copy['imagePositions[]'];
      }
      return copy;
    }
    return raw;
  },
  z.object({
    name: z.string().min(1).max(200).optional(),
    description: z.string().optional(),
    shortDescription: z.string().optional(),
    category: z.string().min(1).optional(),
    subCategory: z.string().optional(),
    sku: z.string().optional(),
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
    variants: z.preprocess((val) => {
      if (typeof val === 'string') {
        try {
          return JSON.parse(val);
        } catch (_) {
          return { type: 'none', options: [] };
        }
      }
      return val;
    }, z.object({
      type: z.string().optional(),
      options: z.array(z.string()).optional(),
      default: z.string().optional(),
      colors: z.array(z.any()).optional(),
    }).optional()),
    tags: z.preprocess(parseTags, z.array(z.string()).optional()),
    offerLabel: z.preprocess((val) => (val === undefined || val === null ? '' : String(val).trim()), z.string().optional()),
    offerStartDate: z.preprocess((val) => (!val ? null : new Date(val)), z.date().optional().nullable()),
    offerEndDate: z.preprocess((val) => (!val ? null : new Date(val)), z.date().optional().nullable()),
    imagePositions: z.preprocess((val) => {
      if (!val) return [];
      return Array.isArray(val) ? val : [val];
    }, z.array(z.string()).optional()),
    isFeatured: z.preprocess(
      (val) => (typeof val === 'string' ? val === 'true' || val === '1' : Boolean(val)),
      z.boolean().optional()
    ),
    isDiscountActive: z.preprocess(
      (val) => (val === undefined ? undefined : (typeof val === 'string' ? val === 'true' || val === '1' : Boolean(val))),
      z.boolean().optional()
    ),
    isActive: z.preprocess(
      (val) => (val === undefined ? undefined : (typeof val === 'string' ? val === 'true' || val === '1' : Boolean(val))),
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

