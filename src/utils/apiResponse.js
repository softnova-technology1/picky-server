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

module.exports = { ApiResponse };
