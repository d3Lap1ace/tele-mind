import { getConfig } from '../config';
import type { Message } from '../llm/types';

/**
 * In-memory conversation store
 * In production, this should be replaced with a database (PostgreSQL, Redis, etc.)
 */
interface ConversationStore {
  [userId: string]: {
    messages: Message[];
    lastActivity: number;
  };
}

/**
 * Conversation Service
 * Manages conversation history and context for each user
 */
export class ConversationService {
  private store: ConversationStore = {};
  private maxHistory: number;
  private ttl: number; // Time to live in milliseconds (24 hours default)

  constructor() {
    const config = getConfig();
    this.maxHistory = config.MAX_CONVERSATION_HISTORY;
    this.ttl = 24 * 60 * 60 * 1000; // 24 hours

    // Clean up expired conversations every hour
    setInterval(() => this.cleanup(), 60 * 60 * 1000);
  }

  /**
   * Get conversation history for a user
   */
  getHistory(userId: string): Message[] {
    const conversation = this.store[userId];

    if (!conversation) {
      return [];
    }

    // Update last activity
    conversation.lastActivity = Date.now();

    return conversation.messages;
  }

  /**
   * Add a message to the conversation history
   */
  addMessage(userId: string, role: 'user' | 'assistant', content: string): void {
    if (!this.store[userId]) {
      this.store[userId] = {
        messages: [],
        lastActivity: Date.now(),
      };
    }

    const message: Message = {
      role,
      content,
      timestamp: Date.now(),
    };

    this.store[userId].messages.push(message);
    this.store[userId].lastActivity = Date.now();

    // Trim history if it exceeds max length
    if (this.store[userId].messages.length > this.maxHistory) {
      // Keep system messages if any, then trim from the beginning
      const systemMessages = this.store[userId].messages.filter((m) => m.role === 'system');
      const otherMessages = this.store[userId].messages.filter((m) => m.role !== 'system');
      const trimmed = otherMessages.slice(-this.maxHistory);

      this.store[userId].messages = [...systemMessages, ...trimmed];
    }
  }

  /**
   * Clear conversation history for a user
   */
  clearHistory(userId: string): void {
    delete this.store[userId];
  }

  /**
   * Check if a conversation exists for a user
   */
  hasConversation(userId: string): boolean {
    return !!this.store[userId];
  }

  /**
   * Get the size of conversation history
   */
  getHistorySize(userId: string): number {
    return this.store[userId]?.messages.length || 0;
  }

  /**
   * Clean up expired conversations
   */
  private cleanup(): void {
    const now = Date.now();
    let cleanedCount = 0;

    for (const userId in this.store) {
      if (now - this.store[userId].lastActivity > this.ttl) {
        delete this.store[userId];
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      const { logger } = require('../logger');
      logger.info({ count: cleanedCount }, 'Cleaned up expired conversations');
    }
  }

  /**
   * Get statistics about the conversation store
   */
  getStats(): { totalUsers: number; totalMessages: number } {
    let totalMessages = 0;

    for (const userId in this.store) {
      totalMessages += this.store[userId].messages.length;
    }

    return {
      totalUsers: Object.keys(this.store).length,
      totalMessages,
    };
  }

  /**
   * Reset the entire store (useful for testing)
   */
  reset(): void {
    this.store = {};
  }
}

// Singleton instance
let conversationService: ConversationService | null = null;

export function getConversationService(): ConversationService {
  if (!conversationService) {
    conversationService = new ConversationService();
  }
  return conversationService;
}
