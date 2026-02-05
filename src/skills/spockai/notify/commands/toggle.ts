/**
 * SpockAI Notify Enable/Disable Commands
 * Toggle notification types on/off
 */

import type { CommandResult } from '../../types/index.js';
import type { NotificationEventType } from '../../types/index.js';
import type { CommandContext } from '../../base/skill.js';
import { NotificationService, createNotificationService } from '../service.js';

let notificationService: NotificationService | null = null;

function getNotificationService(context: CommandContext): NotificationService {
  if (!notificationService) {
    notificationService = createNotificationService(context.config.notifications);
  }
  return notificationService;
}

const VALID_TYPES: NotificationEventType[] = [
  'high_priority_email',
  'calendar_reminder',
  'beans_priority_1',
  'samanage_new_request',
  'monday_update'
];

const TYPE_NAMES: Record<string, string> = {
  high_priority_email: 'High-Priority Emails',
  calendar_reminder: 'Calendar Reminders',
  beans_priority_1: 'Priority 1 Tasks',
  samanage_new_request: 'Samanage Requests',
  monday_update: 'Monday.com Updates'
};

interface ToggleResult {
  type: NotificationEventType;
  enabled: boolean;
}

/**
 * Enable notification type command handler
 */
export async function enableCommand(
  args: string[],
  context: CommandContext
): Promise<CommandResult<ToggleResult>> {
  if (args.length < 1) {
    return {
      success: false,
      error: 'Missing notification type',
      message: getUsageMessage('enable')
    };
  }

  const typeArg = args[0]!.toLowerCase();
  const eventType = parseEventType(typeArg);

  if (!eventType) {
    return {
      success: false,
      error: `Invalid notification type: ${typeArg}`,
      message: getUsageMessage('enable')
    };
  }

  const service = getNotificationService(context);

  try {
    service.enableRule(eventType);
    const name = TYPE_NAMES[eventType] ?? eventType;

    return {
      success: true,
      data: { type: eventType, enabled: true },
      message: `✅ **${name}** notifications enabled.\n\nYou will receive notifications for this event type.`
    };
  } catch (error) {
    context.logger.error('Failed to enable notification', { error, eventType });
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to enable notification'
    };
  }
}

/**
 * Disable notification type command handler
 */
export async function disableCommand(
  args: string[],
  context: CommandContext
): Promise<CommandResult<ToggleResult>> {
  if (args.length < 1) {
    return {
      success: false,
      error: 'Missing notification type',
      message: getUsageMessage('disable')
    };
  }

  const typeArg = args[0]!.toLowerCase();
  const eventType = parseEventType(typeArg);

  if (!eventType) {
    return {
      success: false,
      error: `Invalid notification type: ${typeArg}`,
      message: getUsageMessage('disable')
    };
  }

  const service = getNotificationService(context);

  try {
    const disabled = service.disableRule(eventType);
    const name = TYPE_NAMES[eventType] ?? eventType;

    if (disabled) {
      return {
        success: true,
        data: { type: eventType, enabled: false },
        message: `⏸️ **${name}** notifications disabled.\n\nYou will no longer receive notifications for this event type.`
      };
    } else {
      return {
        success: false,
        error: `Notification type not found: ${typeArg}`
      };
    }
  } catch (error) {
    context.logger.error('Failed to disable notification', { error, eventType });
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to disable notification'
    };
  }
}

/**
 * Parse event type from user input
 */
function parseEventType(input: string): NotificationEventType | null {
  // Direct match
  if (VALID_TYPES.includes(input as NotificationEventType)) {
    return input as NotificationEventType;
  }

  // Aliases
  const aliases: Record<string, NotificationEventType> = {
    email: 'high_priority_email',
    emails: 'high_priority_email',
    calendar: 'calendar_reminder',
    reminder: 'calendar_reminder',
    reminders: 'calendar_reminder',
    beans: 'beans_priority_1',
    tasks: 'beans_priority_1',
    samanage: 'samanage_new_request',
    monday: 'monday_update'
  };

  return aliases[input] ?? null;
}

/**
 * Get usage message
 */
function getUsageMessage(action: 'enable' | 'disable'): string {
  return `Usage: \`/notify ${action} <type>\`\n\n**Valid types**:\n` +
    VALID_TYPES.map(t => `• \`${t}\` - ${TYPE_NAMES[t]}`).join('\n');
}
