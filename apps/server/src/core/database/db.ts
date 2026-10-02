import { Pool } from "pg";
import { databaseConfig } from "../config/database.config";
import { logger } from "../logger/logger";

export const pool = new Pool(databaseConfig);

pool.on("connect", () => {
  logger.info("Connected to PostgreSQL via Docker network");
});

pool.on("error", (err) => {
  logger.error({ err }, "Unexpected error on idle database client");
  process.exit(-1);
});