/** @type {import('drizzle-kit').Config} */
export default {
  schema: './src/db/schema.js',
  out: './src/db/migrations',
  dialect: 'turso',
  dbCredentials: {
    url: process.env.TURSO_DATABASE_URL,
    authToken: process.env.TURSO_AUTH_TOKEN,
  },
};
