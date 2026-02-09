/**
 * SpockAI Configuration Loader
 * Handles loading, saving, and validating configuration
 */

import { readFile, writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { join, dirname } from 'path';
import { homedir } from 'os';
import type { SpockAIConfig, OpenClawConfig } from '../types/config.js';
import type { ValidationResult } from '../types/index.js';
import { logger } from '../utils/logger.js';

const DEFAULT_CONFIG_PATH = join(homedir(), '.spockai', 'config.json');

// Default configuration values
const DEFAULT_SPOCKAI_CONFIG: SpockAIConfig = {
  notifications: {
    channel: 'telegram',
    telegram: { botToken: '', chatId: '' },
    teams: { webhookUrl: '' },
    digestInterval: 5,
    rules: []
  },
  email: {
    accounts: [],
    globalRules: {
      vipSenders: [],
      priorityKeywords: ['URGENT', 'ACTION REQUIRED', 'CRITICAL', 'ASAP', 'IMMEDIATE']
    },
    syncInterval: 5
  },
  calendar: {
    sources: [],
    defaultWindow: 'today'
  },
  beans: {
    scanPaths: [],
    scanInterval: 5,
    enabled: true
  },
  services: {
    samanage: { enabled: false, baseUrl: '', apiKey: '' },
    monday: { enabled: false, apiToken: '' },
    syncInterval: 15
  }
};

export class ConfigLoader {
  private configPath: string;
  private config: OpenClawConfig | null = null;

  constructor(configPath: string = DEFAULT_CONFIG_PATH) {
    this.configPath = configPath;
  }

  /**
   * Load configuration from disk
   */
  async load(): Promise<SpockAIConfig> {
    try {
      if (!existsSync(this.configPath)) {
        logger.info('Config file not found, creating default configuration');
        await this.initializeConfig();
      }

      const content = await readFile(this.configPath, 'utf-8');
      this.config = JSON.parse(content) as OpenClawConfig;

      // Ensure spockai section exists with defaults
      if (!this.config.spockai) {
        this.config.spockai = { ...DEFAULT_SPOCKAI_CONFIG };
        await this.save();
      }

      return this.config.spockai;
    } catch (error) {
      logger.error('Failed to load configuration', { error });
      throw new Error(`Configuration load failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Save configuration to disk
   */
  async save(): Promise<void> {
    if (!this.config) {
      throw new Error('No configuration loaded to save');
    }

    try {
      const dir = dirname(this.configPath);
      if (!existsSync(dir)) {
        await mkdir(dir, { recursive: true });
      }

      await writeFile(this.configPath, JSON.stringify(this.config, null, 2), 'utf-8');
      logger.info('Configuration saved successfully');
    } catch (error) {
      logger.error('Failed to save configuration', { error });
      throw new Error(`Configuration save failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get SpockAI configuration
   */
  getSpockAIConfig(): SpockAIConfig {
    if (!this.config?.spockai) {
      throw new Error('Configuration not loaded. Call load() first.');
    }
    return this.config.spockai;
  }

  /**
   * Update SpockAI configuration
   */
  async updateSpockAIConfig(updates: Partial<SpockAIConfig>): Promise<SpockAIConfig> {
    if (!this.config) {
      await this.load();
    }

    this.config!.spockai = {
      ...this.config!.spockai,
      ...updates
    };

    await this.save();
    return this.config!.spockai;
  }

  /**
   * Validate configuration
   */
  validate(): ValidationResult {
    const errors: string[] = [];
    const config = this.config?.spockai;

    if (!config) {
      return { valid: false, errors: ['Configuration not loaded'] };
    }

    // Validate notification config
    if (config.notifications.channel === 'telegram') {
      if (!config.notifications.telegram?.botToken) {
        errors.push('Telegram bot token is required when using Telegram notifications');
      }
      if (!config.notifications.telegram?.chatId) {
        errors.push('Telegram chat ID is required when using Telegram notifications');
      }
    }

    if (config.notifications.channel === 'teams') {
      if (!config.notifications.teams?.webhookUrl) {
        errors.push('Teams webhook URL is required when using Teams notifications');
      }
    }

    // Validate email accounts
    for (const account of config.email.accounts) {
      if (!account.email) {
        errors.push(`Email account "${account.name}" is missing email address`);
      }
      if (account.syncInterval < 1 || account.syncInterval > 60) {
        errors.push(`Email account "${account.name}" has invalid sync interval (must be 1-60 minutes)`);
      }
    }

    // Validate calendar sources
    for (const source of config.calendar.sources) {
      if (!source.calendarId) {
        errors.push(`Calendar "${source.name}" is missing calendar ID`);
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Initialize default configuration file
   */
  private async initializeConfig(): Promise<void> {
    const dir = dirname(this.configPath);
    if (!existsSync(dir)) {
      await mkdir(dir, { recursive: true });
    }

    this.config = {
      spockai: { ...DEFAULT_SPOCKAI_CONFIG }
    };

    await this.save();
  }
}

// Singleton instance for easy access
let configLoaderInstance: ConfigLoader | null = null;

export function getConfigLoader(configPath?: string): ConfigLoader {
  if (!configLoaderInstance || configPath) {
    configLoaderInstance = new ConfigLoader(configPath);
  }
  return configLoaderInstance;
}
