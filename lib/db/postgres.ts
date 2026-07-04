import { Pool, type PoolClient, type QueryResultRow } from "pg";
import { getDatabaseUrl, isPostgresConfigured } from "@/lib/env";

declare global {
  var __tisaPostgresPool: Pool | undefined;
}

function createPool() {
  const connectionString = getDatabaseUrl();
  if (!connectionString) {
    throw new Error("DATABASE_URL is not configured.");
  }

  return new Pool({
    connectionString,
    ssl: connectionString.includes("localhost") || connectionString.includes("127.0.0.1")
      ? false
      : { rejectUnauthorized: false },
  });
}

export function getPostgresPool() {
  if (!isPostgresConfigured()) {
    throw new Error("Plain PostgreSQL mode is not configured yet.");
  }

  if (!global.__tisaPostgresPool) {
    global.__tisaPostgresPool = createPool();
  }

  return global.__tisaPostgresPool;
}

export async function dbQuery<Row extends QueryResultRow = QueryResultRow>(
  text: string,
  params: unknown[] = [],
) {
  return getPostgresPool().query<Row>(text, params);
}

export async function withDbTransaction<T>(
  callback: (client: PoolClient) => Promise<T>,
) {
  const client = await getPostgresPool().connect();

  try {
    await client.query("begin");
    const result = await callback(client);
    await client.query("commit");
    return result;
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}
