const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables from .env if present
dotenv.config({ path: path.join(__dirname, '.env') });

const employeeRoutes = require('./routes/employeeRoutes');
const Employee = require('./models/Employee');
const notFound = require('./middleware/notFound');
const errorHandler = require('./middleware/errorHandler');

const app = express();
const PORT = process.env.PORT || 5000;
const NODE_ENV = process.env.NODE_ENV || 'development';
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:3000';

// 1. Security Headers (Helmet)
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    contentSecurityPolicy: false // Allows easy local frontend testing without CDN script blocks
  })
);

// 2. CORS Configuration
const allowedOrigins = [
  CLIENT_URL,
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'http://localhost:5500',
  'http://127.0.0.1:5500',
  'http://localhost:8080',
  'http://127.0.0.1:8080'
];

app.use(
  cors({
    origin: function (origin, callback) {
      // Allow requests with no origin (e.g. mobile apps, curl, Postman, file://)
      if (!origin) return callback(null, true);
      if (NODE_ENV === 'development' || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error(`CORS blocked request from unauthorized origin: ${origin}`));
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
    credentials: true
  })
);

// 3. Body Parser with Size Limits (Protection against DoS)
app.use(express.json({ limit: '50kb' }));
app.use(express.urlencoded({ extended: true, limit: '50kb' }));

// 4. Rate Limiter (Protection against brute force / API flooding)
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 300, // Max 300 requests per 15 min per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many requests from this IP address. Please try again after 15 minutes.'
  }
});
app.use('/api', limiter);

// 5. Mount API Routes
app.use('/api', employeeRoutes);

// Optional: Serve frontend static files if accessed directly on the backend port
app.use(express.static(path.join(__dirname, '../frontend')));

// 6. 404 Route Handler
app.use(notFound);

// 7. Centralized Global Error Handler
app.use(errorHandler);

// Helper for starting server and connecting to MongoDB
let mongodInstance = null;

const autoSeedIfEmpty = async () => {
  try {
    const count = await Employee.countDocuments();
    if (count === 0) {
      const { SAMPLE_EMPLOYEES } = require('./scripts/seed');
      if (SAMPLE_EMPLOYEES && SAMPLE_EMPLOYEES.length > 0) {
        await Employee.insertMany(SAMPLE_EMPLOYEES);
        console.log(`🌱 Pre-populated database with ${SAMPLE_EMPLOYEES.length} sample employee records.`);
      }
    }
  } catch (err) {
    console.warn('⚠️  Auto-seed notice:', err.message);
  }
};

const connectDB = async () => {
  const isInMemoryFlag = process.argv.includes('--in-memory');
  let mongoUri = process.env.MONGODB_URI;

  if (isInMemoryFlag) {
    try {
      console.log('⚡ Starting embedded MongoDB Memory Server for automated test/demonstration mode...');
      const { MongoMemoryServer } = require('mongodb-memory-server');
      mongodInstance = await MongoMemoryServer.create();
      mongoUri = mongodInstance.getUri();
      console.log(`✅ Embedded MongoDB initialized at: ${mongoUri}`);
      await mongoose.connect(mongoUri);
      console.log(`✅ MongoDB Connected Successfully: ${mongoose.connection.host}/${mongoose.connection.name}`);
      await autoSeedIfEmpty();
      return;
    } catch (err) {
      console.error('❌ Failed to launch embedded MongoDB Memory Server:', err.message);
      process.exit(1);
    }
  }

  if (!mongoUri) {
    mongoUri = 'mongodb://127.0.0.1:27017/peopledesk';
  }

  try {
    console.log(`🔌 Attempting MongoDB connection to: ${mongoUri.replace(/:([^:@]{4})[^:@]*@/, ':****@')}`);
    await mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: 3000
    });
    console.log(`✅ MongoDB Connected Successfully: ${mongoose.connection.host}/${mongoose.connection.name}`);
    await autoSeedIfEmpty();
  } catch (err) {
    console.warn(`\n⚠️  Could not connect to local MongoDB (${err.message})`);
    console.log('⚡ Launching embedded MongoDB Memory Server as zero-setup fallback...');
    try {
      const { MongoMemoryServer } = require('mongodb-memory-server');
      mongodInstance = await MongoMemoryServer.create();
      const baseUri = mongodInstance.getUri();
      const inMemUri = baseUri.endsWith('/') ? `${baseUri}PeopleDesk` : `${baseUri}/PeopleDesk`;
      await mongoose.connect(inMemUri);
      console.log(`✅ Embedded MongoDB Connected Successfully: ${mongoose.connection.host}/${mongoose.connection.name}`);
      await autoSeedIfEmpty();
    } catch (fallbackErr) {
      console.error('❌ MongoDB Connection Failure:');
      console.error(`   Error Message: ${fallbackErr.message}`);
      console.error('   Hint: Ensure local MongoDB service is running (mongod) or provide a valid MONGODB_URI in .env');
    }
  }
};

let server;

// Start HTTP server only if not required as a module in tests
if (process.env.NODE_ENV !== 'test') {
  connectDB().then(() => {
    server = app.listen(PORT, () => {
      console.log(`\n======================================================`);
      console.log(`🚀 PeopleDesk Server running in ${NODE_ENV.toUpperCase()} mode`);
      console.log(`📡 Base API URL: http://localhost:${PORT}/api`);
      console.log(`🩺 Health Check: http://localhost:${PORT}/api/health`);
      console.log(`👥 Employees API: http://localhost:${PORT}/api/employees`);
      console.log(`💻 Frontend Client: http://localhost:${PORT}`);
      if (mongodInstance) {
        const compassUri = mongodInstance.getUri().endsWith('/') ? `${mongodInstance.getUri()}PeopleDesk` : `${mongodInstance.getUri()}/PeopleDesk`;
        console.log(`🧭 MongoDB Compass URI: ${compassUri}`);
      }
      console.log(`======================================================\n`);
    });
  });
}

// Graceful Shutdown
const handleShutdown = async (signal) => {
  console.log(`\n🛑 Received ${signal}. Closing HTTP server and database connections gracefully...`);
  if (server) {
    server.close(() => {
      console.log('🔒 HTTP server closed.');
    });
  }
  if (mongoose.connection.readyState === 1) {
    await mongoose.connection.close();
    console.log('🔒 MongoDB connection closed.');
  }
  if (mongodInstance) {
    await mongodInstance.stop();
    console.log('🔒 Embedded MongoDB Memory Server stopped.');
  }
  process.exit(0);
};

process.on('SIGINT', () => handleShutdown('SIGINT'));
process.on('SIGTERM', () => handleShutdown('SIGTERM'));

module.exports = app;
