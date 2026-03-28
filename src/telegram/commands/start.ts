import type { CommandHandler, TelegramMessage } from '../types';
import { getWhitelistService } from '../../services/whitelist';
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
 * /start command handler
 * Initializes the bot and provides welcome message
 */
export const startCommand: CommandHandler = async (msg, _args) => {
  const { getWhitelistService } = await import('../../services/whitelist');
  const whitelist = getWhitelistService();

  const userId = msg.from.id;
  const userName = formatUserName(msg);
  const chatId = msg.chat.id;

  logger.info({ userId, userName, chatId }, 'Start command received');

  // Check if user is allowed
  if (!whitelist.isUserAllowed(userId)) {
    await msgReply(
      msg,
      'Sorry, you are not authorized to use this bot. Please contact the administrator.'
    );
    logger.warn({ userId, userName }, 'Unauthorized access attempt');
    return;
  }

  const welcomeMessage = `
🤖 *Welcome to TeleMind AI Assistant*

Hello ${userName}! I'm your AI-powered assistant, ready to help you with:

• Answering questions on various topics
• Creative writing and brainstorming
• Code explanations and debugging
• General conversation and assistance

*Available Commands:*
/start - Show this welcome message
/help - Display help information
/clear - Clear conversation history

Just send me a message and I'll do my best to assist you! 🚀
`;

  await msgReply(msg, welcomeMessage);
};

/**
 * Helper function to reply to a message
 * This avoids circular dependencies by importing TelegramBot dynamically
 */
async function msgReply(msg: TelegramMessage, text: string): Promise<void> {
  try {
    // Import dynamically to avoid circular dependency
    const { getTelegramBot } = await import('../bot');
    const bot = getTelegramBot();

    await bot.sendMessage(msg.chat.id, text, { parse_mode: 'Markdown' });
  } catch (error) {
    logger.error({ error, chatId: msg.chat.id }, 'Failed to send start message');
  }
}
