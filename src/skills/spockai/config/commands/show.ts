/**
 * SpockAI Config Show Command
 * Display current configuration
 */

import type { CommandResult } from '../../types/index.js';
import type { CommandContext } from '../../base/skill.js';
import { configLogger } from '../../utils/logger.js';

type ConfigSection = 'email' | 'calendar' | 'beans' | 'notifications' | 'services' | 'all';

interface ShowResult {
  section: ConfigSection;
  config: Record<string, unknown>;
}

/**
 * Config show command handler
 */
export async function showCommand(
  args: string[],
  context: CommandContext
): Promise<CommandResult<ShowResult>> {
  try {
    const section = (args[0]?.toLowerCase() || 'all') as ConfigSection;
    const fullConfig = context.config;

    let configToShow: Record<string, unknown>;
    let sectionTitle: string;

    if (section === 'all') {
      configToShow = sanitizeConfig(fullConfig);
      sectionTitle = 'All Configuration';
    } else if (section in fullConfig) {
      configToShow = sanitizeConfig({ [section]: fullConfig[section] });
      sectionTitle = `${capitalize(section)} Configuration`;
    } else {
      return {
        success: false,
        error: `Unknown section: ${section}. Available: email, calendar, beans, notifications, services`
      };
    }

    const message = formatConfig(sectionTitle, configToShow);

    return {
      success: true,
      data: { section, config: configToShow },
      message
    };
  } catch (error) {
    configLogger.error('Failed to show config', { error });
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to show config'
    };
  }
}

/**
 * Sanitize config by masking sensitive values
 */
function sanitizeConfig(config: Record<string, unknown>): Record<string, unknown> {
  const sensitiveKeys = [
    'apiToken', 'apiKey', 'accessToken', 'refreshToken',
    'botToken', 'secret', 'password', 'webhookUrl'
  ];

  const sanitize = (obj: unknown): unknown => {
    if (obj === null || obj === undefined) {
      return obj;
    }

    if (Array.isArray(obj)) {
      return obj.map(sanitize);
    }

    if (typeof obj === 'object') {
      const result: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
        if (sensitiveKeys.some(sk => key.toLowerCase().includes(sk.toLowerCase()))) {
          result[key] = value ? '***REDACTED***' : undefined;
        } else {
          result[key] = sanitize(value);
        }
      }
      return result;
    }

    return obj;
  };

  return sanitize(config) as Record<string, unknown>;
}

/**
 * Format config for display
 */
function formatConfig(title: string, config: Record<string, unknown>): string {
  let message = `**${title}**\n\n`;

  const formatValue = (value: unknown, indent: number = 0): string => {
    const prefix = '  '.repeat(indent);

    if (value === null || value === undefined) {
      return `${prefix}_not set_`;
    }

    if (Array.isArray(value)) {
      if (value.length === 0) {
        return `${prefix}_empty_`;
      }
      return value.map((v, i) => `${prefix}${i + 1}. ${formatValue(v, 0)}`).join('\n');
    }

    if (typeof value === 'object') {
      const lines: string[] = [];
      for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
        if (typeof v === 'object' && v !== null && !Array.isArray(v)) {
          lines.push(`${prefix}**${k}**:`);
          lines.push(formatValue(v, indent + 1));
        } else {
          lines.push(`${prefix}${k}: ${formatValue(v, 0)}`);
        }
      }
      return lines.join('\n');
    }

    if (typeof value === 'boolean') {
      return value ? '✅ enabled' : '❌ disabled';
    }

    return String(value);
  };

  message += formatValue(config, 0);
  message += '\n\n_Use `/config show <section>` to view a specific section_';

  return message;
}

function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}
