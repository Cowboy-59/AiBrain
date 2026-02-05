/**
 * SpockAI Email Accounts Command
 * Manage and display email account connections
 */

import type { CommandResult } from '../../types/index.js';
import type { CommandContext } from '../../base/skill.js';
import type { EmailAccountStatus } from '../types.js';
import { EmailService } from '../service.js';

let emailService: EmailService | null = null;

function getEmailService(context: CommandContext): EmailService {
  if (!emailService) {
    emailService = new EmailService(context.config.email.globalRules);
  }
  return emailService;
}

export interface AccountsResult {
  accounts: EmailAccountStatus[];
}

/**
 * List email accounts command handler
 */
export async function accountsCommand(
  _args: string[],
  context: CommandContext
): Promise<CommandResult<AccountsResult>> {
  const service = getEmailService(context);

  try {
    const accounts = service.getAccountStatuses();

    if (accounts.length === 0) {
      return {
        success: true,
        data: { accounts: [] },
        message: '📧 No email accounts configured.\n\nUse `/email add <name> <provider> <email>` to add an account.\n\nProviders: gmail, outlook, imap'
      };
    }

    const formattedAccounts = accounts.map(formatAccountStatus).join('\n\n');

    return {
      success: true,
      data: { accounts },
      message: `📧 **Email Accounts** (${accounts.length})\n\n${formattedAccounts}`
    };
  } catch (error) {
    context.logger.error('Failed to list accounts', { error });
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to list accounts'
    };
  }
}

/**
 * Format account status for display
 */
function formatAccountStatus(account: EmailAccountStatus): string {
  const statusIcon = account.enabled ? '✅' : '⏸️';
  const providerIcon = getProviderIcon(account.provider);
  const syncStatus = account.lastSync
    ? `Last sync: ${formatTime(account.lastSync)}`
    : 'Never synced';

  let status = `${statusIcon} **${account.name}** ${providerIcon}\n`;
  status += `   ${account.email}\n`;
  status += `   ${syncStatus}`;

  if (account.emailCount > 0) {
    status += ` | ${account.emailCount} emails`;
    if (account.highPriorityCount > 0) {
      status += ` (${account.highPriorityCount} high priority)`;
    }
  }

  if (account.lastError) {
    status += `\n   ⚠️ Error: ${account.lastError}`;
  }

  return status;
}

/**
 * Get icon for email provider
 */
function getProviderIcon(provider: string): string {
  switch (provider) {
    case 'gmail':
      return '📨';
    case 'outlook':
      return '📬';
    case 'imap':
      return '📫';
    default:
      return '📧';
  }
}

/**
 * Format time for display
 */
function formatTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;

  return date.toLocaleTimeString();
}
