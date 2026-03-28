import { getConfig } from '../config';

/**
 * Access Control Service
 * Manages user whitelisting and admin permissions
 */
export class WhitelistService {
  private allowedUsers: Set<number>;
  private adminUsers: Set<number>;
  private whitelistEnabled: boolean;

  constructor() {
    const config = getConfig();

    // Parse allowed user IDs from environment variable
    const allowedIds = config.ALLOWED_USER_IDS.split(',')
      .map((id) => id.trim())
      .filter((id) => id.length > 0)
      .map((id) => parseInt(id, 10));

    this.allowedUsers = new Set(allowedIds);
    this.whitelistEnabled = allowedIds.length > 0;

    // Parse admin user IDs from environment variable
    const adminIds = config.ADMIN_USER_IDS.split(',')
      .map((id) => id.trim())
      .filter((id) => id.length > 0)
      .map((id) => parseInt(id, 10));

    this.adminUsers = new Set(adminIds);
  }

  /**
   * Check if a user is allowed to use the bot
   * Returns true if whitelist is disabled or user is in the whitelist
   */
  isUserAllowed(userId: number): boolean {
    if (!this.whitelistEnabled) {
      return true;
    }

    return this.allowedUsers.has(userId);
  }

  /**
   * Check if a user is an admin
   */
  isAdmin(userId: number): boolean {
    return this.adminUsers.has(userId);
  }

  /**
   * Get the list of allowed users
   */
  getAllowedUsers(): number[] {
    return Array.from(this.allowedUsers);
  }

  /**
   * Get the list of admin users
   */
  getAdminUsers(): number[] {
    return Array.from(this.adminUsers);
  }

  /**
   * Add a user to the whitelist (runtime only, not persisted)
   */
  addToWhitelist(userId: number): void {
    this.allowedUsers.add(userId);
    this.whitelistEnabled = true;
  }

  /**
   * Remove a user from the whitelist (runtime only, not persisted)
   */
  removeFromWhitelist(userId: number): void {
    this.allowedUsers.delete(userId);

    if (this.allowedUsers.size === 0) {
      this.whitelistEnabled = false;
    }
  }

  /**
   * Check if whitelist is enabled
   */
  isEnabled(): boolean {
    return this.whitelistEnabled;
  }
}

// Singleton instance
let whitelistService: WhitelistService | null = null;

export function getWhitelistService(): WhitelistService {
  if (!whitelistService) {
    whitelistService = new WhitelistService();
  }
  return whitelistService;
}
