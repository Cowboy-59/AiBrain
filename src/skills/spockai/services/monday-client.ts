/**
 * SpockAI Monday.com Client
 * API client for Monday.com work management platform
 */

import type {
  MondayConfig,
  MondayItem,
  ServiceRequest,
  ServiceSyncResult
} from './types.js';
import { servicesLogger } from '../utils/logger.js';
import { randomUUID } from 'crypto';

const MONDAY_API_URL = 'https://api.monday.com/v2';

/**
 * Monday.com API Client
 */
export class MondayClient {
  private config: MondayConfig;
  private connected: boolean = false;

  constructor(config: MondayConfig) {
    this.config = config;
    servicesLogger.info('Monday.com client initialized');
  }

  /**
   * Test connection to Monday.com
   */
  async connect(): Promise<boolean> {
    try {
      const query = `query { me { id name } }`;
      const result = await this.graphql<{ me: { id: string; name: string } }>(query);

      if (result?.me) {
        this.connected = true;
        servicesLogger.info('Monday.com connected successfully', {
          user: result.me.name
        });
        return true;
      }
      return false;
    } catch (error) {
      servicesLogger.error('Monday.com connection failed', { error });
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
   * Fetch items from Monday.com boards
   */
  async getItems(options: {
    boardIds?: string[];
    limit?: number;
  } = {}): Promise<MondayItem[]> {
    const boardIds = options.boardIds ?? this.config.boardIds ?? [];
    const limit = options.limit ?? 100;

    if (boardIds.length === 0) {
      // Fetch items from all boards if none specified
      return this.getAllBoardItems(limit);
    }

    const items: MondayItem[] = [];
    for (const boardId of boardIds) {
      const boardItems = await this.getBoardItems(boardId, limit);
      items.push(...boardItems);
    }

    return items;
  }

  /**
   * Fetch items from a specific board
   */
  async getBoardItems(boardId: string, limit: number = 100): Promise<MondayItem[]> {
    const query = `
      query ($boardId: ID!, $limit: Int!) {
        boards(ids: [$boardId]) {
          id
          name
          items_page(limit: $limit) {
            items {
              id
              name
              created_at
              updated_at
              group {
                id
                title
              }
              column_values {
                id
                title: column {
                  title
                }
                text
                value
              }
            }
          }
        }
      }
    `;

    try {
      const result = await this.graphql<{
        boards: Array<{
          id: string;
          name: string;
          items_page: {
            items: Array<{
              id: string;
              name: string;
              created_at: string;
              updated_at: string;
              group?: { id: string; title: string };
              column_values: Array<{
                id: string;
                title: { title: string };
                text?: string;
                value?: string;
              }>;
            }>;
          };
        }>;
      }>(query, { boardId, limit });

      const items: MondayItem[] = [];
      for (const board of result?.boards ?? []) {
        for (const item of board.items_page.items) {
          items.push({
            id: item.id,
            name: item.name,
            board: { id: board.id, name: board.name },
            group: item.group,
            column_values: item.column_values.map(cv => ({
              id: cv.id,
              title: cv.title?.title ?? cv.id,
              text: cv.text,
              value: cv.value
            })),
            created_at: item.created_at,
            updated_at: item.updated_at
          });
        }
      }

      return items;
    } catch (error) {
      servicesLogger.error('Failed to fetch Monday.com board items', { boardId, error });
      return [];
    }
  }

  /**
   * Fetch items from all boards
   */
  private async getAllBoardItems(limit: number): Promise<MondayItem[]> {
    const query = `
      query ($limit: Int!) {
        boards(limit: 10) {
          id
          name
          items_page(limit: $limit) {
            items {
              id
              name
              created_at
              updated_at
              group {
                id
                title
              }
              column_values {
                id
                title: column {
                  title
                }
                text
                value
              }
            }
          }
        }
      }
    `;

    try {
      const result = await this.graphql<{
        boards: Array<{
          id: string;
          name: string;
          items_page: {
            items: Array<{
              id: string;
              name: string;
              created_at: string;
              updated_at: string;
              group?: { id: string; title: string };
              column_values: Array<{
                id: string;
                title: { title: string };
                text?: string;
                value?: string;
              }>;
            }>;
          };
        }>;
      }>(query, { limit });

      const items: MondayItem[] = [];
      for (const board of result?.boards ?? []) {
        for (const item of board.items_page.items) {
          items.push({
            id: item.id,
            name: item.name,
            board: { id: board.id, name: board.name },
            group: item.group,
            column_values: item.column_values.map(cv => ({
              id: cv.id,
              title: cv.title?.title ?? cv.id,
              text: cv.text,
              value: cv.value
            })),
            created_at: item.created_at,
            updated_at: item.updated_at
          });
        }
      }

      return items;
    } catch (error) {
      servicesLogger.error('Failed to fetch all Monday.com items', { error });
      return [];
    }
  }

  /**
   * Sync items to service requests
   */
  async syncItems(serviceId: string): Promise<{
    requests: ServiceRequest[];
    result: ServiceSyncResult;
  }> {
    const items = await this.getItems({ limit: 100 });

    const requests: ServiceRequest[] = items.map(item =>
      this.mapItemToRequest(serviceId, item)
    );

    const result: ServiceSyncResult = {
      serviceId,
      serviceName: 'Monday.com',
      itemsFound: items.length,
      newItems: items.length,
      updatedItems: 0,
      syncedAt: new Date()
    };

    return { requests, result };
  }

  /**
   * Map Monday.com item to ServiceRequest
   */
  private mapItemToRequest(serviceId: string, item: MondayItem): ServiceRequest {
    const statusColumn = item.column_values.find(cv =>
      cv.title.toLowerCase().includes('status')
    );
    const priorityColumn = item.column_values.find(cv =>
      cv.title.toLowerCase().includes('priority')
    );
    const personColumn = item.column_values.find(cv =>
      cv.title.toLowerCase().includes('person') ||
      cv.title.toLowerCase().includes('owner') ||
      cv.title.toLowerCase().includes('assignee')
    );

    return {
      id: randomUUID(),
      serviceId,
      externalId: item.id,
      title: item.name,
      description: item.group?.title,
      status: this.mapStatus(statusColumn?.text),
      priority: this.mapPriority(priorityColumn?.text),
      assigneeName: personColumn?.text,
      category: item.board.name,
      createdAt: new Date(item.created_at),
      updatedAt: new Date(item.updated_at),
      url: `https://monday.com/boards/${item.board.id}/pulses/${item.id}`
    };
  }

  /**
   * Map Monday.com status to RequestStatus
   */
  private mapStatus(status?: string): ServiceRequest['status'] {
    if (!status) return 'open';

    const statusLower = status.toLowerCase();
    if (statusLower.includes('done') || statusLower.includes('complete')) return 'closed';
    if (statusLower.includes('stuck') || statusLower.includes('block')) return 'on_hold';
    if (statusLower.includes('working') || statusLower.includes('progress')) return 'in_progress';
    if (statusLower.includes('review') || statusLower.includes('pending')) return 'pending';
    if (statusLower.includes('new')) return 'new';

    return 'open';
  }

  /**
   * Map Monday.com priority to Priority
   */
  private mapPriority(priority?: string): ServiceRequest['priority'] {
    if (!priority) return 'medium';

    const priorityLower = priority.toLowerCase();
    if (priorityLower.includes('critical') || priorityLower.includes('high')) return 'high';
    if (priorityLower.includes('low')) return 'low';

    return 'medium';
  }

  /**
   * Make GraphQL request
   */
  private async graphql<T>(query: string, variables?: Record<string, unknown>): Promise<T | null> {
    try {
      const response = await fetch(MONDAY_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': this.config.apiToken,
          'API-Version': '2024-01'
        },
        body: JSON.stringify({ query, variables })
      });

      if (!response.ok) {
        throw new Error(`Monday.com API error: ${response.status}`);
      }

      const json = await response.json() as { data?: T; errors?: unknown[] };

      if (json.errors) {
        servicesLogger.error('Monday.com GraphQL errors', { errors: json.errors });
      }

      return json.data ?? null;
    } catch (error) {
      servicesLogger.error('Monday.com GraphQL request failed', { error });
      return null;
    }
  }
}

/**
 * Create Monday.com client
 */
export function createMondayClient(config: MondayConfig): MondayClient {
  return new MondayClient(config);
}
