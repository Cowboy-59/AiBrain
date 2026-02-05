/**
 * SpockAI Teams Bot Listener
 * Handles bidirectional communication with Microsoft Teams
 *
 * NOTE: This is a stub implementation. Full Teams bot integration
 * requires Azure Bot Service registration and additional setup.
 */

import type { TeamsConfig, TeamsBotMessage } from './teams-types.js';
import { notifyLogger } from '../utils/logger.js';

/**
 * Teams Bot Listener
 * Listens for incoming messages from Teams bot
 */
export class TeamsBotListener {
  private config: TeamsConfig;
  private running: boolean = false;

  constructor(config: TeamsConfig) {
    this.config = config;
    notifyLogger.info('Teams bot listener initialized (stub)');
  }

  /**
   * Start listening for bot messages
   */
  async start(): Promise<void> {
    if (!this.config.botAppId || !this.config.botAppSecret) {
      notifyLogger.warn('Teams bot not configured - bidirectional messaging unavailable');
      return;
    }

    notifyLogger.info('Starting Teams bot listener');
    this.running = true;

    // In production:
    // 1. Set up Express server to receive webhook callbacks
    // 2. Register with Azure Bot Service
    // 3. Handle incoming activities

    /*
    const server = express();
    server.post('/api/messages', async (req, res) => {
      await this.handleActivity(req.body);
      res.sendStatus(200);
    });
    server.listen(3978);
    */
  }

  /**
   * Stop listening
   */
  async stop(): Promise<void> {
    notifyLogger.info('Stopping Teams bot listener');
    this.running = false;
  }

  /**
   * Check if running
   */
  isRunning(): boolean {
    return this.running;
  }

  /**
   * Handle incoming bot activity
   */
  async handleActivity(activity: TeamsBotMessage): Promise<string | null> {
    if (activity.type !== 'message') {
      return null;
    }

    const text = activity.text?.trim().toLowerCase();
    if (!text) {
      return null;
    }

    notifyLogger.debug('Received Teams message', {
      from: activity.from.name,
      text: text.substring(0, 50)
    });

    // Handle commands
    if (text.startsWith('/')) {
      return this.handleCommand(text, activity);
    }

    // Handle natural language queries
    return this.handleQuery(text, activity);
  }

  /**
   * Handle slash commands
   */
  private handleCommand(command: string, _activity: TeamsBotMessage): string {
    const parts = command.substring(1).split(' ');
    const cmd = parts[0];

    switch (cmd) {
      case 'status':
        return 'SpockAI Status:\n• Email: Connected\n• Calendar: Connected\n• Notifications: Active';

      case 'help':
        return `SpockAI Commands:
/status - Show current status
/emails - Show priority emails
/calendar - Show today's events
/tasks - Show priority 1 tasks
/help - Show this message`;

      case 'emails':
        return 'Checking emails... (feature in development)';

      case 'calendar':
        return 'Checking calendar... (feature in development)';

      case 'tasks':
        return 'Checking tasks... (feature in development)';

      default:
        return `Unknown command: ${cmd}. Type /help for available commands.`;
    }
  }

  /**
   * Handle natural language queries
   */
  private handleQuery(query: string, _activity: TeamsBotMessage): string {
    // Simple keyword matching for common queries
    if (query.includes('email') || query.includes('mail')) {
      return 'You have 3 high-priority emails. Use /emails to see them.';
    }

    if (query.includes('calendar') || query.includes('meeting') || query.includes('event')) {
      return 'You have 2 events today. Use /calendar to see details.';
    }

    if (query.includes('task') || query.includes('todo') || query.includes('priority')) {
      return 'You have 1 priority 1 task. Use /tasks to see it.';
    }

    if (query.includes('help') || query.includes('what can you do')) {
      return this.handleCommand('/help', _activity);
    }

    return "I can help with emails, calendar, and tasks. Try asking about those or type /help for commands.";
  }

  /**
   * Send a proactive message
   */
  async sendProactiveMessage(
    _conversationId: string,
    _message: string
  ): Promise<boolean> {
    // In production, use Bot Framework SDK to send proactive messages
    notifyLogger.warn('Proactive messaging not implemented in stub');
    return false;
  }
}

/**
 * Create Teams bot listener
 */
export function createTeamsBotListener(config: TeamsConfig): TeamsBotListener {
  return new TeamsBotListener(config);
}
