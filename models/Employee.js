const mongoose = require('mongoose');

const DEPARTMENTS = ['IT', 'HR', 'Finance', 'Marketing', 'Sales', 'Operations'];
const MAX_SALARY = 100000000; // 10 Crore INR limit

const addDepartment = (deptName) => {
  if (deptName && typeof deptName === 'string') {
    const trimmed = deptName.trim();
    if (!DEPARTMENTS.includes(trimmed)) {
      DEPARTMENTS.push(trimmed);
    }
  }
};

const removeDepartment = (deptName) => {
  if (deptName && typeof deptName === 'string') {
    const trimmed = deptName.trim().toLowerCase();
    const idx = DEPARTMENTS.findIndex((d) => d.toLowerCase() === trimmed);
    if (idx !== -1) {
      DEPARTMENTS.splice(idx, 1);
    }
  }
};

const employeeSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Employee full name is required'],
      trim: true,
      minlength: [2, 'Name must be at least 2 characters long'],
      maxlength: [100, 'Name cannot exceed 100 characters']
    },
    department: {
      type: String,
      required: [true, 'Department is required'],
      trim: true,
      validate: {
        validator: function (v) {
          return DEPARTMENTS.includes(v);
        },
        message: function (props) {
          return `Invalid department: ${props.value}. Allowed: ` + DEPARTMENTS.join(', ');
        }
      }
    },
    role: {
      type: String,
      required: [true, 'Job role is required'],
      trim: true,
      minlength: [2, 'Job role must be at least 2 characters long'],
      maxlength: [100, 'Job role cannot exceed 100 characters']
    },
    salary: {
      type: Number,
      required: [true, 'Monthly salary is required'],
      min: [0, 'Monthly salary cannot be negative'],
      max: [MAX_SALARY, `Monthly salary cannot exceed ₹${MAX_SALARY.toLocaleString('en-IN')}`],
      validate: {
        validator: function (v) {
          return Number.isFinite(v) && !isNaN(v);
        },
        message: 'Salary must be a valid finite number'
      }
    },
    joinDate: {
      type: Date,
      required: [true, 'Joining date is required'],
      validate: {
        validator: function (v) {
          if (!v || isNaN(new Date(v).getTime())) return false;
          // Normalize today's date to end of day to prevent timezone boundary issues
          const endOfToday = new Date();
          endOfToday.setHours(23, 59, 59, 999);
          return new Date(v) <= endOfToday;
        },
        message: 'Joining date cannot be set in the future'
      }
    }
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: function (doc, ret) {
        ret.id = ret._id;
        delete ret.__v;
        return ret;
      }
    },
    toObject: {
      virtuals: true,
      transform: function (doc, ret) {
        ret.id = ret._id;
        delete ret.__v;
        return ret;
      }
    }
  }
);

// Indexes for high-performance searching, filtering, and sorting
employeeSchema.index({ name: 1 });
employeeSchema.index({ department: 1 });
employeeSchema.index({ role: 1 });
employeeSchema.index({ salary: 1 });
employeeSchema.index({ joinDate: 1 });
employeeSchema.index({ createdAt: -1 });

// Export allowed departments constant for validators
employeeSchema.statics.DEPARTMENTS = DEPARTMENTS;
employeeSchema.statics.MAX_SALARY = MAX_SALARY;
employeeSchema.statics.addDepartment = addDepartment;
employeeSchema.statics.removeDepartment = removeDepartment;

const Employee = mongoose.model('Employee', employeeSchema);
Employee.addDepartment = addDepartment;
Employee.removeDepartment = removeDepartment;
Employee.DEPARTMENTS = DEPARTMENTS;

module.exports = Employee;
