const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

process.env.NODE_ENV = 'test';

const app = require('../server');
const Employee = require('../models/Employee');

let mongoServer;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  await mongoose.connect(uri);
});

afterAll(async () => {
  await mongoose.disconnect();
  if (mongoServer) {
    await mongoServer.stop();
  }
});

beforeEach(async () => {
  await Employee.deleteMany({});
});

describe('PeopleDesk API Test Suite', () => {
  const validEmployee = {
    name: 'Rohit Satras',
    department: 'IT',
    role: 'Full Stack Engineer',
    salary: 85000,
    joinDate: '2023-05-10'
  };

  // 1. Health Check
  test('1. GET /api/health - Returns 200 and healthy status', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.status).toBe('UP');
  });

  // 2. Create Employee
  test('2. POST /api/employees - Creates employee with valid data', async () => {
    const res = await request(app)
      .post('/api/employees')
      .send(validEmployee);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.name).toBe(validEmployee.name);
    expect(res.body.data.department).toBe('IT');
  });

  // 3. Validation: Missing Name
  test('3. POST /api/employees - Fails with 400 when name is missing', async () => {
    const { name, ...payload } = validEmployee;
    const res = await request(app)
      .post('/api/employees')
      .send(payload);

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.errors).toHaveProperty('name');
  });

  // 4. Validation: Invalid Department
  test('4. POST /api/employees - Fails with 400 for invalid department', async () => {
    const res = await request(app)
      .post('/api/employees')
      .send({ ...validEmployee, department: 'Robotics' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.errors).toHaveProperty('department');
  });

  // 5. Validation: Future Joining Date
  test('5. POST /api/employees - Fails with 400 if joinDate is in the future', async () => {
    const res = await request(app)
      .post('/api/employees')
      .send({ ...validEmployee, joinDate: '2099-12-31' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.errors).toHaveProperty('joinDate');
  });

  // 6. Validation: Negative Salary
  test('6. POST /api/employees - Fails with 400 for negative salary', async () => {
    const res = await request(app)
      .post('/api/employees')
      .send({ ...validEmployee, salary: -5000 });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.errors).toHaveProperty('salary');
  });

  // 7. Get All Employees
  test('7. GET /api/employees - Retrieves list of employees', async () => {
    await Employee.create(validEmployee);
    const res = await request(app).get('/api/employees');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.length).toBe(1);
    expect(res.body.summary).toBeDefined();
  });

  // 8. Filter by Department
  test('8. GET /api/employees?department=IT - Filters by department', async () => {
    await Employee.create(validEmployee);
    await Employee.create({
      name: 'Priya Sharma',
      department: 'HR',
      role: 'HR Specialist',
      salary: 60000,
      joinDate: '2023-01-10'
    });

    const res = await request(app).get('/api/employees?department=IT');
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(1);
    expect(res.body.data[0].department).toBe('IT');
  });

  // 9. Search by Name
  test('9. GET /api/employees?search=Rohit - Performs case-insensitive search', async () => {
    await Employee.create(validEmployee);
    const res = await request(app).get('/api/employees?search=rohit');

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(1);
    expect(res.body.data[0].name).toBe('Rohit Satras');
  });

  // 10. Sort by Salary
  test('10. GET /api/employees?sortBy=salary&order=desc - Sorts employees', async () => {
    await Employee.create({ ...validEmployee, name: 'Emp 1', salary: 50000 });
    await Employee.create({ ...validEmployee, name: 'Emp 2', salary: 90000 });

    const res = await request(app).get('/api/employees?sortBy=salary&order=desc');
    expect(res.status).toBe(200);
    expect(res.body.data[0].salary).toBe(90000);
    expect(res.body.data[1].salary).toBe(50000);
  });

  // 11. Get Single Employee by ID
  test('11. GET /api/employees/:id - Retrieves employee by ID', async () => {
    const created = await Employee.create(validEmployee);
    const res = await request(app).get(`/api/employees/${created._id}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.name).toBe(validEmployee.name);
  });

  // 12. Invalid ObjectId Format
  test('12. GET /api/employees/:id - Returns 400 for malformed ObjectId', async () => {
    const res = await request(app).get('/api/employees/123-invalid-id');
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  // 13. Non-existent Employee ID
  test('13. GET /api/employees/:id - Returns 404 for non-existent ID', async () => {
    const nonExistentId = new mongoose.Types.ObjectId();
    const res = await request(app).get(`/api/employees/${nonExistentId}`);
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });

  // 14. Update Employee
  test('14. PUT /api/employees/:id - Updates employee details', async () => {
    const created = await Employee.create(validEmployee);
    const res = await request(app)
      .put(`/api/employees/${created._id}`)
      .send({
        name: 'Rohit Satras',
        department: 'IT',
        role: 'Lead Architect',
        salary: 110000,
        joinDate: '2023-05-10'
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.role).toBe('Lead Architect');
    expect(res.body.data.salary).toBe(110000);
  });

  // 15. Update Non-existent Employee
  test('15. PUT /api/employees/:id - Returns 404 when updating non-existent ID', async () => {
    const nonExistentId = new mongoose.Types.ObjectId();
    const res = await request(app)
      .put(`/api/employees/${nonExistentId}`)
      .send(validEmployee);

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });

  // 16. Delete Employee
  test('16. DELETE /api/employees/:id - Deletes an employee', async () => {
    const created = await Employee.create(validEmployee);
    const res = await request(app).delete(`/api/employees/${created._id}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const exists = await Employee.findById(created._id);
    expect(exists).toBeNull();
  });

  // 17. Delete Non-existent Employee
  test('17. DELETE /api/employees/:id - Returns 404 for deleting non-existent ID', async () => {
    const nonExistentId = new mongoose.Types.ObjectId();
    const res = await request(app).delete(`/api/employees/${nonExistentId}`);
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });

  // 18. Summary Stats
  test('18. GET /api/employees/stats/summary - Calculates global summary metrics', async () => {
    await Employee.create({ ...validEmployee, salary: 50000, department: 'IT' });
    await Employee.create({ ...validEmployee, salary: 70000, department: 'HR' });

    const res = await request(app).get('/api/employees/stats/summary');
    expect(res.status).toBe(200);
    expect(res.body.data.totalEmployees).toBe(2);
    expect(res.body.data.totalPayroll).toBe(120000);
    expect(res.body.data.departmentCount).toBe(2);
  });

  // 19. Departments Catalog
  test('19. GET /api/departments - Returns standard department catalog', async () => {
    const res = await request(app).get('/api/departments');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.count).toBeGreaterThan(0);
  });
});
