/**
 * SpockAI Email Remove Command
 * Remove an email account
 */

import type { CommandResult } from '../../types/index.js';
import type { CommandContext } from '../../base/skill.js';
import { EmailService } from '../service.js';

let emailService: EmailService | null = null;

function getEmailService(context: CommandContext): EmailService {
  if (!emailService) {
    emailService = new EmailService(context.config.email.globalRules);
  }
  return emailService;
}

export interface RemoveAccountResult {
  removed: boolean;
  accountName: string;
}

/**
 * Remove email account command handler
 * Usage: /email remove <name|id>
 */
export async function removeCommand(
  args: string[],
  context: CommandContext
): Promise<CommandResult<RemoveAccountResult>> {
  if (args.length < 1) {
    return {
      success: false,
      error: 'Missing account name or ID',
      message: 'Usage: `/email remove <name|id>`\n\nUse `/email accounts` to see available accounts.'
    };
  }

  const identifier = args.join(' ').replace(/"/g, '');
  const service = getEmailService(context);

  try {
    const accounts = service.getAccounts();

    // Find account by name or ID
    const account = accounts.find(a =>
      a.name.toLowerCase() === identifier.toLowerCase() ||
      a.id === identifier ||
      a.email.toLowerCase() === identifier.toLowerCase()
    );

    if (!account) {
      return {
        success: false,
        error: `Account not found: ${identifier}`,
        message: 'Use `/email accounts` to see available accounts.'
      };
    }

    const removed = await service.removeAccount(account.id);

    if (removed) {
      return {
        success: true,
        data: { removed: true, accountName: account.name },
        message: `✅ Account "${account.name}" (${account.email}) has been removed.`
      };
    } else {
      return {
        success: false,
        error: 'Failed to remove account'
      };
    }
  } catch (error) {
    context.logger.error('Failed to remove email account', { error, identifier });
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to remove account'
    };
  }
}
