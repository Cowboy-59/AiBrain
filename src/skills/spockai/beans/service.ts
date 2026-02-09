/**
 * SpockAI BEANS Service
 * Core service for managing and scanning BEANS files
 */

import type { Bean, BeansConfig, BeansScanResult, BeansFilterOptions, PriorityItem } from './types.js';
import { BeansParser, createBeansParser } from './parser.js';
import { BeansScanner, createBeansScanner } from './scanner.js';
import { beansLogger } from '../utils/logger.js';

/**
 * BEANS Service
 * Manages scan paths, scanning, and bean retrieval
 */
export class BeansService {
  private config: BeansConfig;
  private parser: BeansParser;
  private scanner: BeansScanner;
  private beans: Map<string, Bean> = new Map();
  private scanInterval: NodeJS.Timeout | null = null;
  private lastScanResults: BeansScanResult[] = [];

  constructor(config: BeansConfig) {
    this.config = config;
    this.parser = createBeansParser();
    this.scanner = createBeansScanner();
    beansLogger.info('BEANS service initialized', { scanPaths: config.scanPaths });
  }

  /**
   * Start periodic scanning
   */
  startPeriodicScan(): void {
    if (this.scanInterval) {
      return;
    }

    const intervalMs = this.config.scanInterval * 60 * 1000;
    this.scanInterval = setInterval(() => {
      this.scanAllPaths().catch(error => {
        beansLogger.error('Periodic scan failed', { error });
      });
    }, intervalMs);

    beansLogger.info('Periodic scanning started', { intervalMinutes: this.config.scanInterval });
  }

  /**
   * Stop periodic scanning
   */
  stopPeriodicScan(): void {
    if (this.scanInterval) {
      clearInterval(this.scanInterval);
      this.scanInterval = null;
      beansLogger.info('Periodic scanning stopped');
    }
  }

  /**
   * Scan all configured paths
   */
  async scanAllPaths(): Promise<BeansScanResult[]> {
    if (!this.config.enabled) {
      beansLogger.warn('BEANS scanning is disabled');
      return [];
    }

    const results: BeansScanResult[] = [];

    for (const scanPath of this.config.scanPaths) {
      const result = await this.scanPath(scanPath);
      results.push(result);
    }

    this.lastScanResults = results;
    return results;
  }

  /**
   * Scan a single path
   */
  async scanPath(basePath: string): Promise<BeansScanResult> {
    beansLogger.info('Scanning path', { basePath });

    try {
      const beansFiles = await this.scanner.findBeansFiles(basePath);
      const beans = await this.parser.parseFiles(beansFiles);

      // Store beans by ID
      for (const bean of beans) {
        this.beans.set(bean.id, bean);
      }

      const priorityOneItems = this.parser.getPriorityOneItems(beans);

      const result: BeansScanResult = {
        path: basePath,
        beansFound: beans.length,
        priorityOneCount: priorityOneItems.length,
        scannedAt: new Date()
      };

      beansLogger.info('Scan complete', result);
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      beansLogger.error('Scan failed', { basePath, error: errorMessage });

      return {
        path: basePath,
        beansFound: 0,
        priorityOneCount: 0,
        scannedAt: new Date(),
        error: errorMessage
      };
    }
  }

  /**
   * Get all beans with optional filtering
   */
  getBeans(options: BeansFilterOptions = {}): Bean[] {
    let beans = Array.from(this.beans.values());

    if (options.priority !== undefined) {
      beans = this.parser.filterByPriority(beans, options.priority);
    }

    if (options.status) {
      beans = beans.filter(b => b.status === options.status);
    }

    if (options.type) {
      beans = beans.filter(b => b.type === options.type);
    }

    if (options.tag) {
      beans = beans.filter(b => b.tags?.includes(options.tag!));
    }

    if (options.path) {
      beans = beans.filter(b => b.sourceFile.startsWith(options.path!));
    }

    if (options.limit) {
      beans = beans.slice(0, options.limit);
    }

    return beans;
  }

  /**
   * Get bean by ID
   */
  getBean(id: string): Bean | undefined {
    return this.beans.get(id);
  }

  /**
   * Get priority 1 items
   */
  getPriorityOneItems(): PriorityItem[] {
    const beans = Array.from(this.beans.values());
    return this.parser.getPriorityOneItems(beans);
  }

  /**
   * Add scan path
   */
  addScanPath(path: string): boolean {
    if (this.config.scanPaths.includes(path)) {
      return false;
    }

    this.config.scanPaths.push(path);
    beansLogger.info('Scan path added', { path });
    return true;
  }

  /**
   * Remove scan path
   */
  removeScanPath(path: string): boolean {
    const index = this.config.scanPaths.indexOf(path);
    if (index === -1) {
      return false;
    }

    this.config.scanPaths.splice(index, 1);
    beansLogger.info('Scan path removed', { path });
    return true;
  }

  /**
   * Get scan paths
   */
  getScanPaths(): string[] {
    return [...this.config.scanPaths];
  }

  /**
   * Get last scan results
   */
  getLastScanResults(): BeansScanResult[] {
    return this.lastScanResults;
  }

  /**
   * Get service status
   */
  getStatus(): {
    enabled: boolean;
    scanPaths: string[];
    totalBeans: number;
    priorityOneCount: number;
    isScanning: boolean;
    lastScan?: Date;
  } {
    const priorityOne = this.getPriorityOneItems();
    const lastScan = this.lastScanResults.length > 0
      ? this.lastScanResults[0]?.scannedAt
      : undefined;

    return {
      enabled: this.config.enabled,
      scanPaths: this.config.scanPaths,
      totalBeans: this.beans.size,
      priorityOneCount: priorityOne.length,
      isScanning: this.scanInterval !== null,
      lastScan
    };
  }

  /**
   * Shutdown service
   */
  async shutdown(): Promise<void> {
    this.stopPeriodicScan();
    beansLogger.info('BEANS service shutdown');
  }
}

/**
 * Create BEANS service
 */
export function createBeansService(config: BeansConfig): BeansService {
  return new BeansService(config);
}
