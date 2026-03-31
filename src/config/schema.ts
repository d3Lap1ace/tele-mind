import { z } from 'zod';

/**
 * Configuration schema with validation using Zod
 * This ensures all required environment variables are present and correctly typed
 */
export const configSchema = z.object({
  // Telegram Configuration
  TELEGRAM_BOT_TOKEN: z.string().min(1, 'Telegram bot token is required'),

  // LLM Provider
  LLM_PROVIDER: z.enum(['openai', 'anthropic', 'azure', 'google'], {
    errorMap: () => ({ message: 'LLM provider must be one of: openai, anthropic, azure, google' }),
  }),

  // OpenAI Configuration
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_MODEL: z.string().default('gpt-4o-mini'),
  OPENAI_API_BASE: z.string().url().default('https://api.openai.com/v1'),
  OPENAI_MAX_TOKENS: z.coerce.number().int().positive().default(4096),
  OPENAI_TEMPERATURE: z.coerce.number().min(0).max(2).default(0.7),

  // Anthropic Configuration
  ANTHROPIC_API_KEY: z.string().optional(),
  ANTHROPIC_MODEL: z.string().default('claude-3-5-sonnet-20241022'),
  ANTHROPIC_MAX_TOKENS: z.coerce.number().int().positive().default(4096),
  ANTHROPIC_TEMPERATURE: z.coerce.number().min(0).max(1).default(0.7),

  // Azure OpenAI Configuration
  AZURE_OPENAI_API_KEY: z.string().optional(),
  AZURE_OPENAI_ENDPOINT: z.string().url().optional(),
  AZURE_OPENAI_DEPLOYMENT: z.string().optional(),
  AZURE_OPENAI_API_VERSION: z.string().default('2024-02-15-preview'),

  // Google Gemini Configuration
  GEMINI_API_KEY: z.string().optional(),
  GEMINI_MODEL: z.string().default('gemini-2.0-flash-exp'),
  GEMINI_MAX_TOKENS: z.coerce.number().int().positive().default(4096),
  GEMINI_TEMPERATURE: z.coerce.number().min(0).max(2).default(0.7),

  // Bot Behavior
  LLM_SYSTEM_PROMPT: z.string().default(
    'You are a helpful AI assistant. Please provide clear, concise, and accurate responses.'
  ),
  MAX_CONVERSATION_HISTORY: z.coerce.number().int().min(0).default(20),
  LLM_REQUEST_TIMEOUT: z.coerce.number().int().positive().default(60000),
  LLM_MAX_RETRIES: z.coerce.number().int().min(0).default(3),
  LLM_RETRY_DELAY: z.coerce.number().int().min(0).default(1000),

  // Access Control
  ALLOWED_USER_IDS: z.string().default(''),
  ADMIN_USER_IDS: z.string().default(''),

  // Server Configuration
  HEALTH_CHECK_PORT: z.coerce.number().int().positive().max(65535).default(3000),
  HEALTH_CHECK_HOST: z.string().default('0.0.0.0'),

  // Logging
  LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).default('info'),
  LOG_FORMAT: z.enum(['json', 'pretty']).default('pretty'),

  // Polling
  TELEGRAM_POLLING_TIMEOUT: z.coerce.number().int().min(0).default(30),

  // Environment
  NODE_ENV: z.enum(['development', 'production', 'test']).default('production'),
});

export type Config = z.infer<typeof configSchema>;
