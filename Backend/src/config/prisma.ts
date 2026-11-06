import { PrismaClient } from '../generated/prisma/index.js';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import dotenv from 'dotenv';
dotenv.config();

// Enable clean JSON serialization for BigInt database primary keys
(BigInt.prototype as any).toJSON = function () {
  return this.toString();
};

const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:admin123@localhost:5432/Algo_Trading';

const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

export default prisma;
