#!/usr/bin/env node
/**
 * SpockAI Standalone Application
 * Personal assistant with email, calendar, and task notifications
 *
 * Run with: npx tsx main.ts
 * Or build and run: npm run build && node dist/main.js
 */

import { ConfigLoader } from './config/loader.js';
import { createNotificationService } from './notify/service.js';
import { PriorityClassifier } from './email/classifier.js';
import { coreLogger } from './utils/logger.js';

// Polling intervals (in milliseconds)
const EMAIL_POLL_INTERVAL = 5 * 60 * 1000;      // 5 minutes
const CALENDAR_CHECK_INTERVAL = 60 * 1000;       // 1 minute
const BEANS_SCAN_INTERVAL = 5 * 60 * 1000;       // 5 minutes

interface SpockAIApp {
  notificationService: Awaited<ReturnType<typeof createNotificationService>> | null;
  emailClassifier: PriorityClassifier | null;
  config: Awaited<ReturnType<ConfigLoader['load']>> | null;
  isRunning: boolean;
  intervals: NodeJS.Timeout[];
}

const app: SpockAIApp = {
  notificationService: null,
  emailClassifier: null,
  config: null,
  isRunning: false,
  intervals: []
};

/**
 * Initialize SpockAI
 */
async function initialize(): Promise<void> {
  console.log('🖖 SpockAI Starting...\n');

  // Load configuration
  const loader = new ConfigLoader();
  app.config = await loader.load();

  console.log('✓ Configuration loaded');

  // Initialize notification service
  if (app.config.notifications) {
    app.notificationService = createNotificationService(app.config.notifications);
    await app.notificationService.initialize();
    const status = app.notificationService.getStatus();
    console.log(`✓ Notifications: ${status.channel} (${status.connected ? 'connected' : 'disconnected'})`);
  }

  // Initialize email classifier
  if (app.config.email?.globalRules) {
    app.emailClassifier = new PriorityClassifier(app.config.email.globalRules);
    console.log(`✓ Email classifier: ${app.config.email.globalRules.vipSenders.length} VIP senders`);
  }

  // Show configuration summary
  console.log('\n--- Configuration Summary ---');
  console.log(`Email accounts: ${app.config.email?.accounts?.length ?? 0}`);
  console.log(`Calendar sources: ${app.config.calendar?.sources?.length ?? 0}`);
  console.log(`BEANS scan paths: ${app.config.beans?.scanPaths?.length ?? 0}`);
  console.log(`VIP senders: ${app.config.email?.globalRules?.vipSenders?.length ?? 0}`);
  console.log('-----------------------------\n');
}

/**
 * Poll Gmail for new emails
 */
async function pollEmails(): Promise<void> {
  if (!app.config?.email?.accounts || !app.notificationService) return;

  for (const account of app.config.email.accounts) {
    if (!account.enabled || !account.credentials?.refreshToken) continue;

    try {
      // Get fresh access token
      const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: account.credentials.clientId,
          client_secret: account.credentials.clientSecret,
          refresh_token: account.credentials.refreshToken,
          grant_type: 'refresh_token'
        })
      });

      const tokens = await tokenResponse.json() as { access_token?: string; error?: string };
      if (!tokens.access_token) {
        coreLogger.error('Failed to refresh email token', { account: account.name, error: tokens.error });
        continue;
      }

      // Fetch recent unread emails
      const messagesResponse = await fetch(
        'https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=10&q=is:unread',
        { headers: { Authorization: `Bearer ${tokens.access_token}` } }
      );

      const messagesData = await messagesResponse.json() as { messages?: Array<{ id: string }> };
      if (!messagesData.messages?.length) continue;

      // Check each message
      for (const msg of messagesData.messages.slice(0, 5)) {
        const msgResponse = await fetch(
          `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject`,
          { headers: { Authorization: `Bearer ${tokens.access_token}` } }
        );

        const msgData = await msgResponse.json() as {
          id: string;
          payload?: { headers?: Array<{ name: string; value: string }> };
        };

        const headers = msgData.payload?.headers ?? [];
        const fromHeader = headers.find(h => h.name === 'From')?.value ?? '';
        const subject = headers.find(h => h.name === 'Subject')?.value ?? '(no subject)';

        // Extract email from "Name <email>" format
        const emailMatch = fromHeader.match(/<([^>]+)>/) ?? [null, fromHeader];
        const senderEmail = emailMatch[1] ?? fromHeader;
        const senderName = fromHeader.replace(/<[^>]+>/, '').trim();

        // Check if VIP
        const isVip = app.config?.email?.globalRules?.vipSenders?.some(
          vip => senderEmail.toLowerCase().includes(vip.toLowerCase())
        ) ?? false;

        // Check for priority keywords
        const hasPriorityKeyword = app.config?.email?.globalRules?.priorityKeywords?.some(
          kw => subject.toUpperCase().includes(kw.toUpperCase())
        ) ?? false;

        if (isVip || hasPriorityKeyword) {
          const vipLabel = isVip ? '⭐ VIP ' : '';
          await app.notificationService.notify({
            type: 'high_priority_email',
            title: `📧 ${vipLabel}High-Priority Email`,
            message: `**From**: ${vipLabel}${senderName || senderEmail}\n**Subject**: ${subject}`,
            priority: 'high',
            sourceId: msg.id,
            timestamp: new Date()
          });

          coreLogger.info('Email notification sent', { subject, isVip });
        }
      }
    } catch (error) {
      coreLogger.error('Email polling failed', { account: account.name, error });
    }
  }
}

