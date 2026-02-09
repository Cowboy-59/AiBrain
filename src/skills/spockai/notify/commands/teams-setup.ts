/**
 * SpockAI Notify Teams Setup Command
 * Configure Microsoft Teams integration
 */

import type { CommandResult } from '../../types/index.js';
import type { CommandContext } from '../../base/skill.js';
import type { TeamsConfig } from '../teams-types.js';
import { createTeamsNotifier } from '../teams.js';

/**
 * Teams setup command handler
 */
export async function teamsSetupCommand(
  args: string[],
  context: CommandContext
): Promise<CommandResult<{ configured: boolean }>> {
  const webhookUrl = args[0];

  if (!webhookUrl) {
    return {
      success: true,
      data: { configured: false },
      message: formatSetupInstructions()
    };
  }

  try {
    // Validate webhook URL
    if (!isValidWebhookUrl(webhookUrl)) {
      return {
        success: false,
        error: 'Invalid Teams webhook URL. URL must be from webhook.office.com or similar Microsoft domain.'
      };
    }

    // Create and test notifier
    const config: TeamsConfig = {
      webhookUrl,
      enabled: true
    };

    const notifier = createTeamsNotifier(config);
    await notifier.connect();

    // Send test notification
    const testResult = await notifier.sendTest();

    if (testResult.success) {
      context.logger.info('Teams configured successfully');

      return {
        success: true,
        data: { configured: true },
        message: `✅ **Teams Configured Successfully**

Your Teams webhook has been configured and verified.

**Webhook URL**: ${notifier.getWebhookUrl()}

A test notification has been sent to your Teams channel.

_Use \`/notify channel teams\` to switch to Teams notifications._`
      };
    } else {
      return {
        success: false,
        error: `Failed to send test notification: ${testResult.error}`
      };
    }
  } catch (error) {
    context.logger.error('Teams setup failed', { error });
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to configure Teams'
    };
  }
}

function isValidWebhookUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return (
      parsed.protocol === 'https:' &&
      (parsed.hostname.endsWith('.office.com') ||
       parsed.hostname.endsWith('.microsoft.com') ||
       parsed.hostname.includes('webhook.office.com'))
    );
  } catch {
    return false;
  }
}

function formatSetupInstructions(): string {
  return `**Microsoft Teams Setup**

To configure Teams notifications, you need an Incoming Webhook URL.

**Step 1: Create a Webhook**
1. Open Microsoft Teams
2. Go to the channel where you want notifications
3. Click "..." > "Connectors"
4. Find "Incoming Webhook" and click "Configure"
5. Give it a name (e.g., "SpockAI")
6. Copy the webhook URL

**Step 2: Configure SpockAI**
\`\`\`
/notify teams-setup <webhook-url>
\`\`\`

**Example:**
\`\`\`
/notify teams-setup https://company.webhook.office.com/webhookb2/...
\`\`\`

The URL should start with \`https://\` and be from a \`.office.com\` or \`.microsoft.com\` domain.`;
}
