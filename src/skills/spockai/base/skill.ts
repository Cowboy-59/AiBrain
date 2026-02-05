/**
 * SpockAI Base Skill Class
 * Abstract base class for all SpockAI skills
 */

import type { SkillMetadata, CommandResult, SkillEvent } from '../types/index.js';
import type { SpockAIConfig } from '../types/config.js';
import { getConfigLoader, ConfigLoader } from '../config/loader.js';
import { ModuleLogger } from '../utils/logger.js';

// Command handler type
export type CommandHandler<T = unknown> = (args: string[], context: CommandContext) => Promise<CommandResult<T>>;

// Command context passed to handlers
export interface CommandContext {
  config: SpockAIConfig;
  logger: ModuleLogger;
  emit: (event: SkillEvent) => void;
}

// Command definition
export interface CommandDefinition {
  name: string;
  description: string;
  usage: string;
  examples: string[];
  handler: CommandHandler;
}

// Event listener type
export type EventListener = (event: SkillEvent) => void | Promise<void>;

/**
 * Abstract base class for SpockAI skills
 */
export abstract class BaseSkill {
  protected readonly metadata: SkillMetadata;
  protected readonly logger: ModuleLogger;
  protected readonly configLoader: ConfigLoader;
  protected commands: Map<string, CommandDefinition> = new Map();
  protected eventListeners: Map<string, Set<EventListener>> = new Map();
  protected initialized: boolean = false;

  constructor(metadata: SkillMetadata) {
    this.metadata = metadata;
    this.logger = new ModuleLogger(metadata.name);
    this.configLoader = getConfigLoader();
  }

  /**
   * Get skill metadata
   */
  getMetadata(): SkillMetadata {
    return this.metadata;
  }

  /**
   * Initialize the skill
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      this.logger.warn('Skill already initialized');
      return;
    }

    this.logger.info('Initializing skill', { name: this.metadata.name });

    try {
      await this.configLoader.load();
      await this.onInitialize();
      this.initialized = true;
      this.logger.info('Skill initialized successfully');
    } catch (error) {
      this.logger.error('Skill initialization failed', { error });
      throw error;
    }
  }

  /**
   * Shutdown the skill
   */
  async shutdown(): Promise<void> {
    this.logger.info('Shutting down skill');
    await this.onShutdown();
    this.initialized = false;
  }

  /**
   * Register a command
   */
  protected registerCommand(command: CommandDefinition): void {
    this.commands.set(command.name, command);
    this.logger.debug('Registered command', { command: command.name });
  }

  /**
   * Execute a command
   */
  async executeCommand(name: string, args: string[]): Promise<CommandResult> {
    const command = this.commands.get(name);

    if (!command) {
      return {
        success: false,
        error: `Unknown command: ${name}`,
        message: `Available commands: ${Array.from(this.commands.keys()).join(', ')}`
      };
    }

    const context: CommandContext = {
      config: this.configLoader.getSpockAIConfig(),
      logger: this.logger,
      emit: (event) => this.emit(event)
    };

    try {
      this.logger.debug('Executing command', { command: name, args });
      const result = await command.handler(args, context);
      return result;
    } catch (error) {
      this.logger.error('Command execution failed', { command: name, error });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Get available commands
   */
  getCommands(): CommandDefinition[] {
    return Array.from(this.commands.values());
  }

  /**
   * Subscribe to events
   */
  on(eventType: string, listener: EventListener): void {
    if (!this.eventListeners.has(eventType)) {
      this.eventListeners.set(eventType, new Set());
    }
    this.eventListeners.get(eventType)!.add(listener);
  }

  /**
   * Unsubscribe from events
   */
  off(eventType: string, listener: EventListener): void {
    this.eventListeners.get(eventType)?.delete(listener);
  }

  /**
   * Emit an event
   */
  protected emit(event: SkillEvent): void {
    const listeners = this.eventListeners.get(event.type);
    if (listeners) {
      for (const listener of listeners) {
        try {
          void listener(event);
        } catch (error) {
          this.logger.error('Event listener error', { eventType: event.type, error });
        }
      }
    }
  }

  /**
   * Get current configuration
   */
  protected getConfig(): SpockAIConfig {
    return this.configLoader.getSpockAIConfig();
  }

  /**
   * Update configuration
   */
  protected async updateConfig(updates: Partial<SpockAIConfig>): Promise<SpockAIConfig> {
    return this.configLoader.updateSpockAIConfig(updates);
  }

  // Abstract methods to be implemented by subclasses
  protected abstract onInitialize(): Promise<void>;
  protected abstract onShutdown(): Promise<void>;
}

/**
 * Skill registry for managing multiple skills
 */
export class SkillRegistry {
  private skills: Map<string, BaseSkill> = new Map();
  private logger = new ModuleLogger('registry');

  /**
   * Register a skill
   */
  register(skill: BaseSkill): void {
    const name = skill.getMetadata().name;
    this.skills.set(name, skill);
    this.logger.info('Registered skill', { name });
  }

  /**
   * Get a skill by name
   */
  get(name: string): BaseSkill | undefined {
    return this.skills.get(name);
  }

  /**
   * Get all registered skills
   */
  getAll(): BaseSkill[] {
    return Array.from(this.skills.values());
  }

  /**
   * Initialize all skills
   */
  async initializeAll(): Promise<void> {
    for (const skill of this.skills.values()) {
      await skill.initialize();
    }
  }

  /**
   * Shutdown all skills
   */
  async shutdownAll(): Promise<void> {
    for (const skill of this.skills.values()) {
      await skill.shutdown();
    }
  }
}

// Global skill registry instance
export const skillRegistry = new SkillRegistry();
