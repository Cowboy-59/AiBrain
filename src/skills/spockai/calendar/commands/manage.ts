/**
 * SpockAI Calendar Manage Commands
 * Add, remove, and sync calendar sources
 */

import type { CommandResult } from '../../types/index.js';
import type { CommandContext } from '../../base/skill.js';
import type { CalendarSource, CalendarProvider, CalendarSyncResult } from '../types.js';
import { CalendarService, createCalendarService } from '../service.js';

let calendarService: CalendarService | null = null;

function getCalendarService(): CalendarService {
  if (!calendarService) {
    calendarService = createCalendarService();
  }
  return calendarService;
}

/**
 * Add calendar command handler
 */
export async function addCommand(
  args: string[],
  context: CommandContext
): Promise<CommandResult<CalendarSource>> {
  const service = getCalendarService();

  const provider = args[0]?.toLowerCase();
  if (!provider || !['google', 'microsoft'].includes(provider)) {
    return {
      success: false,
      error: 'Please specify a provider: `google` or `microsoft`'
    };
  }

  try {
    // In production, this would trigger OAuth flow
    // For now, create a placeholder source
    const source = await service.addSource({
      name: `${provider === 'google' ? 'Google' : 'Microsoft'} Calendar`,
      provider: provider as CalendarProvider,
      calendarId: 'primary',
      credentials: {
        accessToken: '',
        refreshToken: '',
        expiresAt: new Date()
      },
      isShared: false,
      enabled: false // Disabled until OAuth completes
    });

    const providerIcon = provider === 'google' ? '🔵' : '🟢';
    let message = `${providerIcon} **Calendar Source Added**\n\n`;
    message += `Provider: ${provider}\n`;
    message += `ID: \`${source.id.substring(0, 8)}...\`\n\n`;
    message += `⚠️ OAuth authentication required before calendar can sync.\n`;
    message += `_Run the OAuth flow to complete setup._`;

    return {
      success: true,
      data: source,
      message
    };
  } catch (error) {
    context.logger.error('Failed to add calendar', { provider, error });
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to add calendar'
    };
  }
}

/**
 * Remove calendar command handler
 */
export async function removeCommand(
  args: string[],
  context: CommandContext
): Promise<CommandResult<{ removed: boolean; id: string }>> {
  const service = getCalendarService();

  const id = args[0];
  if (!id) {
    return {
      success: false,
      error: 'Please specify a calendar ID to remove'
    };
  }

  try {
    // Find by partial ID match
    const sources = service.getSources();
    const source = sources.find(s => s.id.startsWith(id) || s.id === id);

    if (!source) {
      return {
        success: false,
        error: `Calendar not found: ${id}`
      };
    }

    const removed = await service.removeSource(source.id);

    if (removed) {
      return {
        success: true,
        data: { removed: true, id: source.id },
        message: `✅ Calendar **${source.name}** removed successfully`
      };
    } else {
      return {
        success: false,
        error: 'Failed to remove calendar'
      };
    }
  } catch (error) {
    context.logger.error('Failed to remove calendar', { id, error });
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to remove calendar'
    };
  }
}

/**
 * Sync calendars command handler
 */
export async function syncCommand(
  _args: string[],
  context: CommandContext
): Promise<CommandResult<CalendarSyncResult[]>> {
  const service = getCalendarService();

  try {
    context.logger.info('Starting calendar sync');
    const results = await service.syncAllSources();

    let message = '**Calendar Sync Results**\n\n';

    if (results.length === 0) {
      message += '_No calendars to sync_\n';
      message += '_Use `/calendar add <provider>` to connect a calendar_';
      return {
        success: true,
        data: results,
        message
      };
    }

    let totalEvents = 0;
    let errors = 0;

    for (const result of results) {
      const icon = result.error ? '❌' : '✅';
      message += `${icon} **${result.calendarName}**\n`;

      if (result.error) {
        message += `   Error: ${result.error}\n`;
        errors++;
      } else {
        message += `   Events: ${result.eventsFound} (${result.upcomingEvents} upcoming)\n`;
        totalEvents += result.eventsFound;
      }

      message += '\n';
    }

    message += `_Synced ${results.length} calendar${results.length !== 1 ? 's' : ''}`;
    if (errors > 0) {
      message += ` (${errors} error${errors !== 1 ? 's' : ''})`;
    }
    message += `_`;

    return {
      success: true,
      data: results,
      message
    };
  } catch (error) {
    context.logger.error('Failed to sync calendars', { error });
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to sync calendars'
    };
  }
}
