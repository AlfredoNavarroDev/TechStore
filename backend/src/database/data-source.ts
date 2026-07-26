import 'dotenv/config';
import { DataSource, DataSourceOptions } from 'typeorm';

/**
 * DataSource usado por el TypeORM CLI (migration:generate/run/revert).
 * La app en runtime usa DatabaseModule (TypeOrmModule.forRootAsync) por separado.
 */
export const dataSourceOptions: DataSourceOptions = {
  type: 'postgres',
  url: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }, // requerido por Neon
  entities: ['src/**/*.entity.ts'],
  migrations: ['src/database/migrations/*.ts'],
  synchronize: false,
};

export const AppDataSource = new DataSource(dataSourceOptions);
