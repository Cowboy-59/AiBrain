const { app, BrowserWindow, Tray, Menu, nativeImage, ipcMain, Notification } = require('electron');
const path = require('path');
const fs = require('fs');
const http = require('http');
const crypto = require('crypto');
const Anthropic = require('@anthropic-ai/sdk');

// Configuration - to be replaced with new config system
let tray = null;
let chatWindow = null;
let config = null;
let lastUpdateId = 0;
let pollingInterval = null;
let anthropic = null;
let conversationHistory = [];
let reminders = []; // In-memory reminders with timeouts
let reminderTimers = {}; // Store timeout IDs

// Data paths
const HOME_DIR = process.env.USERPROFILE || process.env.HOME;
const SPOCKAI_DIR = path.join(HOME_DIR, '.spockai');
const DATA_DIR = path.join(SPOCKAI_DIR, 'data');
const NOTES_FILE = path.join(DATA_DIR, 'notes.json');
const REMINDERS_FILE = path.join(DATA_DIR, 'reminders.json');
const MEMORY_DIR = path.join(SPOCKAI_DIR, 'memory');
const MEMORY_FILE = path.join(MEMORY_DIR, 'MEMORY.md');
const USER_FILE = path.join(MEMORY_DIR, 'USER.md');
const SESSIONS_DIR = path.join(SPOCKAI_DIR, 'sessions');
const KNOWLEDGE_DIR = path.join(SPOCKAI_DIR, 'knowledge');
const SCRATCH_FILE = path.join(DATA_DIR, 'scratch.json');
const TRIAGE_FILE = path.join(DATA_DIR, 'triage-rules.json');
const DEFERRED_FILE = path.join(DATA_DIR, 'deferred.json');
const VAULT_FILE = path.join(SPOCKAI_DIR, 'vault.enc');
const VAULT_KEY_FILE = path.join(SPOCKAI_DIR, '.vault-key');

// Scheduled check-in timers
let checkInTimers = {};
let sessionId = null;
let sessionLog = [];
let contextTokenEstimate = 0;

// Load configuration from ~/.spockai/config.json
function loadConfig() {
  const configPath = path.join(SPOCKAI_DIR, 'config.json');
  try {
    if (fs.existsSync(configPath)) {
      const raw = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      config = raw.spockai || raw;
      console.log('Configuration loaded from', configPath);
      return config;
    }
  } catch (error) {
    console.error('Failed to load config:', error);
  }
  config = {};
  return config;
}

// Overlay vault keys into config so the rest of the app works seamlessly
function overlayVaultKeys() {
  const vault = loadVault();
  if (!vault || Object.keys(vault.keys).length === 0) return;

  // Telegram keys
  if (vault.keys['telegram']) {
    if (!config.notifications) config.notifications = {};
    if (!config.notifications.telegram) config.notifications.telegram = {};
    const tg = vault.keys['telegram'].keys;
    if (tg.botToken) config.notifications.telegram.botToken = tg.botToken;
    if (tg.chatId) config.notifications.telegram.chatId = tg.chatId;
  }

  // Google OAuth - overlay into email accounts and calendar sources
  if (vault.keys['google-oauth']) {
    const creds = vault.keys['google-oauth'].keys;
    if (config.email?.accounts) {
      for (const account of config.email.accounts) {
        if (!account.credentials) account.credentials = {};
        if (creds.clientId) account.credentials.clientId = creds.clientId;
        if (creds.clientSecret) account.credentials.clientSecret = creds.clientSecret;
        if (creds.refreshToken) account.credentials.refreshToken = creds.refreshToken;
      }
    }
    if (config.calendar?.sources) {
      for (const source of config.calendar.sources) {
        if (!source.credentials) source.credentials = {};
        if (creds.clientId) source.credentials.clientId = creds.clientId;
        if (creds.clientSecret) source.credentials.clientSecret = creds.clientSecret;
        if (creds.refreshToken) source.credentials.refreshToken = creds.refreshToken;
      }
    }
  }

  // Teams
  if (vault.keys['teams']) {
    if (!config.teams) config.teams = {};
    const t = vault.keys['teams'].keys;
    if (t.tenantId) config.teams.tenantId = t.tenantId;
    if (t.clientId) config.teams.clientId = t.clientId;
    if (t.clientSecret) config.teams.clientSecret = t.clientSecret;
    if (t.webhookUrl) config.teams.webhookUrl = t.webhookUrl;
  }

  // Zoom
  if (vault.keys['zoom']) {
    if (!config.zoom) config.zoom = {};
    const z = vault.keys['zoom'].keys;
    if (z.accountId) config.zoom.accountId = z.accountId;
    if (z.clientId) config.zoom.clientId = z.clientId;
    if (z.clientSecret) config.zoom.clientSecret = z.clientSecret;
  }

  console.log('Vault keys overlaid into config');
}

// ============================================
// ENCRYPTED KEY VAULT
// ============================================

function ensureVaultKey() {
  try {
    if (fs.existsSync(VAULT_KEY_FILE)) {
      return fs.readFileSync(VAULT_KEY_FILE);
    }
    const key = crypto.randomBytes(32);
    fs.mkdirSync(path.dirname(VAULT_KEY_FILE), { recursive: true });
    fs.writeFileSync(VAULT_KEY_FILE, key, { mode: 0o600 });
    console.log('Vault encryption key generated');
    return key;
  } catch (error) {
    console.error('Failed to ensure vault key:', error);
    return null;
  }
}

function loadVault() {
  try {
    if (!fs.existsSync(VAULT_FILE)) {
      return { version: 1, created: new Date().toISOString(), updated: new Date().toISOString(), keys: {} };
    }
    const vaultKey = ensureVaultKey();
    if (!vaultKey) return null;

    const encrypted = fs.readFileSync(VAULT_FILE, 'utf-8');
    const parts = encrypted.split(':');
    if (parts.length !== 3) return null;

    const iv = Buffer.from(parts[0], 'hex');
    const authTag = Buffer.from(parts[1], 'hex');
    const ciphertext = Buffer.from(parts[2], 'hex');

    const decipher = crypto.createDecipheriv('aes-256-gcm', vaultKey, iv);
    decipher.setAuthTag(authTag);
    let decrypted = decipher.update(ciphertext, null, 'utf-8');
    decrypted += decipher.final('utf-8');

    return JSON.parse(decrypted);
  } catch (error) {
    console.error('Failed to load vault:', error);
    return null;
  }
}

function saveVault(data) {
  try {
    const vaultKey = ensureVaultKey();
    if (!vaultKey) return false;

    data.updated = new Date().toISOString();
    const plaintext = JSON.stringify(data, null, 2);

    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-gcm', vaultKey, iv);
    let encrypted = cipher.update(plaintext, 'utf-8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag().toString('hex');

    fs.writeFileSync(VAULT_FILE, `${iv.toString('hex')}:${authTag}:${encrypted}`);
    return true;
  } catch (error) {
    console.error('Failed to save vault:', error);
    return false;
  }
}

function getVaultKey(service, keyName) {
  const vault = loadVault();
  if (!vault || !vault.keys[service]) return null;
  return vault.keys[service].keys[keyName] || null;
}

function setVaultKeys(service, label, source, keys) {
  const vault = loadVault();
  if (!vault) return false;

  vault.keys[service] = { source, label, keys };
  return saveVault(vault);
}

function removeVaultService(service) {
  const vault = loadVault();
  if (!vault || !vault.keys[service]) return false;

  delete vault.keys[service];
  return saveVault(vault);
}

function listVaultKeys() {
  const vault = loadVault();
  if (!vault) return { error: 'Vault not available' };

  const grouped = {};
  for (const [service, entry] of Object.entries(vault.keys)) {
    const src = entry.source || 'Unknown';
    if (!grouped[src]) grouped[src] = [];
    grouped[src].push({
      service,
      label: entry.label,
      keyNames: Object.keys(entry.keys),
      keyCount: Object.keys(entry.keys).length
    });
  }
  return { sources: grouped, totalServices: Object.keys(vault.keys).length };
}

function exportVaultKeys(service) {
  const vault = loadVault();
  if (!vault || !vault.keys[service]) {
    return { error: `Service '${service}' not found in vault` };
  }

  const entry = vault.keys[service];
  const masked = {};
  for (const [k, v] of Object.entries(entry.keys)) {
    if (typeof v === 'string' && v.length > 8) {
      masked[k] = v.substring(0, 4) + '...' + v.substring(v.length - 4);
    } else {
      masked[k] = v;
    }
  }
  return {
    service,
    source: entry.source,
    label: entry.label,
    keys: entry.keys,
    masked
  };
}

function migrateConfigToVault() {
  const vault = loadVault();
  if (!vault) return { error: 'Vault not available' };

  let migrated = 0;

  // Anthropic API key from environment
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  if (anthropicKey && !vault.keys['anthropic']) {
    vault.keys['anthropic'] = {
      source: 'Anthropic',
      label: 'Claude API Key',
      keys: { apiKey: anthropicKey }
    };
    migrated++;
  }

  // Google OAuth from email accounts
  if (config?.email?.accounts?.[0]?.credentials && !vault.keys['google-oauth']) {
    const creds = config.email.accounts[0].credentials;
    if (creds.clientId || creds.clientSecret || creds.refreshToken) {
      vault.keys['google-oauth'] = {
        source: 'Google Cloud',
        label: 'Google OAuth (Gmail + Calendar)',
        keys: {
          clientId: creds.clientId || '',
          clientSecret: creds.clientSecret || '',
          refreshToken: creds.refreshToken || ''
        }
      };
      migrated++;
    }
  }

  // Telegram
  if (config?.notifications?.telegram && !vault.keys['telegram']) {
    const tg = config.notifications.telegram;
    if (tg.botToken || tg.chatId) {
      vault.keys['telegram'] = {
        source: 'Telegram',
        label: 'SpockAI Bot',
        keys: {
          botToken: tg.botToken || '',
          chatId: tg.chatId || ''
        }
      };
      migrated++;
    }
  }

  // Teams
  if (config?.teams && !vault.keys['teams']) {
    const t = config.teams;
    if (t.tenantId || t.clientId || t.clientSecret || t.webhookUrl) {
      vault.keys['teams'] = {
        source: 'Microsoft',
        label: 'Teams Integration',
        keys: {
          tenantId: t.tenantId || '',
          clientId: t.clientId || '',
          clientSecret: t.clientSecret || '',
          webhookUrl: t.webhookUrl || ''
        }
      };
      migrated++;
    }
  }

  // Zoom
  if (config?.zoom && !vault.keys['zoom']) {
    const z = config.zoom;
    if (z.accountId || z.clientId || z.clientSecret) {
      vault.keys['zoom'] = {
        source: 'Zoom',
        label: 'Zoom Meetings',
        keys: {
          accountId: z.accountId || '',
          clientId: z.clientId || '',
          clientSecret: z.clientSecret || ''
        }
      };
      migrated++;
    }
  }

  // Samanage
  if (config?.services?.samanage && !vault.keys['samanage']) {
    const s = config.services.samanage;
    if (s.apiKey) {
      vault.keys['samanage'] = {
        source: 'Samanage',
        label: 'Service Desk',
        keys: { apiKey: s.apiKey }
      };
      migrated++;
    }
  }

  // Monday.com
  if (config?.services?.monday && !vault.keys['monday']) {
    const m = config.services.monday;
    if (m.apiToken) {
      vault.keys['monday'] = {
        source: 'Monday.com',
        label: 'Project Management',
        keys: { apiToken: m.apiToken }
      };
      migrated++;
    }
  }

  // OpenAI (from environment)
  const openaiKey = process.env.OPENAI_API_KEY;
  if (openaiKey && !vault.keys['openai']) {
    vault.keys['openai'] = {
      source: 'OpenAI',
      label: 'Whisper Transcription',
      keys: { apiKey: openaiKey }
    };
    migrated++;
  }

  if (migrated > 0) {
    saveVault(vault);
    console.log(`Migrated ${migrated} services to encrypted vault`);
  }

  return { migrated, totalServices: Object.keys(vault.keys).length };
}

// Initialize Claude AI
function initializeAI() {
  const apiKey = getVaultKey('anthropic', 'apiKey') || process.env.ANTHROPIC_API_KEY || config?.ai?.apiKey;
  if (!apiKey) {
    console.log('No Anthropic API key found (vault, env, config), AI features disabled');
    return false;
  }

  try {
    anthropic = new Anthropic({ apiKey });
    console.log('Claude AI initialized');
    return true;
  } catch (error) {
    console.error('Failed to initialize Claude AI:', error);
    return false;
  }
}

// ============================================
// SERVICE QUERY FUNCTIONS
// ============================================

// Get OAuth access token for Google services
async function getGoogleAccessToken(credentials) {
  try {
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: credentials.clientId,
        client_secret: credentials.clientSecret,
        refresh_token: credentials.refreshToken,
        grant_type: 'refresh_token'
      })
    });
    const data = await response.json();
    return data.access_token;
  } catch (error) {
    console.error('Failed to get access token:', error);
    return null;
  }
}

// Query Google Calendar events
async function queryCalendar(timeRange = 'today') {
  if (!config?.calendar?.sources?.length) {
    return { error: 'No calendars configured' };
  }

  const now = new Date();
  let timeMin, timeMax;

  switch (timeRange) {
    case 'today':
      timeMin = new Date(now.setHours(0, 0, 0, 0)).toISOString();
      timeMax = new Date(now.setHours(23, 59, 59, 999)).toISOString();
      break;
    case 'tomorrow':
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      timeMin = new Date(tomorrow.setHours(0, 0, 0, 0)).toISOString();
      timeMax = new Date(tomorrow.setHours(23, 59, 59, 999)).toISOString();
      break;
    case 'week':
      timeMin = new Date().toISOString();
      const weekEnd = new Date();
      weekEnd.setDate(weekEnd.getDate() + 7);
      timeMax = weekEnd.toISOString();
      break;
    default:
      timeMin = new Date().toISOString();
      timeMax = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  }

  const allEvents = [];

  for (const source of config.calendar.sources) {
    if (!source.enabled || !source.credentials?.refreshToken) continue;

    try {
      const accessToken = await getGoogleAccessToken(source.credentials);
      if (!accessToken) continue;

      const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(source.calendarId)}/events?` +
        `timeMin=${timeMin}&timeMax=${timeMax}&singleEvents=true&orderBy=startTime&maxResults=20`;

      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${accessToken}` }
      });

      const data = await response.json();

      if (data.items) {
        for (const event of data.items) {
          allEvents.push({
            calendar: source.name,
            title: event.summary || '(No title)',
            start: event.start?.dateTime || event.start?.date,
            end: event.end?.dateTime || event.end?.date,
            location: event.location || null,
            isAllDay: !event.start?.dateTime
          });
        }
      }
    } catch (error) {
      console.error(`Calendar query failed for ${source.name}:`, error);
    }
  }

  // Sort by start time
  allEvents.sort((a, b) => new Date(a.start) - new Date(b.start));

  return {
    timeRange,
    eventCount: allEvents.length,
    events: allEvents
  };
}

