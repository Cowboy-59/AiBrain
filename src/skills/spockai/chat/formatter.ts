/**
 * SpockAI Response Formatter
 * Formats responses for conversational output
 */

import type { ChatMessage, ConfigurationIntent, IntentType } from './types.js';

/**
 * Response Formatter
 * Converts structured data into conversational responses
 */
export class ResponseFormatter {
  /**
   * Format a welcome message
   */
  formatWelcome(): string {
    return `👋 **Hello! I'm SpockAI, your personal assistant.**

I can help you with:
• 📧 Email management and priority alerts
• 📅 Calendar reminders
• 📋 BEANS task tracking
• 🔧 Service integrations (Samanage, Monday.com)
• 🔔 Notification configuration

What would you like to do?`;
  }

  /**
   * Format a help message
   */
  formatHelp(): string {
    return `**Here's what I can help you with:**

**Email**
• "Add my email account" - Connect Gmail or Outlook
• "Show my emails" - View priority emails

**Calendar**
• "Add my calendar" - Connect Google or Microsoft calendar
• "What's on my calendar today?" - View appointments

**BEANS**
• "Scan for priority 1 items" - Check for high-priority tasks
• "Add a scan path" - Add directory to monitor

**Services**
• "Connect Samanage" - Set up Samanage integration
• "Connect Monday.com" - Set up Monday.com integration

**Notifications**
• "Enable calendar reminders" - Turn on notifications
• "Disable email alerts" - Turn off notifications

Just tell me what you'd like to do in natural language!`;
  }

  /**
   * Format status response
   */
  formatStatus(status: {
    email: { accounts: number; unread: number };
    calendar: { sources: number; todayEvents: number };
    beans: { paths: number; priorityOne: number };
    services: { connected: number };
    notifications: { channel: string; enabled: boolean };
  }): string {
    let response = `**📊 SpockAI Status**\n\n`;

    response += `**📧 Email**\n`;
    response += `• ${status.email.accounts} account(s) connected\n`;
    response += `• ${status.email.unread} unread message(s)\n\n`;

    response += `**📅 Calendar**\n`;
    response += `• ${status.calendar.sources} calendar(s) connected\n`;
    response += `• ${status.calendar.todayEvents} event(s) today\n\n`;

    response += `**📋 BEANS**\n`;
    response += `• ${status.beans.paths} scan path(s)\n`;
    response += `• ${status.beans.priorityOne} priority 1 item(s)\n\n`;

    response += `**🔧 Services**\n`;
    response += `• ${status.services.connected} service(s) connected\n\n`;

    response += `**🔔 Notifications**\n`;
    response += `• Channel: ${status.notifications.channel}\n`;
    response += `• Status: ${status.notifications.enabled ? 'Active' : 'Disabled'}`;

    return response;
  }

  /**
   * Format intent recognition response
   */
  formatIntentRecognition(intent: ConfigurationIntent): string {
    if (intent.type === 'unknown') {
      return `I'm not sure what you're asking. Could you rephrase that, or say "help" to see what I can do?`;
    }

    const intentDescriptions: Record<IntentType, string> = {
      add_email_account: "set up a new email account",
      remove_email_account: "remove an email account",
      configure_notifications: "configure your notifications",
      add_calendar: "add a calendar",
      remove_calendar: "remove a calendar",
      add_beans_path: "add a BEANS scan path",
      remove_beans_path: "remove a BEANS scan path",
      connect_samanage: "connect to Samanage",
      connect_monday: "connect to Monday.com",
      help: "show help",
      status: "show status",
      unknown: "unknown request"
    };

    const description = intentDescriptions[intent.type];

    if (intent.complete) {
      return `I'll ${description} for you.`;
    }

    return `I understand you want to ${description}. Let me help you with that.`;
  }

  /**
   * Format wizard prompt
   */
  formatWizardPrompt(prompt: string): string {
    return `❓ ${prompt}`;
  }

  /**
   * Format validation error
   */
  formatValidationError(error: string): string {
    return `⚠️ ${error}`;
  }

  /**
   * Format success message
   */
  formatSuccess(message: string): string {
    return `✅ ${message}`;
  }

  /**
   * Format error message
   */
  formatError(message: string): string {
    return `❌ ${message}`;
  }

  /**
   * Format confirmation request
   */
  formatConfirmation(action: string): string {
    return `Are you sure you want to ${action}? (yes/no)`;
  }

  /**
   * Format list of items
   */
  formatList(title: string, items: string[]): string {
    if (items.length === 0) {
      return `**${title}**\n_No items_`;
    }

    let response = `**${title}**\n`;
    for (const item of items) {
      response += `• ${item}\n`;
    }
    return response.trim();
  }

  /**
   * Format conversation history for display
   */
  formatHistory(messages: ChatMessage[]): string {
    let response = '';

    for (const message of messages.slice(-10)) {
      const prefix = message.role === 'user' ? '👤 You' : '🤖 SpockAI';
      const time = message.timestamp.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      });

      response += `**${prefix}** _${time}_\n`;
      response += `${message.content}\n\n`;
    }

    return response.trim();
  }

  /**
   * Format quick actions
   */
  formatQuickActions(): string {
    return `**Quick Actions:**
📧 \`/email\` - View emails
📅 \`/calendar\` - View calendar
📋 \`/beans\` - View tasks
🔧 \`/services\` - View services
🔔 \`/notify status\` - Notification status`;
  }
}

/**
 * Create response formatter
 */
export function createResponseFormatter(): ResponseFormatter {
  return new ResponseFormatter();
}
