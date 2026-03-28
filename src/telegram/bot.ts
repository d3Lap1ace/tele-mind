import TelegramBot from 'node-telegram-bot-api';
import { getConfig } from '../config';
import { logger } from '../logger';
import { getWhitelistService } from '../services/whitelist';
import { commands, getCommand } from './commands';
import { handleMessage } from './handlers/message';
import type { TelegramUpdate } from './types';

/**
 * Telegram Bot Service
 * Manages bot lifecycle and update handling
 */
class TelegramBotService {
  private bot: TelegramBot | null = null;
  private isPolling = false;
  private config = getConfig();

  /**
   * Initialize the bot with token
   */
  initialize(): void {
    if (this.bot) {
      logger.warn('Bot already initialized');
      return;
    }

    const token = this.config.TELEGRAM_BOT_TOKEN;

    if (!token) {
      throw new Error('TELEGRAM_BOT_TOKEN is required');
    }

    // Create bot instance with polling
    this.bot = new TelegramBot(token, {
      polling: false, // We'll start polling manually
    });

    logger.info({ botUsername: this.bot.options.username }, 'Telegram Bot initialized');
  }

  /**
   * Get the bot instance
   */
  getBot(): TelegramBot {
    if (!this.bot) {
      throw new Error('Bot not initialized. Call initialize() first.');
    }
    return this.bot;
  }

  /**
   * Start polling for updates
   */
  async startPolling(): Promise<void> {
    if (!this.bot) {
      throw new Error('Bot not initialized. Call initialize() first.');
    }

    if (this.isPolling) {
      logger.warn('Polling already started');
      return;
    }

    const options = {
      timeout: this.config.TELEGRAM_POLLING_TIMEOUT,
    };

    logger.info({ options }, 'Starting bot polling');

    this.bot.on('polling_error', (error) => {
      logger.error({ error: error.message }, 'Polling error');
    });

    this.bot.on('message', async (msg) => {
      await this.handleUpdate({ updateId: 0, message: msg } as TelegramUpdate);
    });

    // Start polling
    await this.bot.startPolling(options);
    this.isPolling = true;

    logger.info('Bot polling started successfully');
  }

  /**
   * Stop polling
   */
  async stopPolling(): Promise<void> {
    if (!this.bot || !this.isPolling) {
      return;
    }

    logger.info('Stopping bot polling');

    await this.bot.stopPolling();
    this.isPolling = false;

    logger.info('Bot polling stopped');
  }

  /**
   * Handle incoming update
   */
  private async handleUpdate(update: TelegramUpdate): Promise<void> {
    try {
      const msg = update.message;

      if (!msg || !msg.text) {
        return;
      }

      const userId = msg.from.id;
      const chatId = msg.chat.id;
      const text = msg.text;

      // Check whitelist
      const whitelist = getWhitelistService();
      if (!whitelist.isUserAllowed(userId)) {
        logger.debug({ userId, chatId }, 'User not in whitelist, ignoring message');
        return;
      }

      // Check if message is a command
      if (text.startsWith('/')) {
        await this.handleCommand(msg);
      } else {
        // Handle regular message
        await handleMessage(msg);
      }
    } catch (error) {
      logger.error({ error, update }, 'Error handling update');
    }
  }

  /**
   * Handle command messages
   */
  private async handleCommand(msg: any): Promise<void> {
    const text = msg.text;
    const parts = text.split(' ');
    const commandName = parts[0].replace('/', '').split('@')[0]; // Remove / and username mentions
    const args = parts.slice(1);

    logger.debug({ command: commandName, args, userId: msg.from.id }, 'Command received');

    const command = getCommand(commandName);

    if (!command) {
      logger.debug({ command: commandName }, 'Unknown command');
      return;
    }

    // Check admin-only commands
    if (command.adminOnly) {
      const whitelist = getWhitelistService();
      if (!whitelist.isAdmin(msg.from.id)) {
        logger.warn({ userId: msg.from.id, command: commandName }, 'Unauthorized admin command attempt');
        await this.getBot().sendMessage(msg.chat.id, 'This command is restricted to administrators.');
        return;
      }
    }

    try {
      await command.handler(msg, args);
    } catch (error) {
      logger.error({ error, command: commandName, userId: msg.from.id }, 'Error executing command');

      // Send error message to user
      try {
        await this.getBot().sendMessage(
          msg.chat.id,
          'Sorry, an error occurred while executing this command. Please try again later.'
        );
      } catch (sendError) {
        logger.error({ error: sendError, chatId: msg.chat.id }, 'Failed to send error message');
      }
    }
  }

  /**
   * Get bot information
   */
  async getBotInfo(): Promise<TelegramBot.GetMeResult> {
    return await this.getBot().getMe();
  }

  /**
   * Clean shutdown
   */
  async shutdown(): Promise<void> {
    logger.info('Shutting down Telegram bot service');

    await this.stopPolling();

    if (this.bot) {
      this.bot = null;
    }

    logger.info('Telegram bot service shut down');
  }
}

// Singleton instance
let botService: TelegramBotService | null = null;

export function initTelegramBot(): TelegramBotService {
  if (!botService) {
    botService = new TelegramBotService();
    botService.initialize();
  }
  return botService;
}

export function getTelegramBotService(): TelegramBotService {
  if (!botService) {
    throw new Error('Telegram bot not initialized. Call initTelegramBot() first.');
  }
  return botService;
}

export function getTelegramBot(): TelegramBot {
  return getTelegramBotService().getBot();
}

/**
 * Start the bot (convenience function)
 */
export async function startBot(): Promise<void> {
  const service = initTelegramBot();
  await service.startPolling();

  // Log bot info
  try {
    const botInfo = await service.getBotInfo();
    logger.info({
      id: botInfo.id,
      username: botInfo.username,
      firstName: botInfo.first_name,
    }, 'Bot information');
  } catch (error) {
    logger.error({ error }, 'Failed to get bot information');
  }
}

/**
 * Stop the bot (convenience function)
 */
export async function stopBot(): Promise<void> {
  if (botService) {
    await botService.shutdown();
    botService = null;
  }
}
