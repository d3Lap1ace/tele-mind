import TelegramBot from 'node-telegram-bot-api';
import type { TelegramMessage } from '../types';
import { getWhitelistService } from '../../services/whitelist';
import { getConversationService } from '../../services/conversation';
import { getLLMClient } from '../../llm/client';
import { logger } from '../../logger';
import { getConfig } from '../../config';

/**
 * Format user display name
 */
function formatUserName(msg: TelegramMessage): string {
  const { from } = msg;
  if (from.username) {
    return `@${from.username}`;
  }
  if (from.lastName) {
    return `${from.firstName} ${from.lastName}`;
  }
  return from.firstName;
}

/**
 * Typing indicator helper
 * Shows "typing..." action to user while processing
 */
async function showTypingAction(bot: TelegramBot, chatId: number): Promise<NodeJS.Timeout | null> {
  try {
    // Send typing action immediately
    await bot.sendChatAction(chatId, 'typing');

    // Continue sending typing action every 3 seconds
    return setInterval(async () => {
      try {
        await bot.sendChatAction(chatId, 'typing');
      } catch {
        // Ignore errors for repeated typing actions
      }
    }, 3000);
  } catch {
    return null;
  }
}

/**
 * Stop typing indicator
 */
function stopTypingAction(typingInterval: NodeJS.Timeout | null): void {
  if (typingInterval) {
    clearInterval(typingInterval);
  }
}

/**
 * Handle regular text messages
 * Processes the message through LLM and sends response
 */
export async function handleMessage(msg: TelegramMessage): Promise<void> {
  const userId = msg.from.id;
  const userName = formatUserName(msg);
  const chatId = msg.chat.id;
  const text = msg.text || '';

  logger.info({ userId, userName, chatId, textLength: text.length }, 'Message received');

  // Get services
  const whitelist = getWhitelistService();
  const conversationService = getConversationService();
  const llmClient = getLLMClient();
  const config = getConfig();

  // Check if user is allowed
  if (!whitelist.isUserAllowed(userId)) {
    try {
      const { getTelegramBot } = await import('../bot');
      const bot = getTelegramBot();
      await bot.sendMessage(
        chatId,
        'Sorry, you are not authorized to use this bot. Please contact the administrator.'
      );
    } catch (error) {
      logger.error({ error, chatId }, 'Failed to send unauthorized message');
    }
    logger.warn({ userId, userName }, 'Unauthorized message attempt');
    return;
  }

  // Ignore empty messages
  if (!text.trim()) {
    return;
  }

  // Get conversation history
  conversationService.getHistory(userId.toString());

  // Add user message to history
  conversationService.addMessage(userId.toString(), 'user', text);

  try {
    // Import bot here to avoid circular dependency
    const { getTelegramBot } = await import('../bot');
    const bot = getTelegramBot();

    // Show typing indicator
    const typingInterval = await showTypingAction(bot, chatId);

    // Prepare messages for LLM
    const messages = conversationService.getHistory(userId.toString());

    // Call LLM with retry logic
    logger.debug({ userId, messageCount: messages.length }, 'Calling LLM');

    const response = await llmClient.chat({
      messages,
      maxTokens: config.OPENAI_MAX_TOKENS,
      temperature: config.OPENAI_TEMPERATURE,
    });

    // Stop typing indicator
    stopTypingAction(typingInterval);

    // Add assistant response to history
    conversationService.addMessage(userId.toString(), 'assistant', response.content);

    // Send response to user
    await bot.sendMessage(chatId, response.content);

    logger.info({
      userId,
      userName,
      responseLength: response.content.length,
      tokensUsed: response.usage?.totalTokens,
    }, 'Message processed successfully');

  } catch (error) {
    logger.error({ error, userId, userName }, 'Failed to process message');

    const { getTelegramBot } = await import('../bot');
    const bot = getTelegramBot();

    // Send appropriate error message based on error type
    let errorMessage = 'Sorry, I encountered an error while processing your message. Please try again.';

    if (error instanceof Error) {
      if (error.message.includes('timeout') || error.message.includes('TIMEOUT')) {
        errorMessage = 'Sorry, the request timed out. Please try again.';
      } else if (error.message.includes('rate limit') || error.message.includes('RATE_LIMIT')) {
        errorMessage = 'Sorry, I\'m receiving too many requests. Please wait a moment and try again.';
      } else if (error.message.includes('authentication') || error.message.includes('401')) {
        errorMessage = 'Authentication error. Please contact the administrator.';
        logger.error({ error: error.message }, 'LLM authentication failed');
      }
    }

    try {
      await bot.sendMessage(chatId, errorMessage);
    } catch (sendError) {
      logger.error({ error: sendError, chatId }, 'Failed to send error message');
    }
  }
}
