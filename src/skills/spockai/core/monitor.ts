/**
 * SpockAI Resource Monitor
 * Monitors memory and CPU usage
 */

import { coreLogger } from '../utils/logger.js';
import { EventEmitter } from 'events';

export interface ResourceMetrics {
  memoryUsageMB: number;
  memoryLimitMB: number;
  memoryPercent: number;
  cpuUsagePercent: number;
  heapUsedMB: number;
  heapTotalMB: number;
  externalMB: number;
  uptimeSeconds: number;
  timestamp: Date;
}

export interface ResourceThresholds {
  maxMemoryMB: number;
  maxCpuPercent: number;
  warningMemoryMB: number;
  warningCpuPercent: number;
}

export interface MonitorConfig {
  sampleIntervalMs: number;
  thresholds: ResourceThresholds;
}

const DEFAULT_CONFIG: MonitorConfig = {
  sampleIntervalMs: 5000,
  thresholds: {
    maxMemoryMB: 100,
    maxCpuPercent: 5,
    warningMemoryMB: 80,
    warningCpuPercent: 4
  }
};

/**
 * Resource Monitor
 * Tracks memory and CPU usage with alerts
 */
export class ResourceMonitor extends EventEmitter {
  private config: MonitorConfig;
  private sampleInterval: NodeJS.Timeout | null = null;
  private lastCpuUsage: NodeJS.CpuUsage | null = null;
  private lastCpuTime: number = 0;
  private metrics: ResourceMetrics;
  private metricsHistory: ResourceMetrics[] = [];
  private maxHistoryLength = 60; // 5 minutes at 5s intervals

  constructor(config: Partial<MonitorConfig> = {}) {
    super();
    this.config = {
      ...DEFAULT_CONFIG,
      ...config,
      thresholds: { ...DEFAULT_CONFIG.thresholds, ...config.thresholds }
    };

    this.metrics = this.collectMetrics();
    coreLogger.info('Resource monitor initialized', this.config.thresholds);
  }

  /**
   * Start monitoring
   */
  start(): void {
    if (this.sampleInterval) {
      return;
    }

    this.sampleInterval = setInterval(() => {
      this.sample();
    }, this.config.sampleIntervalMs);

    // Initial sample
    this.sample();

    coreLogger.info('Resource monitoring started', {
      intervalMs: this.config.sampleIntervalMs
    });
  }

  /**
   * Stop monitoring
   */
  stop(): void {
    if (this.sampleInterval) {
      clearInterval(this.sampleInterval);
      this.sampleInterval = null;
      coreLogger.info('Resource monitoring stopped');
    }
  }

  /**
   * Take a sample
   */
  private sample(): void {
    this.metrics = this.collectMetrics();

    // Add to history
    this.metricsHistory.push(this.metrics);
    if (this.metricsHistory.length > this.maxHistoryLength) {
      this.metricsHistory.shift();
    }

    // Check thresholds
    this.checkThresholds();

    this.emit('sample', this.metrics);
  }

  /**
   * Collect current metrics
   */
  private collectMetrics(): ResourceMetrics {
    const memUsage = process.memoryUsage();
    const cpuUsage = this.calculateCpuUsage();

    return {
      memoryUsageMB: memUsage.rss / (1024 * 1024),
      memoryLimitMB: this.config.thresholds.maxMemoryMB,
      memoryPercent: (memUsage.rss / (1024 * 1024)) / this.config.thresholds.maxMemoryMB * 100,
      cpuUsagePercent: cpuUsage,
      heapUsedMB: memUsage.heapUsed / (1024 * 1024),
      heapTotalMB: memUsage.heapTotal / (1024 * 1024),
      externalMB: memUsage.external / (1024 * 1024),
      uptimeSeconds: process.uptime(),
      timestamp: new Date()
    };
  }

  /**
   * Calculate CPU usage percentage
   */
  private calculateCpuUsage(): number {
    const cpuUsage = process.cpuUsage(this.lastCpuUsage ?? undefined);
    const now = Date.now();

    if (this.lastCpuTime === 0) {
      this.lastCpuUsage = cpuUsage;
      this.lastCpuTime = now;
      return 0;
    }

    const timeDiff = (now - this.lastCpuTime) * 1000; // Convert to microseconds
    const totalCpu = cpuUsage.user + cpuUsage.system;
    const cpuPercent = (totalCpu / timeDiff) * 100;

    this.lastCpuUsage = cpuUsage;
    this.lastCpuTime = now;

    return Math.min(cpuPercent, 100);
  }

