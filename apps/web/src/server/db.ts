import 'server-only';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';
import { requiredEnv } from './env';
function createDb() {
  const client = postgres(requiredEnv('DATABASE_URL'), {
    prepare: false,
    max: 5,
    idle_timeout: 20,
    connect_timeout: 10,
  });
  return drizzle(client, { schema });
}
let db: ReturnType<typeof createDb> | null = null;
export function getDb() {
  return (db ??= createDb());
}
export type Database = ReturnType<typeof getDb>;
export type Transaction = Parameters<Parameters<Database['transaction']>[0]>[0];
