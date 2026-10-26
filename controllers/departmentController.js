const { ALLOWED_DEPARTMENTS, addAllowedDepartment, removeAllowedDepartment } = require('../validators/employeeValidator');
const Employee = require('../models/Employee');

// In-memory catalog seeded with enterprise defaults
const DEPARTMENTS_CATALOG = [
  { name: 'IT', desc: 'Software Engineering, Cloud, & Systems Architecture', icon: 'laptop', color: '#2563EB' },
  { name: 'HR', desc: 'People Operations, Recruitment, & Workplace Culture', icon: 'users', color: '#9333EA' },
  { name: 'Finance', desc: 'Accounting, Budgeting, Taxation, & Payroll Audits', icon: 'calculator', color: '#059669' },
  { name: 'Marketing', desc: 'Brand Positioning, Content, & Demand Generation', icon: 'megaphone', color: '#EA580C' },
  { name: 'Sales', desc: 'Enterprise Accounts, Pipeline, & Revenue Growth', icon: 'trending-up', color: '#0D9488' },
  { name: 'Operations', desc: 'Supply Chain, Logistics, & Business Process Optimization', icon: 'layers', color: '#475569' }
];

/**
 * GET /api/departments
 * Returns full list of active organizational departments
 */
const getDepartments = async (req, res) => {
  return res.status(200).json({
    success: true,
    count: DEPARTMENTS_CATALOG.length,
    data: DEPARTMENTS_CATALOG
  });
};

/**
 * POST /api/departments
 * Registers a new organizational department into the enterprise catalog
 */
const createDepartment = async (req, res) => {
  try {
    const { name, desc, icon, color } = req.body || {};

    if (!name || typeof name !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'Department name is required and must be a text string.',
        errors: { name: 'Department name is required' }
      });
    }

    const trimmedName = name.trim();
    if (trimmedName.length < 2) {
      return res.status(400).json({
        success: false,
        message: 'Department name must be at least 2 characters long.',
        errors: { name: 'Department name must be at least 2 characters long' }
      });
    }

    if (trimmedName.length > 50) {
      return res.status(400).json({
        success: false,
        message: 'Department name cannot exceed 50 characters.',
        errors: { name: 'Department name cannot exceed 50 characters' }
      });
    }

    // Check duplicate (case-insensitive)
    const exists = DEPARTMENTS_CATALOG.some(
      (d) => d.name.toLowerCase() === trimmedName.toLowerCase()
    );

    if (exists) {
      return res.status(400).json({
        success: false,
        message: `Department '${trimmedName}' already exists in the organizational directory.`,
        errors: { name: 'Department already exists' }
      });
    }

    const newDept = {
      name: trimmedName,
      desc: (desc && typeof desc === 'string' && desc.trim()) 
        ? desc.trim() 
        : 'Operational department domain and team responsibilities.',
      icon: (icon && typeof icon === 'string' && icon.trim()) ? icon.trim() : 'building-2',
      color: (color && typeof color === 'string' && color.trim()) ? color.trim() : '#2563EB',
      isCustom: true
    };

    DEPARTMENTS_CATALOG.push(newDept);
    addAllowedDepartment(trimmedName);
    if (Employee.addDepartment) {
      Employee.addDepartment(trimmedName);
    }

    return res.status(201).json({
      success: true,
      message: `Department '${trimmedName}' created successfully.`,
      data: newDept
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to create department: ' + error.message
    });
  }
};

/**
 * DELETE /api/departments/:name
 * Removes a department from the organizational catalog
 */
const deleteDepartment = async (req, res) => {
  try {
    const { name } = req.params;
    if (!name || typeof name !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'Department name is required.'
      });
    }

    const trimmedName = name.trim();
    const index = DEPARTMENTS_CATALOG.findIndex(
      (d) => d.name.toLowerCase() === trimmedName.toLowerCase()
    );

    removeAllowedDepartment(trimmedName);
    if (Employee.removeDepartment) {
      Employee.removeDepartment(trimmedName);
    }

    if (index === -1) {
      return res.status(200).json({
        success: true,
        message: `Department '${trimmedName}' deleted successfully.`,
        data: { name: trimmedName }
      });
    }

    // Check if any employees currently belong to this department
    const employeeCount = await Employee.countDocuments({ department: trimmedName });
    const force = req.query.force === 'true';

    if (employeeCount > 0 && !force) {
      return res.status(400).json({
        success: false,
        hasEmployees: true,
        employeeCount,
        message: `Cannot delete department '${trimmedName}' because it contains ${employeeCount} active employee(s). Please reassign them first or confirm force deletion.`
      });
    }

    // Remove from catalog
    const removedDept = DEPARTMENTS_CATALOG.splice(index, 1)[0];

    return res.status(200).json({
      success: true,
      message: `Department '${trimmedName}' deleted successfully.`,
      data: removedDept
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to delete department: ' + error.message
    });
  }
};

module.exports = {
  getDepartments,
  createDepartment,
  deleteDepartment,
  DEPARTMENTS_CATALOG
};
