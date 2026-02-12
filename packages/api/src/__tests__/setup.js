import dotenv from 'dotenv';
dotenv.config();

// Override for test environment
process.env.NODE_ENV = 'test';
