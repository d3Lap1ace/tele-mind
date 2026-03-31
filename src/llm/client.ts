import axios, { type AxiosInstance, type AxiosError } from 'axios';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { getConfig } from '../config';
import {
  type Message,
  type LLMRequestOptions,
  type LLMResponse,
  LLMError,
  LLMTimeoutError,
  LLMRateLimitError,
  LLMAuthenticationError,
} from './types';

/**
 * LLM Provider Client Factory
 * Abstracts different LLM providers behind a unified interface
 */
export class LLMClient {
  private client?: AxiosInstance;
  private geminiClient?: GoogleGenerativeAI;
  private provider: string;
  private model: string;
  private maxTokens: number;
  private temperature: number;
  private timeout: number;
  private maxRetries: number;
  private retryDelay: number;

  constructor() {
    const config = getConfig();

    this.provider = config.LLM_PROVIDER;
    this.maxTokens = config.OPENAI_MAX_TOKENS;
    this.temperature = config.OPENAI_TEMPERATURE;
    this.timeout = config.LLM_REQUEST_TIMEOUT;
    this.maxRetries = config.LLM_MAX_RETRIES;
    this.retryDelay = config.LLM_RETRY_DELAY;

    // Initialize client based on provider
    if (this.provider === 'google') {
      this.initializeGemini(config);
    } else {
      this.initializeAxios(config);
    }

    // Set model based on provider
    this.model = this.getModelName(config);
  }

  private initializeGemini(config: ReturnType<typeof getConfig>): void {
    if (!config.GEMINI_API_KEY) {
      throw new LLMAuthenticationError('GEMINI_API_KEY is required for Google provider');
    }
    this.geminiClient = new GoogleGenerativeAI(config.GEMINI_API_KEY);
    this.maxTokens = config.GEMINI_MAX_TOKENS;
    this.temperature = config.GEMINI_TEMPERATURE;
  }

  private initializeAxios(_config: ReturnType<typeof getConfig>): void {
    const baseURL = this.getBaseURL();
    const headers = this.getHeaders();

    this.client = axios.create({
      baseURL,
      headers,
      timeout: this.timeout,
    });
  }

  private getBaseURL(): string {
    const config = getConfig();

    switch (this.provider) {
      case 'openai':
        return config.OPENAI_API_BASE;
      case 'anthropic':
        return 'https://api.anthropic.com/v1';
      case 'azure':
        return `${config.AZURE_OPENAI_ENDPOINT}/openai/deployments/${config.AZURE_OPENAI_DEPLOYMENT}`;
      default:
        throw new LLMError(`Unsupported provider: ${this.provider}`);
    }
  }