// Query Gmail for emails
async function queryEmails(filter = 'unread') {
  if (!config?.email?.accounts?.length) {
    return { error: 'No email accounts configured' };
  }

  const allEmails = [];

  for (const account of config.email.accounts) {
    if (!account.enabled || !account.credentials?.refreshToken) continue;

    try {
      const accessToken = await getGoogleAccessToken(account.credentials);
      if (!accessToken) continue;

      let query = 'is:inbox';
      if (filter === 'unread') query += ' is:unread';
      if (filter === 'important') query += ' is:important';
      if (filter === 'starred') query += ' is:starred';

      const listUrl = `https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=10&q=${encodeURIComponent(query)}`;
      const listResponse = await fetch(listUrl, {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      const listData = await listResponse.json();

      if (!listData.messages?.length) continue;

      for (const msg of listData.messages.slice(0, 5)) {
        const msgUrl = `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date`;
        const msgResponse = await fetch(msgUrl, {
          headers: { Authorization: `Bearer ${accessToken}` }
        });
        const msgData = await msgResponse.json();

        const headers = msgData.payload?.headers || [];
        const from = headers.find(h => h.name === 'From')?.value || '';
        const subject = headers.find(h => h.name === 'Subject')?.value || '(no subject)';
        const date = headers.find(h => h.name === 'Date')?.value || '';

        // Check if VIP
        const senderEmail = from.match(/<([^>]+)>/)?.[1] || from;
        const isVip = config.email.globalRules?.vipSenders?.some(
          vip => senderEmail.toLowerCase().includes(vip.toLowerCase())
        ) || false;

        allEmails.push({
          account: account.name,
          from: from.replace(/<[^>]+>/, '').trim() || senderEmail,
          subject,
          date,
          isVip,
          snippet: msgData.snippet?.substring(0, 100)
        });
      }
    } catch (error) {
      console.error(`Email query failed for ${account.name}:`, error);
    }
  }

  return {
    filter,
    emailCount: allEmails.length,
    emails: allEmails
  };
}

// Query BEANS/beads files
async function queryBeads(filter = 'open') {
  if (!config?.beans?.enabled || !config.beans.scanPaths?.length) {
    return { error: 'BEANS not configured' };
  }

  const allItems = [];
  const patterns = config.beans.patterns || ['**/.beads/*.jsonl'];

  for (const scanPath of config.beans.scanPaths) {
    try {
      // Look for .beads directories
      const beadsDir = path.join(scanPath, '.beads');
      if (!fs.existsSync(beadsDir)) continue;

      const files = fs.readdirSync(beadsDir).filter(f => f.endsWith('.jsonl'));

      for (const file of files) {
        const filePath = path.join(beadsDir, file);
        const content = fs.readFileSync(filePath, 'utf-8');
        const lines = content.split('\n').filter(l => l.trim());

        for (const line of lines) {
          try {
            const item = JSON.parse(line);

            // Filter by status
            if (filter === 'open' && item.status === 'closed') continue;
            if (filter === 'priority1' && item.priority !== 0 && item.priority !== 1) continue;
            if (filter === 'in_progress' && item.status !== 'in_progress') continue;

            allItems.push({
              id: item.id,
              title: item.title,
              status: item.status,
              priority: item.priority,
              type: item.type,
              project: path.basename(scanPath)
            });
          } catch {
            // Skip invalid JSON lines
          }
        }
      }
    } catch (error) {
      console.error(`BEANS scan failed for ${scanPath}:`, error);
    }
  }

  // Sort by priority
  allItems.sort((a, b) => (a.priority || 99) - (b.priority || 99));

  return {
    filter,
    itemCount: allItems.length,
    items: allItems.slice(0, 20)
  };
}

// Create a calendar event
async function createCalendarEvent(title, startTime, endTime, description = '', location = '') {
  if (!config?.calendar?.sources?.length) {
    return { error: 'No calendars configured' };
  }

  // Use the primary calendar (first enabled one)
  const source = config.calendar.sources.find(s => s.enabled && s.credentials?.refreshToken);
  if (!source) {
    return { error: 'No calendar with credentials found' };
  }

  try {
    const accessToken = await getGoogleAccessToken(source.credentials);
    if (!accessToken) {
      return { error: 'Failed to get calendar access token' };
    }

    // Parse start time - handle various formats
    let startDate, endDate;

    // If startTime is just a time like "3pm" or "15:00", assume today
    if (/^\d{1,2}(:\d{2})?\s*(am|pm)?$/i.test(startTime)) {
      const now = new Date();
      startDate = parseTimeString(startTime, now);
      // Default to 1 hour duration if no end time
      endDate = endTime ? parseTimeString(endTime, now) : new Date(startDate.getTime() + 60 * 60 * 1000);
    } else {
      // Try to parse as full date/time
      startDate = new Date(startTime);
      endDate = endTime ? new Date(endTime) : new Date(startDate.getTime() + 60 * 60 * 1000);
    }

    if (isNaN(startDate.getTime())) {
      return { error: `Invalid start time: ${startTime}` };
    }

    const event = {
      summary: title,
      description: description,
      location: location,
      start: {
        dateTime: startDate.toISOString(),
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
      },
      end: {
        dateTime: endDate.toISOString(),
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
      }
    };

    const response = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(source.calendarId)}/events`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(event)
      }
    );

    const data = await response.json();

    if (data.id) {
      return {
        success: true,
        eventId: data.id,
        title: data.summary,
        start: data.start?.dateTime || data.start?.date,
        end: data.end?.dateTime || data.end?.date,
        htmlLink: data.htmlLink
      };
    } else {
      return { error: data.error?.message || 'Failed to create event' };
    }
  } catch (error) {
    console.error('Calendar event creation failed:', error);
    return { error: error.message };
  }
}

// Helper to parse time strings like "3pm", "15:00", "3:30 PM"
function parseTimeString(timeStr, baseDate) {
  const date = new Date(baseDate);
  const time = timeStr.toLowerCase().trim();

  // Match patterns like "3pm", "3:30pm", "15:00"
  const match = time.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/i);
  if (!match) {
    return new Date(timeStr); // Fall back to native parsing
  }

  let hours = parseInt(match[1], 10);
  const minutes = match[2] ? parseInt(match[2], 10) : 0;
  const meridiem = match[3]?.toLowerCase();

  if (meridiem === 'pm' && hours < 12) hours += 12;
  if (meridiem === 'am' && hours === 12) hours = 0;

  date.setHours(hours, minutes, 0, 0);
  return date;
}

// Send an email
async function sendEmail(to, subject, body) {
  if (!config?.email?.accounts?.length) {
    return { error: 'No email accounts configured' };
  }

  // Use the first enabled account
  const account = config.email.accounts.find(a => a.enabled && a.credentials?.refreshToken);
  if (!account) {
    return { error: 'No email account with credentials found' };
  }

  try {
    const accessToken = await getGoogleAccessToken(account.credentials);
    if (!accessToken) {
      return { error: 'Failed to get email access token' };
    }

    // Create the email message in RFC 2822 format
    const emailLines = [
      `To: ${to}`,
      `Subject: ${subject}`,
      'Content-Type: text/plain; charset=utf-8',
      '',
      body
    ];
    const email = emailLines.join('\r\n');

    // Base64url encode the message
    const encodedMessage = Buffer.from(email)
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    const response = await fetch(
      'https://gmail.googleapis.com/gmail/v1/users/me/messages/send',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ raw: encodedMessage })
      }
    );

    const data = await response.json();

    if (data.id) {
      return {
        success: true,
        messageId: data.id,
        to: to,
        subject: subject
      };
    } else {
      return { error: data.error?.message || 'Failed to send email' };
    }
  } catch (error) {
    console.error('Email send failed:', error);
    return { error: error.message };
  }
}

// Create a Zoom meeting
async function createZoomMeeting(topic, startTime, duration = 60, agenda = '') {
  if (!config?.zoom?.enabled || !config.zoom.accountId) {
    return { error: 'Zoom not configured. Add Zoom credentials to config.' };
  }

  try {
    // Get Zoom access token using Server-to-Server OAuth
    const tokenResponse = await fetch('https://zoom.us/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${Buffer.from(`${config.zoom.clientId}:${config.zoom.clientSecret}`).toString('base64')}`
      },
      body: new URLSearchParams({
        grant_type: 'account_credentials',
        account_id: config.zoom.accountId
      })
    });

    const tokenData = await tokenResponse.json();
    if (!tokenData.access_token) {
      return { error: 'Failed to get Zoom access token' };
    }

    // Parse start time
    let startDate;
    if (/^\d{1,2}(:\d{2})?\s*(am|pm)?$/i.test(startTime)) {
      startDate = parseTimeString(startTime, new Date());
    } else {
      startDate = new Date(startTime);
    }

    // Create meeting
    const meetingResponse = await fetch('https://api.zoom.us/v2/users/me/meetings', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        topic: topic,
        type: 2, // Scheduled meeting
        start_time: startDate.toISOString(),
        duration: duration,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        agenda: agenda,
        settings: {
          host_video: true,
          participant_video: true,
          join_before_host: true,
          mute_upon_entry: false,
          waiting_room: false
        }
      })
    });

    const meeting = await meetingResponse.json();

    if (meeting.id) {
      return {
        success: true,
        meetingId: meeting.id,
        topic: meeting.topic,
        startTime: meeting.start_time,
        duration: meeting.duration,
        joinUrl: meeting.join_url,
        password: meeting.password
      };
    } else {
      return { error: meeting.message || 'Failed to create Zoom meeting' };
    }
  } catch (error) {
    console.error('Zoom meeting creation failed:', error);
    return { error: error.message };
  }
}

// Send Teams message via webhook
async function sendTeamsMessage(message, title = '') {
  const webhookUrl = config?.teams?.webhookUrl || config?.notifications?.teams?.webhookUrl;

  if (!webhookUrl) {
    return { error: 'Teams webhook not configured. Add webhookUrl to teams config.' };
  }

  try {
    const card = {
      '@type': 'MessageCard',
      '@context': 'http://schema.org/extensions',
      summary: title || 'SpockAI Message',
      themeColor: '0076D7',
      title: title || 'SpockAI',
      text: message
    };

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(card)
    });

    if (response.ok) {
      return { success: true, message: 'Message sent to Teams' };
    } else {
      const text = await response.text();
      return { error: `Teams webhook failed: ${text}` };
    }
  } catch (error) {
    console.error('Teams message failed:', error);
    return { error: error.message };
  }
}

// Create a beads issue using bd CLI
async function createBead(title, type = 'task', priority = 2, description = '') {
  if (!config?.beans?.enabled || !config.beans.scanPaths?.length) {
    return { error: 'BEANS not configured' };
  }

  const { execSync } = require('child_process');
  const projectPath = config.beans.scanPaths[0]; // Use first scan path

  try {
    // Build the bd create command
    let cmd = `bd create --title="${title.replace(/"/g, '\\"')}" --type=${type} --priority=${priority}`;
    if (description) {
      cmd += ` --description="${description.replace(/"/g, '\\"')}"`;
    }

    // Execute in the project directory
    const result = execSync(cmd, {
      cwd: projectPath,
      encoding: 'utf-8',
      timeout: 10000
    });

    // Parse the created issue ID from output (typically "Created beads-xxx")
    const match = result.match(/Created\s+(beads-[a-z0-9]+)/i);
    const issueId = match ? match[1] : null;

    return {
      success: true,
      issueId: issueId,
      title: title,
      type: type,
      priority: priority,
      project: path.basename(projectPath),
      message: result.trim()
    };
  } catch (error) {
    console.error('Failed to create bead:', error);
    return { error: error.message || 'Failed to create beads issue' };
  }
}

// Update a beads issue status
async function updateBeadStatus(issueId, status) {
  if (!config?.beans?.enabled || !config.beans.scanPaths?.length) {
    return { error: 'BEANS not configured' };
  }

  const { execSync } = require('child_process');
  const projectPath = config.beans.scanPaths[0];

  try {
    const cmd = `bd update ${issueId} --status=${status}`;
    const result = execSync(cmd, {
      cwd: projectPath,
      encoding: 'utf-8',
      timeout: 10000
    });

    return {
      success: true,
      issueId: issueId,
      status: status,
      message: result.trim()
    };
  } catch (error) {
    console.error('Failed to update bead:', error);
    return { error: error.message || 'Failed to update beads issue' };
  }
}

// Close a beads issue
async function closeBead(issueId, reason = '') {
  if (!config?.beans?.enabled || !config.beans.scanPaths?.length) {
    return { error: 'BEANS not configured' };
  }

  const { execSync } = require('child_process');
  const projectPath = config.beans.scanPaths[0];

  try {
    let cmd = `bd close ${issueId}`;
    if (reason) {
      cmd += ` --reason="${reason.replace(/"/g, '\\"')}"`;
    }

    const result = execSync(cmd, {
      cwd: projectPath,
      encoding: 'utf-8',
      timeout: 10000
    });

    return {
      success: true,
      issueId: issueId,
      closed: true,
      message: result.trim()
    };
  } catch (error) {
    console.error('Failed to close bead:', error);
    return { error: error.message || 'Failed to close beads issue' };
  }
}

// ============================================
// REMINDERS FUNCTIONS
// ============================================

// Ensure data directory exists
function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

// Load reminders from file
function loadReminders() {
  ensureDataDir();
  try {
    if (fs.existsSync(REMINDERS_FILE)) {
      const data = fs.readFileSync(REMINDERS_FILE, 'utf-8');
      reminders = JSON.parse(data);
      // Re-schedule active reminders
      reminders.forEach(r => {
        if (!r.completed && new Date(r.time) > new Date()) {
          scheduleReminder(r);
        }
      });
    }
  } catch (error) {
    console.error('Failed to load reminders:', error);
    reminders = [];
  }
}

// Save reminders to file
function saveReminders() {
  ensureDataDir();
  try {
    fs.writeFileSync(REMINDERS_FILE, JSON.stringify(reminders, null, 2));
  } catch (error) {
    console.error('Failed to save reminders:', error);
  }
}

