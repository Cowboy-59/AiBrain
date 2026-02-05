/**
 * SpockAI Samanage Client
 * API client for Samanage service management platform
 */

import type {
  SamanageConfig,
  SamanageIncident,
  ServiceRequest,
  ServiceSyncResult
} from './types.js';
import { servicesLogger } from '../utils/logger.js';
import { randomUUID } from 'crypto';

/**
 * Samanage API Client
 */
export class SamanageClient {
  private config: SamanageConfig;
  private baseUrl: string;
  private connected: boolean = false;

  constructor(config: SamanageConfig) {
    this.config = config;
    this.baseUrl = `https://${config.subdomain}.samanage.com/api/1.1`;
    servicesLogger.info('Samanage client initialized', {
      subdomain: config.subdomain
    });
  }

  /**
   * Test connection to Samanage
   */
  async connect(): Promise<boolean> {
    try {
      // Test API connection by fetching current user
      const response = await this.request('/users/current.json');
      if (response.ok) {
        this.connected = true;
        servicesLogger.info('Samanage connected successfully');
        return true;
      }
      return false;
    } catch (error) {
      servicesLogger.error('Samanage connection failed', { error });
      return false;
    }
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.connected;
  }

  /**
   * Fetch incidents from Samanage
   */
  async getIncidents(options: {
    page?: number;
    perPage?: number;
    state?: string[];
  } = {}): Promise<SamanageIncident[]> {
    const params = new URLSearchParams();

    if (options.page) params.set('page', options.page.toString());
    if (options.perPage) params.set('per_page', options.perPage.toString());
    if (options.state?.length) {
      params.set('state[]', options.state.join(','));
    }

    const queryString = params.toString();
    const url = `/incidents.json${queryString ? `?${queryString}` : ''}`;

    try {
      const response = await this.request(url);
      if (!response.ok) {
        throw new Error(`Samanage API error: ${response.status}`);
      }
      const data = await response.json();
      return data as SamanageIncident[];
    } catch (error) {
      servicesLogger.error('Failed to fetch Samanage incidents', { error });
      return [];
    }
  }

  /**
   * Fetch a single incident
   */
  async getIncident(id: number): Promise<SamanageIncident | null> {
    try {
      const response = await this.request(`/incidents/${id}.json`);
      if (!response.ok) {
        return null;
      }
      return (await response.json()) as SamanageIncident;
    } catch (error) {
      servicesLogger.error('Failed to fetch Samanage incident', { id, error });
      return null;
    }
  }

  /**
   * Sync incidents to service requests
   */
  async syncIncidents(serviceId: string): Promise<{
    requests: ServiceRequest[];
    result: ServiceSyncResult;
  }> {
    const incidents = await this.getIncidents({
      perPage: 100,
      state: ['New', 'Assigned', 'In Progress', 'Awaiting Input', 'On Hold']
    });

    const requests: ServiceRequest[] = incidents.map(incident =>
      this.mapIncidentToRequest(serviceId, incident)
    );

    const result: ServiceSyncResult = {
      serviceId,
      serviceName: 'Samanage',
      itemsFound: incidents.length,
      newItems: incidents.length, // Simplified - would need diff in production
      updatedItems: 0,
      syncedAt: new Date()
    };

    return { requests, result };
  }

  /**
   * Map Samanage incident to ServiceRequest
   */
  private mapIncidentToRequest(serviceId: string, incident: SamanageIncident): ServiceRequest {
    return {
      id: randomUUID(),
      serviceId,
      externalId: incident.id.toString(),
      title: incident.name,
      description: incident.description,
      status: this.mapStatus(incident.state),
      priority: this.mapPriority(incident.priority),
      requesterName: incident.requester?.name,
      requesterEmail: incident.requester?.email,
      assigneeName: incident.assignee?.name,
      assigneeEmail: incident.assignee?.email,
      category: incident.category?.name,
      dueDate: incident.due_at ? new Date(incident.due_at) : undefined,
      createdAt: new Date(incident.created_at),
      updatedAt: new Date(incident.updated_at),
      url: `https://${this.config.subdomain}.samanage.com/incidents/${incident.id}`
    };
  }

  /**
   * Map Samanage state to RequestStatus
   */
  private mapStatus(state: string): ServiceRequest['status'] {
    const stateMap: Record<string, ServiceRequest['status']> = {
      'New': 'new',
      'Assigned': 'open',
      'In Progress': 'in_progress',
      'Awaiting Input': 'pending',
      'On Hold': 'on_hold',
      'Resolved': 'resolved',
      'Closed': 'closed'
    };
    return stateMap[state] ?? 'open';
  }

  /**
   * Map Samanage priority to Priority
   */
  private mapPriority(priority: string): ServiceRequest['priority'] {
    const priorityMap: Record<string, ServiceRequest['priority']> = {
      'Critical': 'high',
      'High': 'high',
      'Medium': 'medium',
      'Low': 'low',
      'None': 'low'
    };
    return priorityMap[priority] ?? 'medium';
  }

  /**
   * Make API request
   */
  private async request(path: string, options: RequestInit = {}): Promise<Response> {
    const url = `${this.baseUrl}${path}`;
    const headers = new Headers(options.headers);
    headers.set('Accept', 'application/json');
    headers.set('Content-Type', 'application/json');
    headers.set('X-Samanage-Authorization', `Bearer ${this.config.apiToken}`);

    return fetch(url, {
      ...options,
      headers
    });
  }
}

/**
 * Create Samanage client
 */
export function createSamanageClient(config: SamanageConfig): SamanageClient {
  return new SamanageClient(config);
}
