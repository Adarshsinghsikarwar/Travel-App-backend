class ApiError extends Error {
  constructor(statusCode, message = "Something wnet wrong") {
    super(message);
    this.statusCode = statusCode;
    this.success = false;
  }
}

export default ApiError;
