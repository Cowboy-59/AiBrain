/**
 * SpockAI Chat Open Command
 * Opens the chat window
 */

import type { CommandResult } from '../../types/index.js';
import type { CommandContext } from '../../base/skill.js';
import type { ChatSessionStatus } from '../types.js';
import { ConversationEngine, createConversationEngine } from '../engine.js';

let conversationEngine: ConversationEngine | null = null;

function getConversationEngine(): ConversationEngine {
  if (!conversationEngine) {
    conversationEngine = createConversationEngine();
  }
  return conversationEngine;
}

/**
 * Chat open command handler
 */
export async function openCommand(
  _args: string[],
  context: CommandContext
): Promise<CommandResult<ChatSessionStatus>> {
  const engine = getConversationEngine();

  try {
    // Start a new conversation
    engine.startConversation();
    const welcomeMessage = engine.getWelcomeMessage();
    const status = engine.getStatus();

    context.logger.info('Chat session started', {
      conversationId: status.conversationId
    });

    let message = '**Chat Window Opened**\n\n';
    message += welcomeMessage;
    message += '\n\n_Note: In production, this opens a dockable Electron window._';

    return {
      success: true,
      data: status,
      message
    };
  } catch (error) {
    context.logger.error('Failed to open chat', { error });
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to open chat'
    };
  }
}

/**
 * Chat message command handler
 * Process a message in the current conversation
 */
export async function messageCommand(
  args: string[],
  context: CommandContext
): Promise<CommandResult<{ response: string }>> {
  const engine = getConversationEngine();

  const input = args.join(' ');
  if (!input.trim()) {
    return {
      success: false,
      error: 'Please provide a message'
    };
  }

  try {
    const response = await engine.processInput(input);

    return {
      success: true,
      data: { response },
      message: response
    };
  } catch (error) {
    context.logger.error('Failed to process message', { error });
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to process message'
    };
  }
}

/**
 * Chat status command handler
 */
export async function statusCommand(
  _args: string[],
  context: CommandContext
): Promise<CommandResult<ChatSessionStatus>> {
  const engine = getConversationEngine();

  try {
    const status = engine.getStatus();

    let message = '**Chat Session Status**\n\n';
    message += `Active: ${status.active ? 'Yes' : 'No'}\n`;

    if (status.active) {
      message += `Conversation ID: \`${status.conversationId?.substring(0, 8)}...\`\n`;
      message += `Messages: ${status.messageCount}\n`;
      if (status.activeIntent) {
        message += `Active Intent: ${status.activeIntent.replace(/_/g, ' ')}\n`;
      }
      if (status.lastActivity) {
        message += `Last Activity: ${formatRelativeTime(status.lastActivity)}`;
      }
    }

    return {
      success: true,
      data: status,
      message
    };
  } catch (error) {
    context.logger.error('Failed to get chat status', { error });
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get status'
    };
  }
}

function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSeconds = Math.floor(diffMs / 1000);

  if (diffSeconds < 60) return 'just now';
  if (diffSeconds < 3600) return `${Math.floor(diffSeconds / 60)}m ago`;
  if (diffSeconds < 86400) return `${Math.floor(diffSeconds / 3600)}h ago`;
  return `${Math.floor(diffSeconds / 86400)}d ago`;
}
