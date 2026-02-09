/**
 * SpockAI Services List Command
 * Display connected external services
 */

import type { CommandResult } from '../../types/index.js';
import type { CommandContext } from '../../base/skill.js';
import type { ServiceStatus, ServicesConfig, ServiceSyncResult } from '../types.js';
import { ExternalServicesService, createExternalServicesService } from '../service.js';

let servicesService: ExternalServicesService | null = null;

function getServicesService(config: ServicesConfig): ExternalServicesService {
  if (!servicesService) {
    servicesService = createExternalServicesService(config);
  }
  return servicesService;
}

interface ListResult {
  services: ServiceStatus[];
  count: number;
}

/**
 * Services list command handler
 */
export async function listCommand(
  _args: string[],
  context: CommandContext
): Promise<CommandResult<ListResult>> {
  const config = context.config.services as ServicesConfig;
  const service = getServicesService(config);

  try {
    const services = service.getServiceStatuses();

    let message = '**Connected Services**\n\n';

    if (services.length === 0) {
      message += '_No services connected_\n\n';
      message += '_Use `/samanage connect` or `/monday connect` to add a service_';
      return {
        success: true,
        data: { services, count: 0 },
        message
      };
    }

    for (const svc of services) {
      const providerIcon = svc.provider === 'samanage' ? '🔧' : '📋';
      const statusIcon = svc.enabled
        ? (svc.connected ? '✅' : '⚠️')
        : '⏸️';

      message += `${statusIcon} ${providerIcon} **${svc.name}**\n`;
      message += `   Provider: ${svc.provider}\n`;
      message += `   Items: ${svc.itemCount}\n`;

      if (svc.lastSync) {
        const syncTime = formatRelativeTime(svc.lastSync);
        message += `   Last sync: ${syncTime}\n`;
      }

      if (svc.lastError) {
        message += `   ⚠️ Error: ${svc.lastError}\n`;
      }

      message += '\n';
    }

    const enabledCount = services.filter(s => s.enabled).length;
    message += `_${enabledCount} of ${services.length} service${services.length !== 1 ? 's' : ''} active_`;

    return {
      success: true,
      data: { services, count: services.length },
      message
    };
  } catch (error) {
    context.logger.error('Failed to list services', { error });
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to list services'
    };
  }
}

/**
 * Services sync command handler
 */
export async function syncCommand(
  _args: string[],
  context: CommandContext
): Promise<CommandResult<ServiceSyncResult[]>> {
  const config = context.config.services as ServicesConfig;
  const service = getServicesService(config);

  try {
    context.logger.info('Starting services sync');
    const results = await service.syncAllServices();

    let message = '**Service Sync Results**\n\n';

    if (results.length === 0) {
      message += '_No services to sync_\n';
      message += '_Use `/samanage connect` or `/monday connect` to add a service_';
      return {
        success: true,
        data: results,
        message
      };
    }

    let totalItems = 0;
    let errors = 0;

    for (const result of results) {
      const icon = result.error ? '❌' : '✅';
      message += `${icon} **${result.serviceName}**\n`;

      if (result.error) {
        message += `   Error: ${result.error}\n`;
        errors++;
      } else {
        message += `   Items: ${result.itemsFound}\n`;
        if (result.newItems > 0) {
          message += `   New: ${result.newItems}\n`;
        }
        totalItems += result.itemsFound;
      }

      message += '\n';
    }

    message += `_Synced ${results.length} service${results.length !== 1 ? 's' : ''}`;
    if (errors > 0) {
      message += ` (${errors} error${errors !== 1 ? 's' : ''})`;
    }
    message += `_`;

    return {
      success: true,
      data: results,
      message
    };
  } catch (error) {
    context.logger.error('Failed to sync services', { error });
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to sync services'
    };
  }
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
