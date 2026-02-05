/**
 * SpockAI Configuration Wizard
 * Guided setup flows for configuration through conversation
 */

import type {
  WizardStep,
  WizardDefinition,
  IntentType,
  ConfigurationIntent,
  ConversationContext
} from './types.js';
import { chatLogger } from '../utils/logger.js';

// Email account wizard steps
const EMAIL_WIZARD_STEPS: WizardStep[] = [
  {
    id: 'provider',
    prompt: 'Which email provider would you like to connect? (google/microsoft)',
    field: 'provider',
    type: 'choice',
    choices: ['google', 'microsoft'],
    validation: (v) => ['google', 'microsoft'].includes(v.toLowerCase()),
    transform: (v) => v.toLowerCase()
  },
  {
    id: 'email',
    prompt: 'What is your email address?',
    field: 'email',
    type: 'email',
    validation: (v) => /^[\w.-]+@[\w.-]+\.\w+$/.test(v)
  },
  {
    id: 'accountName',
    prompt: 'Give this account a name (e.g., "Personal" or "Work"):',
    field: 'accountName',
    type: 'text',
    validation: (v) => v.length > 0 && v.length <= 50
  }
];

// Calendar wizard steps
const CALENDAR_WIZARD_STEPS: WizardStep[] = [
  {
    id: 'provider',
    prompt: 'Which calendar provider? (google/microsoft)',
    field: 'provider',
    type: 'choice',
    choices: ['google', 'microsoft'],
    validation: (v) => ['google', 'microsoft'].includes(v.toLowerCase()),
    transform: (v) => v.toLowerCase()
  },
  {
    id: 'calendarName',
    prompt: 'Give this calendar a name:',
    field: 'calendarName',
    type: 'text',
    validation: (v) => v.length > 0 && v.length <= 50
  },
  {
    id: 'isShared',
    prompt: 'Is this a shared calendar? (yes/no)',
    field: 'isShared',
    type: 'boolean',
    validation: (v) => ['yes', 'no', 'y', 'n', 'true', 'false'].includes(v.toLowerCase()),
    transform: (v) => ['yes', 'y', 'true'].includes(v.toLowerCase())
  }
];

// BEANS path wizard steps
const BEANS_PATH_WIZARD_STEPS: WizardStep[] = [
  {
    id: 'path',
    prompt: 'Enter the path to scan for BEANS files:',
    field: 'path',
    type: 'text',
    validation: (v) => v.length > 0
  }
];

// Notification config wizard steps
const NOTIFICATION_WIZARD_STEPS: WizardStep[] = [
  {
    id: 'notificationType',
    prompt: 'Which notification type? (high_priority_email, calendar_reminder, beans_priority_1)',
    field: 'notificationType',
    type: 'choice',
    choices: ['high_priority_email', 'calendar_reminder', 'beans_priority_1'],
    validation: (v) => ['high_priority_email', 'calendar_reminder', 'beans_priority_1'].includes(v)
  },
  {
    id: 'enabled',
    prompt: 'Enable or disable this notification? (enable/disable)',
    field: 'enabled',
    type: 'choice',
    choices: ['enable', 'disable'],
    validation: (v) => ['enable', 'disable'].includes(v.toLowerCase()),
    transform: (v) => v.toLowerCase() === 'enable'
  }
];

// Samanage wizard steps
const SAMANAGE_WIZARD_STEPS: WizardStep[] = [
  {
    id: 'subdomain',
    prompt: 'Enter your Samanage subdomain (the part before .samanage.com):',
    field: 'subdomain',
    type: 'text',
    validation: (v) => /^[\w-]+$/.test(v)
  },
  {
    id: 'apiToken',
    prompt: 'Enter your Samanage API token:',
    field: 'apiToken',
    type: 'text',
    validation: (v) => v.length > 0
  }
];

// Monday.com wizard steps
const MONDAY_WIZARD_STEPS: WizardStep[] = [
  {
    id: 'apiToken',
    prompt: 'Enter your Monday.com API token:',
    field: 'apiToken',
    type: 'text',
    validation: (v) => v.length > 0
  }
];

/**
 * Configuration Wizard
 * Manages guided setup flows
 */
export class ConfigurationWizard {
  private wizards: Map<IntentType, WizardDefinition> = new Map();

  constructor() {
    this.registerDefaultWizards();
  }

