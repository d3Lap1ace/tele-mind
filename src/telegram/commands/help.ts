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
 * /help command handler
 * Displays help information and available commands
 */
export const helpCommand: CommandHandler = async (msg, _args) => {
  const { getWhitelistService } = await import('../../services/whitelist');
  const whitelist = getWhitelistService();

  const userId = msg.from.id;
  const userName = formatUserName(msg);
  const chatId = msg.chat.id;

  logger.info({ userId, userName, chatId }, 'Help command received');

  // Check if user is allowed
  if (!whitelist.isUserAllowed(userId)) {
    await msgReply(
      msg,
      'Sorry, you are not authorized to use this bot. Please contact the administrator.'
    );
    return;
  }

  const isAdmin = whitelist.isAdmin(userId);
  const userNameDisplay = userName;

  let helpMessage = `
📚 *TeleMind AI Assistant - Help*

Hello ${userNameDisplay}! Here's how to use this bot:

*Basic Commands:*
/start - Initialize the bot and see welcome message
/help - Display this help message
/clear - Clear your conversation history

*Using the Bot:*
• Simply send any text message to chat with the AI
• The bot maintains conversation context for better responses
• Use /clear to start a fresh conversation

*Features:*
✅ Multi-turn conversations with context memory
✅ Support for various LLM providers (OpenAI, Anthropic, Azure)
✅ User access control for security
✅ Error handling and automatic retries
`;

  if (isAdmin) {
    helpMessage += `
*Admin Commands:*
/stats - Show bot usage statistics
`;

    const { getConversationService } = await import('../../services/conversation');
    const conversationService = getConversationService();
    const stats = conversationService.getStats();

    helpMessage += `
*Current Stats:*
👥 Active users: ${stats.totalUsers}
💬 Total messages: ${stats.totalMessages}
`;
  }

  helpMessage += `
*Need Assistance?*
If you encounter any issues or have questions, please contact the administrator.

🚀 *Powered by TeleMind*
`;

  await msgReply(msg, helpMessage);
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
    logger.error({ error, chatId: msg.chat.id }, 'Failed to send help message');
  }
}
