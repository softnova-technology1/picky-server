class ApiResponse {
  static success(data, message = 'Success', statusCode = 200) {
    return { success: true, statusCode, message, data };
  }

  static error(message, statusCode = 500) {
    return { success: false, statusCode, error: message };
  }

  static paginated(data, pagination, message = 'Success') {
    return { success: true, message, data, pagination };
  }
}

const sendSuccess = (res, data, statusCode = 200, pagination = null, message = 'Success') => {
  const payload = { success: true, message, data };
  if (pagination) payload.pagination = pagination;
  return res.status(statusCode).json(payload);
};

const sendError = (res, message = 'Error', statusCode = 500) => {
  return res.status(statusCode).json({ success: false, message, error: message });
};

module.exports = { ApiResponse, sendSuccess, sendError };