// Schedule a reminder notification
function scheduleReminder(reminder) {
  const now = new Date();
  const reminderTime = new Date(reminder.time);
  const delay = reminderTime.getTime() - now.getTime();

  if (delay > 0) {
    reminderTimers[reminder.id] = setTimeout(() => {
      // Show notification
      showNotification('Reminder', reminder.text);

      // Send to Telegram if configured
      if (config?.notifications?.telegram?.botToken) {
        sendToTelegram(`🔔 Reminder: ${reminder.text}`);
      }

      // Mark as completed
      reminder.completed = true;
      saveReminders();
    }, delay);
  }
}

// Create a new reminder
async function createReminder(text, time) {
  const id = `reminder-${Date.now()}`;

  // Parse time - support various formats
  let reminderTime;
  if (/^\d+\s*(min|minute|minutes|m)$/i.test(time)) {
    const mins = parseInt(time);
    reminderTime = new Date(Date.now() + mins * 60 * 1000);
  } else if (/^\d+\s*(hour|hours|h)$/i.test(time)) {
    const hours = parseInt(time);
    reminderTime = new Date(Date.now() + hours * 60 * 60 * 1000);
  } else if (/^\d{1,2}(:\d{2})?\s*(am|pm)?$/i.test(time)) {
    reminderTime = parseTimeString(time, new Date());
    // If time is in the past, assume tomorrow
    if (reminderTime < new Date()) {
      reminderTime.setDate(reminderTime.getDate() + 1);
    }
  } else {
    reminderTime = new Date(time);
  }

  if (isNaN(reminderTime.getTime())) {
    return { error: `Invalid time format: ${time}` };
  }

  const reminder = {
    id,
    text,
    time: reminderTime.toISOString(),
    created: new Date().toISOString(),
    completed: false
  };

  reminders.push(reminder);
  scheduleReminder(reminder);
  saveReminders();

  return {
    success: true,
    id,
    text,
    time: reminderTime.toISOString(),
    timeFormatted: reminderTime.toLocaleString()
  };
}

// List reminders
async function listReminders(filter = 'pending') {
  const now = new Date();
  let filtered = reminders;

  if (filter === 'pending') {
    filtered = reminders.filter(r => !r.completed && new Date(r.time) > now);
  } else if (filter === 'completed') {
    filtered = reminders.filter(r => r.completed);
  }

  return {
    filter,
    count: filtered.length,
    reminders: filtered.map(r => ({
      id: r.id,
      text: r.text,
      time: r.time,
      timeFormatted: new Date(r.time).toLocaleString(),
      completed: r.completed
    }))
  };
}

// Delete a reminder
async function deleteReminder(reminderId) {
  const index = reminders.findIndex(r => r.id === reminderId);
  if (index === -1) {
    return { error: `Reminder not found: ${reminderId}` };
  }

  // Clear the timeout if scheduled
  if (reminderTimers[reminderId]) {
    clearTimeout(reminderTimers[reminderId]);
    delete reminderTimers[reminderId];
  }

  reminders.splice(index, 1);
  saveReminders();

  return { success: true, deleted: reminderId };
}

// ============================================
// NOTES FUNCTIONS
// ============================================

// Load notes from file
function loadNotes() {
  ensureDataDir();
  try {
    if (fs.existsSync(NOTES_FILE)) {
      return JSON.parse(fs.readFileSync(NOTES_FILE, 'utf-8'));
    }
  } catch (error) {
    console.error('Failed to load notes:', error);
  }
  return [];
}

// Save notes to file
function saveNotes(notes) {
  ensureDataDir();
  try {
    fs.writeFileSync(NOTES_FILE, JSON.stringify(notes, null, 2));
  } catch (error) {
    console.error('Failed to save notes:', error);
  }
}

// Create a new note
async function createNote(title, content, tags = []) {
  const notes = loadNotes();
  const id = `note-${Date.now()}`;

  const note = {
    id,
    title,
    content,
    tags: Array.isArray(tags) ? tags : tags.split(',').map(t => t.trim()),
    created: new Date().toISOString(),
    updated: new Date().toISOString()
  };

  notes.push(note);
  saveNotes(notes);

  return {
    success: true,
    id,
    title,
    tagsCount: note.tags.length
  };
}

// Search notes
async function searchNotes(query) {
  const notes = loadNotes();
  const queryLower = query.toLowerCase();

  const matches = notes.filter(note =>
    note.title.toLowerCase().includes(queryLower) ||
    note.content.toLowerCase().includes(queryLower) ||
    note.tags.some(tag => tag.toLowerCase().includes(queryLower))
  );

  return {
    query,
    count: matches.length,
    notes: matches.map(n => ({
      id: n.id,
      title: n.title,
      preview: n.content.substring(0, 100) + (n.content.length > 100 ? '...' : ''),
      tags: n.tags,
      updated: n.updated
    }))
  };
}

// Get a specific note
async function getNote(noteId) {
  const notes = loadNotes();
  const note = notes.find(n => n.id === noteId);

  if (!note) {
    return { error: `Note not found: ${noteId}` };
  }

  return {
    success: true,
    ...note
  };
}

// List all notes
async function listNotes(limit = 20) {
  const notes = loadNotes();

  // Sort by updated date, most recent first
  notes.sort((a, b) => new Date(b.updated) - new Date(a.updated));

  return {
    count: notes.length,
    notes: notes.slice(0, limit).map(n => ({
      id: n.id,
      title: n.title,
      preview: n.content.substring(0, 50) + (n.content.length > 50 ? '...' : ''),
      tags: n.tags,
      updated: n.updated
    }))
  };
}

// Delete a note
async function deleteNote(noteId) {
  const notes = loadNotes();
  const index = notes.findIndex(n => n.id === noteId);

  if (index === -1) {
    return { error: `Note not found: ${noteId}` };
  }

  notes.splice(index, 1);
  saveNotes(notes);

  return { success: true, deleted: noteId };
}

// ============================================
// DAILY BRIEFING FUNCTION
// ============================================

async function getDailyBriefing() {
  const briefing = {
    timestamp: new Date().toISOString(),
    sections: []
  };

  // Get today's calendar events
  try {
    const calendarData = await queryCalendar('today');
    if (!calendarData.error) {
      briefing.sections.push({
        title: 'Calendar',
        summary: `${calendarData.eventCount} events today`,
        items: calendarData.events.slice(0, 5).map(e => ({
          text: `${e.title} at ${new Date(e.start).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`,
          detail: e.location || ''
        }))
      });
    }
  } catch (e) {
    console.error('Briefing calendar error:', e);
  }

  // Get unread emails
  try {
    const emailData = await queryEmails('unread');
    if (!emailData.error) {
      const vipEmails = emailData.emails.filter(e => e.isVip);
      briefing.sections.push({
        title: 'Email',
        summary: `${emailData.emailCount} unread${vipEmails.length ? `, ${vipEmails.length} VIP` : ''}`,
        items: emailData.emails.slice(0, 5).map(e => ({
          text: `${e.from}: ${e.subject}`,
          detail: e.isVip ? 'VIP' : ''
        }))
      });
    }
  } catch (e) {
    console.error('Briefing email error:', e);
  }

  // Get priority tasks
  try {
    const tasksData = await queryBeads('priority1');
    if (!tasksData.error) {
      briefing.sections.push({
        title: 'Priority Tasks',
        summary: `${tasksData.itemCount} high priority items`,
        items: tasksData.items.slice(0, 5).map(t => ({
          text: t.title,
          detail: `P${t.priority} - ${t.status}`
        }))
      });
    }
  } catch (e) {
    console.error('Briefing tasks error:', e);
  }

  // Get pending reminders
  try {
    const remindersData = await listReminders('pending');
    if (remindersData.count > 0) {
      briefing.sections.push({
        title: 'Reminders',
        summary: `${remindersData.count} pending reminders`,
        items: remindersData.reminders.slice(0, 3).map(r => ({
          text: r.text,
          detail: new Date(r.time).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
        }))
      });
    }
  } catch (e) {
    console.error('Briefing reminders error:', e);
  }

  return briefing;
}

// ============================================
// PHASE 1: MEMORY SYSTEM
// ============================================

function ensureMemoryDir() {
  if (!fs.existsSync(MEMORY_DIR)) {
    fs.mkdirSync(MEMORY_DIR, { recursive: true });
  }
}

function getDailyLogPath() {
  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  return path.join(MEMORY_DIR, `${today}.md`);
}

// Append to today's daily log
function appendDailyLog(entry) {
  ensureMemoryDir();
  const logPath = getDailyLogPath();
  const timestamp = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  const line = `- [${timestamp}] ${entry}\n`;

  try {
    fs.appendFileSync(logPath, line);
  } catch (error) {
    console.error('Failed to append daily log:', error);
  }
}

// Read today's daily log
function readDailyLog() {
  const logPath = getDailyLogPath();
  try {
    if (fs.existsSync(logPath)) {
      return fs.readFileSync(logPath, 'utf-8');
    }
  } catch (error) {
    console.error('Failed to read daily log:', error);
  }
  return '';
}

// Read long-term memory
function readMemory() {
  ensureMemoryDir();
  try {
    if (fs.existsSync(MEMORY_FILE)) {
      return fs.readFileSync(MEMORY_FILE, 'utf-8');
    }
  } catch (error) {
    console.error('Failed to read memory:', error);
  }
  return '';
}

// Write long-term memory
function writeMemory(content) {
  ensureMemoryDir();
  try {
    fs.writeFileSync(MEMORY_FILE, content);
    appendDailyLog('Updated long-term memory');
    return { success: true };
  } catch (error) {
    return { error: error.message };
  }
}

// Read user preferences
function readUserProfile() {
  ensureMemoryDir();
  try {
    if (fs.existsSync(USER_FILE)) {
      return fs.readFileSync(USER_FILE, 'utf-8');
    }
  } catch (error) {
    console.error('Failed to read user profile:', error);
  }
  return '';
}

// Write user preferences
function writeUserProfile(content) {
  ensureMemoryDir();
  try {
    fs.writeFileSync(USER_FILE, content);
    appendDailyLog('Updated user profile');
    return { success: true };
  } catch (error) {
    return { error: error.message };
  }
}

// Search daily logs by date range or keyword
async function searchMemoryLogs(query, daysBack = 7) {
  ensureMemoryDir();
  const results = [];

  try {
    const files = fs.readdirSync(MEMORY_DIR).filter(f => f.match(/^\d{4}-\d{2}-\d{2}\.md$/));
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - daysBack);

    for (const file of files) {
      const dateStr = file.replace('.md', '');
      if (new Date(dateStr) >= cutoff) {
        const content = fs.readFileSync(path.join(MEMORY_DIR, file), 'utf-8');
        if (!query || content.toLowerCase().includes(query.toLowerCase())) {
          results.push({ date: dateStr, content });
        }
      }
    }
  } catch (error) {
    console.error('Failed to search memory logs:', error);
  }

  return { count: results.length, logs: results };
}

// Build memory context for system prompt
function buildMemoryContext() {
  const parts = [];

  const memory = readMemory();
  if (memory) {
    parts.push(`## Long-Term Memory\n${memory}`);
  }

  const userProfile = readUserProfile();
  if (userProfile) {
    parts.push(`## User Profile\n${userProfile}`);
  }

  const dailyLog = readDailyLog();
  if (dailyLog) {
    parts.push(`## Today's Activity Log\n${dailyLog}`);
  }

  return parts.length > 0 ? '\n\n---\n\n# Memory Context\n\n' + parts.join('\n\n') : '';
}

// ============================================
// PHASE 1: SCHEDULED CHECK-INS
// ============================================

// Check-in schedule configuration
const CHECK_IN_SCHEDULE = {
  morning: { hour: 7, minute: 0, label: 'Morning Briefing' },
  lunch: { hour: 12, minute: 0, label: 'Midday Check-in' },
  eod: { hour: 17, minute: 0, label: 'End of Day Wrap-up' },
  evening: { hour: 20, minute: 0, label: 'Evening Prep' }
};

async function generateCheckInMessage(type) {
  const briefing = await getDailyBriefing();
  const dailyLog = readDailyLog();

  let prompt;
  switch (type) {
    case 'morning':
      prompt = `Generate a concise morning briefing. Include today's priorities, calendar events, unread emails, and any important tasks. Here's the data:\n${JSON.stringify(briefing, null, 2)}\n\nToday's activity so far:\n${dailyLog || 'No activity yet.'}`;
      break;
    case 'lunch':
      prompt = `It's midday. Give a quick status update: any stale tasks, upcoming afternoon events, and anything needing attention. Here's current data:\n${JSON.stringify(briefing, null, 2)}\n\nToday's activity:\n${dailyLog || 'No activity logged.'}`;
      break;
    case 'eod':
      prompt = `End of day wrap-up. Summarize what was accomplished today, note any loose ends, and flag anything needing follow-up tomorrow. Today's log:\n${dailyLog || 'No activity logged.'}\n\nCurrent status:\n${JSON.stringify(briefing, null, 2)}`;
      break;
    case 'evening':
      prompt = `Evening prep: help plan tomorrow. Review any calendar events for tomorrow, pending tasks, and suggest priorities for the next day. Data:\n${JSON.stringify(briefing, null, 2)}`;
      break;
    default:
      prompt = `Provide a brief status check. Data:\n${JSON.stringify(briefing, null, 2)}`;
  }

  if (!anthropic) return prompt;

  try {
    const memoryContext = buildMemoryContext();
    const systemPrompt = (config?.ai?.systemPrompt ||
      'You are SpockAI, a helpful personal assistant. Be concise but thorough.') + memoryContext;

    const response = await anthropic.messages.create({
      model: config?.ai?.model || 'claude-sonnet-4-20250514',
      max_tokens: 512,
      system: systemPrompt,
      messages: [{ role: 'user', content: prompt }]
    });

    const text = response.content.find(b => b.type === 'text');
    return text?.text || prompt;
  } catch (error) {
    console.error('Failed to generate check-in:', error);
    return `[${CHECK_IN_SCHEDULE[type]?.label}] Check-in failed to generate AI summary. Raw briefing data available.`;
  }
}

