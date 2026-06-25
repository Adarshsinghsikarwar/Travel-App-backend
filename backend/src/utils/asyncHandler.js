// Wraps controllers so we never need try/catch in every route.
// Any thrown error (sync or async) is forwarded to the error middleware.

const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

export { asyncHandler };
