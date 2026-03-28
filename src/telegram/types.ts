/**
 * Telegram User information
 */
export interface TelegramUser {
  id: number;
  firstName: string;
  lastName?: string;
  username?: string;
  languageCode?: string;
}

/**
 * Telegram Chat information
 */
export interface TelegramChat {
  id: number;
  type: 'private' | 'group' | 'supergroup' | 'channel';
  title?: string;
  username?: string;
  firstName?: string;
  lastName?: string;
}

/**
 * Telegram Message
 */
export interface TelegramMessage {
  messageId: number;
  from: TelegramUser;
  chat: TelegramChat;
  date: number;
  text?: string;
  photo?: any[];
  replyToMessage?: TelegramMessage;
}

/**
 * Telegram Update
 */
export interface TelegramUpdate {
  updateId: number;
  message?: TelegramMessage;
  callbackQuery?: any;
  editedMessage?: TelegramMessage;
}

/**
 * Command handler function type
 */
export type CommandHandler = (msg: TelegramMessage, args: string[]) => Promise<void> | void;

/**
 * Command definition
 */
export interface Command {
  name: string;
  description: string;
  handler: CommandHandler;
  adminOnly?: boolean;
}

/**
 * Bot context passed to handlers
 */
export interface BotContext {
  userId: number;
  chatId: number;
  username?: string;
  isAdmin: boolean;
}
