const mongoose = require('mongoose');
const Employee = require('../models/Employee');

/**
 * Escapes regex special characters to prevent ReDoS attacks and regex injection
 */
const escapeRegex = (str) => {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

/**
 * GET /health
 * Returns API server and MongoDB database connection status
 */
const getHealth = async (req, res) => {
  const connectionStates = {
    0: 'Disconnected',
    1: 'Connected',
    2: 'Connecting',
    3: 'Disconnecting'
  };

  const dbState = mongoose.connection.readyState;
  const isDbHealthy = dbState === 1;

  res.status(isDbHealthy ? 200 : 503).json({
    success: isDbHealthy,
    status: isDbHealthy ? 'UP' : 'DEGRADED',
    message: isDbHealthy
      ? 'PeopleDesk API is healthy and connected to MongoDB'
      : 'API is running but database is not connected',
    timestamp: new Date().toISOString(),
    uptime: `${Math.floor(process.uptime())}s`,
    database: {
      status: connectionStates[dbState] || 'Unknown',
      host: mongoose.connection.host || 'N/A',
      name: mongoose.connection.name || 'N/A'
    }
  });
};

/**
 * Computes global dashboard summary metrics across all persistent employee records
 */
const getGlobalSummary = async () => {
  const result = await Employee.aggregate([
    {
      $group: {
        _id: null,
        totalEmployees: { $sum: 1 },
        totalPayroll: { $sum: '$salary' },
        departments: { $addToSet: '$department' }
      }
    }
  ]);

  if (!result || result.length === 0) {
    return {
      totalEmployees: 0,
      totalPayroll: 0,
      departmentCount: 0
    };
  }

  return {
    totalEmployees: result[0].totalEmployees || 0,
    totalPayroll: result[0].totalPayroll || 0,
    departmentCount: (result[0].departments || []).length
  };
};

/**
 * POST /employees
 * Create a new employee record with validated data
 */
const createEmployee = async (req, res, next) => {
  try {
    const employee = new Employee(req.cleanData);
    await employee.save();

    res.status(201).json({
      success: true,
      message: 'Employee created successfully',
      data: employee
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /employees
 * Retrieves employee records with search, sorting, and pagination support.
 * Also returns global summary metrics for the dashboard cards.
 */
const getEmployees = async (req, res, next) => {
  try {
    const { search, department, sortBy = 'createdAt', order = 'desc', page, limit } = req.query;

    // 1. Build search and filter query
    const query = {};

    // Exact department filter if specified
    if (department && department.trim()) {
      query.department = department.trim();
    }

    if (search && search.trim()) {
      const sanitizedSearch = escapeRegex(search.trim());
      // For short acronyms (<= 2 chars like 'IT' or 'HR'), enforce word boundaries
      // so searching 'IT' does not match substring 'Digital' or 'Auditor'
      const isShortAcronym = sanitizedSearch.length <= 2;
      const nameRegex = isShortAcronym ? new RegExp(`\\b${sanitizedSearch}\\b`, 'i') : new RegExp(sanitizedSearch, 'i');
      const deptRegex = isShortAcronym ? new RegExp(`^${sanitizedSearch}$`, 'i') : new RegExp(sanitizedSearch, 'i');
      const roleRegex = isShortAcronym ? new RegExp(`\\b${sanitizedSearch}\\b`, 'i') : new RegExp(sanitizedSearch, 'i');

      query.$or = [
        { name: nameRegex },
        { department: deptRegex },
        { role: roleRegex }
      ];
    }

    // 2. Build sort order
    const sortField = sortBy;
    const sortDirection = order.toLowerCase() === 'asc' ? 1 : -1;
    const sortOptions = { [sortField]: sortDirection };

    // 3. Count total matching documents
    const totalMatching = await Employee.countDocuments(query);

    // 4. Query with pagination or full set
    let employeeQuery = Employee.find(query).sort(sortOptions);

    if (page && limit) {
      const pageNum = parseInt(page, 10);
      const limitNum = parseInt(limit, 10);
      const skip = (pageNum - 1) * limitNum;
      employeeQuery = employeeQuery.skip(skip).limit(limitNum);
    }

    const [employees, summary] = await Promise.all([
      employeeQuery.exec(),
      getGlobalSummary()
    ]);

    res.status(200).json({
      success: true,
      message: 'Employees retrieved successfully',
      count: employees.length,
      total: totalMatching,
      summary,
      data: employees
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /employees/:id
 * Retrieve a single employee by their ObjectId
 */
const getEmployeeById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const employee = await Employee.findById(id);

    if (!employee) {
      return res.status(404).json({
        success: false,
        message: `Employee with ID '${id}' was not found.`,
        data: null
      });
    }

    res.status(200).json({
      success: true,
      message: 'Employee retrieved successfully',
      data: employee
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /employees/:id
 * Update an existing employee with pre-validated data
 */
const updateEmployee = async (req, res, next) => {
  try {
    const { id } = req.params;

    const updatedEmployee = await Employee.findByIdAndUpdate(
      id,
      req.cleanData,
      {
        new: true,
        runValidators: true
      }
    );

    if (!updatedEmployee) {
      return res.status(404).json({
        success: false,
        message: `Employee with ID '${id}' was not found and could not be updated.`,
        data: null
      });
    }

    res.status(200).json({
      success: true,
      message: 'Employee updated successfully',
      data: updatedEmployee
    });
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /employees/:id
 * Delete an existing employee by ObjectId
 */
const deleteEmployee = async (req, res, next) => {
  try {
    const { id } = req.params;

    const deletedEmployee = await Employee.findByIdAndDelete(id);

    if (!deletedEmployee) {
      return res.status(404).json({
        success: false,
        message: `Employee with ID '${id}' was not found and could not be deleted.`,
        data: null
      });
    }

    res.status(200).json({
      success: true,
      message: 'Employee deleted successfully',
      data: {
        id: deletedEmployee._id,
        name: deletedEmployee.name
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /employees/stats/summary
 * Direct endpoint for summary cards if requested independently
 */
const getStats = async (req, res, next) => {
  try {
    const summary = await getGlobalSummary();
    res.status(200).json({
      success: true,
      message: 'Summary metrics calculated successfully',
      data: summary
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getHealth,
  createEmployee,
  getEmployees,
  getEmployeeById,
  updateEmployee,
  deleteEmployee,
  getStats
};