  /**
   * Check thresholds and emit warnings
   */
  private checkThresholds(): void {
    const { thresholds } = this.config;

    // Memory checks
    if (this.metrics.memoryUsageMB > thresholds.maxMemoryMB) {
      coreLogger.warn('Memory limit exceeded', {
        current: this.metrics.memoryUsageMB,
        limit: thresholds.maxMemoryMB
      });
      this.emit('memoryExceeded', this.metrics);
    } else if (this.metrics.memoryUsageMB > thresholds.warningMemoryMB) {
      this.emit('memoryWarning', this.metrics);
    }

    // CPU checks
    if (this.metrics.cpuUsagePercent > thresholds.maxCpuPercent) {
      coreLogger.warn('CPU limit exceeded', {
        current: this.metrics.cpuUsagePercent,
        limit: thresholds.maxCpuPercent
      });
      this.emit('cpuExceeded', this.metrics);
    } else if (this.metrics.cpuUsagePercent > thresholds.warningCpuPercent) {
      this.emit('cpuWarning', this.metrics);
    }
  }

  /**
   * Get current metrics
   */
  getMetrics(): ResourceMetrics {
    return { ...this.metrics };
  }

  /**
   * Get metrics history
   */
  getHistory(): ResourceMetrics[] {
    return [...this.metricsHistory];
  }

  /**
   * Get average metrics over history
   */
  getAverages(): {
    avgMemoryMB: number;
    avgCpuPercent: number;
    maxMemoryMB: number;
    maxCpuPercent: number;
  } {
    if (this.metricsHistory.length === 0) {
      return {
        avgMemoryMB: 0,
        avgCpuPercent: 0,
        maxMemoryMB: 0,
        maxCpuPercent: 0
      };
    }

    let totalMemory = 0;
    let totalCpu = 0;
    let maxMemory = 0;
    let maxCpu = 0;

    for (const m of this.metricsHistory) {
      totalMemory += m.memoryUsageMB;
      totalCpu += m.cpuUsagePercent;
      maxMemory = Math.max(maxMemory, m.memoryUsageMB);
      maxCpu = Math.max(maxCpu, m.cpuUsagePercent);
    }

    return {
      avgMemoryMB: totalMemory / this.metricsHistory.length,
      avgCpuPercent: totalCpu / this.metricsHistory.length,
      maxMemoryMB: maxMemory,
      maxCpuPercent: maxCpu
    };
  }

  /**
   * Check if within limits
   */
  isWithinLimits(): boolean {
    return (
      this.metrics.memoryUsageMB <= this.config.thresholds.maxMemoryMB &&
      this.metrics.cpuUsagePercent <= this.config.thresholds.maxCpuPercent
    );
  }

  /**
   * Format metrics for display
   */
  formatMetrics(): string {
    const m = this.metrics;
    const avg = this.getAverages();
    const { thresholds } = this.config;

    const memoryStatus = m.memoryUsageMB > thresholds.maxMemoryMB ? '🔴' :
      m.memoryUsageMB > thresholds.warningMemoryMB ? '🟡' : '🟢';
    const cpuStatus = m.cpuUsagePercent > thresholds.maxCpuPercent ? '🔴' :
      m.cpuUsagePercent > thresholds.warningCpuPercent ? '🟡' : '🟢';

    return `**Resource Usage**

${memoryStatus} **Memory**: ${m.memoryUsageMB.toFixed(1)} MB / ${thresholds.maxMemoryMB} MB (${m.memoryPercent.toFixed(1)}%)
  Heap: ${m.heapUsedMB.toFixed(1)} / ${m.heapTotalMB.toFixed(1)} MB

${cpuStatus} **CPU**: ${m.cpuUsagePercent.toFixed(2)}% (limit: ${thresholds.maxCpuPercent}%)

**Averages** (last ${this.metricsHistory.length} samples):
  Memory: ${avg.avgMemoryMB.toFixed(1)} MB (max: ${avg.maxMemoryMB.toFixed(1)} MB)
  CPU: ${avg.avgCpuPercent.toFixed(2)}% (max: ${avg.maxCpuPercent.toFixed(2)}%)

**Uptime**: ${formatDuration(m.uptimeSeconds * 1000)}`;
  }

  /**
   * Shutdown
   */
  shutdown(): void {
    this.stop();
    this.metricsHistory = [];
    this.removeAllListeners();
    coreLogger.info('Resource monitor shutdown');
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
 * Create resource monitor
 */
export function createResourceMonitor(config?: Partial<MonitorConfig>): ResourceMonitor {
  return new ResourceMonitor(config);
}