  private getHeaders(): Record<string, string> {
    const config = getConfig();

    switch (this.provider) {
      case 'openai':
        return {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${config.OPENAI_API_KEY}`,
        };
      case 'anthropic':
        return {
          'Content-Type': 'application/json',
          'x-api-key': config.ANTHROPIC_API_KEY!,
          'anthropic-version': '2023-06-01',
        };
      case 'azure':
        return {
          'Content-Type': 'application/json',
          'api-key': config.AZURE_OPENAI_API_KEY!,
        };
      default:
        return { 'Content-Type': 'application/json' };
    }
  }

  private getModelName(config: ReturnType<typeof getConfig>): string {
    switch (this.provider) {
      case 'openai':
        return config.OPENAI_MODEL;
      case 'anthropic':
        return config.ANTHROPIC_MODEL;
      case 'azure':
        return config.AZURE_OPENAI_DEPLOYMENT!;
      case 'google':
        return config.GEMINI_MODEL;
      default:
        return 'unknown';
    }
  }

  /**
   * Build request payload for provider
   */
  private buildPayload(options: LLMRequestOptions): any {
    const config = getConfig();

    switch (this.provider) {
      case 'openai':
      case 'azure':
        return {
          model: this.model,
          messages: options.messages.map((m) => ({ role: m.role, content: m.content })),
          max_tokens: options.maxTokens || this.maxTokens,
          temperature: options.temperature ?? this.temperature,
        };

      case 'anthropic':
        const systemMsg = options.messages.find((m) => m.role === 'system');
        const conversation = options.messages.filter((m) => m.role !== 'system');

        return {
          model: this.model,
          system: systemMsg?.content || config.LLM_SYSTEM_PROMPT,
          messages: conversation.map((m) => ({ role: m.role, content: m.content })),
          max_tokens: options.maxTokens || config.ANTHROPIC_MAX_TOKENS,
          temperature: options.temperature ?? config.ANTHROPIC_TEMPERATURE,
        };

      default:
        throw new LLMError(`Unsupported provider: ${this.provider}`);
    }
  }

  /**
   * Convert messages to Gemini format
   */
  private convertToGeminiMessages(messages: Message[]): Array<{ role: string; parts: Array<{ text: string }> }> {
    return messages
      .filter((m) => m.role !== 'system')
      .map((m) => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }],
      }));
  }

  /**
   * Extract system prompt from messages
   */
  private extractSystemPrompt(messages: Message[]): string | undefined {
    const systemMsg = messages.find((m) => m.role === 'system');
    return systemMsg?.content;
  }

  /**
   * Make LLM API call with retry logic
   */
  async chat(options: LLMRequestOptions): Promise<LLMResponse> {
    if (this.provider === 'google') {
      return this.chatWithGemini(options);
    }
    return this.chatWithAxios(options);
  }

  /**
   * Chat using Gemini SDK
   */
  private async chatWithGemini(options: LLMRequestOptions): Promise<LLMResponse> {
    const config = getConfig();
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        if (!this.geminiClient) {
          throw new LLMAuthenticationError('Gemini client not initialized');
        }

        const model = this.geminiClient.getGenerativeModel({
          model: this.model,
          systemInstruction: this.extractSystemPrompt(options.messages) || config.LLM_SYSTEM_PROMPT,
        });

        const chatSession = model.startChat({
          history: this.convertToGeminiMessages(options.messages.slice(0, -1)),
          generationConfig: {
            maxOutputTokens: options.maxTokens || this.maxTokens,
            temperature: options.temperature ?? this.temperature,
          },
        });

        const lastMessage = options.messages[options.messages.length - 1];
        const result = await chatSession.sendMessage(lastMessage.content);
        const response = await result.response;
        const content = response.text();

        return {
          content,
          model: this.model,
          usage: {
            promptTokens: response.usageMetadata?.promptTokenCount || 0,
            completionTokens: response.usageMetadata?.candidatesTokenCount || 0,
            totalTokens: response.usageMetadata?.totalTokenCount || 0,
          },
        };
      } catch (error) {
        lastError = this.handleError(error);

        // Don't retry on authentication errors
        if (lastError instanceof LLMAuthenticationError) {
          throw lastError;
        }

        // Don't retry on the last attempt
        if (attempt < this.maxRetries) {
          // Exponential backoff
          const delay = this.retryDelay * Math.pow(2, attempt);
          await this.sleep(delay);
        }
      }
    }

    throw lastError || new LLMError('Max retries exceeded');
  }

  /**
   * Chat using Axios (for OpenAI, Anthropic, Azure)
   */
  private async chatWithAxios(options: LLMRequestOptions): Promise<LLMResponse> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        if (!this.client) {
          throw new LLMError('Axios client not initialized');
        }

        const payload = this.buildPayload(options);
        const endpoint = this.getEndpoint();

        const response = await this.client.post(endpoint, payload);

        const content = this.extractResponse(response.data);
        const usage = this.extractUsage(response.data);

        return {
          content,
          model: this.model,
          usage,
        };
      } catch (error) {
        lastError = this.handleError(error);

        // Don't retry on authentication errors
        if (lastError instanceof LLMAuthenticationError) {
          throw lastError;
        }

        // Don't retry on the last attempt
        if (attempt < this.maxRetries) {
          // Exponential backoff
          const delay = this.retryDelay * Math.pow(2, attempt);
          await this.sleep(delay);
        }
      }
    }

    throw lastError || new LLMError('Max retries exceeded');
  }

  /**
   * Extract response content from provider response
   */
  private extractResponse(data: any): string {
    switch (this.provider) {
      case 'openai':
      case 'azure':
        return data.choices?.[0]?.message?.content || '';

      case 'anthropic':
        return data.content?.[0]?.text || '';

      default:
        return '';
    }
  }

  /**
   * Extract usage information from provider response
   */
  private extractUsage(data: any): LLMResponse['usage'] {
    try {
      switch (this.provider) {
        case 'openai':
        case 'azure':
          const usage = data.usage;
          if (usage) {
            return {
              promptTokens: usage.prompt_tokens || 0,
              completionTokens: usage.completion_tokens || 0,
              totalTokens: usage.total_tokens || 0,
            };
          }
          break;

        case 'anthropic':
          const anthropicUsage = data.usage;
          if (anthropicUsage) {
            return {
              promptTokens: anthropicUsage.input_tokens || 0,
              completionTokens: anthropicUsage.output_tokens || 0,
              totalTokens: (anthropicUsage.input_tokens || 0) + (anthropicUsage.output_tokens || 0),
            };
          }
          break;
      }
    } catch {
      // Ignore usage extraction errors
    }
    return undefined;
  }

  /**
   * Sleep for specified milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Get API endpoint for provider
   */
  private getEndpoint(): string {
    const config = getConfig();

    switch (this.provider) {
      case 'openai':
        return '/chat/completions';
      case 'anthropic':
        return '/messages';
      case 'azure':
        return `/chat/completions?api-version=${config.AZURE_OPENAI_API_VERSION}`;
      default:
        throw new LLMError(`Unsupported provider: ${this.provider}`);
    }
  }

  /**
   * Handle and classify errors from API calls
   */
  private handleError(error: unknown): LLMError {
    // Handle Gemini errors
    if (error instanceof Error) {
      const errorMessage = error.message.toLowerCase();

      if (errorMessage.includes('timeout') || errorMessage.includes('timed out')) {
        return new LLMTimeoutError('Request timeout');
      }

      if (errorMessage.includes('quota') || errorMessage.includes('rate limit') || errorMessage.includes('429')) {
        return new LLMRateLimitError('Rate limit exceeded');
      }

      if (errorMessage.includes('api key') || errorMessage.includes('authentication') || errorMessage.includes('401')) {
        return new LLMAuthenticationError('Invalid API key or authentication failed');
      }

      return new LLMError(error.message);
    }

    // Handle Axios errors
    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError<any>;

      // Check for timeout
      if (axiosError.code === 'ECONNABORTED' || axiosError.message.includes('timeout')) {
        return new LLMTimeoutError('Request timeout');
      }

      // Check for rate limiting
      if (axiosError.response?.status === 429) {
        return new LLMRateLimitError('Rate limit exceeded');
      }

      // Check for authentication errors
      if (axiosError.response?.status === 401) {
        return new LLMAuthenticationError('Invalid API key or authentication failed');
      }

      // Extract error message from response
      const message =
        axiosError.response?.data?.error?.message ||
        axiosError.response?.data?.message ||
        axiosError.message ||
        'Unknown API error';

      return new LLMError(
        message,
        axiosError.response?.data?.error?.code,
        axiosError.response?.status
      );
    }

    if (error instanceof LLMError) {
      return error;
    }

    return new LLMError(error instanceof Error ? error.message : 'Unknown error');
  }

  /**
   * Create a new conversation with system prompt
   */
  createConversation(systemPrompt?: string): Message[] {
    const config = getConfig();
    const messages: Message[] = [];

    if (systemPrompt || config.LLM_SYSTEM_PROMPT) {
      messages.push({
        role: 'system',
        content: systemPrompt || config.LLM_SYSTEM_PROMPT,
        timestamp: Date.now(),
      });
    }

    return messages;
  }
}

// Singleton instance
let clientInstance: LLMClient | null = null;

export function getLLMClient(): LLMClient {
  if (!clientInstance) {
    clientInstance = new LLMClient();
  }
  return clientInstance;
}
