/**
 * Centralized Global Error Handling Middleware
 * Ensures standardized JSON error responses across the entire API
 */
const errorHandler = (err, req, res, next) => {
  let statusCode = err.statusCode || 500;
  let message = err.message || 'Internal Server Error';
  let errors = err.errors || null;

  // Handle Bad JSON syntax in request body
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    statusCode = 400;
    message = 'Malformed JSON in request body';
    errors = { body: 'Invalid JSON payload format' };
  }

  // Handle Mongoose CastError (e.g. invalid ObjectId)
  if (err.name === 'CastError') {
    statusCode = 400;
    message = `Invalid format for field '${err.path}': ${err.value}`;
    errors = { [err.path]: `Invalid value: ${err.value}` };
  }

  // Handle Mongoose Validation Error
  if (err.name === 'ValidationError') {
    statusCode = 400;
    message = 'Validation failed';
    errors = {};
    for (const [field, fieldError] of Object.entries(err.errors)) {
      errors[field] = fieldError.message;
    }
  }

  // Handle MongoDB Duplicate Key Error (E11000)
  if (err.code === 11000) {
    statusCode = 409;
    const duplicatedKey = Object.keys(err.keyValue || {})[0] || 'field';
    message = `Duplicate value entered for ${duplicatedKey}. Must be unique.`;
    errors = { [duplicatedKey]: 'Already exists' };
  }

  // Handle Payload Too Large (e.g. limit exceeded)
  if (err.type === 'entity.too.large') {
    statusCode = 413;
    message = 'Request payload exceeds allowable limit (50KB)';
  }

  // Construct structured response
  const response = {
    success: false,
    message,
    ...(errors && { errors })
  };

  // Only include stack trace in non-production environments
  if (process.env.NODE_ENV !== 'production' && statusCode === 500) {
    response.stack = err.stack;
  }

  // Log 500 errors to console for server debugging
  if (statusCode >= 500) {
    console.error(`[Server Error ${statusCode}] ${req.method} ${req.originalUrl}:`, err);
  }

  res.status(statusCode).json(response);
};

module.exports = errorHandler;
