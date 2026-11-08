import dotenv from "dotenv";
dotenv.config();

import { z } from "zod";
import { type StringValue } from "ms";

// Defines and validates the required environment variables using Zod
const envSchema = z.object({
  // App configuration
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
  PORT: z.coerce.number().default(3000),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),

  // Database configuration
  DATABASE_URL: z.string().url(),

  // Redis configuration
  REDIS_URL: z.string().url(),

  // Auth configuration
  JWT_SECRET: z.string().min(32, "JWT_SECRET must be at least 32 characters"),
  JWT_EXPIRES_IN: z
    .string()
    .default("15m")
    .transform((value) => value as StringValue),
  JWT_REFRESH_EXPIRES_IN: z
    .string()
    .default("7d")
    .transform((value) => value as StringValue),

  // CORS configuration (client origin, for allowed-origin config)
  CLIENT_URL: z.string().url().default("http://localhost:5173"),

  // Email service configuration (Resend)
  RESEND_API_KEY: z.string().startsWith("re_"),
  EMAIL_FROM: z.string().min(3).default("Quill <beth.t@example.com>"),

  // AI Recommender Service configuration
  AI_SERVICE_URL: z.string().url().default("http://localhost:8000"),

  // Observability & Sentry
  SENTRY_DSN: z.string().url().optional().or(z.literal("")),
  SENTRY_TRACES_SAMPLE_RATE: z.coerce.number().min(0).max(1).default(1.0),
});

// Validates all environment variables at application startup
const parsed = envSchema.safeParse(process.env);

// Stops application startup if any environment variables are invalid
if (!parsed.success) {
  console.error("Invalid environment variables:");
  console.error(JSON.stringify(parsed.error.flatten().fieldErrors, null, 2));
  process.exit(1);
}

// Exports validated and typed environment variables for application-wide use
export const env = parsed.data;

// Convenience flags used throughout the app
export const isProduction = env.NODE_ENV === "production";
export const isDevelopment = env.NODE_ENV === "development";
export const isTest = env.NODE_ENV === "test";
