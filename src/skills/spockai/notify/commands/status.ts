/**
 * SpockAI Notify Status Command
 * Display notification configuration and status
 */

import type { CommandResult } from '../../types/index.js';
import type { CommandContext } from '../../base/skill.js';
import type { NotificationStatus } from '../types.js';
import { NotificationService, createNotificationService } from '../service.js';

let notificationService: NotificationService | null = null;

function getNotificationService(context: CommandContext): NotificationService {
  if (!notificationService) {
    notificationService = createNotificationService(context.config.notifications);
  }
  return notificationService;
}

/**
 * Notify status command handler
 */
export async function statusCommand(
  _args: string[],
  context: CommandContext
): Promise<CommandResult<NotificationStatus>> {
  const service = getNotificationService(context);

  try {
    const status = service.getStatus();
    const config = service.getConfig();

    const channelIcon = status.channel === 'telegram' ? '📱' : '💬';
    const connectedStatus = status.connected ? '✅ Connected' : '❌ Disconnected';

    let message = `${channelIcon} **Notification Status**\n\n`;
    message += `**Channel**: ${status.channel}\n`;
    message += `**Status**: ${connectedStatus}\n`;
    message += `**Digest Interval**: ${config.digestInterval} minutes\n`;
    message += `**Queue Size**: ${status.queueSize}\n\n`;

    message += `**Notification Rules**:\n`;

    const typeNames: Record<string, string> = {
      high_priority_email: 'High-Priority Emails',
      calendar_reminder: 'Calendar Reminders',
      beans_priority_1: 'Priority 1 Tasks',
      samanage_new_request: 'Samanage Requests',
      monday_update: 'Monday.com Updates'
    };

    for (const rule of status.rules) {
      const statusIcon = rule.enabled ? '✅' : '⏸️';
      const name = typeNames[rule.type] ?? rule.type;
      message += `${statusIcon} ${name}\n`;
    }

    if (status.rules.length === 0) {
      message += '_No notification rules configured_\n';
    }

    message += `\n_Use \`/notify enable <type>\` or \`/notify disable <type>\` to manage rules_`;

    return {
      success: true,
      data: status,
      message
    };
  } catch (error) {
    context.logger.error('Failed to get notification status', { error });
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get status'
    };
  }
}
