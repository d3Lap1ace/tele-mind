import type { CommandHandler, TelegramMessage } from '../types';
import { logger } from '../../logger';

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
 * /clear command handler
 * Clears conversation history for the user
 */
export const clearCommand: CommandHandler = async (msg, _args) => {
  const { getWhitelistService } = await import('../../services/whitelist');
  const whitelist = getWhitelistService();

  const userId = msg.from.id;
  const userName = formatUserName(msg);
  const chatId = msg.chat.id;

  logger.info({ userId, userName, chatId }, 'Clear command received');

  // Check if user is allowed
  if (!whitelist.isUserAllowed(userId)) {
    await msgReply(
      msg,
      'Sorry, you are not authorized to use this bot. Please contact the administrator.'
    );
    return;
  }

  // Clear conversation history
  const { getConversationService } = await import('../../services/conversation');
  const conversationService = getConversationService();
  conversationService.clearHistory(userId.toString());

  const clearMessage = `
🗑️ *Conversation Cleared*

Your conversation history has been cleared successfully.

Starting fresh! Feel free to send a new message anytime. 🚀
`;

  await msgReply(msg, clearMessage);
  logger.info({ userId, userName }, 'Conversation history cleared');
};

/**
 * Helper function to reply to a message
 */
async function msgReply(msg: TelegramMessage, text: string): Promise<void> {
  try {
    const { getTelegramBot } = await import('../bot');
    const bot = getTelegramBot();
    await bot.sendMessage(msg.chat.id, text, { parse_mode: 'Markdown' });
  } catch (error) {
    logger.error({ error, chatId: msg.chat.id }, 'Failed to send clear message');
  }
}
