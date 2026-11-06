import 'reflect-metadata';
import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';

// Load environment variables from .env by default
dotenv.config();

const isProd =
  process.env.STAGE === 'prod' || process.env.NODE_ENV === 'production';
const databaseSsl = process.env.PGSSLMODE === 'require' || isProd;

// For DigitalOcean/Azure managed Postgres, SSL is required in prod.
// We mirror the Nest config: enable SSL and don't require CA validation by default.
const sslExtra = databaseSsl
  ? { ssl: { rejectUnauthorized: false } }
  : undefined;

const dataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST || process.env.PGHOST,
  port: +(process.env.DB_PORT || process.env.PGPORT || 5432),
  username: process.env.DB_USERNAME || process.env.PGUSER,
  password: process.env.DB_PASSWORD || process.env.PGPASSWORD,
  database: process.env.DB_NAME || process.env.PGDATABASE,
  ssl: databaseSsl,
  extra: sslExtra,
  // Use globs for entities/migrations when running CLI in TS
  entities: ['src/**/*.entity{.ts,.js}'],
  migrations: ['src/migrations/*{.ts,.js}'],
  synchronize: false,
  // logging: true,
});

export default dataSource;
