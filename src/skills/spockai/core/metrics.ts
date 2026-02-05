/**
 * SpockAI Metrics
 * Priority classification accuracy and performance metrics
 */

import { coreLogger } from '../utils/logger.js';

export interface ClassificationMetrics {
  totalClassified: number;
  correctClassifications: number;
  incorrectClassifications: number;
  accuracy: number;
  byPriority: Map<string, PriorityMetrics>;
  lastUpdated: Date;
}

export interface PriorityMetrics {
  total: number;
  correct: number;
  incorrect: number;
  falsePositives: number;
  falseNegatives: number;
  precision: number;
  recall: number;
  f1Score: number;
}

export interface PerformanceMetrics {
  operationCounts: Map<string, number>;
  operationDurations: Map<string, number[]>;
  errorCounts: Map<string, number>;
  lastUpdated: Date;
}

/**
 * Metrics Collector
 * Tracks classification accuracy and performance
 */
export class MetricsCollector {
  private classificationMetrics: ClassificationMetrics;
  private performanceMetrics: PerformanceMetrics;
  private targetAccuracy = 0.90; // 90% target

  constructor() {
    this.classificationMetrics = {
      totalClassified: 0,
      correctClassifications: 0,
      incorrectClassifications: 0,
      accuracy: 0,
      byPriority: new Map(),
      lastUpdated: new Date()
    };

    this.performanceMetrics = {
      operationCounts: new Map(),
      operationDurations: new Map(),
      errorCounts: new Map(),
      lastUpdated: new Date()
    };

    coreLogger.info('Metrics collector initialized');
  }

  /**
   * Record a classification result
   */
  recordClassification(
    predicted: string,
    actual: string,
    isCorrect: boolean
  ): void {
    this.classificationMetrics.totalClassified++;

    if (isCorrect) {
      this.classificationMetrics.correctClassifications++;
    } else {
      this.classificationMetrics.incorrectClassifications++;
    }

    // Update accuracy
    this.classificationMetrics.accuracy =
      this.classificationMetrics.correctClassifications /
      this.classificationMetrics.totalClassified;

    // Update priority-specific metrics
    this.updatePriorityMetrics(predicted, actual, isCorrect);
    this.classificationMetrics.lastUpdated = new Date();
  }

  /**
   * Update priority-specific metrics
   */
  private updatePriorityMetrics(
    predicted: string,
    actual: string,
    isCorrect: boolean
  ): void {
    // Get or create metrics for predicted priority
    if (!this.classificationMetrics.byPriority.has(predicted)) {
      this.classificationMetrics.byPriority.set(predicted, this.createEmptyPriorityMetrics());
    }

    // Get or create metrics for actual priority
    if (!this.classificationMetrics.byPriority.has(actual)) {
      this.classificationMetrics.byPriority.set(actual, this.createEmptyPriorityMetrics());
    }

    const predictedMetrics = this.classificationMetrics.byPriority.get(predicted)!;
    const actualMetrics = this.classificationMetrics.byPriority.get(actual)!;

    if (isCorrect) {
      predictedMetrics.correct++;
      actualMetrics.correct++;
    } else {
      predictedMetrics.incorrect++;
      actualMetrics.incorrect++;

      // False positive: predicted this priority but was actually different
      predictedMetrics.falsePositives++;

      // False negative: should have been this priority but wasn't predicted
      actualMetrics.falseNegatives++;
    }

    predictedMetrics.total++;

    // Recalculate precision, recall, F1
    this.calculateF1Metrics(predictedMetrics);
    this.calculateF1Metrics(actualMetrics);
  }

  /**
   * Create empty priority metrics
   */
  private createEmptyPriorityMetrics(): PriorityMetrics {
    return {
      total: 0,
      correct: 0,
      incorrect: 0,
      falsePositives: 0,
      falseNegatives: 0,
      precision: 0,
      recall: 0,
      f1Score: 0
    };
  }

  /**
   * Calculate F1 metrics
   */
  private calculateF1Metrics(metrics: PriorityMetrics): void {
    // Precision = TP / (TP + FP)
    const truePositives = metrics.correct;
    metrics.precision = truePositives > 0
      ? truePositives / (truePositives + metrics.falsePositives)
      : 0;

    // Recall = TP / (TP + FN)
    metrics.recall = truePositives > 0
      ? truePositives / (truePositives + metrics.falseNegatives)
      : 0;

    // F1 = 2 * (precision * recall) / (precision + recall)
    metrics.f1Score = (metrics.precision + metrics.recall) > 0
      ? 2 * (metrics.precision * metrics.recall) / (metrics.precision + metrics.recall)
      : 0;
  }

