/**
 * SpockAI Monday.com Command
 * Display and manage Monday.com items
 */

import type { CommandResult } from '../../types/index.js';
import type { CommandContext } from '../../base/skill.js';
import type { ServiceRequest, ServicesConfig } from '../types.js';
import { ExternalServicesService, createExternalServicesService } from '../service.js';

let servicesService: ExternalServicesService | null = null;

function getServicesService(config: ServicesConfig): ExternalServicesService {
  if (!servicesService) {
    servicesService = createExternalServicesService(config);
  }
  return servicesService;
}

interface MondayResult {
  requests?: ServiceRequest[];
  count?: number;
  boardFilter?: string;
  connected?: boolean;
}

/**
 * Monday.com list command handler
 */
export async function mondayCommand(
  args: string[],
  context: CommandContext
): Promise<CommandResult<MondayResult>> {
  const config = context.config.services as ServicesConfig;
  const service = getServicesService(config);

  // Check for subcommand
  const subCommand = args[0]?.toLowerCase();

  if (subCommand === 'connect') {
    return connectCommand(context);
  }

  try {
    // Parse filter options
    let boardFilter: string | undefined;
    const boardIndex = args.indexOf('--board');
    if (boardIndex !== -1 && args[boardIndex + 1]) {
      boardFilter = args[boardIndex + 1];
    }

    const requests = service.getRequests({
      provider: 'monday',
      limit: 20
    });

    // Filter by board if specified
    let filteredRequests = requests;
    if (boardFilter) {
      filteredRequests = requests.filter(r =>
        r.category?.toLowerCase().includes(boardFilter!.toLowerCase())
      );
    }

    let message = '**Monday.com Items**\n\n';

    if (filteredRequests.length === 0) {
      message += '_No items found_\n\n';
      if (!config.monday) {
        message += '_Use `/monday connect` to connect your Monday.com account_';
      }
      return {
        success: true,
        data: { requests: filteredRequests, count: 0, boardFilter },
        message
      };
    }

    // Group by board
    const byBoard = new Map<string, ServiceRequest[]>();
    for (const request of filteredRequests) {
      const board = request.category ?? 'Unknown Board';
      if (!byBoard.has(board)) {
        byBoard.set(board, []);
      }
      byBoard.get(board)!.push(request);
    }

    for (const [board, items] of byBoard) {
      message += `### 📋 ${board}\n\n`;

      for (const item of items.slice(0, 10)) {
        const priorityIcon = getPriorityIcon(item.priority);
        const statusIcon = getStatusIcon(item.status);

        message += `${priorityIcon} **${item.title}**\n`;
        message += `   ${statusIcon} ${formatStatus(item.status)}`;
        if (item.assigneeName) {
          message += ` • 👤 ${item.assigneeName}`;
        }
        message += '\n';
        message += `   Updated: ${formatRelativeTime(item.updatedAt)}\n\n`;
      }

      if (items.length > 10) {
        message += `   _...and ${items.length - 10} more items_\n\n`;
      }
    }

    message += `_${filteredRequests.length} item${filteredRequests.length !== 1 ? 's' : ''}_`;
    if (boardFilter) {
      message += ` (filtered by board: ${boardFilter})`;
    }

    return {
      success: true,
      data: { requests: filteredRequests, count: filteredRequests.length, boardFilter },
      message
    };
  } catch (error) {
    context.logger.error('Failed to list Monday.com items', { error });
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to list items'
    };
  }
}

/**
 * Connect Monday.com command
 */
async function connectCommand(
  context: CommandContext
): Promise<CommandResult<MondayResult>> {
  const config = context.config.services as ServicesConfig;

  if (!config.monday) {
    return {
      success: false,
      error: 'Monday.com not configured. Add monday configuration to your settings.'
    };
  }

  const service = getServicesService(config);

  try {
    await service.connectAll();

    // Add Monday.com service if not already added
    const services = service.getServices();
    const existingMonday = services.find(s => s.provider === 'monday');

    if (!existingMonday) {
      await service.addService({
        name: 'Monday.com',
        provider: 'monday',
        apiKey: config.monday.apiToken,
        enabled: true
      });
    }

    return {
      success: true,
      data: { connected: true },
      message: '✅ **Monday.com Connected**\n\nYour Monday.com account has been connected. Use `/monday` to view items.'
    };
  } catch (error) {
    context.logger.error('Failed to connect Monday.com', { error });
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to connect'
    };
  }
}

function getPriorityIcon(priority: string): string {
  switch (priority) {
    case 'high':
      return '🔴';
    case 'medium':
      return '🟡';
    case 'low':
      return '🟢';
    default:
      return '⚪';
  }
}

function getStatusIcon(status: string): string {
  switch (status) {
    case 'new':
      return '🆕';
    case 'open':
      return '📂';
    case 'in_progress':
      return '🔄';
    case 'pending':
      return '⏳';
    case 'on_hold':
      return '⏸️';
    case 'resolved':
      return '✅';
    case 'closed':
      return '📦';
    default:
      return '📋';
  }
}

function formatStatus(status: string): string {
  return status.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMinutes = Math.floor(diffMs / (1000 * 60));

  if (diffMinutes < 1) return 'just now';
  if (diffMinutes < 60) return `${diffMinutes}m ago`;

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;

  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}
