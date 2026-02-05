/**
 * SpockAI Core Integration
 * Wires services together and handles cross-service notifications
 */

import type { NotificationPayload } from '../notify/types.js';
import type { NotificationService } from '../notify/service.js';
import type { EmailService } from '../email/service.js';
import type { CalendarService } from '../calendar/service.js';
import type { BeansService } from '../beans/service.js';
import type { ExternalServicesService } from '../services/service.js';
import type { Email } from '../email/types.js';
import type { Appointment } from '../calendar/types.js';
import type { PriorityItem } from '../beans/types.js';
import type { ServiceRequest } from '../services/types.js';
import { coreLogger } from '../utils/logger.js';

interface IntegrationConfig {
  emailPollingInterval: number;   // Minutes between email polling
  calendarReminderLead: number;   // Minutes before event to send reminder
  beansPollingInterval: number;   // Minutes between BEANS scans
  servicesPollingInterval: number; // Minutes between external service syncs
}

const DEFAULT_CONFIG: IntegrationConfig = {
  emailPollingInterval: 5,
  calendarReminderLead: 15,
  beansPollingInterval: 30,
  servicesPollingInterval: 15
};

/**
 * Integration Manager
 * Coordinates notifications between services
 */
export class IntegrationManager {
  private config: IntegrationConfig;
  private notificationService: NotificationService | null = null;
  private emailService: EmailService | null = null;
  private calendarService: CalendarService | null = null;
  private beansService: BeansService | null = null;
  private servicesService: ExternalServicesService | null = null;

  private emailPollInterval: NodeJS.Timeout | null = null;
  private calendarReminderInterval: NodeJS.Timeout | null = null;
  private beansPollInterval: NodeJS.Timeout | null = null;
  private servicesPollInterval: NodeJS.Timeout | null = null;

  private seenEmailIds: Set<string> = new Set();
  private seenBeanIds: Set<string> = new Set();
  private seenRequestIds: Set<string> = new Set();

  constructor(config: Partial<IntegrationConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    coreLogger.info('Integration manager initialized', this.config);
  }

  /**
   * Register the notification service
   */
  setNotificationService(service: NotificationService): void {
    this.notificationService = service;
  }

  /**
   * Register and wire email service (T034)
   */
  wireEmailService(service: EmailService): void {
    this.emailService = service;
    coreLogger.info('Email service wired to notifications');
  }

  /**
   * Register and wire calendar service (T045)
   */
  wireCalendarService(service: CalendarService): void {
    this.calendarService = service;
    coreLogger.info('Calendar service wired to notifications');
  }

  /**
   * Register and wire BEANS service (T055)
   */
  wireBeansService(service: BeansService): void {
    this.beansService = service;
    coreLogger.info('BEANS service wired to notifications');
  }

  /**
   * Register and wire external services (T065)
   */
  wireServicesService(service: ExternalServicesService): void {
    this.servicesService = service;
    coreLogger.info('External services wired to notifications');
  }

  /**
   * Start background polling for emails (T035)
   */
  startEmailPolling(): void {
    if (this.emailPollInterval) {
      return;
    }

    const intervalMs = this.config.emailPollingInterval * 60 * 1000;

    this.emailPollInterval = setInterval(async () => {
      await this.pollEmails();
    }, intervalMs);

    coreLogger.info('Email polling started', {
      intervalMinutes: this.config.emailPollingInterval
    });

    // Run immediately
    void this.pollEmails();
  }

  /**
   * Stop email polling
   */
  stopEmailPolling(): void {
    if (this.emailPollInterval) {
      clearInterval(this.emailPollInterval);
      this.emailPollInterval = null;
      coreLogger.info('Email polling stopped');
    }
  }

  /**
   * Start calendar reminder checks
   */
  startCalendarReminders(): void {
    if (this.calendarReminderInterval) {
      return;
    }

    // Check every minute for upcoming events
    this.calendarReminderInterval = setInterval(async () => {
      await this.checkCalendarReminders();
    }, 60 * 1000);

    coreLogger.info('Calendar reminders started', {
      leadTimeMinutes: this.config.calendarReminderLead
    });

    // Run immediately
    void this.checkCalendarReminders();
  }

