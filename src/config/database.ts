import { Pool } from 'pg';
import path from 'path';
import dotenv from 'dotenv';
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

console.log('database.ts loaded. process.env.DATABASE_URL is:', process.env.DATABASE_URL ? process.env.DATABASE_URL.replace(/:[^:@\s]+@/, ':***@') : 'undefined');

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});