function scheduleCheckIns() {
  // Clear any existing timers
  Object.values(checkInTimers).forEach(timer => clearTimeout(timer));
  checkInTimers = {};

  const now = new Date();

  for (const [type, schedule] of Object.entries(CHECK_IN_SCHEDULE)) {
    const target = new Date(now);
    target.setHours(schedule.hour, schedule.minute, 0, 0);

    // If time already passed today, schedule for tomorrow
    if (target <= now) {
      target.setDate(target.getDate() + 1);
    }

    const delay = target.getTime() - now.getTime();

    checkInTimers[type] = setTimeout(async () => {
      const message = await generateCheckInMessage(type);
      const label = schedule.label;

      // Send via Telegram
      await sendToTelegram(`🖖 *${label}*\n\n${message}`);

      // Show desktop notification
      showNotification(label, message.substring(0, 200));

      // Log it
      appendDailyLog(`Scheduled check-in: ${label}`);

      // Also show in chat window
      if (chatWindow && !chatWindow.isDestroyed()) {
        chatWindow.webContents.send('ai-message', {
          text: `🖖 ${label}\n\n${message}`,
          timestamp: Date.now()
        });
      }

      // Reschedule for tomorrow
      scheduleCheckIns();
    }, delay);
  }
}

// ============================================
// PHASE 2: EMAIL TRIAGE
// ============================================

function loadTriageRules() {
  ensureDataDir();
  try {
    if (fs.existsSync(TRIAGE_FILE)) {
      return JSON.parse(fs.readFileSync(TRIAGE_FILE, 'utf-8'));
    }
  } catch (error) {
    console.error('Failed to load triage rules:', error);
  }
  return { rules: [], autoClassify: true };
}

function saveTriageRules(rules) {
  ensureDataDir();
  try {
    fs.writeFileSync(TRIAGE_FILE, JSON.stringify(rules, null, 2));
  } catch (error) {
    console.error('Failed to save triage rules:', error);
  }
}

async function triageEmails() {
  const triageConfig = loadTriageRules();
  const emailData = await queryEmails('unread');

  if (emailData.error || !emailData.emails?.length) {
    return { processed: 0, results: [] };
  }

  const results = [];

  for (const email of emailData.emails) {
    let action = 'inbox'; // default
    let priority = 'normal';
    let matchedRule = null;

    for (const rule of triageConfig.rules) {
      let matches = false;

      if (rule.from && email.from?.toLowerCase().includes(rule.from.toLowerCase())) {
        matches = true;
      }
      if (rule.subject && email.subject?.toLowerCase().includes(rule.subject.toLowerCase())) {
        matches = true;
      }
      if (rule.keyword && (
        email.subject?.toLowerCase().includes(rule.keyword.toLowerCase()) ||
        email.snippet?.toLowerCase().includes(rule.keyword.toLowerCase())
      )) {
        matches = true;
      }

      if (matches) {
        action = rule.action || 'flag';
        priority = rule.priority || 'high';
        matchedRule = rule.name || 'unnamed rule';
        break;
      }
    }

    results.push({
      from: email.from,
      subject: email.subject,
      action,
      priority,
      matchedRule
    });
  }

  // Log triage results
  const highPriority = results.filter(r => r.priority === 'high');
  if (highPriority.length > 0) {
    appendDailyLog(`Email triage: ${highPriority.length} high-priority emails found`);
    // Notify about high priority
    const summary = highPriority.map(e => `- ${e.from}: ${e.subject}`).join('\n');
    await sendToTelegram(`📧 *High Priority Emails*\n\n${summary}`);
  }

  return {
    processed: results.length,
    highPriority: highPriority.length,
    results
  };
}

async function addTriageRule(name, criteria, action, priority) {
  const triageConfig = loadTriageRules();

  const rule = {
    id: `rule-${Date.now()}`,
    name,
    ...criteria, // from, subject, keyword
    action: action || 'flag',
    priority: priority || 'high',
    created: new Date().toISOString()
  };

  triageConfig.rules.push(rule);
  saveTriageRules(triageConfig);
  appendDailyLog(`Added triage rule: ${name}`);

  return { success: true, rule };
}

async function removeTriageRule(ruleId) {
  const triageConfig = loadTriageRules();
  const index = triageConfig.rules.findIndex(r => r.id === ruleId);

  if (index === -1) {
    return { error: `Rule not found: ${ruleId}` };
  }

  const removed = triageConfig.rules.splice(index, 1)[0];
  saveTriageRules(triageConfig);

  return { success: true, removed: removed.name };
}

async function listTriageRules() {
  const triageConfig = loadTriageRules();
  return {
    count: triageConfig.rules.length,
    autoClassify: triageConfig.autoClassify,
    rules: triageConfig.rules
  };
}

// ============================================
// PHASE 2: SECOND BRAIN / KNOWLEDGE BASE
// ============================================

function ensureKnowledgeDir() {
  if (!fs.existsSync(KNOWLEDGE_DIR)) {
    fs.mkdirSync(KNOWLEDGE_DIR, { recursive: true });
  }
}

// Index all markdown files in knowledge base
async function indexKnowledge() {
  ensureKnowledgeDir();
  const index = [];

  function walkDir(dir, prefix = '') {
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          walkDir(fullPath, path.join(prefix, entry.name));
        } else if (entry.name.endsWith('.md') || entry.name.endsWith('.txt')) {
          try {
            const content = fs.readFileSync(fullPath, 'utf-8');
            const title = content.split('\n')[0]?.replace(/^#+\s*/, '') || entry.name;
            index.push({
              path: path.join(prefix, entry.name),
              fullPath,
              title,
              size: content.length,
              preview: content.substring(0, 200),
              modified: fs.statSync(fullPath).mtime.toISOString()
            });
          } catch (e) {
            // skip unreadable files
          }
        }
      }
    } catch (e) {
      // skip unreadable directories
    }
  }

  // Index the knowledge directory
  walkDir(KNOWLEDGE_DIR);

  // Also index any configured scan paths
  const scanPaths = config?.knowledge?.scanPaths || [];
  for (const scanPath of scanPaths) {
    const resolved = scanPath.replace(/^~/, HOME_DIR);
    if (fs.existsSync(resolved)) {
      walkDir(resolved, path.basename(resolved));
    }
  }

  return { count: index.length, documents: index };
}

// Search knowledge base
async function searchKnowledge(query) {
  const { documents } = await indexKnowledge();
  const queryLower = query.toLowerCase();

  const results = [];

  for (const doc of documents) {
    try {
      const content = fs.readFileSync(doc.fullPath, 'utf-8');
      if (
        doc.title.toLowerCase().includes(queryLower) ||
        content.toLowerCase().includes(queryLower) ||
        doc.path.toLowerCase().includes(queryLower)
      ) {
        // Find matching lines for context
        const lines = content.split('\n');
        const matchingLines = lines
          .map((line, i) => ({ line, num: i + 1 }))
          .filter(({ line }) => line.toLowerCase().includes(queryLower))
          .slice(0, 3);

        results.push({
          path: doc.path,
          title: doc.title,
          matchingLines,
          preview: content.substring(0, 300)
        });
      }
    } catch (e) {
      // skip
    }
  }

  return { query, count: results.length, results };
}

// Read a knowledge document
async function readKnowledgeDoc(docPath) {
  const fullPath = path.isAbsolute(docPath)
    ? docPath
    : path.join(KNOWLEDGE_DIR, docPath);

  try {
    if (fs.existsSync(fullPath)) {
      const content = fs.readFileSync(fullPath, 'utf-8');
      return { success: true, path: docPath, content };
    }
    return { error: `Document not found: ${docPath}` };
  } catch (error) {
    return { error: error.message };
  }
}

// Save a knowledge document
async function saveKnowledgeDoc(docPath, content) {
  ensureKnowledgeDir();
  const fullPath = path.join(KNOWLEDGE_DIR, docPath);

  // Ensure subdirectories exist
  const dir = path.dirname(fullPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  try {
    fs.writeFileSync(fullPath, content);
    appendDailyLog(`Saved knowledge document: ${docPath}`);
    return { success: true, path: docPath };
  } catch (error) {
    return { error: error.message };
  }
}

// ============================================
// PHASE 2: SESSION LOGGING
// ============================================

function ensureSessionsDir() {
  if (!fs.existsSync(SESSIONS_DIR)) {
    fs.mkdirSync(SESSIONS_DIR, { recursive: true });
  }
}

function startSession() {
  ensureSessionsDir();
  sessionId = `session-${Date.now()}`;
  sessionLog = [];
  const startEntry = {
    type: 'start',
    timestamp: new Date().toISOString(),
    sessionId
  };
  sessionLog.push(startEntry);
  appendDailyLog(`Session started: ${sessionId}`);
  return sessionId;
}

function logSessionEntry(role, content) {
  if (!sessionId) startSession();

  sessionLog.push({
    role,
    content: typeof content === 'string' ? content : JSON.stringify(content),
    timestamp: new Date().toISOString()
  });

  // Estimate token usage (rough: 4 chars per token)
  contextTokenEstimate += Math.ceil((typeof content === 'string' ? content.length : JSON.stringify(content).length) / 4);
}

function saveSession(summary) {
  if (!sessionId || sessionLog.length === 0) return;

  ensureSessionsDir();
  const date = new Date().toISOString().split('T')[0];
  const slug = summary
    ? summary.toLowerCase().replace(/[^a-z0-9]+/g, '-').substring(0, 40)
    : 'untitled';

  const sessionFile = path.join(SESSIONS_DIR, `${date}-${slug}.json`);

  try {
    fs.writeFileSync(sessionFile, JSON.stringify({
      sessionId,
      date,
      summary: summary || 'No summary',
      messageCount: sessionLog.length,
      estimatedTokens: contextTokenEstimate,
      log: sessionLog
    }, null, 2));
    appendDailyLog(`Session saved: ${slug}`);
    return { success: true, file: sessionFile };
  } catch (error) {
    return { error: error.message };
  }
}

async function searchSessions(query, limit = 10) {
  ensureSessionsDir();
  const results = [];

  try {
    const files = fs.readdirSync(SESSIONS_DIR)
      .filter(f => f.endsWith('.json'))
      .sort()
      .reverse();

    for (const file of files) {
      if (results.length >= limit) break;

      try {
        const data = JSON.parse(fs.readFileSync(path.join(SESSIONS_DIR, file), 'utf-8'));

        if (!query) {
          results.push({
            file,
            date: data.date,
            summary: data.summary,
            messageCount: data.messageCount
          });
        } else {
          const queryLower = query.toLowerCase();
          const logText = data.log.map(e => e.content).join(' ').toLowerCase();
          if (
            data.summary?.toLowerCase().includes(queryLower) ||
            logText.includes(queryLower)
          ) {
            results.push({
              file,
              date: data.date,
              summary: data.summary,
              messageCount: data.messageCount
            });
          }
        }
      } catch (e) {
        // skip bad files
      }
    }
  } catch (error) {
    console.error('Failed to search sessions:', error);
  }

  return { query, count: results.length, sessions: results };
}

// ============================================
// PHASE 3: SCRATCH PAD / DAILY TICKLER
// ============================================

function loadScratchPad() {
  ensureDataDir();
  try {
    if (fs.existsSync(SCRATCH_FILE)) {
      const data = JSON.parse(fs.readFileSync(SCRATCH_FILE, 'utf-8'));
      // Roll over incomplete items from previous days
      const today = new Date().toISOString().split('T')[0];
      if (data.date !== today) {
        const carryOver = (data.items || []).filter(i => !i.done);
        return { date: today, items: carryOver };
      }
      return data;
    }
  } catch (error) {
    console.error('Failed to load scratch pad:', error);
  }
  return { date: new Date().toISOString().split('T')[0], items: [] };
}

function saveScratchPad(pad) {
  ensureDataDir();
  try {
    fs.writeFileSync(SCRATCH_FILE, JSON.stringify(pad, null, 2));
  } catch (error) {
    console.error('Failed to save scratch pad:', error);
  }
}

async function addScratchItem(text) {
  const pad = loadScratchPad();
  const item = {
    id: `scratch-${Date.now()}`,
    text,
    done: false,
    added: new Date().toISOString()
  };
  pad.items.push(item);
  saveScratchPad(pad);
  appendDailyLog(`Scratch pad: added "${text}"`);
  return { success: true, item };
}

async function toggleScratchItem(itemId) {
  const pad = loadScratchPad();
  const item = pad.items.find(i => i.id === itemId);
  if (!item) return { error: `Item not found: ${itemId}` };

  item.done = !item.done;
  saveScratchPad(pad);
  return { success: true, item };
}

async function removeScratchItem(itemId) {
  const pad = loadScratchPad();
  const index = pad.items.findIndex(i => i.id === itemId);
  if (index === -1) return { error: `Item not found: ${itemId}` };

  pad.items.splice(index, 1);
  saveScratchPad(pad);
  return { success: true, removed: itemId };
}

async function getScratchPad() {
  const pad = loadScratchPad();
  return {
    date: pad.date,
    totalItems: pad.items.length,
    pendingItems: pad.items.filter(i => !i.done).length,
    completedItems: pad.items.filter(i => i.done).length,
    items: pad.items
  };
}

// ============================================
// PHASE 3: DEFER SYSTEM
// ============================================

function loadDeferred() {
  ensureDataDir();
  try {
    if (fs.existsSync(DEFERRED_FILE)) {
      return JSON.parse(fs.readFileSync(DEFERRED_FILE, 'utf-8'));
    }
  } catch (error) {
    console.error('Failed to load deferred items:', error);
  }
  return [];
}

function saveDeferred(items) {
  ensureDataDir();
  try {
    fs.writeFileSync(DEFERRED_FILE, JSON.stringify(items, null, 2));
  } catch (error) {
    console.error('Failed to save deferred items:', error);
  }
}

async function deferTask(text, deferUntil, recurring = false) {
  const items = loadDeferred();

  let deferTime;
  // Parse relative times
  if (/^(tomorrow|tmw)$/i.test(deferUntil)) {
    deferTime = new Date();
    deferTime.setDate(deferTime.getDate() + 1);
    deferTime.setHours(9, 0, 0, 0);
  } else if (/^(monday|tuesday|wednesday|thursday|friday|saturday|sunday)$/i.test(deferUntil)) {
    const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const targetDay = days.indexOf(deferUntil.toLowerCase());
    deferTime = new Date();
    const currentDay = deferTime.getDay();
    const daysUntil = (targetDay - currentDay + 7) % 7 || 7;
    deferTime.setDate(deferTime.getDate() + daysUntil);
    deferTime.setHours(9, 0, 0, 0);
  } else if (/^\d+\s*(day|days|d)$/i.test(deferUntil)) {
    const numDays = parseInt(deferUntil);
    deferTime = new Date(Date.now() + numDays * 24 * 60 * 60 * 1000);
    deferTime.setHours(9, 0, 0, 0);
  } else if (/^\d+\s*(week|weeks|w)$/i.test(deferUntil)) {
    const numWeeks = parseInt(deferUntil);
    deferTime = new Date(Date.now() + numWeeks * 7 * 24 * 60 * 60 * 1000);
    deferTime.setHours(9, 0, 0, 0);
  } else {
    deferTime = new Date(deferUntil);
  }

  if (isNaN(deferTime.getTime())) {
    return { error: `Invalid defer time: ${deferUntil}` };
  }

  const item = {
    id: `defer-${Date.now()}`,
    text,
    deferUntil: deferTime.toISOString(),
    recurring,
    created: new Date().toISOString(),
    fired: false
  };

  items.push(item);
  saveDeferred(items);
  scheduleDeferredItem(item);
  appendDailyLog(`Deferred: "${text}" until ${deferTime.toLocaleDateString()}`);

  return {
    success: true,
    item: {
      id: item.id,
      text: item.text,
      deferUntil: item.deferUntil,
      deferFormatted: deferTime.toLocaleString()
    }
  };
}

function scheduleDeferredItem(item) {
  const delay = new Date(item.deferUntil).getTime() - Date.now();
  if (delay <= 0 || item.fired) return;

  setTimeout(async () => {
    item.fired = true;

    // Notify
    showNotification('Deferred Task', item.text);
    await sendToTelegram(`⏰ *Deferred Task Due*\n\n${item.text}`);

    // Add to scratch pad
    await addScratchItem(`[Deferred] ${item.text}`);

    // Handle recurring
    if (item.recurring) {
      item.fired = false;
      const nextDate = new Date(item.deferUntil);
      nextDate.setDate(nextDate.getDate() + 7); // weekly by default
      item.deferUntil = nextDate.toISOString();
      scheduleDeferredItem(item);
    }

    const items = loadDeferred();
    const idx = items.findIndex(i => i.id === item.id);
    if (idx !== -1) {
      items[idx] = item;
      saveDeferred(items);
    }
  }, delay);
}

async function listDeferred(includeCompleted = false) {
  const items = loadDeferred();
  const filtered = includeCompleted ? items : items.filter(i => !i.fired);
  return {
    count: filtered.length,
    items: filtered.map(i => ({
      id: i.id,
      text: i.text,
      deferUntil: i.deferUntil,
      deferFormatted: new Date(i.deferUntil).toLocaleString(),
      recurring: i.recurring,
      fired: i.fired
    }))
  };
}

async function cancelDeferred(itemId) {
  const items = loadDeferred();
  const index = items.findIndex(i => i.id === itemId);
  if (index === -1) return { error: `Deferred item not found: ${itemId}` };

  items.splice(index, 1);
  saveDeferred(items);
  return { success: true, cancelled: itemId };
}

// ============================================
// PHASE 4: CONTEXT WINDOW MONITORING
// ============================================

function getContextStatus() {
  const maxTokens = 200000; // Claude's context window
  const usagePercent = Math.round((contextTokenEstimate / maxTokens) * 100);

  return {
    estimatedTokens: contextTokenEstimate,
    maxTokens,
    usagePercent,
    conversationLength: conversationHistory.length,
    shouldFlush: usagePercent > 75
  };
}

function flushContext(preserveImportant = true) {
  const oldLength = conversationHistory.length;

  if (preserveImportant) {
    // Save current session before flushing
    saveSession('Auto-flushed context at ' + new Date().toLocaleTimeString());

    // Keep last 4 messages for continuity
    conversationHistory = conversationHistory.slice(-4);
  } else {
    conversationHistory = [];
  }

  contextTokenEstimate = conversationHistory.reduce((sum, msg) => {
    const content = typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content);
    return sum + Math.ceil(content.length / 4);
  }, 0);

  appendDailyLog(`Context flushed: ${oldLength} -> ${conversationHistory.length} messages`);

  return {
    success: true,
    previousMessages: oldLength,
    currentMessages: conversationHistory.length,
    estimatedTokens: contextTokenEstimate
  };
}

