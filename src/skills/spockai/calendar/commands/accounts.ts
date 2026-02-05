/**
 * SpockAI Calendar Accounts Command
 * Display connected calendar sources
 */

import type { CommandResult } from '../../types/index.js';
import type { CommandContext } from '../../base/skill.js';
import type { CalendarStatus } from '../types.js';
import { CalendarService, createCalendarService } from '../service.js';

let calendarService: CalendarService | null = null;

function getCalendarService(): CalendarService {
  if (!calendarService) {
    calendarService = createCalendarService();
  }
  return calendarService;
}

interface AccountsResult {
  accounts: CalendarStatus[];
  count: number;
}

/**
 * Calendar accounts command handler
 */
export async function accountsCommand(
  _args: string[],
  context: CommandContext
): Promise<CommandResult<AccountsResult>> {
  const service = getCalendarService();

  try {
    const accounts = service.getSourceStatuses();

    let message = '**Connected Calendars**\n\n';

    if (accounts.length === 0) {
      message += '_No calendars connected_\n\n';
      message += '_Use `/calendar add google` or `/calendar add microsoft` to connect a calendar_';
      return {
        success: true,
        data: { accounts, count: 0 },
        message
      };
    }

    for (const account of accounts) {
      const statusIcon = account.enabled
        ? (account.lastError ? '⚠️' : '✅')
        : '⏸️';
      const providerIcon = account.provider === 'google' ? '🔵' : '🟢';
      const sharedLabel = account.isShared ? ' (Shared)' : '';

      message += `${statusIcon} ${providerIcon} **${account.name}**${sharedLabel}\n`;
      message += `   ID: \`${account.id.substring(0, 8)}...\`\n`;
      message += `   Events: ${account.eventCount}\n`;

      if (account.lastSync) {
        const syncTime = formatRelativeTime(account.lastSync);
        message += `   Last sync: ${syncTime}\n`;
      }

      if (account.lastError) {
        message += `   ⚠️ Error: ${account.lastError}\n`;
      }

      message += '\n';
    }

    const enabledCount = accounts.filter(a => a.enabled).length;
    message += `_${enabledCount} of ${accounts.length} calendar${accounts.length !== 1 ? 's' : ''} active_`;

    return {
      success: true,
      data: { accounts, count: accounts.length },
      message
    };
  } catch (error) {
    context.logger.error('Failed to list calendar accounts', { error });
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to list accounts'
    };
  }
}

function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMinutes = Math.floor(diffMs / (1000 * 60));

  if (diffMinutes < 1) return 'just now';
  if (diffMinutes < 60) return `${diffMinutes}m ago`;

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;

  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}
