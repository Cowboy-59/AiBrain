/**
 * SpockAI Intent Parser
 * Parses natural language input to detect configuration intents
 */

import type { ConfigurationIntent, IntentType, IntentEntities } from './types.js';
// Unused: chatLogger import removed

// Intent patterns with keywords and confidence weights
interface IntentPattern {
  type: IntentType;
  patterns: RegExp[];
  keywords: string[];
  requiredFields: string[];
}

const INTENT_PATTERNS: IntentPattern[] = [
  {
    type: 'add_email_account',
    patterns: [
      /add\s+(?:my\s+)?(?:email|mail)\s+(?:account)?/i,
      /connect\s+(?:my\s+)?(?:email|gmail|outlook)/i,
      /set\s*up\s+(?:my\s+)?(?:email|mail)/i
    ],
    keywords: ['email', 'gmail', 'outlook', 'add', 'connect', 'setup'],
    requiredFields: ['provider', 'email']
  },
  {
    type: 'remove_email_account',
    patterns: [
      /remove\s+(?:my\s+)?(?:email|mail)\s+(?:account)?/i,
      /disconnect\s+(?:my\s+)?(?:email|gmail|outlook)/i,
      /delete\s+(?:my\s+)?(?:email|mail)\s+(?:account)?/i
    ],
    keywords: ['remove', 'disconnect', 'delete', 'email'],
    requiredFields: ['accountId']
  },
  {
    type: 'configure_notifications',
    patterns: [
      /(?:enable|disable|turn\s+(?:on|off))\s+(?:notifications?)/i,
      /configure\s+(?:my\s+)?notifications?/i,
      /(?:change|update)\s+notification\s+(?:settings?)?/i
    ],
    keywords: ['notification', 'alert', 'enable', 'disable', 'configure'],
    requiredFields: ['notificationType', 'enabled']
  },
  {
    type: 'add_calendar',
    patterns: [
      /add\s+(?:my\s+)?calendar/i,
      /connect\s+(?:my\s+)?(?:google|microsoft)\s+calendar/i,
      /set\s*up\s+(?:my\s+)?calendar/i
    ],
    keywords: ['calendar', 'add', 'connect', 'google calendar', 'outlook calendar'],
    requiredFields: ['provider']
  },
  {
    type: 'remove_calendar',
    patterns: [
      /remove\s+(?:my\s+)?calendar/i,
      /disconnect\s+(?:my\s+)?calendar/i
    ],
    keywords: ['calendar', 'remove', 'disconnect', 'delete'],
    requiredFields: ['calendarId']
  },
  {
    type: 'add_beans_path',
    patterns: [
      /add\s+(?:a\s+)?(?:beans?\s+)?(?:scan\s+)?path/i,
      /scan\s+(?:this\s+)?(?:directory|folder|path)/i,
      /watch\s+(?:this\s+)?(?:directory|folder)/i
    ],
    keywords: ['beans', 'path', 'scan', 'watch', 'directory', 'folder'],
    requiredFields: ['path']
  },
  {
    type: 'connect_samanage',
    patterns: [
      /connect\s+(?:to\s+)?samanage/i,
      /set\s*up\s+samanage/i,
      /add\s+samanage/i
    ],
    keywords: ['samanage', 'connect', 'setup'],
    requiredFields: ['apiToken', 'subdomain']
  },
  {
    type: 'connect_monday',
    patterns: [
      /connect\s+(?:to\s+)?monday\.?com?/i,
      /set\s*up\s+monday\.?com?/i,
      /add\s+monday\.?com?/i
    ],
    keywords: ['monday', 'monday.com', 'connect', 'setup'],
    requiredFields: ['apiToken']
  },
  {
    type: 'help',
    patterns: [
      /help\s*(?:me)?/i,
      /what\s+can\s+you\s+do/i,
      /how\s+(?:do\s+i|can\s+i|to)/i
    ],
    keywords: ['help', 'how', 'what'],
    requiredFields: []
  },
  {
    type: 'status',
    patterns: [
      /(?:show|get|check)\s+(?:my\s+)?status/i,
      /what(?:'s|\s+is)\s+(?:the\s+)?status/i,
      /how\s+(?:am\s+i\s+doing|are\s+things)/i
    ],
    keywords: ['status', 'show', 'check'],
    requiredFields: []
  }
];

/**
 * Intent Parser
 * Analyzes natural language to detect configuration intents
 */
export class IntentParser {
  /**
   * Parse user input to detect intent
   */
  parse(input: string): ConfigurationIntent {
    const normalizedInput = input.toLowerCase().trim();

    // Try pattern matching first
    for (const pattern of INTENT_PATTERNS) {
      for (const regex of pattern.patterns) {
        if (regex.test(normalizedInput)) {
          const entities = this.extractEntities(normalizedInput, pattern.type);
          const collectedFields = this.getCollectedFields(entities, pattern.requiredFields);

          return {
            type: pattern.type,
            confidence: 0.9,
            entities,
            requiredFields: pattern.requiredFields,
            collectedFields,
            complete: collectedFields.length === pattern.requiredFields.length
          };
        }
      }
    }

    // Fall back to keyword matching
    const keywordMatches = this.matchKeywords(normalizedInput);
    if (keywordMatches.type !== 'unknown') {
      return keywordMatches;
    }

    // Unknown intent
    return {
      type: 'unknown',
      confidence: 0,
      entities: {},
      requiredFields: [],
      collectedFields: [],
      complete: false
    };
  }

  /**
   * Extract entities from input
   */
  private extractEntities(input: string, _intentType: IntentType): IntentEntities {
    const entities: IntentEntities = {};

    // Extract provider
    if (input.includes('google') || input.includes('gmail')) {
      entities.provider = 'google';
    } else if (input.includes('microsoft') || input.includes('outlook')) {
      entities.provider = 'microsoft';
    } else if (input.includes('telegram')) {
      entities.provider = 'telegram';
    } else if (input.includes('teams')) {
      entities.provider = 'teams';
    }

    // Extract email
    const emailMatch = input.match(/[\w.-]+@[\w.-]+\.\w+/);
    if (emailMatch) {
      entities.email = emailMatch[0];
    }

    // Extract path
    const pathMatch = input.match(/(?:["']([^"']+)["']|([\/\\][\w\/\\.~-]+))/);
    if (pathMatch) {
      entities.path = pathMatch[1] || pathMatch[2];
    }

    // Extract boolean for enable/disable
    if (input.includes('enable') || input.includes('turn on')) {
      entities.enabled = true;
    } else if (input.includes('disable') || input.includes('turn off')) {
      entities.enabled = false;
    }

    return entities;
  }

  /**
   * Match keywords for fallback intent detection
   */
  private matchKeywords(input: string): ConfigurationIntent {
    let bestMatch: IntentPattern | null = null;
    let bestScore = 0;

    for (const pattern of INTENT_PATTERNS) {
      let score = 0;
      for (const keyword of pattern.keywords) {
        if (input.includes(keyword)) {
          score++;
        }
      }

      if (score > bestScore) {
        bestScore = score;
        bestMatch = pattern;
      }
    }

    if (bestMatch && bestScore >= 2) {
      const entities = this.extractEntities(input, bestMatch.type);
      const collectedFields = this.getCollectedFields(entities, bestMatch.requiredFields);

      return {
        type: bestMatch.type,
        confidence: Math.min(0.3 + (bestScore * 0.15), 0.75),
        entities,
        requiredFields: bestMatch.requiredFields,
        collectedFields,
        complete: collectedFields.length === bestMatch.requiredFields.length
      };
    }

    return {
      type: 'unknown',
      confidence: 0,
      entities: {},
      requiredFields: [],
      collectedFields: [],
      complete: false
    };
  }

  /**
   * Get list of collected fields based on entities
   */
  private getCollectedFields(entities: IntentEntities, requiredFields: string[]): string[] {
    return requiredFields.filter(field => entities[field] !== undefined);
  }

  /**
   * Update intent with additional entities from follow-up input
   */
  updateIntent(intent: ConfigurationIntent, input: string): ConfigurationIntent {
    const additionalEntities = this.extractEntities(input.toLowerCase(), intent.type);

    // Merge entities
    const mergedEntities = { ...intent.entities, ...additionalEntities };
    const collectedFields = this.getCollectedFields(mergedEntities, intent.requiredFields);

    return {
      ...intent,
      entities: mergedEntities,
      collectedFields,
      complete: collectedFields.length === intent.requiredFields.length
    };
  }
}

/**
 * Create intent parser
 */
export function createIntentParser(): IntentParser {
  return new IntentParser();
}
