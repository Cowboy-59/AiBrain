/**
 * SpockAI BEANS List Command
 * Display beans (priority 1 by default)
 */

import type { CommandResult } from '../../types/index.js';
import type { CommandContext } from '../../base/skill.js';
import type { Bean, BeansConfig, PriorityItem } from '../types.js';
import { BeansService, createBeansService } from '../service.js';

let beansService: BeansService | null = null;

function getBeansService(config: BeansConfig): BeansService {
  if (!beansService) {
    beansService = createBeansService(config);
  }
  return beansService;
}

interface ListResult {
  items: PriorityItem[] | Bean[];
  count: number;
  showAll: boolean;
}

/**
 * BEANS list command handler
 */
export async function listCommand(
  args: string[],
  context: CommandContext
): Promise<CommandResult<ListResult>> {
  const config = context.config.beans as BeansConfig;
  const service = getBeansService(config);

  try {
    const showAll = args.includes('--all') || args.includes('-a');

    if (showAll) {
      const beans = service.getBeans();
      return {
        success: true,
        data: { items: beans, count: beans.length, showAll: true },
        message: formatAllBeans(beans)
      };
    }

    const items = service.getPriorityOneItems();
    return {
      success: true,
      data: { items, count: items.length, showAll: false },
      message: formatPriorityItems(items)
    };
  } catch (error) {
    context.logger.error('Failed to list beans', { error });
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to list beans'
    };
  }
}

function formatPriorityItems(items: PriorityItem[]): string {
  let message = '**Priority 1 Items**\n\n';

  if (items.length === 0) {
    message += '_No priority 1 items found_\n\n';
    message += '_Use `/beans scan` to scan for BEANS files_';
    return message;
  }

  for (const item of items) {
    const typeIcon = getTypeIcon(item.type);
    const statusIcon = getStatusIcon(item.status);

    message += `${typeIcon} **${item.title}**\n`;
    message += `   ${statusIcon} ${item.status.replace('_', ' ')}\n`;

    if (item.description) {
      const desc = item.description.length > 100
        ? item.description.substring(0, 100) + '...'
        : item.description;
      message += `   ${desc}\n`;
    }

    message += `   📁 \`${shortenPath(item.sourceFile)}\`\n\n`;
  }

  message += `_${items.length} priority 1 item${items.length !== 1 ? 's' : ''}_`;
  return message;
}

function formatAllBeans(beans: Bean[]): string {
  let message = '**All BEANS Items**\n\n';

  if (beans.length === 0) {
    message += '_No BEANS files found_\n\n';
    message += '_Use `/beans scan` to scan for BEANS files_';
    return message;
  }

  // Group by priority
  const byPriority = new Map<number | string, Bean[]>();

  for (const bean of beans) {
    const priority = bean.priority ?? 4;
    const key = typeof priority === 'number' ? priority : priority.toString();
    if (!byPriority.has(key)) {
      byPriority.set(key, []);
    }
    byPriority.get(key)!.push(bean);
  }

  // Sort by priority
  const sortedPriorities = Array.from(byPriority.keys()).sort((a, b) => {
    const numA = typeof a === 'number' ? a : parseInt(a as string, 10) || 4;
    const numB = typeof b === 'number' ? b : parseInt(b as string, 10) || 4;
    return numA - numB;
  });

  for (const priority of sortedPriorities) {
    const priorityBeans = byPriority.get(priority)!;
    message += `### Priority ${priority}\n\n`;

    for (const bean of priorityBeans) {
      const typeIcon = getTypeIcon(bean.type);
      const statusIcon = getStatusIcon(bean.status);

      message += `${typeIcon} ${statusIcon} **${bean.title}**\n`;
      message += `   \`${bean.id}\` - ${shortenPath(bean.sourceFile)}\n\n`;
    }
  }

  message += `_${beans.length} total bean${beans.length !== 1 ? 's' : ''}_`;
  return message;
}

function getTypeIcon(type?: string): string {
  switch (type) {
    case 'bug':
      return '🐛';
    case 'feature':
      return '✨';
    case 'epic':
      return '📋';
    case 'task':
    default:
      return '📝';
  }
}

function getStatusIcon(status: string): string {
  switch (status) {
    case 'todo':
      return '⬜';
    case 'in_progress':
      return '🔄';
    case 'completed':
      return '✅';
    case 'archived':
      return '📦';
    default:
      return '⬜';
  }
}

function shortenPath(path: string): string {
  const parts = path.replace(/\\/g, '/').split('/');
  if (parts.length <= 3) return path;
  return `.../${parts.slice(-3).join('/')}`;
}
