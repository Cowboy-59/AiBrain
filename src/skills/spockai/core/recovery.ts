/**
 * SpockAI Error Recovery
 * Graceful error recovery with automatic restart
 */

import { coreLogger } from '../utils/logger.js';
import { EventEmitter } from 'events';

export interface RecoveryConfig {
  maxRetries: number;
  retryDelayMs: number;
  backoffMultiplier: number;
  maxBackoffMs: number;
  resetAfterMs: number;
}

export interface RecoveryState {
  failureCount: number;
  lastFailure?: Date;
  lastRecovery?: Date;
  isRecovering: boolean;
  currentBackoffMs: number;
}

const DEFAULT_CONFIG: RecoveryConfig = {
  maxRetries: 5,
  retryDelayMs: 1000,
  backoffMultiplier: 2,
  maxBackoffMs: 60000,
  resetAfterMs: 300000 // 5 minutes
};

/**
 * Recovery Manager
 * Handles graceful error recovery with exponential backoff
 */
export class RecoveryManager extends EventEmitter {
  private config: RecoveryConfig;
  private state: RecoveryState;
  private recoveryTimer: NodeJS.Timeout | null = null;

  constructor(config: Partial<RecoveryConfig> = {}) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.state = {
      failureCount: 0,
      isRecovering: false,
      currentBackoffMs: this.config.retryDelayMs
    };

    coreLogger.info('Recovery manager initialized', this.config);
  }

  /**
   * Report a failure and trigger recovery if needed
   */
  async reportFailure(error: Error, context?: string): Promise<boolean> {
    const now = new Date();

    // Reset failure count if enough time has passed
    if (this.state.lastFailure) {
      const timeSinceLastFailure = now.getTime() - this.state.lastFailure.getTime();
      if (timeSinceLastFailure > this.config.resetAfterMs) {
        this.resetState();
      }
    }

    this.state.failureCount++;
    this.state.lastFailure = now;

    coreLogger.error('Failure reported', {
      error: error.message,
      context,
      failureCount: this.state.failureCount,
      maxRetries: this.config.maxRetries
    });

    this.emit('failure', { error, context, failureCount: this.state.failureCount });

    // Check if we've exceeded max retries
    if (this.state.failureCount > this.config.maxRetries) {
      coreLogger.fatal('Max retries exceeded, giving up', {
        failureCount: this.state.failureCount
      });
      this.emit('maxRetriesExceeded', { error, failureCount: this.state.failureCount });
      return false;
    }

    // Schedule recovery
    return this.scheduleRecovery();
  }

  /**
   * Schedule a recovery attempt
   */
  private scheduleRecovery(): Promise<boolean> {
    return new Promise((resolve) => {
      if (this.state.isRecovering) {
        coreLogger.debug('Recovery already in progress');
        resolve(false);
        return;
      }

      this.state.isRecovering = true;

      coreLogger.info('Scheduling recovery', {
        backoffMs: this.state.currentBackoffMs,
        attempt: this.state.failureCount
      });

      this.recoveryTimer = setTimeout(async () => {
        try {
          this.emit('recovering', { attempt: this.state.failureCount });

          // The actual recovery action is handled by the listener
          // This just signals that recovery should be attempted

          this.state.lastRecovery = new Date();
          this.state.isRecovering = false;

          // Increase backoff for next failure
          this.state.currentBackoffMs = Math.min(
            this.state.currentBackoffMs * this.config.backoffMultiplier,
            this.config.maxBackoffMs
          );

          this.emit('recovered', { attempt: this.state.failureCount });
          resolve(true);
        } catch (error) {
          this.state.isRecovering = false;
          coreLogger.error('Recovery attempt failed', { error });
          resolve(false);
        }
      }, this.state.currentBackoffMs);
    });
  }

  /**
   * Report successful operation (resets failure count)
   */
  reportSuccess(): void {
    if (this.state.failureCount > 0) {
      coreLogger.info('Success reported, resetting failure count');
      this.resetState();
      this.emit('success');
    }
  }

  /**
   * Reset recovery state
   */
  private resetState(): void {
    this.state.failureCount = 0;
    this.state.currentBackoffMs = this.config.retryDelayMs;

    if (this.recoveryTimer) {
      clearTimeout(this.recoveryTimer);
      this.recoveryTimer = null;
    }
  }

  /**
   * Get current state
   */
  getState(): RecoveryState {
    return { ...this.state };
  }

  /**
   * Check if system is healthy
   */
  isHealthy(): boolean {
    return this.state.failureCount === 0 && !this.state.isRecovering;
  }

  /**
   * Wrap an async function with recovery
   */
  async withRecovery<T>(
    fn: () => Promise<T>,
    context?: string
  ): Promise<T> {
    try {
      const result = await fn();
      this.reportSuccess();
      return result;
    } catch (error) {
      const shouldRetry = await this.reportFailure(
        error instanceof Error ? error : new Error(String(error)),
        context
      );

      if (shouldRetry) {
        // Wait for recovery event and retry
        return new Promise((resolve, reject) => {
          this.once('recovering', async () => {
            try {
              const result = await fn();
              resolve(result);
            } catch (retryError) {
              reject(retryError);
            }
          });
        });
      }

      throw error;
    }
  }

  /**
   * Shutdown
   */
  shutdown(): void {
    if (this.recoveryTimer) {
      clearTimeout(this.recoveryTimer);
      this.recoveryTimer = null;
    }
    this.removeAllListeners();
    coreLogger.info('Recovery manager shutdown');
  }
}

/**
 * Create recovery manager
 */
export function createRecoveryManager(config?: Partial<RecoveryConfig>): RecoveryManager {
  return new RecoveryManager(config);
}