  /**
   * Stop calendar reminders
   */
  stopCalendarReminders(): void {
    if (this.calendarReminderInterval) {
      clearInterval(this.calendarReminderInterval);
      this.calendarReminderInterval = null;
      coreLogger.info('Calendar reminders stopped');
    }
  }

  /**
   * Start BEANS polling
   */
  startBeansPolling(): void {
    if (this.beansPollInterval) {
      return;
    }

    const intervalMs = this.config.beansPollingInterval * 60 * 1000;

    this.beansPollInterval = setInterval(async () => {
      await this.pollBeans();
    }, intervalMs);

    coreLogger.info('BEANS polling started', {
      intervalMinutes: this.config.beansPollingInterval
    });

    // Run immediately
    void this.pollBeans();
  }

  /**
   * Stop BEANS polling
   */
  stopBeansPolling(): void {
    if (this.beansPollInterval) {
      clearInterval(this.beansPollInterval);
      this.beansPollInterval = null;
      coreLogger.info('BEANS polling stopped');
    }
  }

  /**
   * Start external services polling (T065)
   */
  startServicesPolling(): void {
    if (this.servicesPollInterval) {
      return;
    }

    const intervalMs = this.config.servicesPollingInterval * 60 * 1000;

    this.servicesPollInterval = setInterval(async () => {
      await this.pollServices();
    }, intervalMs);

    coreLogger.info('External services polling started', {
      intervalMinutes: this.config.servicesPollingInterval
    });

    // Run immediately
    void this.pollServices();
  }

  /**
   * Stop external services polling
   */
  stopServicesPolling(): void {
    if (this.servicesPollInterval) {
      clearInterval(this.servicesPollInterval);
      this.servicesPollInterval = null;
      coreLogger.info('External services polling stopped');
    }
  }

  /**
   * Start all polling
   */
  startAll(): void {
    if (this.emailService) {
      this.startEmailPolling();
    }
    if (this.calendarService) {
      this.startCalendarReminders();
    }
    if (this.beansService) {
      this.startBeansPolling();
    }
    if (this.servicesService) {
      this.startServicesPolling();
    }
  }

  /**
   * Stop all polling
   */
  stopAll(): void {
    this.stopEmailPolling();
    this.stopCalendarReminders();
    this.stopBeansPolling();
    this.stopServicesPolling();
  }

  /**
   * Shutdown integration manager
   */
  async shutdown(): Promise<void> {
    this.stopAll();
    coreLogger.info('Integration manager shut down');
  }

  // Private polling methods

  private async pollEmails(): Promise<void> {
    if (!this.emailService || !this.notificationService) {
      return;
    }

    try {
      coreLogger.debug('Polling for new emails');

      // Sync all accounts
      await this.emailService.syncAllAccounts();

      // Get high-priority unread emails
      const highPriorityEmails = this.emailService.getEmails({
        priority: 'high',
        unreadOnly: true,
        limit: 20
      });

      // Send notifications for new high-priority emails
      for (const email of highPriorityEmails) {
        if (!this.seenEmailIds.has(email.id)) {
          this.seenEmailIds.add(email.id);
          await this.notifyHighPriorityEmail(email);
        }
      }
    } catch (error) {
      coreLogger.error('Email polling failed', { error });
    }
  }

  private async checkCalendarReminders(): Promise<void> {
    if (!this.calendarService || !this.notificationService) {
      return;
    }

    try {
      const upcomingEvents = this.calendarService.getAppointmentsNeedingReminders(
        this.config.calendarReminderLead
      );

      for (const event of upcomingEvents) {
        await this.notifyCalendarReminder(event);
        this.calendarService.markReminderSent(event.id);
      }
    } catch (error) {
      coreLogger.error('Calendar reminder check failed', { error });
    }
  }

  private async pollBeans(): Promise<void> {
    if (!this.beansService || !this.notificationService) {
      return;
    }

    try {
      coreLogger.debug('Polling for BEANS updates');

      // Scan all paths
      await this.beansService.scanAllPaths();

      // Get priority 1 items
      const priorityItems = this.beansService.getPriorityOneItems();

      // Send notifications for new priority 1 items
      for (const item of priorityItems) {
        if (!this.seenBeanIds.has(item.id)) {
          this.seenBeanIds.add(item.id);
          await this.notifyPriorityOneBean(item);
        }
      }
    } catch (error) {
      coreLogger.error('BEANS polling failed', { error });
    }
  }

