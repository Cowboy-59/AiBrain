/**
 * SpockAI Email Service
 * Core email management service
 */

import type {
  EmailAccount,
  Email,
  EmailSyncResult,
  EmailFilterOptions,
  EmailAccountStatus,
  GlobalEmailRules
} from './types.js';
import type { Priority } from '../types/index.js';
import { ImapClient, createImapClient } from './imap-client.js';
import { PriorityClassifier } from './classifier.js';
import { emailLogger } from '../utils/logger.js';
import { encrypt, decrypt, isEncrypted } from '../utils/crypto.js';
import { randomUUID } from 'crypto';

/**
 * Email Service
 * Manages email accounts, syncing, and priority classification
 */
export class EmailService {
  private accounts: Map<string, EmailAccount> = new Map();
  private emails: Map<string, Email[]> = new Map(); // accountId -> emails
  private clients: Map<string, ImapClient> = new Map();
  private classifier: PriorityClassifier;
  private syncIntervals: Map<string, NodeJS.Timeout> = new Map();

  constructor(globalRules: GlobalEmailRules) {
    this.classifier = new PriorityClassifier(globalRules);
  }

  /**
   * Add an email account
   */
  async addAccount(account: Omit<EmailAccount, 'id'>): Promise<EmailAccount> {
    const id = randomUUID();
    const newAccount: EmailAccount = {
      ...account,
      id,
      credentials: await this.encryptCredentials(account.credentials)
    };

    this.accounts.set(id, newAccount);
    this.emails.set(id, []);
    this.classifier.setAccountRules(id, account.priorityRules);

    emailLogger.info('Email account added', {
      id,
      name: account.name,
      provider: account.provider
    });

    if (account.enabled) {
      await this.startSync(id);
    }

    return newAccount;
  }

  /**
   * Remove an email account
   */
  async removeAccount(accountId: string): Promise<boolean> {
    const account = this.accounts.get(accountId);
    if (!account) {
      return false;
    }

    this.stopSync(accountId);
    await this.disconnectClient(accountId);

    this.accounts.delete(accountId);
    this.emails.delete(accountId);

    emailLogger.info('Email account removed', { id: accountId, name: account.name });
    return true;
  }

  /**
   * Get all accounts
   */
  getAccounts(): EmailAccount[] {
    return Array.from(this.accounts.values());
  }

  /**
   * Get account by ID
   */
  getAccount(accountId: string): EmailAccount | undefined {
    return this.accounts.get(accountId);
  }

  /**
   * Update global rules
   */
  updateGlobalRules(rules: GlobalEmailRules): void {
    this.classifier.updateGlobalRules(rules);
    emailLogger.info('Global email rules updated');
  }

  /**
   * Sync emails for an account
   */
  async syncAccount(accountId: string): Promise<EmailSyncResult> {
    const account = this.accounts.get(accountId);
    if (!account) {
      throw new Error(`Account not found: ${accountId}`);
    }

    const startTime = Date.now();
    emailLogger.info('Starting email sync', { accountId, name: account.name });

    try {
      let newEmails: Email[] = [];

      if (account.provider === 'imap') {
        newEmails = await this.syncImapAccount(account);
      } else if (account.provider === 'gmail') {
        newEmails = await this.syncGmailAccount(account);
      } else if (account.provider === 'outlook') {
        newEmails = await this.syncOutlookAccount(account);
      }

      // Classify priorities
      for (const email of newEmails) {
        email.priority = this.classifier.classify(email);
      }

      // Store emails
      this.emails.set(accountId, newEmails);

      // Update account sync timestamp
      account.lastSync = new Date();
      account.lastError = undefined;

      const highPriority = newEmails.filter(e => e.priority === 'high').length;

      const result: EmailSyncResult = {
        accountId,
        accountName: account.name,
        newEmails: newEmails.length,
        totalEmails: newEmails.length,
        highPriority,
        syncedAt: new Date()
      };

      emailLogger.info('Email sync complete', {
        accountId,
        duration: Date.now() - startTime,
        ...result
      });

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      account.lastError = errorMessage;

      emailLogger.error('Email sync failed', { accountId, error: errorMessage });

      return {
        accountId,
        accountName: account.name,
        newEmails: 0,
        totalEmails: 0,
        highPriority: 0,
        syncedAt: new Date(),
        error: errorMessage
      };
    }
  }

  /**
   * Sync all accounts
   */
  async syncAllAccounts(): Promise<EmailSyncResult[]> {
    const results: EmailSyncResult[] = [];

    for (const account of this.accounts.values()) {
      if (account.enabled) {
        const result = await this.syncAccount(account.id);
        results.push(result);
      }
    }

    return results;
  }

  /**
   * Get emails with filtering
   */
  getEmails(options: EmailFilterOptions = {}): Email[] {
    let allEmails: Email[] = [];

    if (options.accountId) {
      allEmails = this.emails.get(options.accountId) ?? [];
    } else {
      for (const emails of this.emails.values()) {
        allEmails.push(...emails);
      }
    }

    // Apply filters
    let filtered = allEmails;

    if (options.priority) {
      filtered = filtered.filter(e => e.priority === options.priority);
    }

    if (options.isRead !== undefined) {
      filtered = filtered.filter(e => e.isRead === options.isRead);
    }

    if (options.dateFrom) {
      filtered = filtered.filter(e => e.receivedAt >= options.dateFrom!);
    }

    if (options.dateTo) {
      filtered = filtered.filter(e => e.receivedAt <= options.dateTo!);
    }

    if (options.sender) {
      const senderLower = options.sender.toLowerCase();
      filtered = filtered.filter(e =>
        e.sender.toLowerCase().includes(senderLower) ||
        e.senderEmail.toLowerCase().includes(senderLower)
      );
    }

    if (options.subject) {
      const subjectLower = options.subject.toLowerCase();
      filtered = filtered.filter(e =>
        e.subject.toLowerCase().includes(subjectLower)
      );
    }

    // Sort by date descending
    filtered.sort((a, b) => b.receivedAt.getTime() - a.receivedAt.getTime());

    // Apply pagination
    const offset = options.offset ?? 0;
    const limit = options.limit ?? 50;
    return filtered.slice(offset, offset + limit);
  }