// Create Teams meeting (requires Graph API)
async function createTeamsMeeting(subject, startTime, duration = 60, attendees = []) {
  if (!config?.teams?.enabled || !config.teams.clientId) {
    return { error: 'Teams not configured. Add Microsoft Graph credentials to config.' };
  }

  try {
    // Get Microsoft Graph access token
    const tokenResponse = await fetch(
      `https://login.microsoftonline.com/${config.teams.tenantId}/oauth2/v2.0/token`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: config.teams.clientId,
          client_secret: config.teams.clientSecret,
          scope: 'https://graph.microsoft.com/.default',
          grant_type: 'client_credentials'
        })
      }
    );

    const tokenData = await tokenResponse.json();
    if (!tokenData.access_token) {
      return { error: 'Failed to get Microsoft Graph access token' };
    }

    // Parse start time
    let startDate;
    if (/^\d{1,2}(:\d{2})?\s*(am|pm)?$/i.test(startTime)) {
      startDate = parseTimeString(startTime, new Date());
    } else {
      startDate = new Date(startTime);
    }

    const endDate = new Date(startDate.getTime() + duration * 60 * 1000);

    // Create online meeting
    const meetingResponse = await fetch(
      'https://graph.microsoft.com/v1.0/me/onlineMeetings',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${tokenData.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          subject: subject,
          startDateTime: startDate.toISOString(),
          endDateTime: endDate.toISOString(),
          participants: {
            attendees: attendees.map(email => ({
              upn: email,
              role: 'attendee'
            }))
          }
        })
      }
    );

    const meeting = await meetingResponse.json();

    if (meeting.id) {
      return {
        success: true,
        meetingId: meeting.id,
        subject: meeting.subject,
        startTime: meeting.startDateTime,
        joinUrl: meeting.joinWebUrl,
        joinInfo: meeting.joinInformation?.content
      };
    } else {
      return { error: meeting.error?.message || 'Failed to create Teams meeting' };
    }
  } catch (error) {
    console.error('Teams meeting creation failed:', error);
    return { error: error.message };
  }
}

// ============================================
// CLAUDE TOOLS DEFINITION
// ============================================

