/**
 * SpockAI Email Rules Command
 * Manage email priority rules (VIP senders, keywords)
 */

import type { CommandResult } from '../../types/index.js';
import type { CommandContext } from '../../base/skill.js';
import type { GlobalEmailRules } from '../types.js';

export interface RulesResult {
  rules: GlobalEmailRules;
  action?: string;
}

/**
 * Email rules command handler
 * Usage: /email rules [add|remove|list] [vip|keyword] [value]
 */
export async function rulesCommand(
  args: string[],
  context: CommandContext
): Promise<CommandResult<RulesResult>> {
  const globalRules = context.config.email.globalRules;
  const action = args[0]?.toLowerCase();

  // List rules (default)
  if (!action || action === 'list') {
    return listRules(globalRules);
  }

  // Add rule
  if (action === 'add') {
    return addRule(args.slice(1), globalRules, context);
  }

  // Remove rule
  if (action === 'remove') {
    return removeRule(args.slice(1), globalRules, context);
  }

  return {
    success: false,
    error: `Unknown action: ${action}`,
    message: 'Usage:\n- `/email rules` - List all rules\n- `/email rules add vip <email>` - Add VIP sender\n- `/email rules add keyword <word>` - Add priority keyword\n- `/email rules remove vip <email>` - Remove VIP sender\n- `/email rules remove keyword <word>` - Remove keyword'
  };
}

/**
 * List all rules
 */
function listRules(rules: GlobalEmailRules): CommandResult<RulesResult> {
  const vipList = rules.vipSenders.length > 0
    ? rules.vipSenders.map(v => `  • ${v}`).join('\n')
    : '  (none configured)';

  const keywordList = rules.priorityKeywords.length > 0
    ? rules.priorityKeywords.map(k => `  • ${k}`).join('\n')
    : '  (none configured)';

  return {
    success: true,
    data: { rules },
    message: `📋 **Email Priority Rules**\n\n**VIP Senders** (${rules.vipSenders.length}):\n${vipList}\n\n**Priority Keywords** (${rules.priorityKeywords.length}):\n${keywordList}\n\n_Emails matching these rules are marked as high priority._`
  };
}

/**
 * Add a rule
 */
function addRule(
  args: string[],
  rules: GlobalEmailRules,
  context: CommandContext
): CommandResult<RulesResult> {
  const [type, ...valueParts] = args;
  const value = valueParts.join(' ').replace(/"/g, '');

  if (!type || !value) {
    return {
      success: false,
      error: 'Missing type or value',
      message: 'Usage:\n- `/email rules add vip <email>` - Add VIP sender\n- `/email rules add keyword <word>` - Add priority keyword'
    };
  }

  const ruleType = type.toLowerCase();

  if (ruleType === 'vip') {
    if (rules.vipSenders.includes(value.toLowerCase())) {
      return {
        success: false,
        error: `VIP sender already exists: ${value}`
      };
    }

    rules.vipSenders.push(value.toLowerCase());
    context.logger.info('Added VIP sender', { value });

    return {
      success: true,
      data: { rules, action: 'add_vip' },
      message: `✅ Added VIP sender: **${value}**\n\nEmails from this sender will be marked as high priority.`
    };
  }

  if (ruleType === 'keyword') {
    const upperValue = value.toUpperCase();
    if (rules.priorityKeywords.includes(upperValue)) {
      return {
        success: false,
        error: `Priority keyword already exists: ${value}`
      };
    }

    rules.priorityKeywords.push(upperValue);
    context.logger.info('Added priority keyword', { value: upperValue });

    return {
      success: true,
      data: { rules, action: 'add_keyword' },
      message: `✅ Added priority keyword: **${upperValue}**\n\nEmails with this keyword in the subject will be marked as high priority.`
    };
  }

  return {
    success: false,
    error: `Unknown rule type: ${type}`,
    message: 'Valid types: vip, keyword'
  };
}

/**
 * Remove a rule
 */
function removeRule(
  args: string[],
  rules: GlobalEmailRules,
  context: CommandContext
): CommandResult<RulesResult> {
  const [type, ...valueParts] = args;
  const value = valueParts.join(' ').replace(/"/g, '');

  if (!type || !value) {
    return {
      success: false,
      error: 'Missing type or value',
      message: 'Usage:\n- `/email rules remove vip <email>` - Remove VIP sender\n- `/email rules remove keyword <word>` - Remove keyword'
    };
  }

  const ruleType = type.toLowerCase();

  if (ruleType === 'vip') {
    const index = rules.vipSenders.findIndex(v => v.toLowerCase() === value.toLowerCase());
    if (index === -1) {
      return {
        success: false,
        error: `VIP sender not found: ${value}`
      };
    }

    rules.vipSenders.splice(index, 1);
    context.logger.info('Removed VIP sender', { value });

    return {
      success: true,
      data: { rules, action: 'remove_vip' },
      message: `✅ Removed VIP sender: **${value}**`
    };
  }

  if (ruleType === 'keyword') {
    const upperValue = value.toUpperCase();
    const index = rules.priorityKeywords.findIndex(k => k === upperValue);
    if (index === -1) {
      return {
        success: false,
        error: `Priority keyword not found: ${value}`
      };
    }

    rules.priorityKeywords.splice(index, 1);
    context.logger.info('Removed priority keyword', { value: upperValue });

    return {
      success: true,
      data: { rules, action: 'remove_keyword' },
      message: `✅ Removed priority keyword: **${upperValue}**`
    };
  }

  return {
    success: false,
    error: `Unknown rule type: ${type}`,
    message: 'Valid types: vip, keyword'
  };
}
