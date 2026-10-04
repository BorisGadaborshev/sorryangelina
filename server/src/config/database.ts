import './env';
import { Pool } from 'pg';
import { logger } from '../utils/logger';

const DATABASE_URL = process.env.DATABASE_URL;
const ssl = process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : undefined;

export const pool = new Pool(
  DATABASE_URL
    ? { connectionString: DATABASE_URL, ssl }
    : { ssl }
);

export const connectDB = async (): Promise<void> => {
  const client = await pool.connect();
  client.release();
  logger.info('connected to PostgreSQL');
};
