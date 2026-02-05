/**
 * SpockAI BEANS Scan Command
 * Scan configured paths for BEANS files
 */

import type { CommandResult } from '../../types/index.js';
import type { CommandContext } from '../../base/skill.js';
import type { BeansConfig, BeansScanResult } from '../types.js';
import { BeansService, createBeansService } from '../service.js';

let beansService: BeansService | null = null;

function getBeansService(config: BeansConfig): BeansService {
  if (!beansService) {
    beansService = createBeansService(config);
  }
  return beansService;
}

interface ScanResult {
  results: BeansScanResult[];
  totalBeans: number;
  totalPriorityOne: number;
}

/**
 * BEANS scan command handler
 */
export async function scanCommand(
  _args: string[],
  context: CommandContext
): Promise<CommandResult<ScanResult>> {
  const config = context.config.beans as BeansConfig;
  const service = getBeansService(config);

  try {
    context.logger.info('Starting BEANS scan');
    const results = await service.scanAllPaths();

    let totalBeans = 0;
    let totalPriorityOne = 0;
    let errors = 0;

    for (const result of results) {
      if (result.error) {
        errors++;
      } else {
        totalBeans += result.beansFound;
        totalPriorityOne += result.priorityOneCount;
      }
    }

    let message = '**BEANS Scan Results**\n\n';

    if (results.length === 0) {
      message += '_No scan paths configured_\n\n';
      message += '_Use `/beans paths add <path>` to add a scan path_';
      return {
        success: true,
        data: { results, totalBeans: 0, totalPriorityOne: 0 },
        message
      };
    }

    for (const result of results) {
      const icon = result.error ? '❌' : '✅';
      message += `${icon} **${shortenPath(result.path)}**\n`;

      if (result.error) {
        message += `   Error: ${result.error}\n`;
      } else {
        message += `   Found: ${result.beansFound} beans`;
        if (result.priorityOneCount > 0) {
          message += ` (🔴 ${result.priorityOneCount} priority 1)`;
        }
        message += '\n';
      }

      message += '\n';
    }

    message += `**Summary**\n`;
    message += `- Total beans: ${totalBeans}\n`;
    message += `- Priority 1: ${totalPriorityOne}\n`;
    if (errors > 0) {
      message += `- Errors: ${errors}\n`;
    }

    if (totalPriorityOne > 0) {
      message += `\n_Use \`/beans\` to view priority 1 items_`;
    }

    return {
      success: true,
      data: { results, totalBeans, totalPriorityOne },
      message
    };
  } catch (error) {
    context.logger.error('Failed to scan BEANS', { error });
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to scan'
    };
  }
}

function shortenPath(path: string): string {
  const normalized = path.replace(/\\/g, '/');
  const parts = normalized.split('/');

  if (parts.length <= 4) return normalized;
  return `${parts[0]}/.../` + parts.slice(-2).join('/');
}
