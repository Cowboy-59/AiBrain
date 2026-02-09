/**
 * SpockAI Teams Adaptive Card Builder
 * Builds rich adaptive cards for Teams notifications
 */

import type {
  AdaptiveCard,
  AdaptiveCardElement,
  AdaptiveCardAction,
  TextBlock,
  FactSet,
  Container
} from './teams-types.js';
import type { NotificationPayload } from './types.js';

/**
 * Teams Adaptive Card Builder
 * Creates rich, formatted cards for Teams notifications
 */
export class TeamsAdaptiveCardBuilder {
  private version = '1.4';
  private schema = 'http://adaptivecards.io/schemas/adaptive-card.json';

  /**
   * Build card from notification payload
   */
  buildFromPayload(payload: NotificationPayload): AdaptiveCard {
    const elements: AdaptiveCardElement[] = [];
    const actions: AdaptiveCardAction[] = [];

    // Header with icon and title
    elements.push(this.buildHeader(payload));

    // Message body
    if (payload.message) {
      elements.push(this.buildTextBlock(payload.message, 'default', 'default'));
    }

    // Priority indicator
    if (payload.priority) {
      elements.push(this.buildPriorityIndicator(payload.priority));
    }

    // Timestamp
    elements.push(this.buildTimestamp(payload.timestamp));

    // Action button if URL provided
    if (payload.url) {
      actions.push({
        type: 'Action.OpenUrl',
        title: 'View Details',
        url: payload.url
      });
    }

    return this.buildCard(elements, actions);
  }

  /**
   * Build notification card
   */
  buildNotificationCard(
    title: string,
    message: string,
    type: 'info' | 'success' | 'warning' | 'error' = 'info',
    url?: string
  ): AdaptiveCard {
    // Color map reserved for future use: { info: 'accent', success: 'good', warning: 'warning', error: 'attention' }

    const iconMap = {
      info: 'ℹ️',
      success: '✅',
      warning: '⚠️',
      error: '❌'
    };

    const elements: AdaptiveCardElement[] = [
      this.buildTextBlock(`${iconMap[type]} ${title}`, 'large', 'bolder'),
      this.buildTextBlock(message, 'default', 'default', true)
    ];

    const actions: AdaptiveCardAction[] = [];
    if (url) {
      actions.push({
        type: 'Action.OpenUrl',
        title: 'Open',
        url
      });
    }

    return this.buildCard(elements, actions);
  }

  /**
   * Build email notification card
   */
  buildEmailCard(
    from: string,
    subject: string,
    preview: string,
    priority: 'high' | 'medium' | 'low',
    url?: string
  ): AdaptiveCard {
    // Priority colors reserved for future use: { high: 'attention', medium: 'warning', low: 'default' }

    const elements: AdaptiveCardElement[] = [
      this.buildTextBlock('📧 High-Priority Email', 'large', 'bolder'),
      this.buildFactSet([
        { title: 'From', value: from },
        { title: 'Subject', value: subject }
      ]),
      this.buildTextBlock(preview, 'default', 'default', true)
    ];

    if (priority === 'high') {
      elements.splice(1, 0, this.buildContainer(
        [this.buildTextBlock('🔴 HIGH PRIORITY', 'small', 'bolder')],
        'attention'
      ));
    }

    const actions: AdaptiveCardAction[] = [];
    if (url) {
      actions.push({
        type: 'Action.OpenUrl',
        title: 'Open Email',
        url
      });
    }

    return this.buildCard(elements, actions);
  }

  /**
   * Build calendar reminder card
   */
  buildCalendarCard(
    eventTitle: string,
    time: string,
    location?: string,
    attendees?: number,
    url?: string
  ): AdaptiveCard {
    const facts = [
      { title: 'Time', value: time }
    ];

    if (location) {
      facts.push({ title: 'Location', value: location });
    }
    if (attendees) {
      facts.push({ title: 'Attendees', value: attendees.toString() });
    }

    const elements: AdaptiveCardElement[] = [
      this.buildTextBlock('⏰ Upcoming Event', 'large', 'bolder'),
      this.buildTextBlock(eventTitle, 'medium', 'bolder'),
      this.buildFactSet(facts)
    ];

    const actions: AdaptiveCardAction[] = [];
    if (url) {
      actions.push({
        type: 'Action.OpenUrl',
        title: 'View Event',
        url
      });
    }

    return this.buildCard(elements, actions);
  }

