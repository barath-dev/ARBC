import "dotenv/config";
import { z } from "zod/v4";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.coerce.number().default(3000),
  DATABASE_URL: z.string(),
  JWT_SECRET: z.string().default("dev-secret-change-in-production"),
  JWT_EXPIRES_IN: z.string().default("7d"),
  // GitHub App Configuration (Required)
  GH_APP_ID: z.string(),
  GH_APP_PRIVATE_KEY: z.string(),
  GH_CLIENT_ID: z.string(),
  GH_CLIENT_SECRET: z.string(),
  GH_API_URL: z.string().default("https://api.github.com"),
  // 64-char hex string (32 bytes) used to encrypt GitHub access tokens at rest.
  GH_TOKEN_ENCRYPTION_KEY: z.string(),
  // Email / notifications (optional — silently skipped in dev if unset)
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().default(587),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_FROM: z.string().default("noreply@arbc.io"),
  APP_URL: z.string().default("http://localhost:3000"),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("❌ Invalid environment variables:", parsed.error.format());
  process.exit(1);
}

export const env = parsed.data;
