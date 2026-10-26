const express = require('express');
const router = express.Router();
const employeeController = require('../controllers/employeeController');
const departmentController = require('../controllers/departmentController');
const {
  validateEmployeePayload,
  validateObjectIdParam,
  validateQueryParams
} = require('../validators/employeeValidator');

// Health check endpoint
router.get('/health', employeeController.getHealth);

// Department Catalog routes
router.route('/departments')
  .get(departmentController.getDepartments)
  .post(departmentController.createDepartment);

router.route('/departments/:name')
  .delete(departmentController.deleteDepartment);

// Optional summary stats endpoint
router.get('/employees/stats/summary', employeeController.getStats);

// Employee CRUD routes
router.route('/employees')
  .get(validateQueryParams, employeeController.getEmployees)
  .post(validateEmployeePayload(false), employeeController.createEmployee);

router.route('/employees/:id')
  .get(validateObjectIdParam('id'), employeeController.getEmployeeById)
  .put(
    validateObjectIdParam('id'),
    validateEmployeePayload(true),
    employeeController.updateEmployee
  )
  .delete(validateObjectIdParam('id'), employeeController.deleteEmployee);

module.exports = router;
