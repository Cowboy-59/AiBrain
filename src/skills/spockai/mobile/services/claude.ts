import Anthropic from '@anthropic-ai/sdk';
import * as SecureStore from 'expo-secure-store';
import { tools, executeTool } from './tools';

let anthropic: Anthropic | null = null;
let conversationHistory: Anthropic.MessageParam[] = [];

const systemPrompt = `You are SpockAI, a helpful personal assistant running on a mobile device. You help with:
- Daily briefings and productivity
- Calendar and schedule management
- Email summaries
- Reminders and notes
- General questions and assistance

Be concise but thorough. Use markdown formatting when helpful.
You have access to tools for managing reminders, notes, and getting information.`;

async function getApiKey(): Promise<string | null> {
  try {
    const config = await SecureStore.getItemAsync('spockai_config');
    if (config) {
      const parsed = JSON.parse(config);
      return parsed.anthropicApiKey || null;
    }
  } catch (error) {
    console.error('Failed to get API key:', error);
  }
  return null;
}

async function initializeClient(): Promise<boolean> {
  const apiKey = await getApiKey();
  if (!apiKey) {
    return false;
  }

  anthropic = new Anthropic({
    apiKey,
    // React Native requires custom fetch
    fetch: globalThis.fetch,
  });
  return true;
}

export interface ChatResponse {
  success: boolean;
  message?: string;
  error?: string;
}

export async function chatWithAI(userMessage: string): Promise<ChatResponse> {
  // Initialize client if needed
  if (!anthropic) {
    const initialized = await initializeClient();
    if (!initialized) {
      return {
        success: false,
        error: 'AI not configured. Please add your API key in Settings.',
      };
    }
  }

  // Add user message to history
  conversationHistory.push({
    role: 'user',
    content: userMessage,
  });

  try {
    // Keep conversation history manageable
    if (conversationHistory.length > 20) {
      conversationHistory = conversationHistory.slice(-20);
    }

    let response = await anthropic!.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      system: systemPrompt,
      tools,
      messages: conversationHistory,
    });

    // Handle tool use loop
    while (response.stop_reason === 'tool_use') {
      const toolUseBlocks = response.content.filter(
        (block): block is Anthropic.ToolUseBlock => block.type === 'tool_use'
      );

      const toolResults: Anthropic.ToolResultBlockParam[] = [];

      for (const toolUse of toolUseBlocks) {
        console.log(`Executing tool: ${toolUse.name}`);
        const result = await executeTool(toolUse.name, toolUse.input as Record<string, unknown>);
        toolResults.push({
          type: 'tool_result',
          tool_use_id: toolUse.id,
          content: JSON.stringify(result),
        });
      }

      // Add assistant response and tool results to history
      conversationHistory.push({
        role: 'assistant',
        content: response.content,
      });
      conversationHistory.push({
        role: 'user',
        content: toolResults,
      });

      // Continue conversation
      response = await anthropic!.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1024,
        system: systemPrompt,
        tools,
        messages: conversationHistory,
      });
    }

    // Extract text response
    const textBlocks = response.content.filter(
      (block): block is Anthropic.TextBlock => block.type === 'text'
    );
    const responseText = textBlocks.map((b) => b.text).join('\n');

    // Add assistant response to history
    conversationHistory.push({
      role: 'assistant',
      content: response.content,
    });

    return {
      success: true,
      message: responseText,
    };
  } catch (error) {
    console.error('Chat error:', error);

    // Remove failed message from history
    conversationHistory.pop();

    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error occurred';

    if (errorMessage.includes('401') || errorMessage.includes('invalid_api_key')) {
      return {
        success: false,
        error: 'Invalid API key. Please check your settings.',
      };
    }

    return {
      success: false,
      error: errorMessage,
    };
  }
}

export function clearConversation() {
  conversationHistory = [];
}

export async function reinitializeClient() {
  anthropic = null;
  await initializeClient();
}