  // Notification helpers

  private async notifyHighPriorityEmail(email: Email): Promise<void> {
    if (!this.notificationService) return;

    const payload: NotificationPayload = {
      type: 'high_priority_email',
      title: `📧 High-Priority Email`,
      message: `**From**: ${email.senderName || email.senderEmail}\n**Subject**: ${email.subject}`,
      priority: 'high',
      sourceId: email.id,
      timestamp: email.receivedAt
    };

    await this.notificationService.notify(payload);
    coreLogger.info('High-priority email notification sent', { emailId: email.id });
  }

  private async notifyCalendarReminder(event: Appointment): Promise<void> {
    if (!this.notificationService) return;

    const timeStr = event.isAllDay
      ? 'All Day'
      : event.startTime.toLocaleTimeString('en-US', {
          hour: 'numeric',
          minute: '2-digit',
          hour12: true
        });

    let message = `**${event.title}**\n📅 ${timeStr}`;
    if (event.location) {
      message += `\n📍 ${event.location}`;
    }
    if (event.attendees.length > 0) {
      message += `\n👥 ${event.attendees.length} attendee(s)`;
    }

    const payload: NotificationPayload = {
      type: 'calendar_reminder',
      title: `⏰ Upcoming Event`,
      message,
      priority: 'medium',
      sourceId: event.id,
      timestamp: new Date()
    };

    await this.notificationService.notify(payload);
    coreLogger.info('Calendar reminder notification sent', { eventId: event.id });
  }

  private async notifyPriorityOneBean(item: PriorityItem): Promise<void> {
    if (!this.notificationService) return;

    let message = `**${item.title}**\n`;
    message += `Status: ${item.status.replace('_', ' ')}\n`;
    if (item.description) {
      const desc = item.description.length > 150
        ? item.description.substring(0, 150) + '...'
        : item.description;
      message += `\n${desc}`;
    }

    const payload: NotificationPayload = {
      type: 'beans_priority_1',
      title: `🔴 Priority 1 Task`,
      message,
      priority: 'high',
      sourceId: item.id,
      timestamp: item.extractedAt
    };

    await this.notificationService.notify(payload);
    coreLogger.info('Priority 1 bean notification sent', { beanId: item.id });
  }

  private async pollServices(): Promise<void> {
    if (!this.servicesService || !this.notificationService) {
      return;
    }

    try {
      coreLogger.debug('Polling external services');

      // Sync all services
      await this.servicesService.syncAllServices();

      // Get high-priority requests
      const highPriorityRequests = this.servicesService.getRequests({
        priority: 'high',
        limit: 20
      });

      // Send notifications for new high-priority requests
      for (const request of highPriorityRequests) {
        if (!this.seenRequestIds.has(request.id)) {
          this.seenRequestIds.add(request.id);
          await this.notifyServiceRequest(request);
        }
      }
    } catch (error) {
      coreLogger.error('External services polling failed', { error });
    }
  }

  private async notifyServiceRequest(request: ServiceRequest): Promise<void> {
    if (!this.notificationService) return;

    // Determine notification type based on service
    const service = this.servicesService?.getServices().find(s => s.id === request.serviceId);
    const notificationType = service?.provider === 'samanage'
      ? 'samanage_new_request'
      : 'monday_update';

    let message = `**${request.title}**\n`;
    message += `Status: ${request.status.replace(/_/g, ' ')}\n`;
    if (request.assigneeName) {
      message += `Assignee: ${request.assigneeName}\n`;
    }
    if (request.category) {
      message += `Category: ${request.category}`;
    }

    const payload: NotificationPayload = {
      type: notificationType,
      title: service?.provider === 'samanage' ? '🔧 New Samanage Request' : '📋 Monday.com Update',
      message,
      priority: request.priority,
      sourceId: request.id,
      timestamp: request.updatedAt
    };

    await this.notificationService.notify(payload);
    coreLogger.info('External service notification sent', {
      requestId: request.id,
      provider: service?.provider
    });
  }
}

/**
 * Create integration manager
 */
export function createIntegrationManager(
  config?: Partial<IntegrationConfig>
): IntegrationManager {
  return new IntegrationManager(config);
}
