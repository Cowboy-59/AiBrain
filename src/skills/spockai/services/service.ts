/**
 * SpockAI External Services Service
 * Core service for managing external service integrations
 */

import type {
  ExternalService,
  ServiceRequest,
  ServicesConfig,
  ServiceSyncResult,
  ServiceFilterOptions,
  ServiceStatus
} from './types.js';
import { SamanageClient, createSamanageClient } from './samanage-client.js';
import { MondayClient, createMondayClient } from './monday-client.js';
import { servicesLogger } from '../utils/logger.js';
import { randomUUID } from 'crypto';

/**
 * External Services Service
 * Manages connections to Samanage and Monday.com
 */
export class ExternalServicesService {
  private config: ServicesConfig;
  private services: Map<string, ExternalService> = new Map();
  private requests: Map<string, ServiceRequest[]> = new Map(); // serviceId -> requests
  private samanageClient: SamanageClient | null = null;
  private mondayClient: MondayClient | null = null;
  private syncInterval: NodeJS.Timeout | null = null;

  constructor(config: ServicesConfig) {
    this.config = config;

    // Initialize clients if configured
    if (config.samanage) {
      this.samanageClient = createSamanageClient(config.samanage);
    }
    if (config.monday) {
      this.mondayClient = createMondayClient(config.monday);
    }

    servicesLogger.info('External services service initialized');
  }

  /**
   * Add a service
   */
  async addService(service: Omit<ExternalService, 'id'>): Promise<ExternalService> {
    const id = randomUUID();
    const newService: ExternalService = {
      ...service,
      id
    };

    this.services.set(id, newService);
    this.requests.set(id, []);

    servicesLogger.info('External service added', {
      id,
      name: service.name,
      provider: service.provider
    });

    if (service.enabled) {
      await this.syncService(id);
    }

    return newService;
  }

  /**
   * Remove a service
   */
  async removeService(serviceId: string): Promise<boolean> {
    const service = this.services.get(serviceId);
    if (!service) {
      return false;
    }

    this.services.delete(serviceId);
    this.requests.delete(serviceId);

    servicesLogger.info('External service removed', { id: serviceId, name: service.name });
    return true;
  }

  /**
   * Get all services
   */
  getServices(): ExternalService[] {
    return Array.from(this.services.values());
  }

  /**
   * Sync a service
   */
  async syncService(serviceId: string): Promise<ServiceSyncResult> {
    const service = this.services.get(serviceId);
    if (!service) {
      throw new Error(`Service not found: ${serviceId}`);
    }

    servicesLogger.info('Syncing service', { serviceId, name: service.name });

    try {
      let syncResult: { requests: ServiceRequest[]; result: ServiceSyncResult };

      if (service.provider === 'samanage' && this.samanageClient) {
        syncResult = await this.samanageClient.syncIncidents(serviceId);
      } else if (service.provider === 'monday' && this.mondayClient) {
        syncResult = await this.mondayClient.syncItems(serviceId);
      } else {
        throw new Error(`No client for provider: ${service.provider}`);
      }

      this.requests.set(serviceId, syncResult.requests);
      service.lastSync = new Date();
      service.lastError = undefined;

      servicesLogger.info('Service sync complete', syncResult.result);
      return syncResult.result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      service.lastError = errorMessage;

      servicesLogger.error('Service sync failed', { serviceId, error: errorMessage });

      return {
        serviceId,
        serviceName: service.name,
        itemsFound: 0,
        newItems: 0,
        updatedItems: 0,
        syncedAt: new Date(),
        error: errorMessage
      };
    }
  }

  /**
   * Sync all services
   */
  async syncAllServices(): Promise<ServiceSyncResult[]> {
    const results: ServiceSyncResult[] = [];

    for (const service of this.services.values()) {
      if (service.enabled) {
        const result = await this.syncService(service.id);
        results.push(result);
      }
    }

    return results;
  }

  /**
   * Get requests with filtering
   */
  getRequests(options: ServiceFilterOptions = {}): ServiceRequest[] {
    let allRequests: ServiceRequest[] = [];

    if (options.serviceId) {
      allRequests = this.requests.get(options.serviceId) ?? [];
    } else {
      for (const requests of this.requests.values()) {
        allRequests.push(...requests);
      }
    }

    // Apply filters
    let filtered = allRequests;

    if (options.provider) {
      const providerServiceIds = new Set(
        Array.from(this.services.values())
          .filter(s => s.provider === options.provider)
          .map(s => s.id)
      );
      filtered = filtered.filter(r => providerServiceIds.has(r.serviceId));
    }

    if (options.status) {
      filtered = filtered.filter(r => r.status === options.status);
    }

    if (options.priority) {
      filtered = filtered.filter(r => r.priority === options.priority);
    }

    if (options.assignee) {
      const assigneeLower = options.assignee.toLowerCase();
      filtered = filtered.filter(r =>
        r.assigneeName?.toLowerCase().includes(assigneeLower) ||
        r.assigneeEmail?.toLowerCase().includes(assigneeLower)
      );
    }

    // Sort by updated date (newest first)
    filtered.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());

    // Apply limit
    if (options.limit) {
      filtered = filtered.slice(0, options.limit);
    }

    return filtered;
  }

  /**
   * Get service statuses
   */
  getServiceStatuses(): ServiceStatus[] {
    return Array.from(this.services.values()).map(service => {
      const requests = this.requests.get(service.id) ?? [];
      let connected = false;

      if (service.provider === 'samanage') {
        connected = this.samanageClient?.isConnected() ?? false;
      } else if (service.provider === 'monday') {
        connected = this.mondayClient?.isConnected() ?? false;
      }

      return {
        id: service.id,
        name: service.name,
        provider: service.provider,
        enabled: service.enabled,
        connected,
        lastSync: service.lastSync,
        lastError: service.lastError,
        itemCount: requests.length
      };
    });
  }

  /**
   * Start periodic sync
   */
  startPeriodicSync(): void {
    if (this.syncInterval) {
      return;
    }

    const intervalMs = this.config.syncInterval * 60 * 1000;
    this.syncInterval = setInterval(() => {
      this.syncAllServices().catch(error => {
        servicesLogger.error('Periodic sync failed', { error });
      });
    }, intervalMs);

    servicesLogger.info('Periodic sync started', {
      intervalMinutes: this.config.syncInterval
    });
  }

  /**
   * Stop periodic sync
   */
  stopPeriodicSync(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
      servicesLogger.info('Periodic sync stopped');
    }
  }

  /**
   * Connect to all providers
   */
  async connectAll(): Promise<void> {
    if (this.samanageClient) {
      await this.samanageClient.connect();
    }
    if (this.mondayClient) {
      await this.mondayClient.connect();
    }
  }

  /**
   * Shutdown service
   */
  async shutdown(): Promise<void> {
    this.stopPeriodicSync();
    servicesLogger.info('External services service shutdown');
  }
}

/**
 * Create external services service
 */
export function createExternalServicesService(config: ServicesConfig): ExternalServicesService {
  return new ExternalServicesService(config);
}
