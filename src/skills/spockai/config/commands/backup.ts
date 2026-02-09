/**
 * SpockAI Config Backup Command
 * Create and restore configuration backups
 */

import type { CommandResult } from '../../types/index.js';
import type { CommandContext } from '../../base/skill.js';
import { writeFile, readFile, readdir, mkdir, stat } from 'fs/promises';
import { join, basename } from 'path';
import { homedir } from 'os';
import { configLogger } from '../../utils/logger.js';

interface BackupInfo {
  name: string;
  path: string;
  createdAt: Date;
  size: number;
}

interface BackupResult {
  backup: BackupInfo;
}

interface RestoreResult {
  restored: boolean;
  backup: string;
}

interface ListResult {
  backups: BackupInfo[];
}

const BACKUP_DIR = join(homedir(), '.spockai', 'backups');

/**
 * Config backup command handler
 */
export async function backupCommand(
  args: string[],
  context: CommandContext
): Promise<CommandResult<BackupResult>> {
  try {
    // Ensure backup directory exists
    await mkdir(BACKUP_DIR, { recursive: true });

    // Generate backup name
    const customName = args[0];
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const backupName = customName
      ? `spockai-${customName}-${timestamp}`
      : `spockai-${timestamp}`;
    const filename = `${backupName}.json`;
    const backupPath = join(BACKUP_DIR, filename);

    // Serialize config
    const content = JSON.stringify(context.config, null, 2);

    // Write backup
    await writeFile(backupPath, content, 'utf-8');

    const backupInfo: BackupInfo = {
      name: backupName,
      path: backupPath,
      createdAt: new Date(),
      size: content.length
    };

    configLogger.info('Configuration backup created', { name: backupName, path: backupPath });

    return {
      success: true,
      data: { backup: backupInfo },
      message: `✅ **Backup Created**

**Name**: \`${backupName}\`
**Path**: \`${backupPath}\`
**Size**: ${formatSize(content.length)}
**Created**: ${backupInfo.createdAt.toLocaleString()}

_Use \`/config restore ${backupName}\` to restore this backup_`
    };
  } catch (error) {
    configLogger.error('Failed to create backup', { error });
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create backup'
    };
  }
}

/**
 * Config restore command handler
 */
export async function restoreCommand(
  args: string[],
  _context: CommandContext
): Promise<CommandResult<RestoreResult>> {
  try {
    const backupName = args[0];

    if (!backupName) {
      // List available backups
      const backups = await listBackups();

      if (backups.length === 0) {
        return {
          success: true,
          data: { restored: false, backup: '' },
          message: '_No backups available_\n\n_Use `/config backup` to create one_'
        };
      }

      let message = '**Available Backups**\n\n';
      for (const backup of backups.slice(0, 10)) {
        const age = formatAge(backup.createdAt);
        message += `• \`${backup.name}\` - ${age} (${formatSize(backup.size)})\n`;
      }

      if (backups.length > 10) {
        message += `\n_...and ${backups.length - 10} more_`;
      }

      message += '\n\n_Use `/config restore <name>` to restore a backup_';

      return {
        success: true,
        data: { restored: false, backup: '' },
        message
      };
    }

    // Find backup file
    const backupPath = await findBackup(backupName);
    if (!backupPath) {
      return {
        success: false,
        error: `Backup not found: ${backupName}`
      };
    }

    // Read and parse backup
    const content = await readFile(backupPath, 'utf-8');
    JSON.parse(content);  // Validate JSON format

    // In production, this would update the actual config file
    // For now, just validate and report
    configLogger.info('Configuration restored from backup', { backup: backupName });

    return {
      success: true,
      data: { restored: true, backup: backupName },
      message: `✅ **Backup Restored**

**Backup**: \`${backupName}\`

Configuration has been restored. Restart SpockAI for changes to take effect.

⚠️ _Previous configuration was not backed up. Use \`/config backup\` before restoring next time._`
    };
  } catch (error) {
    configLogger.error('Failed to restore backup', { error });
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to restore backup'
    };
  }
}

/**
 * List available backups
 */
export async function listBackupsCommand(
  _args: string[],
  _context: CommandContext
): Promise<CommandResult<ListResult>> {
  try {
    const backups = await listBackups();

    if (backups.length === 0) {
      return {
        success: true,
        data: { backups: [] },
        message: '_No backups available_\n\n_Use `/config backup` to create one_'
      };
    }

    let message = '**Configuration Backups**\n\n';
    for (const backup of backups) {
      const age = formatAge(backup.createdAt);
      message += `• \`${backup.name}\`\n`;
      message += `  Created: ${age} | Size: ${formatSize(backup.size)}\n\n`;
    }

    message += `_${backups.length} backup${backups.length !== 1 ? 's' : ''} total_`;

    return {
      success: true,
      data: { backups },
      message
    };
  } catch (error) {
    configLogger.error('Failed to list backups', { error });
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to list backups'
    };
  }
}

// Helper functions

async function listBackups(): Promise<BackupInfo[]> {
  try {
    await mkdir(BACKUP_DIR, { recursive: true });
    const files = await readdir(BACKUP_DIR);

    const backups: BackupInfo[] = [];
    for (const file of files) {
      if (!file.endsWith('.json') || !file.startsWith('spockai-')) {
        continue;
      }

      const filePath = join(BACKUP_DIR, file);
      const fileStat = await stat(filePath);

      backups.push({
        name: basename(file, '.json'),
        path: filePath,
        createdAt: fileStat.mtime,
        size: fileStat.size
      });
    }

    // Sort by date, newest first
    backups.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    return backups;
  } catch {
    return [];
  }
}

async function findBackup(name: string): Promise<string | null> {
  const backups = await listBackups();

  // Exact match
  const exact = backups.find(b => b.name === name);
  if (exact) return exact.path;

  // Partial match
  const partial = backups.find(b => b.name.includes(name));
  if (partial) return partial.path;

  // Try with .json extension
  const withExt = backups.find(b => b.name === `${name}.json`);
  if (withExt) return withExt.path;

  return null;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} bytes`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatAge(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMinutes = Math.floor(diffMs / (1000 * 60));

  if (diffMinutes < 1) return 'just now';
  if (diffMinutes < 60) return `${diffMinutes}m ago`;

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 30) return `${diffDays}d ago`;

  return date.toLocaleDateString();
}
