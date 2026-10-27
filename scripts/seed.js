const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
const dns = require('dns');
const Employee = require('../models/Employee');

dotenv.config({ path: path.join(__dirname, '../.env') });

const SAMPLE_EMPLOYEES = [
  {
    name: 'Aarav Sharma',
    department: 'IT',
    role: 'Senior Full Stack Engineer',
    salary: 145000,
    joinDate: new Date('2022-03-15')
  },
  {
    name: 'Priya Nair',
    department: 'HR',
    role: 'Lead People Operations',
    salary: 95000,
    joinDate: new Date('2021-08-10')
  },
  {
    name: 'Vikram Malhotra',
    department: 'Finance',
    role: 'Senior Financial Analyst',
    salary: 120000,
    joinDate: new Date('2023-01-20')
  },
  {
    name: 'Ananya Deshmukh',
    department: 'Marketing',
    role: 'Digital Marketing Strategist',
    salary: 88000,
    joinDate: new Date('2023-06-01')
  },
  {
    name: 'Rohan Patel',
    department: 'Sales',
    role: 'Enterprise Account Executive',
    salary: 110000,
    joinDate: new Date('2022-11-12')
  },
  {
    name: 'Sneha Roy',
    department: 'Operations',
    role: 'Supply Chain Operations Manager',
    salary: 105000,
    joinDate: new Date('2021-05-18')
  },
  {
    name: 'Karan Verma',
    department: 'IT',
    role: 'DevOps & Cloud Specialist',
    salary: 135000,
    joinDate: new Date('2023-09-04')
  },
  {
    name: 'Divya Iyer',
    department: 'Finance',
    role: 'Senior Payroll Accountant',
    salary: 92000,
    joinDate: new Date('2022-07-25')
  }
];

const seedDatabase = async () => {
  const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/peopledesk';

  if (mongoUri.startsWith('mongodb+srv://')) {
    try {
      dns.setServers(['8.8.8.8', '1.1.1.1']);
    } catch (dnsErr) {
      // Fallback silently if OS restricts custom DNS servers
    }
  }

  try {
    const maskedUri = mongoUri.replace(/:([^:@]+)@/, ':****@');
    console.log(`Connecting to MongoDB at: ${maskedUri}`);
    await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 10000 });
    console.log('✅ Connected to MongoDB.');

    const existingCount = await Employee.countDocuments();
    console.log(`Current employee count: ${existingCount}`);

    console.log('Seeding initial sample employee records...');
    await Employee.deleteMany({});
    const inserted = await Employee.insertMany(SAMPLE_EMPLOYEES);

    console.log(`🎉 Successfully seeded ${inserted.length} realistic employee records!`);
    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error during database seeding:', error.message);
    process.exit(1);
  }
};

if (require.main === module) {
  seedDatabase();
}

module.exports = { SAMPLE_EMPLOYEES, seedDatabase };