/**
 * Check calendar for upcoming events
 */
async function checkCalendar(): Promise<void> {
  if (!app.config?.calendar?.sources || !app.notificationService) return;

  const now = new Date();
  const reminderWindow = 15 * 60 * 1000; // 15 minutes

  for (const source of app.config.calendar.sources) {
    if (!source.enabled || !source.credentials?.refreshToken) continue;

    try {
      // Get fresh access token
      const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: source.credentials.clientId,
          client_secret: source.credentials.clientSecret,
          refresh_token: source.credentials.refreshToken,
          grant_type: 'refresh_token'
        })
      });

      const tokens = await tokenResponse.json() as { access_token?: string };
      if (!tokens.access_token) continue;

      // Fetch events starting in the next 20 minutes
      const timeMin = now.toISOString();
      const timeMax = new Date(now.getTime() + 20 * 60 * 1000).toISOString();

      const eventsResponse = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(source.calendarId)}/events?` +
        `timeMin=${timeMin}&timeMax=${timeMax}&singleEvents=true&orderBy=startTime`,
        { headers: { Authorization: `Bearer ${tokens.access_token}` } }
      );

      const eventsData = await eventsResponse.json() as {
        items?: Array<{
          id: string;
          summary?: string;
          start?: { dateTime?: string; date?: string };
          location?: string;
        }>;
      };

      for (const event of eventsData.items ?? []) {
        const startStr = event.start?.dateTime ?? event.start?.date;
        if (!startStr) continue;

        const eventStart = new Date(startStr);
        const timeUntil = eventStart.getTime() - now.getTime();

        // Send reminder if event is 14-16 minutes away (to avoid duplicates)
        if (timeUntil > 14 * 60 * 1000 && timeUntil < 16 * 60 * 1000) {
          const timeStr = eventStart.toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
          });

          let message = `**${event.summary ?? 'Event'}**\n📅 ${timeStr}`;
          if (event.location) {
            message += `\n📍 ${event.location}`;
          }
          message += `\n📆 ${source.name}`;

          await app.notificationService.notify({
            type: 'calendar_reminder',
            title: '⏰ Upcoming Event (15 min)',
            message,
            priority: 'medium',
            sourceId: event.id,
            timestamp: new Date()
          });

          coreLogger.info('Calendar reminder sent', { event: event.summary, source: source.name });
        }
      }
    } catch (error) {
      coreLogger.error('Calendar check failed', { source: source.name, error });
    }
  }
}

/**
 * Scan for BEANS/beads items
 */
async function scanBeans(): Promise<void> {
  if (!app.config?.beans?.enabled || !app.config.beans.scanPaths?.length) return;
  if (!app.notificationService) return;

  // For now, just log that we would scan
  // Full implementation would use the BeansParser to scan directories
  coreLogger.debug('BEANS scan triggered', { paths: app.config.beans.scanPaths });
}

/**
 * Start polling loops
 */
function startPolling(): void {
  console.log('Starting polling loops...');

  // Email polling
  if (app.config?.email?.accounts?.length) {
    app.intervals.push(setInterval(pollEmails, EMAIL_POLL_INTERVAL));
    console.log(`✓ Email polling: every ${EMAIL_POLL_INTERVAL / 60000} minutes`);
    // Run immediately
    void pollEmails();
  }

  // Calendar checking
  if (app.config?.calendar?.sources?.length) {
    app.intervals.push(setInterval(checkCalendar, CALENDAR_CHECK_INTERVAL));
    console.log(`✓ Calendar checking: every ${CALENDAR_CHECK_INTERVAL / 60000} minute(s)`);
    // Run immediately
    void checkCalendar();
  }

  // BEANS scanning
  if (app.config?.beans?.enabled && app.config.beans.scanPaths?.length) {
    app.intervals.push(setInterval(scanBeans, BEANS_SCAN_INTERVAL));
    console.log(`✓ BEANS scanning: every ${BEANS_SCAN_INTERVAL / 60000} minutes`);
  }

  app.isRunning = true;
  console.log('\n🖖 SpockAI is running. Press Ctrl+C to stop.\n');
}

/**
 * Graceful shutdown
 */
async function shutdown(): Promise<void> {
  console.log('\n\nShutting down SpockAI...');
  app.isRunning = false;

  // Clear all intervals
  for (const interval of app.intervals) {
    clearInterval(interval);
  }

  // Send shutdown notification
  if (app.notificationService) {
    try {
      await app.notificationService.notify({
        type: 'system',
        title: '🖖 SpockAI Offline',
        message: 'SpockAI has been shut down.',
        priority: 'low',
        timestamp: new Date()
      });
    } catch {
      // Ignore notification errors during shutdown
    }
  }

  console.log('Goodbye! 🖖');
  process.exit(0);
}

/**
 * Main entry point
 */
async function main(): Promise<void> {
  try {
    await initialize();

    // Send startup notification
    if (app.notificationService) {
      await app.notificationService.notify({
        type: 'system',
        title: '🖖 SpockAI Online',
        message: `SpockAI is now monitoring:\n• ${app.config?.email?.accounts?.length ?? 0} email account(s)\n• ${app.config?.calendar?.sources?.length ?? 0} calendar(s)\n• ${app.config?.beans?.scanPaths?.length ?? 0} BEANS path(s)`,
        priority: 'low',
        timestamp: new Date()
      });
    }

    startPolling();

    // Handle shutdown signals
    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);

  } catch (error) {
    console.error('Failed to start SpockAI:', error);
    process.exit(1);
  }
}

// Run
main().catch(console.error);
