import { env } from "./env";

// Database connection pool configuration
export const databaseConfig = {
  // Database connection URL loaded from environment variables
  connectionString: env.DATABASE_URL,

  // Maximum number of connections allowed in the pool
  max: 20,

  // Time (in milliseconds) a connection can remain idle before being closed
  idleTimeoutMillis: 30000,

  // Maximum time (in milliseconds) to wait for a new connection
  connectionTimeoutMillis: 5000,
};
