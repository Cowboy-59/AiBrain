/**
 * SpockAI Health Check
 * Health check endpoint for uptime monitoring
 */

import { coreLogger } from '../utils/logger.js';
import type { RecoveryManager } from './recovery.js';
import type { ResourceMonitor } from './monitor.js';

export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  uptime: number;
  timestamp: Date;
  version: string;
  checks: HealthCheck[];
}

export interface HealthCheck {
  name: string;
  status: 'pass' | 'warn' | 'fail';
  message?: string;
  lastCheck: Date;
  duration?: number;
}

export interface HealthCheckConfig {
  serviceName: string;
  version: string;
  checkInterval: number; // Milliseconds
}

const DEFAULT_CONFIG: HealthCheckConfig = {
  serviceName: 'SpockAI',
  version: '0.1.0',
  checkInterval: 30000
};

/**
 * Health Check Manager
 * Provides health status for monitoring
 */
export class HealthCheckManager {
  private config: HealthCheckConfig;
  private startTime: Date;
  private checks: Map<string, HealthCheck> = new Map();
  private checkFunctions: Map<string, () => Promise<HealthCheck>> = new Map();
  private checkInterval: NodeJS.Timeout | null = null;
  private recoveryManager?: RecoveryManager;
  private resourceMonitor?: ResourceMonitor;

  constructor(config: Partial<HealthCheckConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.startTime = new Date();

    coreLogger.info('Health check manager initialized');
  }

  /**
   * Set recovery manager for health checking
   */
  setRecoveryManager(manager: RecoveryManager): void {
    this.recoveryManager = manager;
    this.registerCheck('recovery', async () => {
      const state = manager.getState();
      return {
        name: 'recovery',
        status: state.isRecovering ? 'warn' : (state.failureCount > 0 ? 'warn' : 'pass'),
        message: state.isRecovering
          ? `Recovering (attempt ${state.failureCount})`
          : (state.failureCount > 0 ? `${state.failureCount} recent failures` : 'No failures'),
        lastCheck: new Date()
      };
    });
  }

  /**
   * Set resource monitor for health checking
   */
  setResourceMonitor(monitor: ResourceMonitor): void {
    this.resourceMonitor = monitor;
    this.registerCheck('resources', async () => {
      const metrics = monitor.getMetrics();
      const memoryOk = metrics.memoryUsageMB < 100;
      const cpuOk = metrics.cpuUsagePercent < 5;

      return {
        name: 'resources',
        status: memoryOk && cpuOk ? 'pass' : 'warn',
        message: `Memory: ${metrics.memoryUsageMB.toFixed(1)}MB, CPU: ${metrics.cpuUsagePercent.toFixed(1)}%`,
        lastCheck: new Date()
      };
    });
  }

  /**
   * Register a health check
   */
  registerCheck(name: string, checkFn: () => Promise<HealthCheck>): void {
    this.checkFunctions.set(name, checkFn);
    coreLogger.debug('Health check registered', { name });
  }

  /**
   * Unregister a health check
   */
  unregisterCheck(name: string): void {
    this.checkFunctions.delete(name);
    this.checks.delete(name);
  }

  /**
   * Start periodic health checks
   */
  startPeriodicChecks(): void {
    if (this.checkInterval) {
      return;
    }

    this.checkInterval = setInterval(async () => {
      await this.runAllChecks();
    }, this.config.checkInterval);

    // Run immediately
    void this.runAllChecks();

    coreLogger.info('Periodic health checks started', {
      intervalMs: this.config.checkInterval
    });
  }

  /**
   * Stop periodic health checks
   */
  stopPeriodicChecks(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
      coreLogger.info('Periodic health checks stopped');
    }
  }

  /**
   * Run all health checks
   */
  async runAllChecks(): Promise<HealthCheck[]> {
    const results: HealthCheck[] = [];

    for (const [name, checkFn] of this.checkFunctions) {
      try {
        const start = Date.now();
        const result = await checkFn();
        result.duration = Date.now() - start;
        this.checks.set(name, result);
        results.push(result);
      } catch (error) {
        const failedCheck: HealthCheck = {
          name,
          status: 'fail',
          message: error instanceof Error ? error.message : 'Check failed',
          lastCheck: new Date()
        };
        this.checks.set(name, failedCheck);
        results.push(failedCheck);
      }
    }

    return results;
  }

  /**
   * Run a single health check
   */
  async runCheck(name: string): Promise<HealthCheck | null> {
    const checkFn = this.checkFunctions.get(name);
    if (!checkFn) {
      return null;
    }

    try {
      const start = Date.now();
      const result = await checkFn();
      result.duration = Date.now() - start;
      this.checks.set(name, result);
      return result;
    } catch (error) {
      const failedCheck: HealthCheck = {
        name,
        status: 'fail',
        message: error instanceof Error ? error.message : 'Check failed',
        lastCheck: new Date()
      };
      this.checks.set(name, failedCheck);
      return failedCheck;
    }
  }

  /**
   * Get overall health status
   */
  getStatus(): HealthStatus {
    const checks = Array.from(this.checks.values());
    const hasFailure = checks.some(c => c.status === 'fail');
    const hasWarning = checks.some(c => c.status === 'warn');

    let status: HealthStatus['status'];
    if (hasFailure) {
      status = 'unhealthy';
    } else if (hasWarning) {
      status = 'degraded';
    } else {
      status = 'healthy';
    }

    return {
      status,
      uptime: Date.now() - this.startTime.getTime(),
      timestamp: new Date(),
      version: this.config.version,
      checks
    };
  }

  /**
   * Get health status as HTTP response
   */
  getHttpResponse(): { statusCode: number; body: HealthStatus } {
    const status = this.getStatus();
    const statusCodes = {
      healthy: 200,
      degraded: 200,
      unhealthy: 503
    };

    return {
      statusCode: statusCodes[status.status],
      body: status
    };
  }

  /**
   * Format status for display
   */
  formatStatus(): string {
    const status = this.getStatus();
    const statusIcon = {
      healthy: '✅',
      degraded: '⚠️',
      unhealthy: '❌'
    }[status.status];

    let message = `${statusIcon} **SpockAI Health Status**: ${status.status.toUpperCase()}\n\n`;
    message += `**Uptime**: ${formatDuration(status.uptime)}\n`;
    message += `**Version**: ${status.version}\n\n`;

    if (status.checks.length > 0) {
      message += '**Checks**:\n';
      for (const check of status.checks) {
        const icon = { pass: '✅', warn: '⚠️', fail: '❌' }[check.status];
        message += `${icon} ${check.name}`;
        if (check.message) {
          message += `: ${check.message}`;
        }
        message += '\n';
      }
    }

    return message;
  }

  /**
   * Shutdown
   */
  shutdown(): void {
    this.stopPeriodicChecks();
    this.checks.clear();
    this.checkFunctions.clear();
    coreLogger.info('Health check manager shutdown');
  }
}

function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ${hours % 24}h`;
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
  return `${seconds}s`;
}

/**
 * Create health check manager
 */
export function createHealthCheckManager(config?: Partial<HealthCheckConfig>): HealthCheckManager {
  return new HealthCheckManager(config);
}
