/**
 * Message role types for conversation history
 */
export type MessageRole = 'system' | 'user' | 'assistant';

/**
 * Message structure for LLM conversations
 */
export interface Message {
  role: MessageRole;
  content: string;
  timestamp?: number;
}

/**
 * LLM request parameters
 */
export interface LLMRequestOptions {
  messages: Message[];
  maxTokens?: number;
  temperature?: number;
  stream?: boolean;
}

/**
 * LLM response structure
 */
export interface LLMResponse {
  content: string;
  model: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

/**
 * LLM error types
 */
export class LLMError extends Error {
  constructor(
    message: string,
    public code?: string,
    public statusCode?: number
  ) {
    super(message);
    this.name = 'LLMError';
  }
}

export class LLMTimeoutError extends LLMError {
  constructor(message: string) {
    super(message, 'TIMEOUT');
    this.name = 'LLMTimeoutError';
  }
}

export class LLMRateLimitError extends LLMError {
  constructor(message: string) {
    super(message, 'RATE_LIMIT', 429);
    this.name = 'LLMRateLimitError';
  }
}

export class LLMAuthenticationError extends LLMError {
  constructor(message: string) {
    super(message, 'AUTHENTICATION', 401);
    this.name = 'LLMAuthenticationError';
  }
}