const tools = [
  {
    name: 'get_calendar_events',
    description: 'Get calendar events for a specified time range. Use this when the user asks about their schedule, appointments, or calendar.',
    input_schema: {
      type: 'object',
      properties: {
        time_range: {
          type: 'string',
          enum: ['today', 'tomorrow', 'week'],
          description: 'Time range to query: today, tomorrow, or week'
        }
      },
      required: ['time_range']
    }
  },
  {
    name: 'get_emails',
    description: 'Get emails from configured email accounts. Use this when the user asks about their emails, messages, or inbox.',
    input_schema: {
      type: 'object',
      properties: {
        filter: {
          type: 'string',
          enum: ['unread', 'important', 'starred', 'all'],
          description: 'Filter emails: unread, important, starred, or all'
        }
      },
      required: ['filter']
    }
  },
  {
    name: 'get_tasks',
    description: 'Get tasks/issues from BEANS/beads tracking system. Use this when the user asks about their tasks, issues, priorities, or work items.',
    input_schema: {
      type: 'object',
      properties: {
        filter: {
          type: 'string',
          enum: ['open', 'priority1', 'in_progress', 'all'],
          description: 'Filter tasks: open, priority1 (P0-P1), in_progress, or all'
        }
      },
      required: ['filter']
    }
  },
  {
    name: 'create_calendar_event',
    description: 'Create a new calendar event. Use this when the user wants to schedule a meeting, appointment, or add something to their calendar.',
    input_schema: {
      type: 'object',
      properties: {
        title: {
          type: 'string',
          description: 'Title/name of the event'
        },
        start_time: {
          type: 'string',
          description: 'Start time (e.g., "3pm", "15:00", "2024-02-05T15:00:00")'
        },
        end_time: {
          type: 'string',
          description: 'End time (optional, defaults to 1 hour after start)'
        },
        description: {
          type: 'string',
          description: 'Event description (optional)'
        },
        location: {
          type: 'string',
          description: 'Event location (optional)'
        }
      },
      required: ['title', 'start_time']
    }
  },
  {
    name: 'send_email',
    description: 'Send an email to someone. Use this when the user wants to email, message, or contact someone via email.',
    input_schema: {
      type: 'object',
      properties: {
        to: {
          type: 'string',
          description: 'Recipient email address'
        },
        subject: {
          type: 'string',
          description: 'Email subject line'
        },
        body: {
          type: 'string',
          description: 'Email body/content'
        }
      },
      required: ['to', 'subject', 'body']
    }
  },
  {
    name: 'create_zoom_meeting',
    description: 'Create a Zoom video meeting. Use this when the user wants to schedule a Zoom call, video meeting, or virtual meeting.',
    input_schema: {
      type: 'object',
      properties: {
        topic: {
          type: 'string',
          description: 'Meeting topic/title'
        },
        start_time: {
          type: 'string',
          description: 'Start time (e.g., "3pm", "15:00", "2024-02-05T15:00:00")'
        },
        duration: {
          type: 'number',
          description: 'Duration in minutes (default 60)'
        },
        agenda: {
          type: 'string',
          description: 'Meeting agenda/description (optional)'
        }
      },
      required: ['topic', 'start_time']
    }
  },
  {
    name: 'send_teams_message',
    description: 'Send a message to Microsoft Teams channel via webhook. Use this when the user wants to post to Teams or notify a Teams channel.',
    input_schema: {
      type: 'object',
      properties: {
        message: {
          type: 'string',
          description: 'Message content'
        },
        title: {
          type: 'string',
          description: 'Message title/header (optional)'
        }
      },
      required: ['message']
    }
  },
  {
    name: 'create_teams_meeting',
    description: 'Create a Microsoft Teams meeting. Use this when the user wants to schedule a Teams call or Teams video meeting.',
    input_schema: {
      type: 'object',
      properties: {
        subject: {
          type: 'string',
          description: 'Meeting subject/title'
        },
        start_time: {
          type: 'string',
          description: 'Start time (e.g., "3pm", "15:00", "2024-02-05T15:00:00")'
        },
        duration: {
          type: 'number',
          description: 'Duration in minutes (default 60)'
        },
        attendees: {
          type: 'array',
          items: { type: 'string' },
          description: 'List of attendee email addresses (optional)'
        }
      },
      required: ['subject', 'start_time']
    }
  },
  {
    name: 'create_bead',
    description: 'Create a new beads/task issue in the project tracking system. Use this when the user wants to add a task, create an issue, track something, or add a todo item to the project.',
    input_schema: {
      type: 'object',
      properties: {
        title: {
          type: 'string',
          description: 'Title/name of the task or issue'
        },
        type: {
          type: 'string',
          enum: ['task', 'bug', 'feature', 'epic'],
          description: 'Type of issue: task (default), bug, feature, or epic'
        },
        priority: {
          type: 'number',
          description: 'Priority 0-4 (0=critical/P0, 1=high/P1, 2=medium/P2, 3=low/P3, 4=backlog). Default is 2.'
        },
        description: {
          type: 'string',
          description: 'Detailed description of the task/issue (optional)'
        }
      },
      required: ['title']
    }
  },
  {
    name: 'update_bead_status',
    description: 'Update the status of an existing beads/task issue. Use this to mark a task as in progress, claim work, or change task status.',
    input_schema: {
      type: 'object',
      properties: {
        issue_id: {
          type: 'string',
          description: 'The beads issue ID (e.g., "beads-abc123")'
        },
        status: {
          type: 'string',
          enum: ['open', 'in_progress', 'blocked'],
          description: 'New status for the issue'
        }
      },
      required: ['issue_id', 'status']
    }
  },
  {
    name: 'close_bead',
    description: 'Close/complete a beads/task issue. Use this when a task is finished, done, or completed.',
    input_schema: {
      type: 'object',
      properties: {
        issue_id: {
          type: 'string',
          description: 'The beads issue ID to close (e.g., "beads-abc123")'
        },
        reason: {
          type: 'string',
          description: 'Optional reason or note for closing the issue'
        }
      },
      required: ['issue_id']
    }
  },
  // ============================================
  // REMINDERS TOOLS
  // ============================================
  {
    name: 'create_reminder',
    description: 'Set a reminder for a specific time. Use this when the user wants to be reminded about something later.',
    input_schema: {
      type: 'object',
      properties: {
        text: {
          type: 'string',
          description: 'What to remind the user about'
        },
        time: {
          type: 'string',
          description: 'When to remind. Accepts: "30 minutes", "2 hours", "3pm", "15:00", or ISO date'
        }
      },
      required: ['text', 'time']
    }
  },
  {
    name: 'list_reminders',
    description: 'List all reminders. Use this when the user asks about their reminders.',
    input_schema: {
      type: 'object',
      properties: {
        filter: {
          type: 'string',
          enum: ['pending', 'completed', 'all'],
          description: 'Filter reminders: pending (default), completed, or all'
        }
      },
      required: []
    }
  },
  {
    name: 'delete_reminder',
    description: 'Delete/cancel a reminder. Use this when the user wants to remove a reminder.',
    input_schema: {
      type: 'object',
      properties: {
        reminder_id: {
          type: 'string',
          description: 'The reminder ID to delete'
        }
      },
      required: ['reminder_id']
    }
  },
  // ============================================
  // NOTES TOOLS
  // ============================================
  {
    name: 'create_note',
    description: 'Create a new note. Use this when the user wants to save information, make a note, or remember something.',
    input_schema: {
      type: 'object',
      properties: {
        title: {
          type: 'string',
          description: 'Title of the note'
        },
        content: {
          type: 'string',
          description: 'Content/body of the note'
        },
        tags: {
          type: 'string',
          description: 'Comma-separated tags for organization (optional)'
        }
      },
      required: ['title', 'content']
    }
  },
  {
    name: 'search_notes',
    description: 'Search through notes. Use this when the user wants to find a note or look up saved information.',
    input_schema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Search term to find in note titles, content, or tags'
        }
      },
      required: ['query']
    }
  },
  {
    name: 'list_notes',
    description: 'List all notes. Use this when the user wants to see their notes.',
    input_schema: {
      type: 'object',
      properties: {
        limit: {
          type: 'number',
          description: 'Maximum notes to return (default 20)'
        }
      },
      required: []
    }
  },
  {
    name: 'get_note',
    description: 'Get the full content of a specific note.',
    input_schema: {
      type: 'object',
      properties: {
        note_id: {
          type: 'string',
          description: 'The note ID to retrieve'
        }
      },
      required: ['note_id']
    }
  },
  {
    name: 'delete_note',
    description: 'Delete a note. Use this when the user wants to remove a saved note.',
    input_schema: {
      type: 'object',
      properties: {
        note_id: {
          type: 'string',
          description: 'The note ID to delete'
        }
      },
      required: ['note_id']
    }
  },
  // ============================================
  // DAILY BRIEFING TOOL
  // ============================================
  {
    name: 'get_daily_briefing',
    description: 'Get a daily briefing summary including calendar events, emails, tasks, and reminders. Use this when the user asks for their daily briefing, morning summary, or "what do I have today".',
    input_schema: {
      type: 'object',
      properties: {},
      required: []
    }
  },
  // ============================================
  // MEMORY TOOLS
  // ============================================
  {
    name: 'read_memory',
    description: 'Read the long-term memory file (MEMORY.md). Contains persistent knowledge across sessions.',
    input_schema: {
      type: 'object',
      properties: {},
      required: []
    }
  },
  {
    name: 'write_memory',
    description: 'Update the long-term memory file. Use this to save important information that should persist across sessions.',
    input_schema: {
      type: 'object',
      properties: {
        content: {
          type: 'string',
          description: 'Full markdown content to write to MEMORY.md'
        }
      },
      required: ['content']
    }
  },
  {
    name: 'append_daily_log',
    description: 'Append an entry to today\'s daily log. Use to record activities, decisions, or events.',
    input_schema: {
      type: 'object',
      properties: {
        entry: {
          type: 'string',
          description: 'Log entry text'
        }
      },
      required: ['entry']
    }
  },
  {
    name: 'read_daily_log',
    description: 'Read today\'s daily activity log.',
    input_schema: {
      type: 'object',
      properties: {},
      required: []
    }
  },
  {
    name: 'search_memory_logs',
    description: 'Search through past daily logs by keyword and date range.',
    input_schema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Search term (optional, empty returns all)'
        },
        days_back: {
          type: 'number',
          description: 'How many days back to search (default 7)'
        }
      },
      required: []
    }
  },
  {
    name: 'read_user_profile',
    description: 'Read the user profile/preferences file (USER.md).',
    input_schema: {
      type: 'object',
      properties: {},
      required: []
    }
  },
  {
    name: 'write_user_profile',
    description: 'Update the user profile/preferences. Use to save user preferences, habits, and personal info.',
    input_schema: {
      type: 'object',
      properties: {
        content: {
          type: 'string',
          description: 'Full markdown content for USER.md'
        }
      },
      required: ['content']
    }
  },
  // ============================================
  // EMAIL TRIAGE TOOLS
  // ============================================
  {
    name: 'triage_emails',
    description: 'Run email triage - classify unread emails using configured rules and notify about high priority items.',
    input_schema: {
      type: 'object',
      properties: {},
      required: []
    }
  },
  {
    name: 'add_triage_rule',
    description: 'Add an email triage rule to auto-classify emails. Specify matching criteria (from address, subject text, or keyword) and the action to take.',
    input_schema: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: 'Name for this rule (e.g., "Boss emails")'
        },
        from: {
          type: 'string',
          description: 'Match sender address (partial match, optional)'
        },
        subject: {
          type: 'string',
          description: 'Match subject text (partial match, optional)'
        },
        keyword: {
          type: 'string',
          description: 'Match keyword in subject or body (optional)'
        },
        action: {
          type: 'string',
          enum: ['flag', 'archive', 'forward', 'notify'],
          description: 'Action to take: flag (default), archive, forward, notify'
        },
        priority: {
          type: 'string',
          enum: ['high', 'normal', 'low'],
          description: 'Priority classification (default: high)'
        }
      },
      required: ['name']
    }
  },
  {
    name: 'remove_triage_rule',
    description: 'Remove an email triage rule by ID.',
    input_schema: {
      type: 'object',
      properties: {
        rule_id: {
          type: 'string',
          description: 'The rule ID to remove'
        }
      },
      required: ['rule_id']
    }
  },
  {
    name: 'list_triage_rules',
    description: 'List all configured email triage rules.',
    input_schema: {
      type: 'object',
      properties: {},
      required: []
    }
  },
  // ============================================
  // KNOWLEDGE BASE TOOLS
  // ============================================
  {
    name: 'index_knowledge',
    description: 'Index all documents in the knowledge base. Returns a list of all markdown/text files with titles and previews.',
    input_schema: {
      type: 'object',
      properties: {},
      required: []
    }
  },
  {
    name: 'search_knowledge',
    description: 'Search the knowledge base (Second Brain) for documents matching a query.',
    input_schema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Search term to find in knowledge base documents'
        }
      },
      required: ['query']
    }
  },
  {
    name: 'read_knowledge_doc',
    description: 'Read a specific document from the knowledge base.',
    input_schema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'Path to the document relative to knowledge base root'
        }
      },
      required: ['path']
    }
  },
  {
    name: 'save_knowledge_doc',
    description: 'Save a document to the knowledge base. Use to store important information, research, or reference material.',
    input_schema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'Path for the document (e.g., "projects/myproject.md")'
        },
        content: {
          type: 'string',
          description: 'Document content (markdown)'
        }
      },
      required: ['path', 'content']
    }
  },
  // ============================================
  // SESSION TOOLS
  // ============================================
  {
    name: 'save_session',
    description: 'Save the current conversation session with a summary for future reference.',
    input_schema: {
      type: 'object',
      properties: {
        summary: {
          type: 'string',
          description: 'Brief summary of what this session was about'
        }
      },
      required: ['summary']
    }
  },
  {
    name: 'search_sessions',
    description: 'Search through past conversation sessions.',
    input_schema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Search term (optional, empty lists recent sessions)'
        },
        limit: {
          type: 'number',
          description: 'Max results (default 10)'
        }
      },
      required: []
    }
  },
  // ============================================
  // SCRATCH PAD TOOLS
  // ============================================
  {
    name: 'add_scratch_item',
    description: 'Add an item to today\'s scratch pad (daily tickler). Items carry over to the next day if not completed.',
    input_schema: {
      type: 'object',
      properties: {
        text: {
          type: 'string',
          description: 'Item text to add to scratch pad'
        }
      },
      required: ['text']
    }
  },
  {
    name: 'get_scratch_pad',
    description: 'Get today\'s scratch pad with all items and their completion status.',
    input_schema: {
      type: 'object',
      properties: {},
      required: []
    }
  },
  {
    name: 'toggle_scratch_item',
    description: 'Toggle a scratch pad item as done/not done.',
    input_schema: {
      type: 'object',
      properties: {
        item_id: {
          type: 'string',
          description: 'The scratch item ID to toggle'
        }
      },
      required: ['item_id']
    }
  },
  {
    name: 'remove_scratch_item',
    description: 'Remove an item from the scratch pad entirely.',
    input_schema: {
      type: 'object',
      properties: {
        item_id: {
          type: 'string',
          description: 'The scratch item ID to remove'
        }
      },
      required: ['item_id']
    }
  },
  // ============================================
  // DEFER TOOLS
  // ============================================
  {
    name: 'defer_task',
    description: 'Defer a task for later. Supports "tomorrow", day names ("monday"), relative ("3 days", "2 weeks"), or specific dates. Optionally recurring.',
    input_schema: {
      type: 'object',
      properties: {
        text: {
          type: 'string',
          description: 'Task description to defer'
        },
        defer_until: {
          type: 'string',
          description: 'When to surface this task: "tomorrow", "monday", "3 days", "2 weeks", or ISO date'
        },
        recurring: {
          type: 'boolean',
          description: 'If true, task recurs weekly after firing (default false)'
        }
      },
      required: ['text', 'defer_until']
    }
  },
  {
    name: 'list_deferred',
    description: 'List all deferred/scheduled tasks.',
    input_schema: {
      type: 'object',
      properties: {
        include_completed: {
          type: 'boolean',
          description: 'Include already-fired items (default false)'
        }
      },
      required: []
    }
  },
  {
    name: 'cancel_deferred',
    description: 'Cancel a deferred task by ID.',
    input_schema: {
      type: 'object',
      properties: {
        item_id: {
          type: 'string',
          description: 'The deferred item ID to cancel'
        }
      },
      required: ['item_id']
    }
  },
  // ============================================
  // CONTEXT MONITORING TOOLS
  // ============================================
  {
    name: 'get_context_status',
    description: 'Check current context window usage - estimated token count, percentage used, and whether flush is recommended.',
    input_schema: {
      type: 'object',
      properties: {},
      required: []
    }
  },
  {
    name: 'flush_context',
    description: 'Flush the conversation history to free context window space. Saves session before flushing.',
    input_schema: {
      type: 'object',
      properties: {
        preserve_important: {
          type: 'boolean',
          description: 'Keep last 4 messages for continuity (default true)'
        }
      },
      required: []
    }
  },
  // ============================================
  // SECURITY VAULT TOOLS
  // ============================================
  {
    name: 'vault_list',
    description: 'List all stored API keys and credentials in the encrypted vault, grouped by source (Google Cloud, Telegram, Anthropic, etc.). Shows service names and key names but NOT key values.',
    input_schema: {
      type: 'object',
      properties: {},
      required: []
    }
  },
  {
    name: 'vault_store',
    description: 'Store an API key or credential in the encrypted vault. Keys are encrypted with AES-256-GCM.',
    input_schema: {
      type: 'object',
      properties: {
        service: {
          type: 'string',
          description: 'Service identifier (e.g., "anthropic", "google-oauth", "telegram", "openai")'
        },
        label: {
          type: 'string',
          description: 'Human-readable label (e.g., "Claude API Key", "SpockAI Bot")'
        },
        source: {
          type: 'string',
          description: 'Where the key came from (e.g., "Anthropic", "Google Cloud", "Telegram")'
        },
        key_name: {
          type: 'string',
          description: 'Name of the specific key (e.g., "apiKey", "clientSecret", "botToken")'
        },
        key_value: {
          type: 'string',
          description: 'The actual key/credential value to store'
        }
      },
      required: ['service', 'label', 'source', 'key_name', 'key_value']
    }
  },
  {
    name: 'vault_get',
    description: 'Retrieve and display a specific key from the vault for recovery purposes. Shows both masked and full values.',
    input_schema: {
      type: 'object',
      properties: {
        service: {
          type: 'string',
          description: 'Service identifier (e.g., "anthropic", "google-oauth")'
        }
      },
      required: ['service']
    }
  },
  {
    name: 'vault_remove',
    description: 'Remove a service and all its keys from the encrypted vault.',
    input_schema: {
      type: 'object',
      properties: {
        service: {
          type: 'string',
          description: 'Service identifier to remove'
        }
      },
      required: ['service']
    }
  },
  {
    name: 'vault_migrate',
    description: 'Migrate existing plaintext keys from config.json and environment variables into the encrypted vault. Safe to run multiple times - skips services already in vault.',
    input_schema: {
      type: 'object',
      properties: {},
      required: []
    }
  }
];

// Execute a tool call
async function executeTool(toolName, toolInput) {
  switch (toolName) {
    case 'get_calendar_events':
      return await queryCalendar(toolInput.time_range);
    case 'get_emails':
      return await queryEmails(toolInput.filter);
    case 'get_tasks':
      return await queryBeads(toolInput.filter);
    case 'create_calendar_event':
      return await createCalendarEvent(
        toolInput.title,
        toolInput.start_time,
        toolInput.end_time,
        toolInput.description || '',
        toolInput.location || ''
      );
    case 'send_email':
      return await sendEmail(toolInput.to, toolInput.subject, toolInput.body);
    case 'create_zoom_meeting':
      return await createZoomMeeting(
        toolInput.topic,
        toolInput.start_time,
        toolInput.duration || 60,
        toolInput.agenda || ''
      );
    case 'send_teams_message':
      return await sendTeamsMessage(toolInput.message, toolInput.title || '');
    case 'create_teams_meeting':
      return await createTeamsMeeting(
        toolInput.subject,
        toolInput.start_time,
        toolInput.duration || 60,
        toolInput.attendees || []
      );
    case 'create_bead':
      return await createBead(
        toolInput.title,
        toolInput.type || 'task',
        toolInput.priority ?? 2,
        toolInput.description || ''
      );
    case 'update_bead_status':
      return await updateBeadStatus(toolInput.issue_id, toolInput.status);
    case 'close_bead':
      return await closeBead(toolInput.issue_id, toolInput.reason || '');
    // Reminders
    case 'create_reminder':
      return await createReminder(toolInput.text, toolInput.time);
    case 'list_reminders':
      return await listReminders(toolInput.filter || 'pending');
    case 'delete_reminder':
      return await deleteReminder(toolInput.reminder_id);
    // Notes
    case 'create_note':
      return await createNote(toolInput.title, toolInput.content, toolInput.tags || []);
    case 'search_notes':
      return await searchNotes(toolInput.query);
    case 'list_notes':
      return await listNotes(toolInput.limit || 20);
    case 'get_note':
      return await getNote(toolInput.note_id);
    case 'delete_note':
      return await deleteNote(toolInput.note_id);
    // Daily Briefing
    case 'get_daily_briefing':
      return await getDailyBriefing();
    // Memory
    case 'read_memory':
      return { content: readMemory() || 'No long-term memory saved yet.' };
    case 'write_memory':
      return writeMemory(toolInput.content);
    case 'append_daily_log':
      appendDailyLog(toolInput.entry);
      return { success: true };
    case 'read_daily_log':
      return { date: new Date().toISOString().split('T')[0], content: readDailyLog() || 'No entries today.' };
    case 'search_memory_logs':
      return await searchMemoryLogs(toolInput.query || '', toolInput.days_back || 7);
    case 'read_user_profile':
      return { content: readUserProfile() || 'No user profile saved yet.' };
    case 'write_user_profile':
      return writeUserProfile(toolInput.content);
    // Email Triage
    case 'triage_emails':
      return await triageEmails();
    case 'add_triage_rule':
      return await addTriageRule(
        toolInput.name,
        { from: toolInput.from, subject: toolInput.subject, keyword: toolInput.keyword },
        toolInput.action,
        toolInput.priority
      );
    case 'remove_triage_rule':
      return await removeTriageRule(toolInput.rule_id);
    case 'list_triage_rules':
      return await listTriageRules();
    // Knowledge Base
    case 'index_knowledge':
      return await indexKnowledge();
    case 'search_knowledge':
      return await searchKnowledge(toolInput.query);
    case 'read_knowledge_doc':
      return await readKnowledgeDoc(toolInput.path);
    case 'save_knowledge_doc':
      return await saveKnowledgeDoc(toolInput.path, toolInput.content);
    // Sessions
    case 'save_session':
      return saveSession(toolInput.summary);
    case 'search_sessions':
      return await searchSessions(toolInput.query || '', toolInput.limit || 10);
    // Scratch Pad
    case 'add_scratch_item':
      return await addScratchItem(toolInput.text);
    case 'get_scratch_pad':
      return await getScratchPad();
    case 'toggle_scratch_item':
      return await toggleScratchItem(toolInput.item_id);
    case 'remove_scratch_item':
      return await removeScratchItem(toolInput.item_id);
    // Defer
    case 'defer_task':
      return await deferTask(toolInput.text, toolInput.defer_until, toolInput.recurring || false);
    case 'list_deferred':
      return await listDeferred(toolInput.include_completed || false);
    case 'cancel_deferred':
      return await cancelDeferred(toolInput.item_id);
    // Context Monitoring
    case 'get_context_status':
      return getContextStatus();
    case 'flush_context':
      return flushContext(toolInput.preserve_important !== false);
    // Security Vault
    case 'vault_list':
      return listVaultKeys();
    case 'vault_store': {
      const vault = loadVault();
      if (!vault) return { error: 'Vault not available' };
      if (!vault.keys[toolInput.service]) {
        vault.keys[toolInput.service] = { source: toolInput.source, label: toolInput.label, keys: {} };
      }
      vault.keys[toolInput.service].source = toolInput.source;
      vault.keys[toolInput.service].label = toolInput.label;
      vault.keys[toolInput.service].keys[toolInput.key_name] = toolInput.key_value;
      const saved = saveVault(vault);
      return saved
        ? { success: true, message: `Stored ${toolInput.key_name} for ${toolInput.service} (${toolInput.source})` }
        : { error: 'Failed to save vault' };
    }
    case 'vault_get':
      return exportVaultKeys(toolInput.service);
    case 'vault_remove': {
      const removed = removeVaultService(toolInput.service);
      return removed
        ? { success: true, message: `Removed ${toolInput.service} from vault` }
        : { error: `Service '${toolInput.service}' not found in vault` };
    }
    case 'vault_migrate':
      return migrateConfigToVault();
    default:
      return { error: `Unknown tool: ${toolName}` };
  }
}