  /**
   * Register default wizards
   */
  private registerDefaultWizards(): void {
    this.registerWizard({
      intentType: 'add_email_account',
      steps: EMAIL_WIZARD_STEPS,
      onComplete: async (data) => {
        return `Great! I'll set up your ${data.provider} email account (${data.email}) as "${data.accountName}". You'll need to complete OAuth authentication to finish setup.`;
      }
    });

    this.registerWizard({
      intentType: 'add_calendar',
      steps: CALENDAR_WIZARD_STEPS,
      onComplete: async (data) => {
        const sharedText = data.isShared ? ' (shared)' : '';
        return `I'll add your ${data.provider} calendar "${data.calendarName}"${sharedText}. You'll need to complete OAuth authentication.`;
      }
    });

    this.registerWizard({
      intentType: 'add_beans_path',
      steps: BEANS_PATH_WIZARD_STEPS,
      onComplete: async (data) => {
        return `Added "${data.path}" to BEANS scan paths. I'll check for priority 1 items in .beans/ directories there.`;
      }
    });

    this.registerWizard({
      intentType: 'configure_notifications',
      steps: NOTIFICATION_WIZARD_STEPS,
      onComplete: async (data) => {
        const action = data.enabled ? 'enabled' : 'disabled';
        return `${data.notificationType.replace(/_/g, ' ')} notifications have been ${action}.`;
      }
    });

    this.registerWizard({
      intentType: 'connect_samanage',
      steps: SAMANAGE_WIZARD_STEPS,
      onComplete: async (data) => {
        return `Samanage connected! I'll sync incidents from ${data.subdomain}.samanage.com.`;
      }
    });

    this.registerWizard({
      intentType: 'connect_monday',
      steps: MONDAY_WIZARD_STEPS,
      onComplete: async (data) => {
        return `Monday.com connected! I'll start syncing your boards and items.`;
      }
    });
  }

  /**
   * Register a wizard
   */
  registerWizard(wizard: WizardDefinition): void {
    this.wizards.set(wizard.intentType, wizard);
  }

  /**
   * Get wizard for intent type
   */
  getWizard(intentType: IntentType): WizardDefinition | undefined {
    return this.wizards.get(intentType);
  }

  /**
   * Get current step for context
   */
  getCurrentStep(context: ConversationContext): WizardStep | null {
    const intent = context.activeIntent;
    if (!intent) return null;

    const wizard = this.wizards.get(intent.type);
    if (!wizard) return null;

    // Find first incomplete step
    for (const step of wizard.steps) {
      if (context.collectedData[step.field] === undefined) {
        return step;
      }
    }

    return null;
  }

  /**
   * Process user response for current step
   */
  processResponse(
    context: ConversationContext,
    response: string
  ): { valid: boolean; error?: string; value?: unknown } {
    const currentStep = this.getCurrentStep(context);
    if (!currentStep) {
      return { valid: false, error: 'No active wizard step' };
    }

    // Validate response
    if (currentStep.validation && !currentStep.validation(response)) {
      return {
        valid: false,
        error: this.getValidationError(currentStep)
      };
    }

    // Transform response if needed
    const value = currentStep.transform
      ? currentStep.transform(response)
      : response;

    return { valid: true, value };
  }

  /**
   * Check if wizard is complete
   */
  isComplete(context: ConversationContext): boolean {
    const intent = context.activeIntent;
    if (!intent) return false;

    const wizard = this.wizards.get(intent.type);
    if (!wizard) return false;

    return wizard.steps.every(
      step => context.collectedData[step.field] !== undefined
    );
  }

  /**
   * Complete wizard and get result message
   */
  async complete(context: ConversationContext): Promise<string> {
    const intent = context.activeIntent;
    if (!intent) {
      return 'No active configuration to complete.';
    }

    const wizard = this.wizards.get(intent.type);
    if (!wizard) {
      return 'Unknown configuration type.';
    }

    try {
      return await wizard.onComplete(context.collectedData);
    } catch (error) {
      chatLogger.error('Wizard completion failed', { error });
      return 'Sorry, something went wrong completing the configuration.';
    }
  }

  /**
   * Get validation error message for step
   */
  private getValidationError(step: WizardStep): string {
    switch (step.type) {
      case 'email':
        return 'Please enter a valid email address.';
      case 'boolean':
        return 'Please answer yes or no.';
      case 'choice':
        return `Please choose one of: ${step.choices?.join(', ')}`;
      default:
        return 'Invalid input. Please try again.';
    }
  }
}

/**
 * Create configuration wizard
 */
export function createConfigurationWizard(): ConfigurationWizard {
  return new ConfigurationWizard();
}
