/**
 * SpockAI IMAP Client Wrapper
 * Provides a simplified interface for IMAP email operations
 */

import Imap from 'node-imap';
import { simpleParser, ParsedMail } from 'mailparser';
import type { ImapConnectionOptions, Email, EmailFetchOptions } from './types.js';
import { emailLogger } from '../utils/logger.js';
import { randomUUID } from 'crypto';

/**
 * IMAP Client wrapper for email fetching
 */
export class ImapClient {
  private connection: Imap | null = null;
  private options: ImapConnectionOptions;
  private connected: boolean = false;

  constructor(options: ImapConnectionOptions) {
    this.options = options;
  }

  /**
   * Connect to IMAP server
   */
  async connect(): Promise<void> {
    if (this.connected) {
      return;
    }

    return new Promise((resolve, reject) => {
      this.connection = new Imap({
        host: this.options.host,
        port: this.options.port,
        tls: this.options.secure,
        user: this.options.user,
        password: this.options.password,
        authTimeout: this.options.authTimeout ?? 10000,
        connTimeout: this.options.connTimeout ?? 30000
      });

      this.connection.once('ready', () => {
        this.connected = true;
        emailLogger.info('IMAP connection established', { host: this.options.host });
        resolve();
      });

      this.connection.once('error', (err: Error) => {
        emailLogger.error('IMAP connection error', { error: err.message });
        reject(err);
      });

      this.connection.once('end', () => {
        this.connected = false;
        emailLogger.debug('IMAP connection ended');
      });

      this.connection.connect();
    });
  }

  /**
   * Disconnect from IMAP server
   */
  disconnect(): void {
    if (this.connection && this.connected) {
      this.connection.end();
      this.connected = false;
    }
  }

  /**
   * Fetch emails from inbox
   */
  async fetchEmails(accountId: string, options: EmailFetchOptions = {}): Promise<Email[]> {
    if (!this.connection || !this.connected) {
      throw new Error('Not connected to IMAP server');
    }

    const emails: Email[] = [];
    const maxResults = options.maxResults ?? 50;

    return new Promise((resolve, reject) => {
      this.connection!.openBox('INBOX', true, (err, _box) => {
        if (err) {
          emailLogger.error('Failed to open INBOX', { error: err.message });
          reject(err);
          return;
        }

        // Build search criteria
        const searchCriteria: (string | string[])[] = ['ALL'];
        if (options.since) {
          searchCriteria.push(['SINCE', options.since.toISOString().split('T')[0]!]);
        }
        if (options.unreadOnly) {
          searchCriteria.push('UNSEEN');
        }

        this.connection!.search(searchCriteria, (searchErr, results) => {
          if (searchErr) {
            emailLogger.error('IMAP search failed', { error: searchErr.message });
            reject(searchErr);
            return;
          }

          if (results.length === 0) {
            resolve([]);
            return;
          }

          // Get most recent emails
          const toFetch = results.slice(-maxResults);
          const fetchOptions = {
            bodies: options.includeBody ? '' : 'HEADER',
            struct: true
          };

          const fetch = this.connection!.fetch(toFetch, fetchOptions);

          fetch.on('message', (msg) => {
            let buffer = '';

            msg.on('body', (stream) => {
              stream.on('data', (chunk: Buffer) => {
                buffer += chunk.toString('utf8');
              });
            });

            msg.once('end', () => {
              void this.parseEmail(buffer, accountId).then((email) => {
                if (email) {
                  emails.push(email);
                }
              });
            });
          });

          fetch.once('error', (fetchErr: Error) => {
            emailLogger.error('IMAP fetch error', { error: fetchErr.message });
            reject(fetchErr);
          });

          fetch.once('end', () => {
            // Sort by received date descending
            emails.sort((a, b) => b.receivedAt.getTime() - a.receivedAt.getTime());
            resolve(emails);
          });
        });
      });
    });
  }

  /**
   * Parse raw email to Email object
   */
  private async parseEmail(raw: string, accountId: string): Promise<Email | null> {
    try {
      const parsed: ParsedMail = await simpleParser(raw);

      const senderAddress = parsed.from?.value[0];
      if (!senderAddress) {
        return null;
      }

      return {
        id: randomUUID(),
        accountId,
        messageId: parsed.messageId ?? randomUUID(),
        subject: parsed.subject ?? '(No Subject)',
        sender: senderAddress.name ?? senderAddress.address ?? 'Unknown',
        senderEmail: senderAddress.address ?? 'unknown@unknown.com',
        recipients: (Array.isArray(parsed.to) ? parsed.to[0]?.value : parsed.to?.value)?.map((r: { address?: string }) => r.address ?? '') ?? [],
        receivedAt: parsed.date ?? new Date(),
        priority: 'low', // Will be classified later
        isRead: false,
        isStarred: false,
        snippet: parsed.text?.substring(0, 200),
        bodyPreview: parsed.text?.substring(0, 500),
        hasAttachments: (parsed.attachments?.length ?? 0) > 0
      };
    } catch (error) {
      emailLogger.error('Failed to parse email', { error });
      return null;
    }
  }

  /**
   * Get mailbox status
   */
  async getMailboxStatus(): Promise<{ total: number; unseen: number }> {
    if (!this.connection || !this.connected) {
      throw new Error('Not connected to IMAP server');
    }

    return new Promise((resolve, reject) => {
      this.connection!.openBox('INBOX', true, (err, box) => {
        if (err) {
          reject(err);
          return;
        }

        resolve({
          total: box.messages.total,
          unseen: box.messages.new
        });
      });
    });
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.connected;
  }
}

/**
 * Create IMAP client from account credentials
 */
export function createImapClient(
  host: string,
  port: number,
  user: string,
  password: string,
  secure: boolean = true
): ImapClient {
  return new ImapClient({
    host,
    port,
    secure,
    user,
    password
  });
}
