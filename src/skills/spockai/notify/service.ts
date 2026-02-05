/**
 * SpockAI Notification Service
 * Central service for managing notifications across all channels
 */

import type {
  NotificationConfig,
  NotificationPayload,
  NotificationStatus,
  NotificationSendResult,
  NotificationRule,
  NotificationListener,
  Notifier
} from './types.js';
import type { NotificationEventType } from '../types/index.js';
import { TelegramNotifier, createTelegramNotifier } from './telegram.js';
import { NotificationQueue, createNotificationQueue } from './queue.js';
import { notifyLogger } from '../utils/logger.js';
import { randomUUID } from 'crypto';

/**
 * Notification Service
 * Manages notification delivery and rules
 */
export class NotificationService {
  private config: NotificationConfig;
  private notifier: Notifier | null = null;
  private queue: NotificationQueue;
  private listeners: Map<string, Set<NotificationListener>> = new Map();
  private initialized: boolean = false;

  constructor(config: NotificationConfig) {
    this.config = config;
    this.queue = createNotificationQueue(config.digestInterval);
  }

  /**
   * Initialize the notification service
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    notifyLogger.info('Initializing notification service', {
      channel: this.config.channel
    });

    // Create notifier based on channel
    if (this.config.channel === 'telegram' && this.config.telegram) {
      this.notifier = createTelegramNotifier(this.config.telegram);
    } else if (this.config.channel === 'teams' && this.config.teams) {
      // Teams notifier will be created in Phase 9
      notifyLogger.warn('Teams notifications not yet implemented');
    }

    if (this.notifier) {
      await this.notifier.connect();
      this.queue.setNotifier(this.notifier);
      this.queue.startDigestTimer();
    }

    this.initialized = true;
    notifyLogger.info('Notification service initialized');
  }

  /**
   * Shutdown the service
   */
  async shutdown(): Promise<void> {
    await this.queue.shutdown();

    if (this.notifier) {
      await this.notifier.disconnect();
    }

    this.initialized = false;
    notifyLogger.info('Notification service shut down');
  }

  /**
   * Send a notification
   */
  async notify(payload: NotificationPayload): Promise<NotificationSendResult> {
    // Check if this event type is enabled
    const rule = this.findRule(payload.type);
    if (!rule || !rule.enabled) {
      notifyLogger.debug('Notification skipped - rule disabled', {
        type: payload.type
      });
      return {
        success: false,
        error: 'Notification type disabled',
        timestamp: new Date()
      };
    }

    // Check priority threshold
    if (rule.options?.minPriority && payload.priority) {
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      const payloadPriority = priorityOrder[payload.priority];
      const minPriority = priorityOrder[rule.options.minPriority];

      if (payloadPriority > minPriority) {
        notifyLogger.debug('Notification skipped - below priority threshold', {
          type: payload.type,
          priority: payload.priority,
          minPriority: rule.options.minPriority
        });
        return {
          success: false,
          error: 'Below priority threshold',
          timestamp: new Date()
        };
      }
    }

    // Emit to listeners
    this.emitToListeners(payload);

    // Use digest mode by default
    const useDigest = rule.options?.digestMode !== false;

    if (useDigest) {
      const id = this.queue.enqueue(payload);
      return {
        success: true,
        messageId: id,
        timestamp: new Date()
      };
    } else {
      // Send immediately
      if (!this.notifier) {
        return {
          success: false,
          error: 'No notifier configured',
          timestamp: new Date()
        };
      }
      return this.notifier.send(payload);
    }
  }

  /**
   * Send a test notification
   */
  async sendTest(): Promise<NotificationSendResult> {
    if (this.notifier instanceof TelegramNotifier) {
      return this.notifier.sendTest();
    }

    return this.notify({
      type: 'high_priority_email',
      title: '🧪 Test Notification',
      message: 'This is a test notification from SpockAI.',
      timestamp: new Date()
    });
  }

  /**
   * Flush digest immediately
   */
  async flushDigest(): Promise<NotificationSendResult | null> {
    return this.queue.flushDigest();
  }

  /**
   * Get notification status
   */
  getStatus(): NotificationStatus {
    const queueStatus = this.queue.getStatus();

    return {
      channel: this.config.channel,
      connected: this.notifier?.isConnected() ?? false,
      queueSize: queueStatus.queueSize + queueStatus.digestBufferSize,
      rules: this.config.rules.map(r => ({
        type: r.eventType,
        enabled: r.enabled
      }))
    };
  }

  /**
   * Enable a notification type
   */
  enableRule(eventType: NotificationEventType): boolean {
    const rule = this.findRule(eventType);
    if (rule) {
      rule.enabled = true;
      notifyLogger.info('Notification rule enabled', { eventType });
      return true;
    }

    // Create new rule
    const newRule: NotificationRule = {
      id: randomUUID(),
      eventType,
      enabled: true
    };
    this.config.rules.push(newRule);
    notifyLogger.info('Notification rule created and enabled', { eventType });
    return true;
  }

  /**
   * Disable a notification type
   */
  disableRule(eventType: NotificationEventType): boolean {
    const rule = this.findRule(eventType);
    if (rule) {
      rule.enabled = false;
      notifyLogger.info('Notification rule disabled', { eventType });
      return true;
    }
    return false;
  }

  /**
   * Toggle a notification type
   */
  toggleRule(eventType: NotificationEventType): boolean {
    const rule = this.findRule(eventType);
    if (rule) {
      rule.enabled = !rule.enabled;
      notifyLogger.info('Notification rule toggled', {
        eventType,
        enabled: rule.enabled
      });
      return rule.enabled;
    }
    return false;
  }

  /**
   * Subscribe to notifications
   */
  subscribe(eventType: NotificationEventType | '*', listener: NotificationListener): void {
    const key = eventType;
    if (!this.listeners.has(key)) {
      this.listeners.set(key, new Set());
    }
    this.listeners.get(key)!.add(listener);
  }

  /**
   * Unsubscribe from notifications
   */
  unsubscribe(eventType: NotificationEventType | '*', listener: NotificationListener): void {
    this.listeners.get(eventType)?.delete(listener);
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<NotificationConfig>): void {
    Object.assign(this.config, config);

    if (config.digestInterval !== undefined) {
      this.queue.setDigestInterval(config.digestInterval);
    }

    notifyLogger.info('Notification config updated');
  }

  /**
   * Get current configuration
   */
  getConfig(): NotificationConfig {
    return { ...this.config };
  }

  // Private methods

  private findRule(eventType: NotificationEventType): NotificationRule | undefined {
    return this.config.rules.find(r => r.eventType === eventType);
  }

  private emitToListeners(payload: NotificationPayload): void {
    // Emit to specific type listeners
    const typeListeners = this.listeners.get(payload.type);
    if (typeListeners) {
      for (const listener of typeListeners) {
        try {
          void listener(payload);
        } catch (error) {
          notifyLogger.error('Notification listener error', { error });
        }
      }
    }

    // Emit to wildcard listeners
    const wildcardListeners = this.listeners.get('*');
    if (wildcardListeners) {
      for (const listener of wildcardListeners) {
        try {
          void listener(payload);
        } catch (error) {
          notifyLogger.error('Notification listener error', { error });
        }
      }
    }
  }
}

/**
 * Create notification service from config
 */
export function createNotificationService(config: NotificationConfig): NotificationService {
  return new NotificationService(config);
}
