import { Pool } from "pg";

import { databaseConfig } from "../config/database.config";
import { logger } from "../logger/logger";

// Initialize the PostgreSQL connection pool using the database configuration
export const pool = new Pool(databaseConfig);

// Log a message when a new database connection is established
pool.on("connect", () => {
  logger.info("Connected to PostgreSQL via Docker network");
});

// Handle unexpected errors from idle database clients
pool.on("error", (err) => {
  logger.error({ err }, "Unexpected error on idle database client");
  process.exit(-1);
});
