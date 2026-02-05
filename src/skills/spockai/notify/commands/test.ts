/**
 * SpockAI Notify Test Command
 * Send a test notification to verify configuration
 */

import type { CommandResult } from '../../types/index.js';
import type { CommandContext } from '../../base/skill.js';
import type { NotificationSendResult } from '../types.js';
import { NotificationService, createNotificationService } from '../service.js';

let notificationService: NotificationService | null = null;

async function getNotificationService(context: CommandContext): Promise<NotificationService> {
  if (!notificationService) {
    notificationService = createNotificationService(context.config.notifications);
    await notificationService.initialize();
  }
  return notificationService;
}

/**
 * Notify test command handler
 */
export async function testCommand(
  _args: string[],
  context: CommandContext
): Promise<CommandResult<NotificationSendResult>> {
  try {
    const service = await getNotificationService(context);
    const status = service.getStatus();

    if (!status.connected) {
      return {
        success: false,
        error: 'Notification service not connected',
        message: `❌ ${status.channel} is not connected.\n\nPlease check your configuration:\n` +
          (status.channel === 'telegram'
            ? '• Verify bot token is correct\n• Verify chat ID is correct\n• Make sure you\'ve started a conversation with your bot'
            : '• Verify Teams webhook URL is correct')
      };
    }

    context.logger.info('Sending test notification');
    const result = await service.sendTest();

    if (result.success) {
      return {
        success: true,
        data: result,
        message: `✅ **Test notification sent!**\n\nCheck your ${status.channel} for the test message.\n\n_Message ID: ${result.messageId}_`
      };
    } else {
      return {
        success: false,
        data: result,
        error: result.error ?? 'Failed to send test notification',
        message: `❌ **Test notification failed**\n\nError: ${result.error}\n\nPlease check your ${status.channel} configuration.`
      };
    }
  } catch (error) {
    context.logger.error('Test notification failed', { error });
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Test notification failed'
    };
  }
}
