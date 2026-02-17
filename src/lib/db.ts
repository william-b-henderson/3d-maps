import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "@/lib/schema";
import * as relations from "@/lib/relations";

/**
 * postgres.js client connected to Supabase's pooled endpoint.
 *
 * `prepare: false` is required for Supabase's PgBouncer (transaction mode)
 * since prepared statements aren't supported through the connection pooler.
 */
const client = postgres(process.env.DATABASE_URL!, { prepare: false });

/**
 * Drizzle ORM database instance.
 *
 * Includes the full schema and relations for type-safe queries
 * via `db.query.<table>` (relational query API) or `db.select()` (SQL-like API).
 */
export const db = drizzle(client, { schema: { ...schema, ...relations } });
