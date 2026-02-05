/**
 * SpockAI External Services Types
 * Type definitions for Samanage and Monday.com integrations
 */

import type { BaseEntity, Priority } from '../types/index.js';

// Service provider types
export type ServiceProvider = 'samanage' | 'monday';

// External service configuration
export interface ExternalService extends BaseEntity {
  name: string;
  provider: ServiceProvider;
  apiKey: string;
  baseUrl?: string;
  organizationId?: string;
  enabled: boolean;
  lastSync?: Date;
  lastError?: string;
}

// Service request (generic across providers)
export interface ServiceRequest extends BaseEntity {
  serviceId: string;
  externalId: string;
  title: string;
  description?: string;
  status: RequestStatus;
  priority: Priority;
  requesterName?: string;
  requesterEmail?: string;
  assigneeName?: string;
  assigneeEmail?: string;
  category?: string;
  tags?: string[];
  dueDate?: Date;
  createdAt: Date;
  updatedAt: Date;
  url?: string;
}

// Request status (normalized across providers)
export type RequestStatus =
  | 'new'
  | 'open'
  | 'in_progress'
  | 'pending'
  | 'on_hold'
  | 'resolved'
  | 'closed';

// Samanage-specific types
export interface SamanageConfig {
  apiToken: string;
  subdomain: string;  // {subdomain}.samanage.com
}

export interface SamanageIncident {
  id: number;
  name: string;
  description?: string;
  state: string;
  priority: string;
  requester?: {
    id: number;
    name: string;
    email: string;
  };
  assignee?: {
    id: number;
    name: string;
    email: string;
  };
  category?: {
    id: number;
    name: string;
  };
  due_at?: string;
  created_at: string;
  updated_at: string;
}

// Monday.com-specific types
export interface MondayConfig {
  apiToken: string;
  boardIds?: string[];  // Optional filter to specific boards
}

export interface MondayItem {
  id: string;
  name: string;
  board: {
    id: string;
    name: string;
  };
  group?: {
    id: string;
    title: string;
  };
  column_values: MondayColumnValue[];
  created_at: string;
  updated_at: string;
}

export interface MondayColumnValue {
  id: string;
  title: string;
  text?: string;
  value?: string;
}

// Service sync result
export interface ServiceSyncResult {
  serviceId: string;
  serviceName: string;
  itemsFound: number;
  newItems: number;
  updatedItems: number;
  syncedAt: Date;
  error?: string;
}

// Service filter options
export interface ServiceFilterOptions {
  serviceId?: string;
  provider?: ServiceProvider;
  status?: RequestStatus;
  priority?: Priority;
  assignee?: string;
  limit?: number;
}

// Service status
export interface ServiceStatus {
  id: string;
  name: string;
  provider: ServiceProvider;
  enabled: boolean;
  connected: boolean;
  lastSync?: Date;
  lastError?: string;
  itemCount: number;
}

// Services configuration
export interface ServicesConfig {
  samanage?: SamanageConfig;
  monday?: MondayConfig;
  syncInterval: number;  // Minutes between syncs
}
