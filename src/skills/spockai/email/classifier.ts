/**
 * SpockAI Priority Classifier
 * Classifies email priority based on configurable rules
 */

import type { Email, PriorityRule, GlobalEmailRules, RuleCondition } from './types.js';
import type { Priority } from '../types/index.js';
import { emailLogger } from '../utils/logger.js';

/**
 * Priority Classifier for emails
 * Evaluates emails against VIP senders, keywords, and custom rules
 */
export class PriorityClassifier {
  private globalRules: GlobalEmailRules;
  private accountRules: Map<string, PriorityRule[]> = new Map();

  constructor(globalRules: GlobalEmailRules) {
    this.globalRules = globalRules;
  }

  /**
   * Set account-specific priority rules
   */
  setAccountRules(accountId: string, rules: PriorityRule[]): void {
    // Sort rules by order for consistent evaluation
    const sortedRules = [...rules].sort((a, b) => a.order - b.order);
    this.accountRules.set(accountId, sortedRules);
  }

  /**
   * Update global rules
   */
  updateGlobalRules(rules: GlobalEmailRules): void {
    this.globalRules = rules;
  }

  /**
   * Classify email priority
   * Order of evaluation:
   * 1. VIP sender check (high priority)
   * 2. Priority keywords in subject (high priority)
   * 3. Account-specific rules (custom priority)
   * 4. Default (low priority)
   */
  classify(email: Email): Priority {
    // Check VIP senders first
    if (this.isVipSender(email.senderEmail)) {
      emailLogger.debug('Email classified as HIGH (VIP sender)', {
        subject: email.subject,
        sender: email.senderEmail
      });
      return 'high';
    }

    // Check priority keywords in subject
    if (this.hasPriorityKeyword(email.subject)) {
      emailLogger.debug('Email classified as HIGH (priority keyword)', {
        subject: email.subject
      });
      return 'high';
    }

    // Check account-specific rules
    const accountRules = this.accountRules.get(email.accountId);
    if (accountRules) {
      for (const rule of accountRules) {
        if (rule.enabled && this.evaluateRule(rule, email)) {
          emailLogger.debug('Email classified by rule', {
            subject: email.subject,
            rule: rule.name,
            priority: rule.priority
          });
          return rule.priority;
        }
      }
    }

    // Default to low priority
    return 'low';
  }

  /**
   * Classify multiple emails
   */
  classifyBatch(emails: Email[]): Map<string, Priority> {
    const results = new Map<string, Priority>();
    for (const email of emails) {
      results.set(email.id, this.classify(email));
    }
    return results;
  }

  /**
   * Check if sender is in VIP list
   */
  private isVipSender(senderEmail: string): boolean {
    const normalizedSender = senderEmail.toLowerCase();
    return this.globalRules.vipSenders.some(
      vip => normalizedSender.includes(vip.toLowerCase())
    );
  }

  /**
   * Check if subject contains priority keywords
   */
  private hasPriorityKeyword(subject: string): boolean {
    const normalizedSubject = subject.toUpperCase();
    return this.globalRules.priorityKeywords.some(
      keyword => normalizedSubject.includes(keyword.toUpperCase())
    );
  }

  /**
   * Evaluate a single rule against an email
   */
  private evaluateRule(rule: PriorityRule, email: Email): boolean {
    return this.evaluateCondition(rule.condition, email);
  }

  /**
   * Evaluate a condition against an email
   */
  private evaluateCondition(condition: RuleCondition, email: Email): boolean {
    const fieldValue = this.getFieldValue(condition.type, email);
    if (!fieldValue) return false;

    const compareValue = condition.caseSensitive
      ? fieldValue
      : fieldValue.toLowerCase();
    const conditionValue = condition.caseSensitive
      ? condition.value
      : condition.value.toLowerCase();

    switch (condition.operator) {
      case 'equals':
        return compareValue === conditionValue;

      case 'contains':
        return compareValue.includes(conditionValue);

      case 'startsWith':
        return compareValue.startsWith(conditionValue);

      case 'endsWith':
        return compareValue.endsWith(conditionValue);

      case 'matches':
        try {
          const regex = new RegExp(condition.value, condition.caseSensitive ? '' : 'i');
          return regex.test(fieldValue);
        } catch {
          emailLogger.warn('Invalid regex in rule condition', { value: condition.value });
          return false;
        }

      default:
        return false;
    }
  }

  /**
   * Get field value from email based on condition type
   */
  private getFieldValue(type: RuleCondition['type'], email: Email): string | undefined {
    switch (type) {
      case 'sender':
        return email.sender;
      case 'senderEmail':
        return email.senderEmail;
      case 'domain':
        return email.senderEmail.split('@')[1];
      case 'subject':
        return email.subject;
      case 'label':
        return email.labels?.join(',');
      default:
        return undefined;
    }
  }

  /**
   * Get statistics about classification rules
   */
  getStats(): { vipCount: number; keywordCount: number; ruleCount: number } {
    let ruleCount = 0;
    for (const rules of this.accountRules.values()) {
      ruleCount += rules.filter(r => r.enabled).length;
    }

    return {
      vipCount: this.globalRules.vipSenders.length,
      keywordCount: this.globalRules.priorityKeywords.length,
      ruleCount
    };
  }
}

/**
 * Create a default classifier with common settings
 */
export function createDefaultClassifier(): PriorityClassifier {
  return new PriorityClassifier({
    vipSenders: [],
    priorityKeywords: ['URGENT', 'ACTION REQUIRED', 'CRITICAL', 'ASAP', 'IMMEDIATE']
  });
}
