import { neon, type NeonQueryFunction } from "@neondatabase/serverless";
import { ConfigError } from "./errors";
import { SCHEMA_STATEMENTS } from "./schema";

type Sql = NeonQueryFunction<false, false>;

let client: Sql | null = null;
let schemaReady: Promise<void> | null = null;

/** The raw Neon HTTP client. Throws a 503 ConfigError if DATABASE_URL is unset. */
export function getSql(): Sql {
  if (client) return client;
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new ConfigError(
      "DATABASE_URL is not set. Add your Neon connection string to .env.local (or the Vercel project's environment variables).",
    );
  }
  client = neon(url);
  return client;
}

/**
 * The Neon client with the schema guaranteed to exist. Each serverless instance
 * applies the (idempotent) DDL once; a failed attempt is retried on the next call.
 */
export async function db(): Promise<Sql> {
  const sql = getSql();
  schemaReady ??= (async () => {
    for (const statement of SCHEMA_STATEMENTS) {
      await sql.query(statement);
    }
  })().catch((error) => {
    schemaReady = null;
    throw error;
  });
  await schemaReady;
  return sql;
}
