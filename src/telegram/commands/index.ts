import type { Command } from '../types';
import { startCommand } from './start';
import { helpCommand } from './help';
import { clearCommand } from './clear';

/**
 * Registry of all available commands
 * Add new commands here to register them
 */
export const commands: Command[] = [
  {
    name: 'start',
    description: 'Initialize the bot and see welcome message',
    handler: startCommand,
  },
  {
    name: 'help',
    description: 'Display help information and available commands',
    handler: helpCommand,
  },
  {
    name: 'clear',
    description: 'Clear your conversation history',
    handler: clearCommand,
  },
];

/**
 * Get a command by name
 */
export function getCommand(name: string): Command | undefined {
  return commands.find((cmd) => cmd.name === name);
}

/**
 * Get all command names (for help text, etc.)
 */
export function getCommandNames(): string[] {
  return commands.map((cmd) => cmd.name);
}

/**
 * Get commands description text
 */
export function getCommandsDescription(): string {
  return commands
    .map((cmd) => `/${cmd.name}${cmd.adminOnly ? ' (admin only)' : ''} - ${cmd.description}`)
    .join('\n');
}
