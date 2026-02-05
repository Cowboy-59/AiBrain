/**
 * SpockAI BEANS Types
 * Type definitions for hmans/beans file scanning
 * @see https://github.com/hmans/beans
 */

import type { BeanStatus, BeanType, BaseEntity } from '../types/index.js';

// Bean from YAML frontmatter
export interface Bean extends BaseEntity {
  slug?: string;              // Optional slug from filename
  title: string;              // Task title from frontmatter
  status: BeanStatus;         // todo, in_progress, completed, archived
  type?: BeanType;            // task, bug, feature, epic
  priority?: string | number; // 1 (highest) to 4 (lowest), or string like "high"
  tags?: string[];            // Optional tags
  parent?: string;            // Parent bean ID for hierarchies
  blocking?: string[];        // IDs this bean blocks
  blockedBy?: string[];       // IDs blocking this bean
  body: string;               // Markdown content
  sourceFile: string;         // Full path to BEANS file
}

// Priority item (filtered view of high-priority beans)
export interface PriorityItem extends BaseEntity {
  title: string;
  description: string;        // Body excerpt
  priority: number | string;
  status: BeanStatus;
  type?: BeanType;
  sourceFile: string;
  extractedAt: Date;
}

// BEANS configuration
export interface BeansConfig {
  scanPaths: string[];        // Directories containing .beans/ folders
  scanInterval: number;       // Minutes between scans
  enabled: boolean;
}

// Scan result
export interface BeansScanResult {
  path: string;
  beansFound: number;
  priorityOneCount: number;
  scannedAt: Date;
  error?: string;
}

// Filter options
export interface BeansFilterOptions {
  priority?: number | string;
  status?: BeanStatus;
  type?: BeanType;
  tag?: string;
  path?: string;
  limit?: number;
}

// Parsed YAML frontmatter
export interface BeanFrontmatter {
  title: string;
  status?: string;
  type?: string;
  priority?: number | string;
  tags?: string[];
  parent?: string;
  blocking?: string[];
  blocked_by?: string[];
  created_at?: string;
  updated_at?: string;
  [key: string]: unknown;
}

// File info
export interface BeansFile {
  path: string;
  filename: string;
  id: string;              // NanoID extracted from filename
  slug?: string;           // Slug from filename
  lastModified: Date;
}

// Directory scan status
export interface BeansDirectoryStatus {
  path: string;
  enabled: boolean;
  beansCount: number;
  priorityOneCount: number;
  lastScan?: Date;
  lastError?: string;
}
