/**
 * Pagination helper for Mongoose queries
 * Usage: const { skip, limit, pagination } = paginate(req.query);
 */
const paginate = (query = {}) => {
  const page = Math.max(1, parseInt(query.page) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(query.limit) || 20)); // capped at 50 (audit fix #11)
  const skip = (page - 1) * limit;

  const buildPagination = (total) => ({
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
    hasNextPage: page < Math.ceil(total / limit),
    hasPrevPage: page > 1,
  });

  return { skip, limit, page, buildPagination };
};

module.exports = paginate;
