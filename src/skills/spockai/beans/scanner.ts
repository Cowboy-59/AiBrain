/**
 * SpockAI BEANS Scanner
 * Scans directories for .beans/ folders and extracts priority items
 */

import { readdir } from 'fs/promises';
import { join, resolve } from 'path';
import { existsSync } from 'fs';
import type {
  Bean,
  BeansScanResult,
  BeansFilterOptions,
  BeansDirectoryStatus,
  PriorityItem
} from './types.js';
import { BeansParser, createBeansParser } from './parser.js';
import { beansLogger } from '../utils/logger.js';

const BEANS_DIR_NAME = '.beans';

/**
 * BEANS Directory Scanner
 */
export class BeansScanner {
  private parser: BeansParser;
  private scanPaths: string[] = [];
  private beans: Map<string, Bean[]> = new Map(); // path -> beans
  private scanInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.parser = createBeansParser();
  }

  /**
   * Add a scan path
   */
  addPath(path: string): boolean {
    const resolved = resolve(path);

    if (this.scanPaths.includes(resolved)) {
      return false;
    }

    if (!existsSync(resolved)) {
      beansLogger.warn('BEANS path does not exist', { path: resolved });
      return false;
    }

    this.scanPaths.push(resolved);
    this.beans.set(resolved, []);
    beansLogger.info('BEANS scan path added', { path: resolved });

    return true;
  }

  /**
   * Remove a scan path
   */
  removePath(path: string): boolean {
    const resolved = resolve(path);
    const index = this.scanPaths.indexOf(resolved);

    if (index === -1) {
      return false;
    }

    this.scanPaths.splice(index, 1);
    this.beans.delete(resolved);
    beansLogger.info('BEANS scan path removed', { path: resolved });

    return true;
  }

  /**
   * Get all scan paths
   */
  getPaths(): string[] {
    return [...this.scanPaths];
  }

  /**
   * Scan a single path for .beans/ directories
   */
  async scanPath(basePath: string): Promise<BeansScanResult> {
    const resolved = resolve(basePath);
    beansLogger.info('Scanning for BEANS', { path: resolved });

    try {
      const beansDirs = await this.findBeansDirs(resolved);
      const allBeans: Bean[] = [];

      for (const beansDir of beansDirs) {
        const files = await this.findBeansFiles(beansDir);
        const beans = await this.parser.parseFiles(files);
        allBeans.push(...beans);
      }

      this.beans.set(resolved, allBeans);

      const priorityOneCount = allBeans.filter(b => this.parser.isPriorityOne(b)).length;

      const result: BeansScanResult = {
        path: resolved,
        beansFound: allBeans.length,
        priorityOneCount,
        scannedAt: new Date()
      };

      beansLogger.info('BEANS scan complete', result);
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      beansLogger.error('BEANS scan failed', { path: resolved, error: errorMessage });

      return {
        path: resolved,
        beansFound: 0,
        priorityOneCount: 0,
        scannedAt: new Date(),
        error: errorMessage
      };
    }
  }

  /**
   * Scan all configured paths
   */
  async scanAll(): Promise<BeansScanResult[]> {
    const results: BeansScanResult[] = [];

    for (const path of this.scanPaths) {
      const result = await this.scanPath(path);
      results.push(result);
    }

    return results;
  }

  /**
   * Get all beans with optional filtering
   */
  getBeans(options: BeansFilterOptions = {}): Bean[] {
    let allBeans: Bean[] = [];

    if (options.path) {
      const resolved = resolve(options.path);
      allBeans = this.beans.get(resolved) ?? [];
    } else {
      for (const beans of this.beans.values()) {
        allBeans.push(...beans);
      }
    }

    // Apply filters
    let filtered = allBeans;

    if (options.priority !== undefined) {
      filtered = this.parser.filterByPriority(filtered, options.priority);
    }

    if (options.status) {
      filtered = filtered.filter(b => b.status === options.status);
    }

    if (options.type) {
      filtered = filtered.filter(b => b.type === options.type);
    }

    if (options.tag) {
      const tagLower = options.tag.toLowerCase();
      filtered = filtered.filter(b =>
        b.tags?.some(t => t.toLowerCase() === tagLower)
      );
    }

    // Sort by priority (1 first)
    filtered.sort((a, b) => {
      const aPriority = typeof a.priority === 'number' ? a.priority : 99;
      const bPriority = typeof b.priority === 'number' ? b.priority : 99;
      return aPriority - bPriority;
    });

    // Apply limit
    if (options.limit) {
      filtered = filtered.slice(0, options.limit);
    }

    return filtered;
  }

  /**
   * Get priority 1 items
   */
  getPriorityOneItems(): PriorityItem[] {
    const allBeans: Bean[] = [];
    for (const beans of this.beans.values()) {
      allBeans.push(...beans);
    }

    return this.parser.getPriorityOneItems(allBeans);
  }

  /**
   * Get directory statuses
   */
  getDirectoryStatuses(): BeansDirectoryStatus[] {
    return this.scanPaths.map(path => {
      const beans = this.beans.get(path) ?? [];
      const priorityOneCount = beans.filter(b => this.parser.isPriorityOne(b)).length;

      return {
        path,
        enabled: true,
        beansCount: beans.length,
        priorityOneCount
      };
    });
  }

  /**
   * Start periodic scanning
   */
  startPeriodicScan(intervalMinutes: number): void {
    if (this.scanInterval) {
      this.stopPeriodicScan();
    }

    const intervalMs = intervalMinutes * 60 * 1000;
    this.scanInterval = setInterval(() => {
      void this.scanAll();
    }, intervalMs);

    beansLogger.info('Started periodic BEANS scanning', { intervalMinutes });
  }

  /**
   * Stop periodic scanning
   */
  stopPeriodicScan(): void {
    if (this.scanInterval) {
      clearInterval(this.scanInterval);
      this.scanInterval = null;
    }
  }

  /**
   * Shutdown scanner
   */
  async shutdown(): Promise<void> {
    this.stopPeriodicScan();
  }

  // Private helpers

  /**
   * Find all .beans/ directories under a path
   */
  private async findBeansDirs(basePath: string): Promise<string[]> {
    const beansDirs: string[] = [];

    // Check if basePath itself is a .beans directory
    if (basePath.endsWith(BEANS_DIR_NAME)) {
      if (existsSync(basePath)) {
        beansDirs.push(basePath);
      }
      return beansDirs;
    }

    // Check for .beans directly under basePath
    const directBeansPath = join(basePath, BEANS_DIR_NAME);
    if (existsSync(directBeansPath)) {
      beansDirs.push(directBeansPath);
    }

    // Recursively search subdirectories (limit depth to 3)
    await this.searchForBeansDirs(basePath, beansDirs, 0, 3);

    return beansDirs;
  }

  private async searchForBeansDirs(
    dir: string,
    results: string[],
    depth: number,
    maxDepth: number
  ): Promise<void> {
    if (depth >= maxDepth) return;

    try {
      const entries = await readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
        if (entry.isDirectory()) {
          const fullPath = join(dir, entry.name);

          if (entry.name === BEANS_DIR_NAME) {
            results.push(fullPath);
          } else if (!entry.name.startsWith('.') && entry.name !== 'node_modules') {
            await this.searchForBeansDirs(fullPath, results, depth + 1, maxDepth);
          }
        }
      }
    } catch {
      // Ignore permission errors
    }
  }

  /**
   * Find all markdown files in a .beans directory
   */
  async findBeansFiles(beansDir: string): Promise<string[]> {
    const files: string[] = [];

    try {
      const entries = await readdir(beansDir, { withFileTypes: true });

      for (const entry of entries) {
        if (entry.isFile() && entry.name.endsWith('.md')) {
          files.push(join(beansDir, entry.name));
        }
      }
    } catch (error) {
      beansLogger.error('Failed to read BEANS directory', { dir: beansDir, error });
    }

    return files;
  }
}

/**
 * Create beans scanner
 */
export function createBeansScanner(): BeansScanner {
  return new BeansScanner();
}
