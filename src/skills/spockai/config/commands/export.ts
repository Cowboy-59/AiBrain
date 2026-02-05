/**
 * SpockAI Config Export Command
 * Export configuration to file
 */

import type { CommandResult } from '../../types/index.js';
import type { CommandContext } from '../../base/skill.js';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { homedir } from 'os';
import { configLogger } from '../../utils/logger.js';

type ExportFormat = 'json' | 'yaml';

interface ExportResult {
  path: string;
  format: ExportFormat;
  size: number;
}

/**
 * Config export command handler
 */
export async function exportCommand(
  args: string[],
  context: CommandContext
): Promise<CommandResult<ExportResult>> {
  try {
    // Parse arguments
    let format: ExportFormat = 'json';
    let includeSecrets = false;

    for (let i = 0; i < args.length; i++) {
      const arg = args[i];
      if (arg === '--format' && args[i + 1]) {
        format = args[i + 1].toLowerCase() as ExportFormat;
        i++;
      } else if (arg === '--include-secrets') {
        includeSecrets = true;
      }
    }

    if (!['json', 'yaml'].includes(format)) {
      return {
        success: false,
        error: 'Invalid format. Use `json` or `yaml`.'
      };
    }

    // Prepare config
    const config = includeSecrets
      ? context.config
      : sanitizeConfig(context.config);

    // Generate filename
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const filename = `spockai-config-${timestamp}.${format}`;

    // Export directory
    const exportDir = join(homedir(), '.openclaw', 'exports');
    await mkdir(exportDir, { recursive: true });

    const exportPath = join(exportDir, filename);

    // Format content
    let content: string;
    if (format === 'json') {
      content = JSON.stringify(config, null, 2);
    } else {
      content = toYaml(config);
    }

    // Write file
    await writeFile(exportPath, content, 'utf-8');

    configLogger.info('Configuration exported', { path: exportPath, format });

    return {
      success: true,
      data: {
        path: exportPath,
        format,
        size: content.length
      },
      message: `✅ **Configuration Exported**

**File**: \`${filename}\`
**Path**: \`${exportPath}\`
**Format**: ${format.toUpperCase()}
**Size**: ${formatSize(content.length)}
${includeSecrets ? '\n⚠️ _Includes sensitive values (encrypted)_' : '\n_Sensitive values redacted_'}`
    };
  } catch (error) {
    configLogger.error('Failed to export config', { error });
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to export config'
    };
  }
}

/**
 * Sanitize config by removing sensitive values
 */
function sanitizeConfig(config: Record<string, unknown>): Record<string, unknown> {
  const sensitiveKeys = [
    'apiToken', 'apiKey', 'accessToken', 'refreshToken',
    'botToken', 'secret', 'password', 'webhookUrl', 'chatId'
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
          // Skip sensitive values entirely in export
          continue;
        }
        result[key] = sanitize(value);
      }
      return result;
    }

    return obj;
  };

  return sanitize(config) as Record<string, unknown>;
}

/**
 * Convert object to YAML (simple implementation)
 */
function toYaml(obj: unknown, indent: number = 0): string {
  const prefix = '  '.repeat(indent);

  if (obj === null || obj === undefined) {
    return 'null';
  }

  if (typeof obj === 'string') {
    // Quote strings with special characters
    if (obj.includes('\n') || obj.includes(':') || obj.includes('#')) {
      return `"${obj.replace(/"/g, '\\"')}"`;
    }
    return obj;
  }

  if (typeof obj === 'number' || typeof obj === 'boolean') {
    return String(obj);
  }

  if (Array.isArray(obj)) {
    if (obj.length === 0) {
      return '[]';
    }
    return obj.map(item => `${prefix}- ${toYaml(item, indent + 1).trimStart()}`).join('\n');
  }

  if (typeof obj === 'object') {
    const entries = Object.entries(obj as Record<string, unknown>);
    if (entries.length === 0) {
      return '{}';
    }

    return entries.map(([key, value]) => {
      if (typeof value === 'object' && value !== null) {
        return `${prefix}${key}:\n${toYaml(value, indent + 1)}`;
      }
      return `${prefix}${key}: ${toYaml(value, indent)}`;
    }).join('\n');
  }

  return String(obj);
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} bytes`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
