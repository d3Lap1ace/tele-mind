import dotenv from 'dotenv';
import { configSchema, type Config } from './schema';

// Load environment variables from .env file
dotenv.config();

/**
 * Load and validate configuration
 * Throws an error if validation fails
 */
export function loadConfig(): Config {
  const rawConfig = {
    TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN,
    LLM_PROVIDER: process.env.LLM_PROVIDER || 'openai',
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    OPENAI_MODEL: process.env.OPENAI_MODEL,
    OPENAI_API_BASE: process.env.OPENAI_API_BASE,
    OPENAI_MAX_TOKENS: process.env.OPENAI_MAX_TOKENS,
    OPENAI_TEMPERATURE: process.env.OPENAI_TEMPERATURE,
    ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
    ANTHROPIC_MODEL: process.env.ANTHROPIC_MODEL,
    ANTHROPIC_MAX_TOKENS: process.env.ANTHROPIC_MAX_TOKENS,
    ANTHROPIC_TEMPERATURE: process.env.ANTHROPIC_TEMPERATURE,
    AZURE_OPENAI_API_KEY: process.env.AZURE_OPENAI_API_KEY,
    AZURE_OPENAI_ENDPOINT: process.env.AZURE_OPENAI_ENDPOINT,
    AZURE_OPENAI_DEPLOYMENT: process.env.AZURE_OPENAI_DEPLOYMENT,
    AZURE_OPENAI_API_VERSION: process.env.AZURE_OPENAI_API_VERSION,
    LLM_SYSTEM_PROMPT: process.env.LLM_SYSTEM_PROMPT,
    MAX_CONVERSATION_HISTORY: process.env.MAX_CONVERSATION_HISTORY,
    LLM_REQUEST_TIMEOUT: process.env.LLM_REQUEST_TIMEOUT,
    LLM_MAX_RETRIES: process.env.LLM_MAX_RETRIES,
    LLM_RETRY_DELAY: process.env.LLM_RETRY_DELAY,
    ALLOWED_USER_IDS: process.env.ALLOWED_USER_IDS || '',
    ADMIN_USER_IDS: process.env.ADMIN_USER_IDS || '',
    HEALTH_CHECK_PORT: process.env.HEALTH_CHECK_PORT,
    HEALTH_CHECK_HOST: process.env.HEALTH_CHECK_HOST,
    LOG_LEVEL: process.env.LOG_LEVEL,
    LOG_FORMAT: process.env.LOG_FORMAT,
    TELEGRAM_POLLING_TIMEOUT: process.env.TELEGRAM_POLLING_TIMEOUT,
    NODE_ENV: process.env.NODE_ENV,
  };

  const result = configSchema.safeParse(rawConfig);

  if (!result.success) {
    const errors = result.error.errors
      .map((e) => `  - ${e.path.join('.')}: ${e.message}`)
      .join('\n');
    throw new Error(`Configuration validation failed:\n${errors}`);
  }

  // Provider-specific API key validation
  const config = result.data;
  const provider = config.LLM_PROVIDER;

  if (provider === 'openai' && !config.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY is required when LLM_PROVIDER is "openai"');
  }
  if (provider === 'anthropic' && !config.ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY is required when LLM_PROVIDER is "anthropic"');
  }
  if (provider === 'azure' && (!config.AZURE_OPENAI_API_KEY || !config.AZURE_OPENAI_ENDPOINT)) {
    throw new Error('AZURE_OPENAI_API_KEY and AZURE_OPENAI_ENDPOINT are required when LLM_PROVIDER is "azure"');
  }

  return config;
}

// Singleton instance
let config: Config | null = null;

export function getConfig(): Config {
  if (!config) {
    config = loadConfig();
  }
  return config;
}

export function resetConfig(): void {
  config = null;
}
