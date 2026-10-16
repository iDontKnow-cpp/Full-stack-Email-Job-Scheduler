import dotenv from 'dotenv';
import { z } from 'zod';
import path from 'path';

// Load .env file from project root or backend directory
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config();

const envSchema = z.object({
  PORT: z.coerce.number().default(3001),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  FRONTEND_URL: z.string().default('http://localhost:5173'),

  DATABASE_URL: z.string().default('postgresql://scheduler:scheduler123@localhost:5432/email_scheduler'),

  REDIS_HOST: z.string().default('localhost'),
  REDIS_PORT: z.coerce.number().default(6379),

  GOOGLE_CLIENT_ID: z.string().default(''),
  GOOGLE_CLIENT_SECRET: z.string().default(''),
  GOOGLE_CALLBACK_URL: z.string().default('http://localhost:3001/api/auth/google/callback'),

  JWT_SECRET: z.string().default('your-jwt-secret-change-in-production-super-secure-key'),
  JWT_EXPIRES_IN: z.string().default('7d'),

  SESSION_SECRET: z.string().default('your-session-secret-change-in-production'),

  ETHEREAL_USER: z.string().optional().default(''),
  ETHEREAL_PASS: z.string().optional().default(''),

  WORKER_CONCURRENCY: z.coerce.number().default(5),
  MIN_DELAY_BETWEEN_EMAILS_MS: z.coerce.number().default(2000),

  MAX_EMAILS_PER_HOUR_PER_SENDER: z.coerce.number().default(200),

  ELASTICSEARCH_URL: z.string().default('http://localhost:9200'),

  SLACK_CLIENT_ID: z.string().default(''),
  SLACK_CLIENT_SECRET: z.string().default(''),
  SLACK_REDIRECT_URI: z.string().default('http://localhost:3001/api/slack/callback'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Invalid environment variables:', parsed.error.format());
  throw new Error('Invalid environment configuration');
}

export const env = parsed.data;
export type Env = typeof env;
