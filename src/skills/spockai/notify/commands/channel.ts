/**
 * SpockAI Notify Channel Command
 * Switch between notification channels (Telegram/Teams)
 */

import type { CommandResult } from '../../types/index.js';
import type { CommandContext } from '../../base/skill.js';
import type { NotificationChannel } from '../../types/index.js';
import { NotificationService, createNotificationService } from '../service.js';

let notificationService: NotificationService | null = null;

function getNotificationService(context: CommandContext): NotificationService {
  if (!notificationService) {
    notificationService = createNotificationService(context.config.notifications);
  }
  return notificationService;
}

interface ChannelResult {
  currentChannel: NotificationChannel;
  changed: boolean;
}

/**
 * Channel switch command handler
 */
export async function channelCommand(
  args: string[],
  context: CommandContext
): Promise<CommandResult<ChannelResult>> {
  const service = getNotificationService(context);

  try {
    const requestedChannel = args[0]?.toLowerCase();
    const config = service.getConfig();
    const currentChannel = config.channel;

    // No argument - show current channel
    if (!requestedChannel) {
      return {
        success: true,
        data: { currentChannel, changed: false },
        message: formatCurrentChannel(currentChannel, config)
      };
    }

    // Validate channel
    if (!['telegram', 'teams'].includes(requestedChannel)) {
      return {
        success: false,
        error: 'Invalid channel. Use `telegram` or `teams`.'
      };
    }

    const newChannel = requestedChannel as NotificationChannel;

    // Check if already using this channel
    if (newChannel === currentChannel) {
      return {
        success: true,
        data: { currentChannel, changed: false },
        message: `Already using ${formatChannelName(currentChannel)} for notifications.`
      };
    }

    // Check if new channel is configured
    if (newChannel === 'telegram' && !config.telegram?.botToken) {
      return {
        success: false,
        error: 'Telegram not configured. Set up Telegram first in your configuration.'
      };
    }

    if (newChannel === 'teams' && !config.teams?.webhookUrl) {
      return {
        success: false,
        error: 'Teams not configured. Use `/notify teams-setup <webhook-url>` first.'
      };
    }

    // Switch channel
    service.updateConfig({ channel: newChannel });

    // Reinitialize service with new channel
    await service.shutdown();
    await service.initialize();

    context.logger.info('Notification channel changed', {
      from: currentChannel,
      to: newChannel
    });

    return {
      success: true,
      data: { currentChannel: newChannel, changed: true },
      message: `✅ Notification channel changed to ${formatChannelName(newChannel)}.

All notifications will now be sent to ${formatChannelName(newChannel)}.`
    };
  } catch (error) {
    context.logger.error('Failed to change channel', { error });
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to change channel'
    };
  }
}

function formatChannelName(channel: NotificationChannel): string {
  const names: Record<NotificationChannel, string> = {
    telegram: '📱 Telegram',
    teams: '💬 Microsoft Teams'
  };
  return names[channel];
}

function formatCurrentChannel(
  channel: NotificationChannel,
  config: { telegram?: { chatId?: string }; teams?: { webhookUrl?: string } }
): string {
  let message = `**Current Notification Channel**\n\n`;
  message += `Channel: ${formatChannelName(channel)}\n\n`;

  message += `**Available Channels:**\n`;

  // Telegram status
  const telegramConfigured = !!config.telegram?.chatId;
  const telegramIcon = telegramConfigured ? '✅' : '❌';
  const telegramStatus = channel === 'telegram' ? ' (active)' : '';
  message += `${telegramIcon} 📱 Telegram${telegramStatus}\n`;

  // Teams status
  const teamsConfigured = !!config.teams?.webhookUrl;
  const teamsIcon = teamsConfigured ? '✅' : '❌';
  const teamsStatus = channel === 'teams' ? ' (active)' : '';
  message += `${teamsIcon} 💬 Teams${teamsStatus}\n`;

  message += `\n_Use \`/notify channel <telegram|teams>\` to switch_`;

  return message;
}
