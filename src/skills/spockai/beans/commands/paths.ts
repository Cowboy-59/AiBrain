/**
 * SpockAI BEANS Paths Command
 * Manage scan paths for BEANS files
 */

import type { CommandResult } from '../../types/index.js';
import type { CommandContext } from '../../base/skill.js';
import type { BeansConfig } from '../types.js';
import { BeansService, createBeansService } from '../service.js';

let beansService: BeansService | null = null;

function getBeansService(config: BeansConfig): BeansService {
  if (!beansService) {
    beansService = createBeansService(config);
  }
  return beansService;
}

interface PathsResult {
  paths: string[];
  action?: 'list' | 'add' | 'remove';
  modifiedPath?: string;
}

/**
 * BEANS paths command handler
 */
export async function pathsCommand(
  args: string[],
  context: CommandContext
): Promise<CommandResult<PathsResult>> {
  const config = context.config.beans as BeansConfig;
  const service = getBeansService(config);

  const action = args[0]?.toLowerCase();

  try {
    // List paths (default)
    if (!action || action === 'list') {
      return listPaths(service);
    }

    // Add path
    if (action === 'add') {
      const path = args.slice(1).join(' ');
      if (!path) {
        return {
          success: false,
          error: 'Please specify a path to add'
        };
      }
      return addPath(service, path);
    }

    // Remove path
    if (action === 'remove' || action === 'rm') {
      const path = args.slice(1).join(' ');
      if (!path) {
        return {
          success: false,
          error: 'Please specify a path to remove'
        };
      }
      return removePath(service, path);
    }

    return {
      success: false,
      error: `Unknown action: ${action}. Use \`list\`, \`add\`, or \`remove\``
    };
  } catch (error) {
    context.logger.error('Failed to manage paths', { error });
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to manage paths'
    };
  }
}

function listPaths(service: BeansService): CommandResult<PathsResult> {
  const paths = service.getScanPaths();

  let message = '**BEANS Scan Paths**\n\n';

  if (paths.length === 0) {
    message += '_No scan paths configured_\n\n';
    message += '_Use `/beans paths add <path>` to add a scan path_';
    return {
      success: true,
      data: { paths, action: 'list' },
      message
    };
  }

  for (let i = 0; i < paths.length; i++) {
    message += `${i + 1}. \`${paths[i]}\`\n`;
  }

  message += `\n_${paths.length} path${paths.length !== 1 ? 's' : ''} configured_\n`;
  message += `_Use \`/beans paths add <path>\` or \`/beans paths remove <path>\`_`;

  return {
    success: true,
    data: { paths, action: 'list' },
    message
  };
}

function addPath(service: BeansService, path: string): CommandResult<PathsResult> {
  const normalizedPath = normalizePath(path);
  const added = service.addScanPath(normalizedPath);

  if (added) {
    return {
      success: true,
      data: {
        paths: service.getScanPaths(),
        action: 'add',
        modifiedPath: normalizedPath
      },
      message: `✅ Added scan path: \`${normalizedPath}\`\n\n_Use \`/beans scan\` to scan this path_`
    };
  }

  return {
    success: false,
    error: `Path already exists: ${normalizedPath}`
  };
}

function removePath(service: BeansService, path: string): CommandResult<PathsResult> {
  const paths = service.getScanPaths();

  // Try exact match first
  let targetPath = path;
  if (!paths.includes(path)) {
    // Try to find by index
    const index = parseInt(path, 10) - 1;
    if (!isNaN(index) && index >= 0 && index < paths.length) {
      targetPath = paths[index];
    } else {
      // Try partial match
      const match = paths.find(p =>
        p.toLowerCase().includes(path.toLowerCase()) ||
        normalizePath(p) === normalizePath(path)
      );
      if (match) {
        targetPath = match;
      }
    }
  }

  const removed = service.removeScanPath(targetPath);

  if (removed) {
    return {
      success: true,
      data: {
        paths: service.getScanPaths(),
        action: 'remove',
        modifiedPath: targetPath
      },
      message: `✅ Removed scan path: \`${targetPath}\``
    };
  }

  return {
    success: false,
    error: `Path not found: ${path}`
  };
}

function normalizePath(path: string): string {
  // Expand ~ to home directory on Unix-like systems
  if (path.startsWith('~')) {
    const home = process.env.HOME || process.env.USERPROFILE || '';
    return path.replace('~', home);
  }
  return path;
}
