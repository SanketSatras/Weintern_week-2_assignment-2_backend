const mongoose = require('mongoose');

const ALLOWED_FIELDS = ['name', 'department', 'role', 'salary', 'joinDate'];
const ALLOWED_DEPARTMENTS = ['IT', 'HR', 'Finance', 'Marketing', 'Sales', 'Operations'];
const MAX_SALARY = 100000000;

const addAllowedDepartment = (deptName) => {
  if (deptName && typeof deptName === 'string') {
    const trimmed = deptName.trim();
    if (!ALLOWED_DEPARTMENTS.includes(trimmed)) {
      ALLOWED_DEPARTMENTS.push(trimmed);
    }
  }
};

const removeAllowedDepartment = (deptName) => {
  if (deptName && typeof deptName === 'string') {
    const trimmed = deptName.trim().toLowerCase();
    const idx = ALLOWED_DEPARTMENTS.findIndex((d) => d.toLowerCase() === trimmed);
    if (idx !== -1) {
      ALLOWED_DEPARTMENTS.splice(idx, 1);
    }
  }
};

/**
 * Validates MongoDB ObjectId
 */
const validateId = (id) => {
  if (!id || typeof id !== 'string') return false;
  return mongoose.Types.ObjectId.isValid(id) && new mongoose.Types.ObjectId(id).toString() === id;
};

/**
 * Sanitizes and strips prohibited characters/operators ($ or .) to prevent NoSQL injection
 */
const sanitizePayload = (body) => {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { sanitized: null, unexpectedFields: [] };
  }

  const sanitized = {};
  const unexpectedFields = [];

  for (const key of Object.keys(body)) {
    // Check for MongoDB operator injection or forbidden characters
    if (key.startsWith('$') || key.includes('.')) {
      unexpectedFields.push(key);
      continue;
    }

    if (ALLOWED_FIELDS.includes(key)) {
      sanitized[key] = body[key];
    } else {
      unexpectedFields.push(key);
    }
  }

  return { sanitized, unexpectedFields };
};

/**
 * Comprehensive employee payload validation middleware
 * Handles both Create (all fields required) and Update (all fields expected for complete payload)
 */
const validateEmployeePayload = (isUpdate = false) => {
  return (req, res, next) => {
    const { sanitized, unexpectedFields } = sanitizePayload(req.body);

    if (!sanitized) {
      return res.status(400).json({
        success: false,
        message: 'Invalid request payload. Expected a JSON object.',
        errors: { body: 'Request body must be a JSON object' }
      });
    }

    const errors = {};

    // 1. Name validation
    if (sanitized.name === undefined || sanitized.name === null || sanitized.name === '') {
      errors.name = 'Full name is required';
    } else if (typeof sanitized.name !== 'string') {
      errors.name = 'Full name must be a text string';
    } else {
      const trimmedName = sanitized.name.trim();
      if (trimmedName.length < 2) {
        errors.name = 'Full name must be at least 2 characters long';
      } else if (trimmedName.length > 100) {
        errors.name = 'Full name cannot exceed 100 characters';
      } else {
        sanitized.name = trimmedName;
      }
    }

    // 2. Department validation
    if (!sanitized.department) {
      errors.department = 'Department is required';
    } else if (typeof sanitized.department !== 'string') {
      errors.department = 'Department must be a string';
    } else {
      const trimmedDept = sanitized.department.trim();
      if (!ALLOWED_DEPARTMENTS.includes(trimmedDept)) {
        errors.department = `Invalid department. Must be one of: ${ALLOWED_DEPARTMENTS.join(', ')}`;
      } else {
        sanitized.department = trimmedDept;
      }
    }

    // 3. Job Role validation
    if (sanitized.role === undefined || sanitized.role === null || sanitized.role === '') {
      errors.role = 'Job role is required';
    } else if (typeof sanitized.role !== 'string') {
      errors.role = 'Job role must be a text string';
    } else {
      const trimmedRole = sanitized.role.trim();
      if (trimmedRole.length < 2) {
        errors.role = 'Job role must be at least 2 characters long';
      } else if (trimmedRole.length > 100) {
        errors.role = 'Job role cannot exceed 100 characters';
      } else {
        sanitized.role = trimmedRole;
      }
    }

    // 4. Monthly Salary validation
    if (sanitized.salary === undefined || sanitized.salary === null || sanitized.salary === '') {
      errors.salary = 'Monthly salary is required';
    } else {
      const numSalary = Number(sanitized.salary);
      if (!Number.isFinite(numSalary) || isNaN(numSalary)) {
        errors.salary = 'Monthly salary must be a valid numeric amount';
      } else if (numSalary < 0) {
        errors.salary = 'Monthly salary cannot be negative';
      } else if (numSalary > MAX_SALARY) {
        errors.salary = `Monthly salary cannot exceed ₹${MAX_SALARY.toLocaleString('en-IN')}`;
      } else {
        sanitized.salary = numSalary;
      }
    }

    // 5. Joining Date validation
    if (!sanitized.joinDate) {
      errors.joinDate = 'Joining date is required';
    } else {
      let dateVal;
      if (typeof sanitized.joinDate === 'string' && /^\d{1,2}\/\d{1,2}\/\d{2,4}$/.test(sanitized.joinDate.trim())) {
        const parts = sanitized.joinDate.trim().split('/');
        const day = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10) - 1;
        let year = parseInt(parts[2], 10);
        if (year < 100) {
          year += (year <= 50 ? 2000 : 1900);
        }
        dateVal = new Date(Date.UTC(year, month, day));
      } else {
        dateVal = new Date(sanitized.joinDate);
      }

      if (isNaN(dateVal.getTime())) {
        errors.joinDate = 'Joining date must be a valid calendar date';
      } else {
        const endOfToday = new Date();
        endOfToday.setHours(23, 59, 59, 999);
        if (dateVal > endOfToday) {
          errors.joinDate = 'Joining date cannot be set in the future';
        } else {
          sanitized.joinDate = dateVal;
        }
      }
    }

    // If validation fails, return 400 Bad Request with field-specific errors
    if (Object.keys(errors).length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed for one or more fields',
        errors
      });
    }

    // Attach strictly sanitized and typed data to req.cleanData
    req.cleanData = sanitized;
    next();
  };
};