// Chat with Claude AI (with tool use)
async function chatWithAI(userMessage, includeTelegram = false) {
  if (!anthropic) {
    return { success: false, error: 'AI not configured. Set ANTHROPIC_API_KEY environment variable.' };
  }

  try {
    // Log to session
    logSessionEntry('user', userMessage);

    // Add user message to history
    conversationHistory.push({
      role: 'user',
      content: userMessage
    });

    // Keep last 20 messages to avoid token limits
    if (conversationHistory.length > 20) {
      conversationHistory = conversationHistory.slice(-20);
    }

    const memoryContext = buildMemoryContext();
    const systemPrompt = (config?.ai?.systemPrompt ||
      'You are SpockAI, a helpful personal assistant. Be concise but thorough. You have access to the user\'s calendar, email, task tracking, knowledge base, memory system, scratch pad, and deferred tasks. Use the available tools to fetch real data when asked. You can save important information to long-term memory and the user profile for future sessions. Log significant activities to the daily log.') + memoryContext;

    let response = await anthropic.messages.create({
      model: config?.ai?.model || 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      system: systemPrompt,
      tools: tools,
      messages: conversationHistory
    });

    // Handle tool use loop
    while (response.stop_reason === 'tool_use') {
      const toolUseBlocks = response.content.filter(block => block.type === 'tool_use');

      // Add assistant's response with tool calls to history
      conversationHistory.push({
        role: 'assistant',
        content: response.content
      });

      // Execute each tool and collect results
      const toolResults = [];
      for (const toolUse of toolUseBlocks) {
        console.log(`Executing tool: ${toolUse.name}`);
        const result = await executeTool(toolUse.name, toolUse.input);
        toolResults.push({
          type: 'tool_result',
          tool_use_id: toolUse.id,
          content: JSON.stringify(result, null, 2)
        });
      }

      // Add tool results to history
      conversationHistory.push({
        role: 'user',
        content: toolResults
      });

      // Get next response
      response = await anthropic.messages.create({
        model: config?.ai?.model || 'claude-sonnet-4-20250514',
        max_tokens: 1024,
        system: systemPrompt,
        tools: tools,
        messages: conversationHistory
      });
    }

    // Extract final text response
    const textBlock = response.content.find(block => block.type === 'text');
    const assistantMessage = textBlock?.text || 'No response generated.';

    // Add assistant response to history
    conversationHistory.push({
      role: 'assistant',
      content: assistantMessage
    });

    // Log to session and track context
    logSessionEntry('assistant', assistantMessage);

    // Auto-flush if context is getting large
    const contextStatus = getContextStatus();
    if (contextStatus.shouldFlush) {
      flushContext(true);
    }

    return { success: true, message: assistantMessage };
  } catch (error) {
    console.error('AI chat error:', error);
    return { success: false, error: error.message };
  }
}

// Create system tray icon
function createTray() {
  // Create a simple icon (green circle for online)
  const iconPath = path.join(__dirname, 'icon.png');

  // If no icon file, create a default one
  let icon;
  if (fs.existsSync(iconPath)) {
    icon = nativeImage.createFromPath(iconPath);
  } else {
    // Create a simple 16x16 icon programmatically
    icon = nativeImage.createEmpty();
  }

  tray = new Tray(icon.isEmpty() ? createDefaultIcon() : icon);
  tray.setToolTip('SpockAI - Personal Assistant');

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Open Chat',
      click: () => showChatWindow()
    },
    { type: 'separator' },
    {
      label: 'Status',
      sublabel: 'Running',
      enabled: false
    },
    { type: 'separator' },
    {
      label: 'Quit SpockAI',
      click: () => {
        app.quit();
      }
    }
  ]);

  tray.setContextMenu(contextMenu);

  // Double-click opens chat
  tray.on('double-click', () => {
    showChatWindow();
  });
}

// Create default tray icon
function createDefaultIcon() {
  // Create a 16x16 icon with a simple design
  const size = 16;
  const canvas = Buffer.alloc(size * size * 4);

  // Fill with a simple pattern (blue circle)
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (y * size + x) * 4;
      const cx = size / 2 - 0.5;
      const cy = size / 2 - 0.5;
      const dist = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);

      if (dist < size / 2 - 1) {
        // Inside circle - blue color
        canvas[idx] = 66;     // R
        canvas[idx + 1] = 133; // G
        canvas[idx + 2] = 244; // B
        canvas[idx + 3] = 255; // A
      } else {
        // Transparent
        canvas[idx] = 0;
        canvas[idx + 1] = 0;
        canvas[idx + 2] = 0;
        canvas[idx + 3] = 0;
      }
    }
  }

  return nativeImage.createFromBuffer(canvas, { width: size, height: size });
}

// Create chat window
function createChatWindow() {
  chatWindow = new BrowserWindow({
    width: 400,
    height: 600,
    show: false,
    frame: true,
    resizable: true,
    minimizable: true,
    maximizable: false,
    skipTaskbar: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    },
    title: 'SpockAI Chat',
    icon: path.join(__dirname, 'icon.png')
  });

  chatWindow.loadFile(path.join(__dirname, 'index.html'));

  chatWindow.on('close', (event) => {
    event.preventDefault();
    chatWindow.hide();
  });
}

// Show chat window
function showChatWindow() {
  if (!chatWindow) {
    createChatWindow();
  }

  if (chatWindow.isMinimized()) {
    chatWindow.restore();
  }

  chatWindow.show();
  chatWindow.focus();
}

// Handle chat messages from renderer - AI conversation
ipcMain.handle('send-message', async (event, message) => {
  // Check for special commands
  if (message.startsWith('/telegram ')) {
    // Forward to Telegram
    const telegramMsg = message.substring(10);
    return await sendToTelegram(telegramMsg);
  }

  if (message === '/clear') {
    conversationHistory = [];
    return { success: true, message: 'Conversation cleared.' };
  }

  // Default: Chat with AI
  if (config?.ai?.enabled !== false && anthropic) {
    return await chatWithAI(message);
  }

  // Fallback to Telegram if AI not configured
  return await sendToTelegram(message);
});

// Send message to Telegram
// ============================================
// PHASE 3: VOICE MESSAGE TRANSCRIPTION
// ============================================

async function handleVoiceMessage(fileId, botToken, chatId, from) {
  try {
    // Get file path from Telegram
    const fileResponse = await fetch(`https://api.telegram.org/bot${botToken}/getFile?file_id=${fileId}`);
    const fileData = await fileResponse.json();

    if (!fileData.ok) {
      await sendToTelegram('Failed to download voice message.');
      return;
    }

    const fileUrl = `https://api.telegram.org/file/bot${botToken}/${fileData.result.file_path}`;

    // Download the audio file
    const audioResponse = await fetch(fileUrl);
    const audioBuffer = Buffer.from(await audioResponse.arrayBuffer());

    // Save temporarily
    const tempPath = path.join(DATA_DIR, `voice-${Date.now()}.ogg`);
    ensureDataDir();
    fs.writeFileSync(tempPath, audioBuffer);

    // Transcribe using OpenAI Whisper API or Gemini
    let transcription = '';

    if (process.env.OPENAI_API_KEY) {
      // Use OpenAI Whisper
      const FormData = (await import('node:buffer')).Blob ? null : null;
      const formBody = new (globalThis.FormData || (await import('undici')).FormData)();
      formBody.append('file', new Blob([audioBuffer], { type: 'audio/ogg' }), 'voice.ogg');
      formBody.append('model', 'whisper-1');

      const whisperResponse = await fetch('https://api.openai.com/v1/audio/transcriptions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
        },
        body: formBody
      });

      const whisperData = await whisperResponse.json();
      transcription = whisperData.text || 'Transcription failed.';
    } else {
      // Fallback: Send base64 audio to Claude for description
      transcription = '[Voice message received - Set OPENAI_API_KEY for transcription]';
    }

    // Clean up temp file
    try { fs.unlinkSync(tempPath); } catch (e) { /* ignore */ }

    // Log it
    appendDailyLog(`Voice message from ${from}: ${transcription.substring(0, 100)}`);

    // Show in chat window
    if (chatWindow && !chatWindow.isDestroyed()) {
      chatWindow.webContents.send('telegram-message', {
        text: `🎤 Voice from ${from}: ${transcription}`,
        from,
        timestamp: Date.now()
      });
    }

    // Process through AI
    if (anthropic && transcription && !transcription.startsWith('[')) {
      await processAndRespondTelegram(`[Voice message transcription]: ${transcription}`, botToken, chatId);
    } else {
      await sendTelegramMsg(botToken, chatId, `🎤 Transcription: ${transcription}`);
    }
  } catch (error) {
    console.error('Voice message handling error:', error);
    await sendToTelegram('Failed to process voice message.');
  }
}

// ============================================
// PHASE 3: IMAGE/PHOTO ANALYSIS
// ============================================

async function handlePhotoMessage(fileId, caption, botToken, chatId, from) {
  try {
    // Get file path from Telegram
    const fileResponse = await fetch(`https://api.telegram.org/bot${botToken}/getFile?file_id=${fileId}`);
    const fileData = await fileResponse.json();

    if (!fileData.ok) {
      await sendToTelegram('Failed to download image.');
      return;
    }

    const fileUrl = `https://api.telegram.org/file/bot${botToken}/${fileData.result.file_path}`;

    // Download the image
    const imageResponse = await fetch(fileUrl);
    const imageBuffer = Buffer.from(await imageResponse.arrayBuffer());

    // Convert to base64 for Claude Vision
    const base64Image = imageBuffer.toString('base64');
    const mimeType = fileData.result.file_path.endsWith('.png') ? 'image/png' : 'image/jpeg';

    appendDailyLog(`Photo from ${from}${caption ? `: ${caption}` : ''}`);

    // Show in chat window
    if (chatWindow && !chatWindow.isDestroyed()) {
      chatWindow.webContents.send('telegram-message', {
        text: `📷 Photo from ${from}${caption ? `: ${caption}` : ''}`,
        from,
        timestamp: Date.now()
      });
    }

    if (!anthropic) {
      await sendToTelegram('AI not configured - cannot analyze image.');
      return;
    }

    // Send to Claude with vision
    const memoryContext = buildMemoryContext();
    const systemPrompt = (config?.ai?.systemPrompt ||
      'You are SpockAI, a helpful personal assistant.') + memoryContext;

    const messageContent = [
      {
        type: 'image',
        source: {
          type: 'base64',
          media_type: mimeType,
          data: base64Image
        }
      }
    ];

    if (caption) {
      messageContent.push({ type: 'text', text: caption });
    } else {
      messageContent.push({ type: 'text', text: 'What do you see in this image? Describe it and provide any useful analysis.' });
    }

    const response = await anthropic.messages.create({
      model: config?.ai?.model || 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      system: systemPrompt,
      messages: [{ role: 'user', content: messageContent }]
    });

    const textBlock = response.content.find(b => b.type === 'text');
    const analysis = textBlock?.text || 'Could not analyze image.';

    // Send analysis back to Telegram (with markdown fallback)
    await sendTelegramMsg(botToken, chatId, `📷 *Image Analysis*\n\n${analysis}`);

    // Show in chat window
    if (chatWindow && !chatWindow.isDestroyed()) {
      chatWindow.webContents.send('ai-message', {
        text: `📷 Image Analysis:\n\n${analysis}`,
        timestamp: Date.now()
      });
    }
  } catch (error) {
    console.error('Photo handling error:', error);
    await sendToTelegram('Failed to analyze image.');
  }
}

// Send a Telegram message with Markdown, falling back to plain text on parse errors
async function sendTelegramMsg(botToken, chatId, text) {
  const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
  const headers = { 'Content-Type': 'application/json' };

  // Try with Markdown first
  let response = await fetch(url, {
    method: 'POST', headers,
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'Markdown' })
  });
  let result = await response.json();

  // Fall back to plain text if Markdown parsing fails
  if (!result.ok && result.description && result.description.includes("can't parse entities")) {
    response = await fetch(url, {
      method: 'POST', headers,
      body: JSON.stringify({ chat_id: chatId, text })
    });
    result = await response.json();
  }

  return result;
}

