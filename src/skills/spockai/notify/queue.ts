/**
 * SpockAI Notification Queue
 * Handles rate-limited notification delivery with digest mode
 */

import type {
  NotificationPayload,
  QueuedNotification,
  NotificationSendResult,
  Notifier
} from './types.js';
import { notifyLogger } from '../utils/logger.js';
import { randomUUID } from 'crypto';

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 5000;

/**
 * Notification Queue with rate limiting and digest mode
 */
export class NotificationQueue {
  private queue: QueuedNotification[] = [];
  private digestBuffer: NotificationPayload[] = [];
  private notifier: Notifier | null = null;
  private digestInterval: number; // minutes
  private digestTimer: NodeJS.Timeout | null = null;
  private isProcessing: boolean = false;

  constructor(digestInterval: number = 5) {
    this.digestInterval = digestInterval;
  }

  /**
   * Set the notifier instance
   */
  setNotifier(notifier: Notifier): void {
    this.notifier = notifier;
  }

  /**
   * Set digest interval
   */
  setDigestInterval(minutes: number): void {
    this.digestInterval = minutes;
    if (this.digestTimer) {
      this.stopDigestTimer();
      this.startDigestTimer();
    }
  }

  /**
   * Add notification to queue
   */
  enqueue(payload: NotificationPayload): string {
    const notification: QueuedNotification = {
      id: randomUUID(),
      payload,
      queuedAt: new Date(),
      attempts: 0
    };

    // Add to digest buffer for batching
    this.digestBuffer.push(payload);
    notifyLogger.debug('Notification added to digest buffer', {
      id: notification.id,
      type: payload.type,
      bufferSize: this.digestBuffer.length
    });

    return notification.id;
  }

  /**
   * Add notification for immediate delivery (bypasses digest)
   */
  enqueueImmediate(payload: NotificationPayload): string {
    const notification: QueuedNotification = {
      id: randomUUID(),
      payload,
      queuedAt: new Date(),
      attempts: 0
    };

    this.queue.push(notification);
    notifyLogger.debug('Notification queued for immediate delivery', {
      id: notification.id,
      type: payload.type
    });

    // Start processing if not already
    if (!this.isProcessing) {
      void this.processQueue();
    }

    return notification.id;
  }

  /**
   * Start the digest timer
   */
  startDigestTimer(): void {
    if (this.digestTimer) {
      return;
    }

    const intervalMs = this.digestInterval * 60 * 1000;
    this.digestTimer = setInterval(() => {
      void this.flushDigest();
    }, intervalMs);

    notifyLogger.info('Digest timer started', { intervalMinutes: this.digestInterval });
  }

  /**
   * Stop the digest timer
   */
  stopDigestTimer(): void {
    if (this.digestTimer) {
      clearInterval(this.digestTimer);
      this.digestTimer = null;
    }
  }

  /**
   * Flush the digest buffer and send bundled notification
   */
  async flushDigest(): Promise<NotificationSendResult | null> {
    if (this.digestBuffer.length === 0) {
      return null;
    }

    if (!this.notifier) {
      notifyLogger.warn('No notifier configured, digest not sent');
      return null;
    }

    const items = [...this.digestBuffer];
    this.digestBuffer = [];

    notifyLogger.info('Sending digest notification', { itemCount: items.length });

    try {
      const result = await this.notifier.sendDigest(items);
      return result;
    } catch (error) {
      notifyLogger.error('Failed to send digest', { error });
      // Re-queue items for next digest
      this.digestBuffer.push(...items);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date()
      };
    }
  }

  /**
   * Process the immediate queue
   */
  private async processQueue(): Promise<void> {
    if (this.isProcessing || !this.notifier) {
      return;
    }

    this.isProcessing = true;

    while (this.queue.length > 0) {
      const notification = this.queue[0];
      if (!notification) break;

      try {
        const result = await this.notifier.send(notification.payload);

        if (result.success) {
          this.queue.shift(); // Remove from queue
          notifyLogger.debug('Notification sent successfully', {
            id: notification.id,
            messageId: result.messageId
          });
        } else {
          await this.handleFailure(notification, result.error);
        }
      } catch (error) {
        await this.handleFailure(
          notification,
          error instanceof Error ? error.message : 'Unknown error'
        );
      }

      // Small delay between sends to avoid rate limiting
      await this.delay(100);
    }

    this.isProcessing = false;
  }

  /**
   * Handle send failure
   */
  private async handleFailure(notification: QueuedNotification, error?: string): Promise<void> {
    notification.attempts++;
    notification.lastAttempt = new Date();
    notification.error = error;

    if (notification.attempts >= MAX_RETRIES) {
      this.queue.shift(); // Remove from queue
      notifyLogger.error('Notification failed after max retries', {
        id: notification.id,
        attempts: notification.attempts,
        error
      });
    } else {
      notifyLogger.warn('Notification send failed, will retry', {
        id: notification.id,
        attempts: notification.attempts,
        error
      });
      await this.delay(RETRY_DELAY_MS);
    }
  }

  /**
   * Get queue status
   */
  getStatus(): { queueSize: number; digestBufferSize: number; isProcessing: boolean } {
    return {
      queueSize: this.queue.length,
      digestBufferSize: this.digestBuffer.length,
      isProcessing: this.isProcessing
    };
  }

  /**
   * Clear all queued notifications
   */
  clear(): void {
    this.queue = [];
    this.digestBuffer = [];
  }

  /**
   * Shutdown the queue
   */
  async shutdown(): Promise<void> {
    this.stopDigestTimer();

    // Flush remaining digest
    if (this.digestBuffer.length > 0) {
      await this.flushDigest();
    }

    this.clear();
  }

  /**
   * Delay helper
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Create notification queue with default settings
 */
export function createNotificationQueue(digestInterval: number = 5): NotificationQueue {
  return new NotificationQueue(digestInterval);
}
