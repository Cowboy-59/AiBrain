/**
 * SpockAI Email List Command
 * Display emails with priority filtering
 */

import type { CommandResult } from '../../types/index.js';
import type { CommandContext } from '../../base/skill.js';
import type { Email, EmailFilterOptions } from '../types.js';
import { EmailService } from '../service.js';

let emailService: EmailService | null = null;

function getEmailService(context: CommandContext): EmailService {
  if (!emailService) {
    emailService = new EmailService(context.config.email.globalRules);
  }
  return emailService;
}

export interface EmailListResult {
  emails: Email[];
  total: number;
  highPriority: number;
}

/**
 * List emails command handler
 */
export async function listCommand(
  args: string[],
  context: CommandContext
): Promise<CommandResult<EmailListResult>> {
  const service = getEmailService(context);
  const showAll = args.includes('all');

  const options: EmailFilterOptions = {};

  // Parse arguments
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const nextArg = args[i + 1];

    if (arg === '--account' && nextArg) {
      options.accountId = nextArg;
      i++;
    } else if (arg === '--limit' && nextArg) {
      options.limit = parseInt(nextArg, 10);
      i++;
    } else if (arg === '--unread') {
      options.isRead = false;
    }
  }

  // Default to high priority only unless 'all' specified
  if (!showAll) {
    options.priority = 'high';
  }

  options.limit = options.limit ?? 20;

  try {
    const emails = service.getEmails(options);
    const allEmails = service.getEmails({});
    const highPriorityCount = allEmails.filter(e => e.priority === 'high').length;

    // Format output
    if (emails.length === 0) {
      return {
        success: true,
        data: {
          emails: [],
          total: allEmails.length,
          highPriority: highPriorityCount
        },
        message: showAll
          ? 'No emails found.'
          : 'No high-priority emails. Use "/email list all" to see all emails.'
      };
    }

    const formattedEmails = emails.map(formatEmailSummary).join('\n');
    const header = showAll
      ? `📧 All Emails (${emails.length}/${allEmails.length})`
      : `🔴 High-Priority Emails (${emails.length})`;

    return {
      success: true,
      data: {
        emails,
        total: allEmails.length,
        highPriority: highPriorityCount
      },
      message: `${header}\n\n${formattedEmails}`
    };
  } catch (error) {
    context.logger.error('Failed to list emails', { error });
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to list emails'
    };
  }
}

/**
 * Format email for display
 */
function formatEmailSummary(email: Email): string {
  const priorityIcon = email.priority === 'high' ? '🔴' : email.priority === 'medium' ? '🟡' : '⚪';
  const readIcon = email.isRead ? '✓' : '•';
  const timeStr = formatRelativeTime(email.receivedAt);

  return `${priorityIcon} ${readIcon} **${email.sender}** - ${email.subject}\n   ${timeStr} | ${email.senderEmail}`;
}

/**
 * Format relative time
 */
function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString();
}
