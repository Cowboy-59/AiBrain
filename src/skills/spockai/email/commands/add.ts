/**
 * SpockAI Email Add Command
 * Add a new email account
 */

import type { CommandResult } from '../../types/index.js';
import type { CommandContext } from '../../base/skill.js';
import type { EmailAccount, EmailProvider } from '../types.js';
import { EmailService } from '../service.js';
import { randomUUID } from 'crypto';

let emailService: EmailService | null = null;

function getEmailService(context: CommandContext): EmailService {
  if (!emailService) {
    emailService = new EmailService(context.config.email.globalRules);
  }
  return emailService;
}

export interface AddAccountResult {
  account: EmailAccount;
}

/**
 * Add email account command handler
 * Usage: /email add <name> <provider> <email>
 */
export async function addCommand(
  args: string[],
  context: CommandContext
): Promise<CommandResult<AddAccountResult>> {
  if (args.length < 3) {
    return {
      success: false,
      error: 'Missing required arguments',
      message: 'Usage: `/email add <name> <provider> <email>`\n\nProviders: gmail, outlook, imap\n\nExample: `/email add "Work Gmail" gmail user@gmail.com`'
    };
  }

  const [name, providerStr, email] = args;

  if (!name || !providerStr || !email) {
    return {
      success: false,
      error: 'Invalid arguments'
    };
  }

  // Validate provider
  const validProviders: EmailProvider[] = ['gmail', 'outlook', 'imap'];
  const provider = providerStr.toLowerCase() as EmailProvider;

  if (!validProviders.includes(provider)) {
    return {
      success: false,
      error: `Invalid provider: ${providerStr}`,
      message: `Valid providers: ${validProviders.join(', ')}`
    };
  }

  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return {
      success: false,
      error: 'Invalid email address format'
    };
  }

  const service = getEmailService(context);

  try {
    // Check for duplicate
    const existingAccounts = service.getAccounts();
    if (existingAccounts.some(a => a.email.toLowerCase() === email.toLowerCase())) {
      return {
        success: false,
        error: `Account with email ${email} already exists`
      };
    }

    // Create account based on provider
    let accountData: Omit<EmailAccount, 'id'>;

    if (provider === 'imap') {
      // IMAP requires additional configuration
      accountData = {
        name: name.replace(/"/g, ''),
        provider: 'imap',
        email,
        credentials: {
          imapHost: '',
          imapPort: 993,
          imapSecure: true,
          username: email,
          password: ''
        },
        syncInterval: 5,
        enabled: false, // Disabled until configured
        priorityRules: []
      };

      const account = await service.addAccount(accountData);

      return {
        success: true,
        data: { account },
        message: `📧 Account "${name}" added (IMAP)\n\n⚠️ Additional configuration required:\n\`\`\`\n/email configure ${account.id} --host <imap.server.com> --password <password>\n\`\`\`\n\nCommon IMAP servers:\n- Gmail: imap.gmail.com\n- Outlook: outlook.office365.com\n- Yahoo: imap.mail.yahoo.com`
      };
    }

    // OAuth providers (Gmail, Outlook)
    accountData = {
      name: name.replace(/"/g, ''),
      provider,
      email,
      credentials: {},
      syncInterval: 5,
      enabled: false, // Disabled until OAuth complete
      priorityRules: []
    };

    const account = await service.addAccount(accountData);

    const oauthMessage = provider === 'gmail'
      ? 'Please complete Gmail OAuth authentication in your browser.'
      : 'Please complete Microsoft OAuth authentication in your browser.';

    return {
      success: true,
      data: { account },
      message: `📧 Account "${name}" added (${provider})\n\n🔐 ${oauthMessage}\n\nOnce authenticated, the account will begin syncing automatically.`
    };
  } catch (error) {
    context.logger.error('Failed to add email account', { error, name, provider, email });
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to add account'
    };
  }
}