/**
 * Middleware to validate MongoDB ObjectId from route parameter
 */
const validateObjectIdParam = (paramName = 'id') => {
  return (req, res, next) => {
    const id = req.params[paramName];
    if (!validateId(id)) {
      return res.status(400).json({
        success: false,
        message: `Invalid employee ID format: '${id}'. Must be a 24-character hexadecimal ObjectId.`,
        errors: { [paramName]: 'Invalid ObjectId format' }
      });
    }
    next();
  };
};

/**
 * Validates query parameters for sorting and filtering
 */
const validateQueryParams = (req, res, next) => {
  const allowedSortFields = ['name', 'department', 'role', 'salary', 'joinDate', 'createdAt'];
  const allowedOrders = ['asc', 'desc'];

  const { sortBy, order, search, department, page, limit } = req.query;

  if (department && !ALLOWED_DEPARTMENTS.includes(department)) {
    return res.status(400).json({
      success: false,
      message: `Invalid department '${department}'. Allowed departments: ${ALLOWED_DEPARTMENTS.join(', ')}`,
      errors: { department: `Must be one of: ${ALLOWED_DEPARTMENTS.join(', ')}` }
    });
  }

  if (sortBy && !allowedSortFields.includes(sortBy)) {
    return res.status(400).json({
      success: false,
      message: `Invalid sortBy field '${sortBy}'. Allowed fields: ${allowedSortFields.join(', ')}`,
      errors: { sortBy: `Must be one of: ${allowedSortFields.join(', ')}` }
    });
  }

  if (order && !allowedOrders.includes(order.toLowerCase())) {
    return res.status(400).json({
      success: false,
      message: `Invalid sort order '${order}'. Allowed orders: 'asc' or 'desc'`,
      errors: { order: "Must be 'asc' or 'desc'" }
    });
  }

  if (page !== undefined) {
    const pageNum = parseInt(page, 10);
    if (isNaN(pageNum) || pageNum < 1) {
      return res.status(400).json({
        success: false,
        message: 'Page query parameter must be a positive integer',
        errors: { page: 'Must be >= 1' }
      });
    }
  }

  if (limit !== undefined) {
    const limitNum = parseInt(limit, 10);
    if (isNaN(limitNum) || limitNum < 1 || limitNum > 500) {
      return res.status(400).json({
        success: false,
        message: 'Limit query parameter must be an integer between 1 and 500',
        errors: { limit: 'Must be between 1 and 500' }
      });
    }
  }

  next();
};

module.exports = {
  validateEmployeePayload,
  validateObjectIdParam,
  validateQueryParams,
  ALLOWED_DEPARTMENTS,
  addAllowedDepartment,
  removeAllowedDepartment,
  ALLOWED_FIELDS,
  validateId
};
