/**
 * 404 Not Found Middleware
 * Intercepts requests to undefined routes and returns structured JSON
 */
const notFound = (req, res, next) => {
  res.status(404).json({
    success: false,
    message: `API endpoint not found: ${req.method} ${req.originalUrl}`
  });
};

module.exports = notFound;
