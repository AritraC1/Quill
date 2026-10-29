// DB migration runner: applies the .sql files in src/core/database/migrations
// in filename order, recording each in a `migrations` table. All files are
// idempotent (IF NOT EXISTS / DO blocks), so re-running on a DB that was
// hand-migrated is safe. Usage: bun run --filter quill-server migrate

import path from "node:path";
import fs from "node:fs";
import { pool } from "../core/database/db";
import { logger } from "../core/logger/logger";

const MIGRATIONS_DIR = path.resolve(
  import.meta.dir,
  "core/database/migrations",
);

async function run(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS migrations (
      name       TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  const files = fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  const applied = await pool.query<{ name: string }>(
    "SELECT name FROM migrations",
  );
  const appliedSet = new Set(applied.rows.map((r) => r.name));

  const pending = files.filter((f) => !appliedSet.has(f));
  if (pending.length === 0) {
    logger.info("Migrations up to date");
    return;
  }

  for (const file of pending) {
    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), "utf8");
    logger.info(`Applying ${file}…`);
    try {
      await pool.query(sql);
      await pool.query("INSERT INTO migrations (name) VALUES ($1)", [file]);
      logger.info(`Applied ${file}`);
    } catch (error) {
      logger.error({ error, file }, "Migration failed. Rolling back the run.");
      process.exitCode = 1;
      return;
    }
  }
}

run()
  .then(() => pool.end())
  .catch(async (error) => {
    logger.error({ error }, "Migration runner failed");
    await pool.end();
    process.exitCode = 1;
  });
