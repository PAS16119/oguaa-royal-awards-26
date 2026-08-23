import { neon } from '@neondatabase/serverless';

if (!process.env.DATABASE_URL) {
  console.warn('DATABASE_URL is not set — API routes that touch the database will fail.');
}

export const sql = neon(process.env.DATABASE_URL);
