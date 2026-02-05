/**
 * SpockAI Samanage Command
 * Display and manage Samanage incidents
 */

import type { CommandResult } from '../../types/index.js';
import type { CommandContext } from '../../base/skill.js';
import type { ServiceRequest, ServicesConfig, RequestStatus } from '../types.js';
import { ExternalServicesService, createExternalServicesService } from '../service.js';

let servicesService: ExternalServicesService | null = null;

function getServicesService(config: ServicesConfig): ExternalServicesService {
  if (!servicesService) {
    servicesService = createExternalServicesService(config);
  }
  return servicesService;
}

interface SamanageResult {
  requests: ServiceRequest[];
  count: number;
  filter?: string;
}

/**
 * Samanage list command handler
 */
export async function samanageCommand(
  args: string[],
  context: CommandContext
): Promise<CommandResult<SamanageResult>> {
  const config = context.config.services as ServicesConfig;
  const service = getServicesService(config);

  // Check for subcommand
  const subCommand = args[0]?.toLowerCase();

  if (subCommand === 'connect') {
    return connectCommand(context);
  }

  try {
    // Parse filter options
    let statusFilter: RequestStatus | undefined;
    const statusIndex = args.indexOf('--status');
    if (statusIndex !== -1 && args[statusIndex + 1]) {
      statusFilter = args[statusIndex + 1] as RequestStatus;
    }

    const requests = service.getRequests({
      provider: 'samanage',
      status: statusFilter,
      limit: 20
    });

    let message = '**Samanage Incidents**\n\n';

    if (requests.length === 0) {
      message += '_No incidents found_\n\n';
      if (!config.samanage) {
        message += '_Use `/samanage connect` to connect your Samanage account_';
      }
      return {
        success: true,
        data: { requests, count: 0, filter: statusFilter },
        message
      };
    }

    for (const request of requests) {
      const priorityIcon = getPriorityIcon(request.priority);
      const statusIcon = getStatusIcon(request.status);

      message += `${priorityIcon} **${request.title}**\n`;
      message += `   ${statusIcon} ${formatStatus(request.status)}`;
      if (request.assigneeName) {
        message += ` • 👤 ${request.assigneeName}`;
      }
      message += '\n';

      if (request.category) {
        message += `   📁 ${request.category}\n`;
      }

      message += `   Updated: ${formatRelativeTime(request.updatedAt)}\n\n`;
    }

    message += `_${requests.length} incident${requests.length !== 1 ? 's' : ''}_`;
    if (statusFilter) {
      message += ` (filtered by: ${statusFilter})`;
    }

    return {
      success: true,
      data: { requests, count: requests.length, filter: statusFilter },
      message
    };
  } catch (error) {
    context.logger.error('Failed to list Samanage incidents', { error });
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to list incidents'
    };
  }
}

/**
 * Connect Samanage command
 */
async function connectCommand(
  context: CommandContext
): Promise<CommandResult<{ connected: boolean }>> {
  const config = context.config.services as ServicesConfig;

  if (!config.samanage) {
    return {
      success: false,
      error: 'Samanage not configured. Add samanage configuration to your settings.'
    };
  }

  const service = getServicesService(config);

  try {
    await service.connectAll();

    // Add Samanage service if not already added
    const services = service.getServices();
    const existingSamanage = services.find(s => s.provider === 'samanage');

    if (!existingSamanage) {
      await service.addService({
        name: 'Samanage',
        provider: 'samanage',
        apiKey: config.samanage.apiToken,
        baseUrl: `https://${config.samanage.subdomain}.samanage.com`,
        enabled: true
      });
    }

    return {
      success: true,
      data: { connected: true },
      message: '✅ **Samanage Connected**\n\nYour Samanage account has been connected. Use `/samanage` to view incidents.'
    };
  } catch (error) {
    context.logger.error('Failed to connect Samanage', { error });
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
