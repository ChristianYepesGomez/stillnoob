import 'dotenv/config';

/** @type {import('drizzle-kit').Config} */
export default {
  schema: './src/db/schema.js',
  out: './src/db/migrations',
  dialect: 'turso',
  dbCredentials: {
    url: process.env.TURSO_DATABASE_URL || 'file:./data/stillnoob.db',
    authToken: process.env.TURSO_AUTH_TOKEN,
  },
};