  /**
   * Record an operation
   */
  recordOperation(operation: string, durationMs: number, error?: Error): void {
    // Count
    const count = this.performanceMetrics.operationCounts.get(operation) || 0;
    this.performanceMetrics.operationCounts.set(operation, count + 1);

    // Duration
    if (!this.performanceMetrics.operationDurations.has(operation)) {
      this.performanceMetrics.operationDurations.set(operation, []);
    }
    const durations = this.performanceMetrics.operationDurations.get(operation)!;
    durations.push(durationMs);

    // Keep last 100 durations
    if (durations.length > 100) {
      durations.shift();
    }

    // Error count
    if (error) {
      const errorCount = this.performanceMetrics.errorCounts.get(operation) || 0;
      this.performanceMetrics.errorCounts.set(operation, errorCount + 1);
    }

    this.performanceMetrics.lastUpdated = new Date();
  }

  /**
   * Get classification metrics
   */
  getClassificationMetrics(): ClassificationMetrics {
    return {
      ...this.classificationMetrics,
      byPriority: new Map(this.classificationMetrics.byPriority)
    };
  }

  /**
   * Get performance metrics
   */
  getPerformanceMetrics(): PerformanceMetrics {
    return {
      ...this.performanceMetrics,
      operationCounts: new Map(this.performanceMetrics.operationCounts),
      operationDurations: new Map(this.performanceMetrics.operationDurations),
      errorCounts: new Map(this.performanceMetrics.errorCounts)
    };
  }

  /**
   * Check if accuracy target is met
   */
  isAccuracyTargetMet(): boolean {
    return this.classificationMetrics.accuracy >= this.targetAccuracy;
  }

  /**
   * Get average operation duration
   */
  getAverageDuration(operation: string): number | null {
    const durations = this.performanceMetrics.operationDurations.get(operation);
    if (!durations || durations.length === 0) {
      return null;
    }

    return durations.reduce((a, b) => a + b, 0) / durations.length;
  }

  /**
   * Format metrics for display
   */
  formatClassificationMetrics(): string {
    const m = this.classificationMetrics;
    const targetMet = this.isAccuracyTargetMet();
    const icon = targetMet ? '✅' : '⚠️';

    let message = `**Classification Metrics**\n\n`;
    message += `${icon} **Overall Accuracy**: ${(m.accuracy * 100).toFixed(1)}% (target: ${this.targetAccuracy * 100}%)\n`;
    message += `Total: ${m.totalClassified} | Correct: ${m.correctClassifications} | Incorrect: ${m.incorrectClassifications}\n\n`;

    if (m.byPriority.size > 0) {
      message += `**By Priority**:\n`;
      for (const [priority, metrics] of m.byPriority) {
        message += `• **${priority}**: P=${(metrics.precision * 100).toFixed(1)}%, R=${(metrics.recall * 100).toFixed(1)}%, F1=${(metrics.f1Score * 100).toFixed(1)}%\n`;
      }
    }

    return message;
  }

  /**
   * Format performance metrics for display
   */
  formatPerformanceMetrics(): string {
    const m = this.performanceMetrics;

    let message = `**Performance Metrics**\n\n`;

    if (m.operationCounts.size === 0) {
      message += '_No operations recorded_';
      return message;
    }

    message += `**Operations**:\n`;
    for (const [op, count] of m.operationCounts) {
      const avgDuration = this.getAverageDuration(op);
      const errorCount = m.errorCounts.get(op) || 0;
      const errorRate = count > 0 ? (errorCount / count * 100).toFixed(1) : '0';

      message += `• **${op}**: ${count} calls`;
      if (avgDuration !== null) {
        message += `, avg ${avgDuration.toFixed(1)}ms`;
      }
      if (errorCount > 0) {
        message += `, ${errorRate}% errors`;
      }
      message += '\n';
    }

    return message;
  }

  /**
   * Reset metrics
   */
  reset(): void {
    this.classificationMetrics = {
      totalClassified: 0,
      correctClassifications: 0,
      incorrectClassifications: 0,
      accuracy: 0,
      byPriority: new Map(),
      lastUpdated: new Date()
    };

    this.performanceMetrics = {
      operationCounts: new Map(),
      operationDurations: new Map(),
      errorCounts: new Map(),
      lastUpdated: new Date()
    };

    coreLogger.info('Metrics reset');
  }
}

/**
 * Create metrics collector
 */
export function createMetricsCollector(): MetricsCollector {
  return new MetricsCollector();
}