async function sendToTelegram(message) {
  if (!config?.notifications?.telegram) {
    return { success: false, error: 'Telegram not configured' };
  }

  try {
    const { botToken, chatId } = config.notifications.telegram;
    const result = await sendTelegramMsg(botToken, chatId, message);

    if (result.ok) {
      return { success: true, message: 'Sent to Telegram', messageId: result.result.message_id };
    } else {
      return { success: false, error: result.description };
    }
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// Get config for renderer
ipcMain.handle('get-config', () => {
  return {
    telegramConfigured: !!config?.notifications?.telegram?.botToken,
    emailConfigured: !!config?.email?.accounts?.length,
    calendarConfigured: !!config?.calendar?.sources?.length,
    aiConfigured: !!anthropic,
    aiModel: config?.ai?.model || 'claude-sonnet-4-20250514'
  };
});

// Show notification
function showNotification(title, body) {
  new Notification({ title, body }).show();
}

// Telegram polling for incoming messages
async function pollTelegramUpdates() {
  if (!config?.notifications?.telegram?.botToken) return;

  const { botToken, chatId } = config.notifications.telegram;

  try {
    const url = `https://api.telegram.org/bot${botToken}/getUpdates?offset=${lastUpdateId + 1}&timeout=5`;
    const response = await fetch(url);
    const data = await response.json();

    if (data.ok && data.result?.length > 0) {
      for (const update of data.result) {
        lastUpdateId = update.update_id;

        // Only process messages from our chat
        const message = update.message;
        if (message && String(message.chat.id) === String(chatId)) {
          const from = message.from?.first_name || 'Telegram';

          // Handle voice messages (Phase 3a)
          if (message.voice || message.audio) {
            const fileId = (message.voice || message.audio).file_id;
            await handleVoiceMessage(fileId, botToken, chatId, from);
            continue;
          }

          // Handle photos (Phase 3b)
          if (message.photo && message.photo.length > 0) {
            // Get the largest photo
            const photo = message.photo[message.photo.length - 1];
            const caption = message.caption || '';
            await handlePhotoMessage(photo.file_id, caption, botToken, chatId, from);
            continue;
          }

          // Handle documents with images
          if (message.document && message.document.mime_type?.startsWith('image/')) {
            const caption = message.caption || '';
            await handlePhotoMessage(message.document.file_id, caption, botToken, chatId, from);
            continue;
          }

          const text = message.text || '';

          // Send to renderer (show incoming message)
          if (chatWindow && !chatWindow.isDestroyed()) {
            chatWindow.webContents.send('telegram-message', {
              text,
              from,
              timestamp: message.date * 1000
            });
          }

          // Show system notification if window is hidden
          if (!chatWindow?.isVisible()) {
            showNotification(`Message from ${from}`, text.substring(0, 100));
          }

          // Process through AI and respond back to Telegram
          if (text && anthropic) {
            await processAndRespondTelegram(text, botToken, chatId);
          }
        }
      }
    }
  } catch (error) {
    console.error('Telegram polling error:', error.message);
  }
}

// Process Telegram message through AI and send response back
async function processAndRespondTelegram(userMessage, botToken, chatId) {
  try {
    // Get AI response with tools
    const result = await chatWithAI(userMessage, true);

    if (result.success && result.message) {
      // Send response back to Telegram (with markdown fallback)
      await sendTelegramMsg(botToken, chatId, result.message);

      // Also show in chat window
      if (chatWindow && !chatWindow.isDestroyed()) {
        chatWindow.webContents.send('telegram-message', {
          text: `SpockAI: ${result.message}`,
          from: 'SpockAI',
          timestamp: Date.now()
        });
      }
    }
  } catch (error) {
    console.error('Failed to process Telegram message:', error);
  }
}

// Start Telegram polling
function startTelegramPolling() {
  if (pollingInterval) return;

  // Poll every 2 seconds
  pollingInterval = setInterval(pollTelegramUpdates, 2000);
  console.log('Telegram polling started');

  // Initial poll
  pollTelegramUpdates();
}

// Stop Telegram polling
function stopTelegramPolling() {
  if (pollingInterval) {
    clearInterval(pollingInterval);
    pollingInterval = null;
    console.log('Telegram polling stopped');
  }
}

// ============================================
// PHASE 4: WEB INTERFACE
// ============================================

let webServer = null;
const webClients = new Set(); // SSE clients

function startWebServer(port = 3000) {
  if (webServer) return;

  webServer = http.createServer(async (req, res) => {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.writeHead(200);
      res.end();
      return;
    }

    const url = new URL(req.url, `http://localhost:${port}`);

    // SSE endpoint for real-time updates
    if (url.pathname === '/api/events') {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive'
      });

      webClients.add(res);
      req.on('close', () => webClients.delete(res));
      return;
    }

    // Chat endpoint
    if (url.pathname === '/api/chat' && req.method === 'POST') {
      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', async () => {
        try {
          const { message } = JSON.parse(body);
          const result = await chatWithAI(message);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(result));

          // Broadcast to SSE clients
          broadcastToWebClients({ type: 'message', data: result });
        } catch (error) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: error.message }));
        }
      });
      return;
    }

    // Health endpoint
    if (url.pathname === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        status: 'healthy',
        uptime: process.uptime() * 1000,
        version: '0.2.0',
        ai: !!anthropic,
        context: getContextStatus()
      }));
      return;
    }

    // API: Get briefing
    if (url.pathname === '/api/briefing') {
      const briefing = await getDailyBriefing();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(briefing));
      return;
    }

    // API: Get scratch pad
    if (url.pathname === '/api/scratch') {
      const pad = await getScratchPad();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(pad));
      return;
    }

    // API: Get memory
    if (url.pathname === '/api/memory') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        memory: readMemory(),
        userProfile: readUserProfile(),
        dailyLog: readDailyLog()
      }));
      return;
    }

    // API: Notify test
    if (url.pathname === '/api/notify/test' && req.method === 'POST') {
      await sendToTelegram('🧪 Test notification from SpockAI web interface');
      showNotification('Test', 'Notification sent');
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true }));
      return;
    }

    // Serve the web UI
    if (url.pathname === '/' || url.pathname === '/index.html') {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(getWebUI());
      return;
    }

    res.writeHead(404);
    res.end('Not found');
  });

  webServer.listen(port, () => {
    console.log(`SpockAI web interface: http://localhost:${port}`);
  });

  webServer.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`Port ${port} in use, trying ${port + 1}`);
      startWebServer(port + 1);
    } else {
      console.error('Web server error:', err);
    }
  });
}

function broadcastToWebClients(data) {
  const message = `data: ${JSON.stringify(data)}\n\n`;
  for (const client of webClients) {
    try { client.write(message); } catch (e) { webClients.delete(client); }
  }
}

function getWebUI() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>SpockAI</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #1a1a2e; color: #e0e0e0; height: 100vh; display: flex; flex-direction: column; }
    .header { background: #16213e; padding: 16px 24px; display: flex; align-items: center; gap: 12px; border-bottom: 1px solid #0f3460; }
    .header h1 { font-size: 20px; color: #e94560; }
    .header .status { font-size: 12px; color: #4ecca3; }
    .chat-container { flex: 1; overflow-y: auto; padding: 16px 24px; display: flex; flex-direction: column; gap: 12px; }
    .message { max-width: 80%; padding: 12px 16px; border-radius: 12px; line-height: 1.5; white-space: pre-wrap; word-wrap: break-word; }
    .message.user { align-self: flex-end; background: #0f3460; border: 1px solid #1a5276; }
    .message.ai { align-self: flex-start; background: #16213e; border: 1px solid #4ecca3; }
    .message.system { align-self: center; color: #888; font-size: 13px; }
    .input-area { background: #16213e; padding: 16px 24px; border-top: 1px solid #0f3460; display: flex; gap: 12px; }
    .input-area input { flex: 1; background: #1a1a2e; border: 1px solid #0f3460; color: #e0e0e0; padding: 12px 16px; border-radius: 8px; font-size: 15px; outline: none; }
    .input-area input:focus { border-color: #4ecca3; }
    .input-area button { background: #e94560; color: white; border: none; padding: 12px 24px; border-radius: 8px; cursor: pointer; font-size: 15px; font-weight: 600; }
    .input-area button:hover { background: #c73e54; }
    .input-area button:disabled { opacity: 0.5; cursor: not-allowed; }
    .quick-actions { display: flex; gap: 8px; padding: 8px 24px; background: #16213e; overflow-x: auto; }
    .quick-actions button { background: #0f3460; color: #4ecca3; border: 1px solid #1a5276; padding: 6px 14px; border-radius: 16px; cursor: pointer; font-size: 13px; white-space: nowrap; }
    .quick-actions button:hover { background: #1a5276; }
  </style>
</head>
<body>
  <div class="header">
    <h1>SpockAI</h1>
    <span class="status" id="status">Connecting...</span>
  </div>
  <div class="quick-actions">
    <button onclick="send('Give me my daily briefing')">Briefing</button>
    <button onclick="send('Show my scratch pad')">Scratch Pad</button>
    <button onclick="send('What tasks are open?')">Tasks</button>
    <button onclick="send('Check my calendar for today')">Calendar</button>
    <button onclick="send('Any new emails?')">Email</button>
    <button onclick="send('Show my reminders')">Reminders</button>
    <button onclick="send('Search my knowledge base for recent notes')">Knowledge</button>
  </div>
  <div class="chat-container" id="chat"></div>
  <div class="input-area">
    <input type="text" id="input" placeholder="Ask SpockAI anything..." autocomplete="off" />
    <button id="sendBtn" onclick="sendMessage()">Send</button>
  </div>
  <script>
    const chat = document.getElementById('chat');
    const input = document.getElementById('input');
    const sendBtn = document.getElementById('sendBtn');
    const status = document.getElementById('status');

    input.addEventListener('keypress', e => { if (e.key === 'Enter') sendMessage(); });

    // SSE for real-time updates
    const events = new EventSource('/api/events');
    events.onopen = () => { status.textContent = 'Connected'; status.style.color = '#4ecca3'; };
    events.onerror = () => { status.textContent = 'Reconnecting...'; status.style.color = '#e94560'; };

    function addMessage(text, type) {
      const div = document.createElement('div');
      div.className = 'message ' + type;
      div.textContent = text;
      chat.appendChild(div);
      chat.scrollTop = chat.scrollHeight;
    }

    async function send(text) {
      input.value = text;
      await sendMessage();
    }

    async function sendMessage() {
      const text = input.value.trim();
      if (!text) return;
      input.value = '';
      sendBtn.disabled = true;
      addMessage(text, 'user');
      try {
        const res = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: text })
        });
        const data = await res.json();
        addMessage(data.message || data.error || 'No response', data.success ? 'ai' : 'system');
      } catch (e) {
        addMessage('Failed to reach SpockAI: ' + e.message, 'system');
      }
      sendBtn.disabled = false;
      input.focus();
    }

    // Check health
    fetch('/health').then(r => r.json()).then(d => {
      status.textContent = d.ai ? 'AI Ready' : 'AI Disabled';
      addMessage('SpockAI web interface connected. Type a message or use the quick actions above.', 'system');
    }).catch(() => addMessage('Failed to connect to SpockAI.', 'system'));
  </script>
</body>
</html>`;
}

// ============================================
// PHASE 4: SUBAGENT ORCHESTRATION
// ============================================

// Run a specialized analysis task as a "subagent" (isolated AI call with specific instructions)
async function runSubagent(agentType, data) {
  if (!anthropic) return { error: 'AI not configured' };

  const agentPrompts = {
    'session-analyzer': `Analyze this session log and provide a concise summary of what was discussed, decisions made, and any action items:\n${JSON.stringify(data)}`,
    'task-detector': `Review this daily log and identify any tasks that were mentioned but not yet tracked. List them as actionable items:\n${data}`,
    'stale-task-finder': `Review these open tasks and identify any that appear stale (no updates recently). Suggest which should be closed, deferred, or need attention:\n${JSON.stringify(data)}`,
    'email-summarizer': `Summarize these emails concisely, grouping by priority. Highlight any that need immediate action:\n${JSON.stringify(data)}`,
    'daily-reporter': `Create a concise daily report from this data. Include accomplishments, pending items, and recommendations:\n${JSON.stringify(data)}`
  };

  const prompt = agentPrompts[agentType];
  if (!prompt) return { error: `Unknown agent type: ${agentType}` };

  try {
    const response = await anthropic.messages.create({
      model: config?.ai?.model || 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      system: 'You are a specialized analysis agent. Be concise and actionable.',
      messages: [{ role: 'user', content: prompt }]
    });

    const text = response.content.find(b => b.type === 'text');
    return { success: true, agentType, result: text?.text || 'No output' };
  } catch (error) {
    return { error: error.message };
  }
}

// Initialize deferred items on startup
function initializeDeferred() {
  const items = loadDeferred();
  for (const item of items) {
    if (!item.fired) {
      scheduleDeferredItem(item);
    }
  }
}

// App lifecycle
app.whenReady().then(() => {
  loadConfig();

  // Initialize encrypted vault and migrate existing keys
  ensureVaultKey();
  migrateConfigToVault();
  overlayVaultKeys();

  loadReminders(); // Load and schedule saved reminders
  createTray();
  createChatWindow();

  // Initialize AI (checks vault -> env -> config for API key)
  const aiReady = initializeAI();

  // Start session
  startSession();

  // Start Telegram polling for incoming messages
  startTelegramPolling();

  // Schedule proactive check-ins
  scheduleCheckIns();

  // Initialize deferred task timers
  initializeDeferred();

  // Start web interface
  startWebServer(config?.web?.port || 3000);

  // Log startup
  appendDailyLog('SpockAI started');

  // Show startup notification
  const aiStatus = aiReady ? 'AI ready' : 'AI disabled (no API key)';
  showNotification('SpockAI Online', `Your personal assistant is running. ${aiStatus}`);
});

app.on('window-all-closed', (event) => {
  // Don't quit when windows are closed - keep running in tray
  event.preventDefault();
});

app.on('activate', () => {
  showChatWindow();
});

// Prevent app from quitting when last window closes
app.on('before-quit', () => {
  stopTelegramPolling();

  // Save session on quit
  saveSession('Session ended - app quit');
  appendDailyLog('SpockAI stopped');

  // Stop web server
  if (webServer) {
    webServer.close();
  }

  // Clear check-in timers
  Object.values(checkInTimers).forEach(timer => clearTimeout(timer));

  if (chatWindow) {
    chatWindow.removeAllListeners('close');
    chatWindow.close();
  }
});
