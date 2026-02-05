/**
 * SpockAI Chat Close Command
 * Closes the chat window and ends conversation
 */

import type { CommandResult } from '../../types/index.js';
import type { CommandContext } from '../../base/skill.js';
import { ConversationEngine, createConversationEngine } from '../engine.js';

let conversationEngine: ConversationEngine | null = null;

function getConversationEngine(): ConversationEngine {
  if (!conversationEngine) {
    conversationEngine = createConversationEngine();
  }
  return conversationEngine;
}

/**
 * Chat close command handler
 */
export async function closeCommand(
  _args: string[],
  context: CommandContext
): Promise<CommandResult<{ closed: boolean }>> {
  const engine = getConversationEngine();

  try {
    const status = engine.getStatus();

    if (!status.active) {
      return {
        success: true,
        data: { closed: false },
        message: '_No active chat session_'
      };
    }

    const messageCount = status.messageCount;
    engine.endConversation();

    context.logger.info('Chat session closed', {
      conversationId: status.conversationId,
      messageCount
    });

    return {
      success: true,
      data: { closed: true },
      message: `✅ Chat window closed. Session had ${messageCount} message(s).`
    };
  } catch (error) {
    context.logger.error('Failed to close chat', { error });
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to close chat'
    };
  }
}

/**
 * Chat cancel command handler
 * Cancels the active configuration wizard
 */
export async function cancelCommand(
  _args: string[],
  context: CommandContext
): Promise<CommandResult<{ cancelled: boolean }>> {
  const engine = getConversationEngine();

  try {
    const result = engine.cancelWizard();

    return {
      success: true,
      data: { cancelled: true },
      message: result
    };
  } catch (error) {
    context.logger.error('Failed to cancel wizard', { error });
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to cancel'
    };
  }
}

/**
 * Chat history command handler
 * Shows conversation history
 */
export async function historyCommand(
  _args: string[],
  context: CommandContext
): Promise<CommandResult<{ history: string }>> {
  const engine = getConversationEngine();

  try {
    const status = engine.getStatus();

    if (!status.active) {
      return {
        success: true,
        data: { history: '' },
        message: '_No active chat session_'
      };
    }

    const history = engine.getFormattedHistory();

    return {
      success: true,
      data: { history },
      message: history || '_No messages in history_'
    };
  } catch (error) {
    context.logger.error('Failed to get history', { error });
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get history'
    };
  }
}
