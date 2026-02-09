/**
 * SpockAI Conversation Engine
 * Handles natural language conversation for configuration
 */

import type {
  ChatMessage,
  ConversationContext,
  ConfigurationIntent,
  ChatConfig,
  ChatSessionStatus
} from './types.js';
import { IntentParser, createIntentParser } from './intent-parser.js';
import { ConfigurationWizard, createConfigurationWizard } from './wizard.js';
import { ResponseFormatter, createResponseFormatter } from './formatter.js';
import { chatLogger } from '../utils/logger.js';
import { randomUUID } from 'crypto';

const DEFAULT_CONFIG: ChatConfig = {
  maxHistoryLength: 50,
  systemPrompt: 'You are SpockAI, a helpful personal assistant for managing email, calendar, tasks, and notifications.',
  responseTimeout: 30000
};

/**
 * Conversation Engine
 * Manages chat conversations and configuration flows
 */
export class ConversationEngine {
  private config: ChatConfig;
  private intentParser: IntentParser;
  private wizard: ConfigurationWizard;
  private formatter: ResponseFormatter;
  private context: ConversationContext | null = null;

  constructor(config: Partial<ChatConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.intentParser = createIntentParser();
    this.wizard = createConfigurationWizard();
    this.formatter = createResponseFormatter();

    chatLogger.info('Conversation engine initialized');
  }

  /**
   * Start a new conversation
   */
  startConversation(): ConversationContext {
    this.context = {
      conversationId: randomUUID(),
      messages: [],
      pendingQuestions: [],
      collectedData: {},
      startedAt: new Date(),
      lastActivityAt: new Date()
    };

    // Add system message
    this.addMessage('system', this.config.systemPrompt);

    chatLogger.info('New conversation started', {
      conversationId: this.context.conversationId
    });

    return this.context;
  }

  /**
   * Process user input
   */
  async processInput(input: string): Promise<string> {
    if (!this.context) {
      this.startConversation();
    }

    // Add user message
    this.addMessage('user', input);
    this.context!.lastActivityAt = new Date();

    try {
      let response: string;

      // Check if we're in an active wizard flow
      if (this.context!.activeIntent && !this.context!.activeIntent.complete) {
        response = await this.processWizardInput(input);
      } else {
        // Parse new intent
        const intent = this.intentParser.parse(input);
        response = await this.processIntent(intent, input);
      }

      // Add assistant response
      this.addMessage('assistant', response);

      return response;
    } catch (error) {
      chatLogger.error('Error processing input', { error });
      const errorResponse = this.formatter.formatError(
        'Sorry, something went wrong. Please try again.'
      );
      this.addMessage('assistant', errorResponse);
      return errorResponse;
    }
  }

  /**
   * Process a detected intent
   */
  private async processIntent(intent: ConfigurationIntent, _input: string): Promise<string> {
    chatLogger.debug('Processing intent', {
      type: intent.type,
      confidence: intent.confidence
    });

    // Handle special intents
    if (intent.type === 'help') {
      return this.formatter.formatHelp();
    }

    if (intent.type === 'status') {
      // Return placeholder - would be filled with actual service data
      return this.formatter.formatStatus({
        email: { accounts: 0, unread: 0 },
        calendar: { sources: 0, todayEvents: 0 },
        beans: { paths: 0, priorityOne: 0 },
        services: { connected: 0 },
        notifications: { channel: 'telegram', enabled: true }
      });
    }

    if (intent.type === 'unknown') {
      return this.formatter.formatIntentRecognition(intent);
    }

    // Start wizard for configuration intent
    const wizard = this.wizard.getWizard(intent.type);
    if (wizard) {
      this.context!.activeIntent = intent;
      this.context!.collectedData = { ...intent.entities };

      // Check if we already have all required data
      if (this.wizard.isComplete(this.context!)) {
        return this.completeWizard();
      }

      // Get first step
      const currentStep = this.wizard.getCurrentStep(this.context!);
      if (currentStep) {
        return this.formatter.formatIntentRecognition(intent) + '\n\n' +
          this.formatter.formatWizardPrompt(currentStep.prompt);
      }
    }

    return this.formatter.formatIntentRecognition(intent);
  }

  /**
   * Process input during wizard flow
   */
  private async processWizardInput(input: string): Promise<string> {
    const currentStep = this.wizard.getCurrentStep(this.context!);
    if (!currentStep) {
      return this.completeWizard();
    }

    // Validate and process response
    const result = this.wizard.processResponse(this.context!, input);

    if (!result.valid) {
      return this.formatter.formatValidationError(result.error!) + '\n\n' +
        this.formatter.formatWizardPrompt(currentStep.prompt);
    }

    // Store collected data
    this.context!.collectedData[currentStep.field] = result.value;

    // Check if wizard is complete
    if (this.wizard.isComplete(this.context!)) {
      return this.completeWizard();
    }

    // Get next step
    const nextStep = this.wizard.getCurrentStep(this.context!);
    if (nextStep) {
      return this.formatter.formatWizardPrompt(nextStep.prompt);
    }

    return this.completeWizard();
  }

  /**
   * Complete the active wizard
   */
  private async completeWizard(): Promise<string> {
    const result = await this.wizard.complete(this.context!);

    // Clear wizard state
    this.context!.activeIntent = undefined;
    this.context!.collectedData = {};

    return this.formatter.formatSuccess(result);
  }

  /**
   * Get welcome message
   */
  getWelcomeMessage(): string {
    return this.formatter.formatWelcome();
  }

  /**
   * Get conversation history
   */
  getHistory(): ChatMessage[] {
    return this.context?.messages ?? [];
  }

  /**
   * Get formatted history
   */
  getFormattedHistory(): string {
    return this.formatter.formatHistory(this.getHistory());
  }

  /**
   * Get session status
   */
  getStatus(): ChatSessionStatus {
    return {
      active: this.context !== null,
      conversationId: this.context?.conversationId,
      messageCount: this.context?.messages.length ?? 0,
      activeIntent: this.context?.activeIntent?.type,
      lastActivity: this.context?.lastActivityAt
    };
  }

  /**
   * Cancel active wizard
   */
  cancelWizard(): string {
    if (this.context?.activeIntent) {
      this.context.activeIntent = undefined;
      this.context.collectedData = {};
      return 'Configuration cancelled. What else can I help you with?';
    }
    return 'No active configuration to cancel.';
  }

  /**
   * End conversation
   */
  endConversation(): void {
    if (this.context) {
      chatLogger.info('Conversation ended', {
        conversationId: this.context.conversationId,
        messageCount: this.context.messages.length
      });
    }
    this.context = null;
  }

  /**
   * Add message to conversation
   */
  private addMessage(role: ChatMessage['role'], content: string): void {
    if (!this.context) return;

    const message: ChatMessage = {
      id: randomUUID(),
      role,
      content,
      timestamp: new Date()
    };

    this.context.messages.push(message);

    // Trim history if too long
    if (this.context.messages.length > this.config.maxHistoryLength) {
      // Keep system message and recent messages
      const systemMessages = this.context.messages.filter(m => m.role === 'system');
      const recentMessages = this.context.messages
        .filter(m => m.role !== 'system')
        .slice(-this.config.maxHistoryLength + systemMessages.length);
      this.context.messages = [...systemMessages, ...recentMessages];
    }
  }
}

/**
 * Create conversation engine
 */
export function createConversationEngine(config?: Partial<ChatConfig>): ConversationEngine {
  return new ConversationEngine(config);
}