  /**
   * Build task notification card
   */
  buildTaskCard(
    title: string,
    status: string,
    description?: string,
    priority?: number,
    url?: string
  ): AdaptiveCard {
    const priorityLabel = priority === 1 ? '🔴 Priority 1' : `Priority ${priority}`;

    const elements: AdaptiveCardElement[] = [
      this.buildTextBlock('📋 Task Update', 'large', 'bolder'),
      this.buildTextBlock(title, 'medium', 'bolder'),
      this.buildFactSet([
        { title: 'Status', value: status },
        { title: 'Priority', value: priorityLabel }
      ])
    ];

    if (description) {
      elements.push(this.buildTextBlock(description, 'default', 'default', true));
    }

    const actions: AdaptiveCardAction[] = [];
    if (url) {
      actions.push({
        type: 'Action.OpenUrl',
        title: 'View Task',
        url
      });
    }

    return this.buildCard(elements, actions);
  }

  /**
   * Build digest card for multiple notifications
   */
  buildDigestCard(notifications: NotificationPayload[]): AdaptiveCard {
    const elements: AdaptiveCardElement[] = [
      this.buildTextBlock(`📊 SpockAI Digest (${notifications.length} items)`, 'large', 'bolder')
    ];

    // Group by type
    const byType = new Map<string, NotificationPayload[]>();
    for (const n of notifications) {
      if (!byType.has(n.type)) {
        byType.set(n.type, []);
      }
      byType.get(n.type)!.push(n);
    }

    for (const [type, items] of byType) {
      const typeLabel = this.getTypeLabel(type);
      elements.push(
        this.buildTextBlock(`**${typeLabel}** (${items.length})`, 'medium', 'bolder')
      );

      for (const item of items.slice(0, 5)) {
        elements.push(
          this.buildTextBlock(`• ${item.title}`, 'default', 'default')
        );
      }

      if (items.length > 5) {
        elements.push(
          this.buildTextBlock(`  _...and ${items.length - 5} more_`, 'small', 'lighter')
        );
      }
    }

    return this.buildCard(elements, []);
  }

  // Helper methods

  private buildCard(
    elements: AdaptiveCardElement[],
    actions: AdaptiveCardAction[]
  ): AdaptiveCard {
    return {
      type: 'AdaptiveCard',
      version: this.version,
      $schema: this.schema,
      body: elements,
      actions: actions.length > 0 ? actions : undefined
    };
  }

  private buildHeader(payload: NotificationPayload): TextBlock {
    const icon = this.getTypeIcon(payload.type);
    return this.buildTextBlock(`${icon} ${payload.title}`, 'large', 'bolder');
  }

  private buildTextBlock(
    text: string,
    size: TextBlock['size'] = 'default',
    weight: TextBlock['weight'] = 'default',
    wrap = false
  ): TextBlock {
    return {
      type: 'TextBlock',
      text,
      size,
      weight,
      wrap
    };
  }

  private buildFactSet(facts: Array<{ title: string; value: string }>): FactSet {
    return {
      type: 'FactSet',
      facts
    };
  }

  private buildContainer(
    items: AdaptiveCardElement[],
    style: Container['style'] = 'default'
  ): Container {
    return {
      type: 'Container',
      items,
      style
    };
  }

  private buildPriorityIndicator(priority: string): Container {
    const styleMap: Record<string, Container['style']> = {
      high: 'attention',
      medium: 'warning',
      low: 'default'
    };

    return this.buildContainer(
      [this.buildTextBlock(`Priority: ${priority.toUpperCase()}`, 'small', 'bolder')],
      styleMap[priority] ?? 'default'
    );
  }

  private buildTimestamp(date: Date): TextBlock {
    const timeStr = date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
    return this.buildTextBlock(timeStr, 'small', 'lighter');
  }

  private getTypeIcon(type: string): string {
    const icons: Record<string, string> = {
      high_priority_email: '📧',
      calendar_reminder: '📅',
      beans_priority_1: '📋',
      samanage_new_request: '🔧',
      monday_update: '📊'
    };
    return icons[type] ?? '🔔';
  }

  private getTypeLabel(type: string): string {
    const labels: Record<string, string> = {
      high_priority_email: 'Emails',
      calendar_reminder: 'Calendar',
      beans_priority_1: 'Tasks',
      samanage_new_request: 'Samanage',
      monday_update: 'Monday.com'
    };
    return labels[type] ?? type;
  }
}

/**
 * Create Teams adaptive card builder
 */
export function createTeamsAdaptiveCardBuilder(): TeamsAdaptiveCardBuilder {
  return new TeamsAdaptiveCardBuilder();
}