  /**
   * Get high-priority emails
   */
  getHighPriorityEmails(limit: number = 20): Email[] {
    return this.getEmails({ priority: 'high', limit });
  }

  /**
   * Get account statuses
   */
  getAccountStatuses(): EmailAccountStatus[] {
    return Array.from(this.accounts.values()).map(account => {
      const emails = this.emails.get(account.id) ?? [];
      return {
        id: account.id,
        name: account.name,
        email: account.email,
        provider: account.provider,
        enabled: account.enabled,
        lastSync: account.lastSync,
        lastError: account.lastError,
        emailCount: emails.length,
        highPriorityCount: emails.filter(e => e.priority === 'high').length
      };
    });
  }

  /**
   * Mark email as read
   */
  markAsRead(emailId: string): boolean {
    for (const emails of this.emails.values()) {
      const email = emails.find(e => e.id === emailId);
      if (email) {
        email.isRead = true;
        return true;
      }
    }
    return false;
  }

  /**
   * Start automatic sync for an account
   */
  async startSync(accountId: string): Promise<void> {
    const account = this.accounts.get(accountId);
    if (!account) return;

    // Clear existing interval
    this.stopSync(accountId);

    // Initial sync
    await this.syncAccount(accountId);

    // Set up interval
    const intervalMs = account.syncInterval * 60 * 1000;
    const interval = setInterval(() => {
      void this.syncAccount(accountId);
    }, intervalMs);

    this.syncIntervals.set(accountId, interval);
    emailLogger.info('Started auto-sync', { accountId, intervalMinutes: account.syncInterval });
  }

  /**
   * Stop automatic sync for an account
   */
  stopSync(accountId: string): void {
    const interval = this.syncIntervals.get(accountId);
    if (interval) {
      clearInterval(interval);
      this.syncIntervals.delete(accountId);
      emailLogger.info('Stopped auto-sync', { accountId });
    }
  }

  /**
   * Shutdown service
   */
  async shutdown(): Promise<void> {
    // Stop all syncs
    for (const accountId of this.syncIntervals.keys()) {
      this.stopSync(accountId);
    }

    // Disconnect all clients
    for (const accountId of this.clients.keys()) {
      await this.disconnectClient(accountId);
    }
  }

  // Private methods

  private async syncImapAccount(account: EmailAccount): Promise<Email[]> {
    const credentials = await this.decryptCredentials(account.credentials);

    if (!credentials.imapHost || !credentials.username || !credentials.password) {
      throw new Error('Missing IMAP credentials');
    }

    const client = createImapClient(
      credentials.imapHost,
      credentials.imapPort ?? 993,
      credentials.username,
      credentials.password,
      credentials.imapSecure ?? true
    );

    this.clients.set(account.id, client);

    await client.connect();
    const emails = await client.fetchEmails(account.id, {
      maxResults: 100,
      since: account.lastSync
    });

    return emails;
  }

  private async syncGmailAccount(_account: EmailAccount): Promise<Email[]> {
    // Gmail OAuth sync would go here
    // For now, return empty array (to be implemented)
    emailLogger.warn('Gmail sync not yet implemented');
    return [];
  }

  private async syncOutlookAccount(_account: EmailAccount): Promise<Email[]> {
    // Outlook/Microsoft Graph sync would go here
    // For now, return empty array (to be implemented)
    emailLogger.warn('Outlook sync not yet implemented');
    return [];
  }

  private async disconnectClient(accountId: string): Promise<void> {
    const client = this.clients.get(accountId);
    if (client) {
      client.disconnect();
      this.clients.delete(accountId);
    }
  }

  private async encryptCredentials(
    credentials: EmailAccount['credentials']
  ): Promise<EmailAccount['credentials']> {
    const encrypted = { ...credentials };

    if (encrypted.password && !isEncrypted(encrypted.password)) {
      encrypted.password = await encrypt(encrypted.password);
    }
    if (encrypted.accessToken && !isEncrypted(encrypted.accessToken)) {
      encrypted.accessToken = await encrypt(encrypted.accessToken);
    }
    if (encrypted.refreshToken && !isEncrypted(encrypted.refreshToken)) {
      encrypted.refreshToken = await encrypt(encrypted.refreshToken);
    }

    return encrypted;
  }

  private async decryptCredentials(
    credentials: EmailAccount['credentials']
  ): Promise<EmailAccount['credentials']> {
    const decrypted = { ...credentials };

    if (decrypted.password && isEncrypted(decrypted.password)) {
      decrypted.password = await decrypt(decrypted.password);
    }
    if (decrypted.accessToken && isEncrypted(decrypted.accessToken)) {
      decrypted.accessToken = await decrypt(decrypted.accessToken);
    }
    if (decrypted.refreshToken && isEncrypted(decrypted.refreshToken)) {
      decrypted.refreshToken = await decrypt(decrypted.refreshToken);
    }

    return decrypted;
  }
}
