/**
 * SpockAI BEANS Parser
 * Parses hmans/beans format files with YAML frontmatter
 * @see https://github.com/hmans/beans
 */

import matter from 'gray-matter';
import { readFile, stat } from 'fs/promises';
import { basename, extname } from 'path';
import type { Bean, BeanFrontmatter, BeansFile, PriorityItem } from './types.js';
import type { BeanStatus, BeanType } from '../types/index.js';
import { beansLogger } from '../utils/logger.js';
import { randomUUID } from 'crypto';

// BEANS filename pattern: beans-{nanoid}.md or beans-{nanoid}-{slug}.md
const BEANS_FILENAME_PATTERN = /^beans-([a-z0-9]+)(?:-(.+))?\.md$/i;

/**
 * BEANS File Parser
 */
export class BeansParser {
  /**
   * Parse a single BEANS file
   */
  async parseFile(filePath: string): Promise<Bean | null> {
    try {
      const content = await readFile(filePath, 'utf-8');
      const fileStat = await stat(filePath);
      const fileInfo = this.parseFilename(filePath);

      if (!fileInfo) {
        beansLogger.warn('Invalid BEANS filename', { filePath });
        return null;
      }

      // Parse YAML frontmatter
      const { data, content: body } = matter(content);
      const frontmatter = data as BeanFrontmatter;

      if (!frontmatter.title) {
        beansLogger.warn('BEANS file missing title', { filePath });
        return null;
      }

      const bean: Bean = {
        id: fileInfo.id,
        slug: fileInfo.slug,
        title: frontmatter.title,
        status: this.parseStatus(frontmatter.status),
        type: this.parseType(frontmatter.type),
        priority: frontmatter.priority,
        tags: frontmatter.tags,
        parent: frontmatter.parent,
        blocking: frontmatter.blocking,
        blockedBy: frontmatter.blocked_by,
        body: body.trim(),
        sourceFile: filePath,
        createdAt: frontmatter.created_at ? new Date(frontmatter.created_at) : undefined,
        updatedAt: frontmatter.updated_at
          ? new Date(frontmatter.updated_at)
          : fileStat.mtime
      };

      return bean;
    } catch (error) {
      beansLogger.error('Failed to parse BEANS file', { filePath, error });
      return null;
    }
  }

  /**
   * Parse multiple BEANS files
   */
  async parseFiles(filePaths: string[]): Promise<Bean[]> {
    const beans: Bean[] = [];

    for (const filePath of filePaths) {
      const bean = await this.parseFile(filePath);
      if (bean) {
        beans.push(bean);
      }
    }

    return beans;
  }

  /**
   * Parse filename to extract ID and slug
   */
  parseFilename(filePath: string): BeansFile | null {
    const filename = basename(filePath);
    const match = filename.match(BEANS_FILENAME_PATTERN);

    if (!match) {
      // Try generic markdown file
      if (extname(filename).toLowerCase() === '.md') {
        return {
          path: filePath,
          filename,
          id: randomUUID().substring(0, 8),
          lastModified: new Date()
        };
      }
      return null;
    }

    return {
      path: filePath,
      filename,
      id: match[1] ?? randomUUID().substring(0, 8),
      slug: match[2],
      lastModified: new Date()
    };
  }

  /**
   * Convert bean to priority item
   */
  toPriorityItem(bean: Bean): PriorityItem {
    return {
      id: bean.id,
      title: bean.title,
      description: bean.body.substring(0, 200),
      priority: bean.priority ?? 4,
      status: bean.status,
      type: bean.type,
      sourceFile: bean.sourceFile,
      extractedAt: new Date()
    };
  }

  /**
   * Check if a bean is priority 1
   */
  isPriorityOne(bean: Bean): boolean {
    const priority = bean.priority;

    if (typeof priority === 'number') {
      return priority === 1;
    }

    if (typeof priority === 'string') {
      const lower = priority.toLowerCase();
      return lower === '1' || lower === 'high' || lower === 'critical' || lower === 'urgent';
    }

    return false;
  }

  /**
   * Filter beans by priority
   */
  filterByPriority(beans: Bean[], priority: number | string): Bean[] {
    return beans.filter(bean => {
      const beanPriority = bean.priority;

      if (typeof priority === 'number') {
        if (typeof beanPriority === 'number') {
          return beanPriority === priority;
        }
        if (typeof beanPriority === 'string') {
          return parseInt(beanPriority, 10) === priority;
        }
      }

      if (typeof priority === 'string') {
        const priorityLower = priority.toLowerCase();
        if (typeof beanPriority === 'string') {
          return beanPriority.toLowerCase() === priorityLower;
        }
        if (typeof beanPriority === 'number') {
          return beanPriority.toString() === priority;
        }
      }

      return false;
    });
  }

  /**
   * Get priority 1 items from beans
   */
  getPriorityOneItems(beans: Bean[]): PriorityItem[] {
    return beans
      .filter(bean => this.isPriorityOne(bean))
      .filter(bean => bean.status !== 'completed' && bean.status !== 'archived')
      .map(bean => this.toPriorityItem(bean));
  }

  // Private helpers

  private parseStatus(status?: string): BeanStatus {
    if (!status) return 'todo';

    const normalized = status.toLowerCase().replace(/[_-]/g, '');
    switch (normalized) {
      case 'todo':
      case 'open':
      case 'new':
        return 'todo';
      case 'inprogress':
      case 'doing':
      case 'started':
        return 'in_progress';
      case 'completed':
      case 'done':
      case 'closed':
        return 'completed';
      case 'archived':
      case 'cancelled':
      case 'wontfix':
        return 'archived';
      default:
        return 'todo';
    }
  }

  private parseType(type?: string): BeanType | undefined {
    if (!type) return undefined;

    const normalized = type.toLowerCase();
    switch (normalized) {
      case 'task':
        return 'task';
      case 'bug':
      case 'bugfix':
      case 'fix':
        return 'bug';
      case 'feature':
      case 'enhancement':
        return 'feature';
      case 'epic':
      case 'story':
        return 'epic';
      default:
        return 'task';
    }
  }
}

/**
 * Create beans parser
 */
export function createBeansParser(): BeansParser {
  return new BeansParser();
}
