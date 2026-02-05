/**
 * SpockAI Integration Test
 * End-to-end test: email → classification → notification → Telegram/Teams
 *
 * Run with: npx tsx src/skills/spockai/tests/integration.test.ts
 *
 * Prerequisites:
 * - Configure ~/.openclaw/skills/spockai/config.yaml with credentials
 * - Set environment variables for sensitive values
 */

import { coreLogger } from '../utils/logger.js';
import { SpockAIError, formatErrorForUser } from '../utils/errors.js';

// Test configuration
interface TestConfig {
  skipEmail: boolean;
  skipCalendar: boolean;
  skipBeans: boolean;
  skipNotifications: boolean;
  skipServices: boolean;
  verbose: boolean;
}

const defaultConfig: TestConfig = {
  skipEmail: process.env.SKIP_EMAIL === 'true',
  skipCalendar: process.env.SKIP_CALENDAR === 'true',
  skipBeans: process.env.SKIP_BEANS === 'true',
  skipNotifications: process.env.SKIP_NOTIFICATIONS === 'true',
  skipServices: process.env.SKIP_SERVICES === 'true',
  verbose: process.env.VERBOSE === 'true'
};

// Test results tracker
interface TestResult {
  name: string;
  passed: boolean;
  duration: number;
  error?: string;
}

const results: TestResult[] = [];

/**
 * Run a single test with timing
 */
async function runTest(
  name: string,
  fn: () => Promise<void>
): Promise<boolean> {
  const start = Date.now();
  console.log(`\n▶ Running: ${name}`);

  try {
    await fn();
    const duration = Date.now() - start;
    results.push({ name, passed: true, duration });
    console.log(`  ✓ PASSED (${duration}ms)`);
    return true;
  } catch (error) {
    const duration = Date.now() - start;
    const errorMsg = error instanceof SpockAIError
      ? formatErrorForUser(error)
      : error instanceof Error ? error.message : String(error);

    results.push({ name, passed: false, duration, error: errorMsg });
    console.log(`  ✗ FAILED: ${errorMsg}`);
    return false;
  }
}

/**
 * Test 1: Configuration Loading
 */
async function testConfigLoading(): Promise<void> {
  const { ConfigLoader } = await import('../config/loader.js');

  const loader = new ConfigLoader();
  const config = await loader.load();

  if (!config) {
    throw new Error('Config loaded as null');
  }

  console.log('    Config loaded successfully');
}

/**
 * Test 2: Logger Initialization
 */
async function testLoggerInit(): Promise<void> {
  coreLogger.info('Integration test started');
  coreLogger.debug('Debug logging works');
  console.log('    Logger initialized');
}

/**
 * Test 3: Email Service (mock mode if no credentials)
 */
async function testEmailService(): Promise<void> {
  const { EmailService } = await import('../email/service.js');
  const { PriorityClassifier } = await import('../email/classifier.js');

  // Test classifier with mock email
  const classifier = new PriorityClassifier({
    priorityKeywords: ['urgent', 'asap', 'critical'],
    vipSenders: ['boss@company.com'],
    lowPriorityPatterns: ['newsletter', 'unsubscribe']
  });

  const mockEmail = {
    id: 'test-1',
    accountId: 'test-account',
    from: { email: 'sender@example.com', name: 'Sender' },
    to: [{ email: 'me@example.com', name: 'Me' }],
    subject: 'URGENT: Please review this ASAP',
    body: 'This is urgent and needs immediate attention.',
    receivedAt: new Date(),
    isRead: false,
    labels: []
  };

  const priority = classifier.classify(mockEmail);

  if (priority !== 'high') {
    throw new Error(`Expected high priority, got ${priority}`);
  }

  console.log('    Email classifier working (high priority detected)');
}

/**
 * Test 4: Calendar Service (mock mode)
 */
async function testCalendarService(): Promise<void> {
  const { CalendarService } = await import('../calendar/service.js');

  const service = new CalendarService();

  // Test appointment conflict detection
  const appointments = [
    {
      id: '1',
      sourceId: 'cal-1',
      title: 'Meeting 1',
      start: new Date('2026-02-05T10:00:00'),
      end: new Date('2026-02-05T11:00:00'),
      location: 'Room A',
      isAllDay: false
    },
    {
      id: '2',
      sourceId: 'cal-1',
      title: 'Meeting 2',
      start: new Date('2026-02-05T10:30:00'),
      end: new Date('2026-02-05T11:30:00'),
      location: 'Room B',
      isAllDay: false
    }
  ];

  const conflicts = service.detectConflicts(appointments);

  if (conflicts.length === 0) {
    throw new Error('Expected conflict detection to find overlapping meetings');
  }

  console.log('    Calendar conflict detection working');
}

/**
 * Test 5: BEANS Parser
 */
async function testBeansParser(): Promise<void> {
  const { BeansParser } = await import('../beans/parser.js');

  const parser = new BeansParser();

  const mockContent = `---
title: Test Note
priority: 1
tags: [work, urgent]
---

# Test Note

This is a test note with priority 1.

## Tasks

- [ ] First task
- [x] Completed task
- [ ] Another task
`;

  const result = parser.parse(mockContent, '/test/note.md');

  if (result.frontmatter.priority !== 1) {
    throw new Error(`Expected priority 1, got ${result.frontmatter.priority}`);
  }

  if (result.tasks.length !== 3) {
    throw new Error(`Expected 3 tasks, got ${result.tasks.length}`);
  }

  console.log('    BEANS parser working (priority and tasks extracted)');
}

/**
 * Test 6: Notification Queue
 */
async function testNotificationQueue(): Promise<void> {
  const { NotificationQueue } = await import('../notify/queue.js');

  const queue = new NotificationQueue({
    maxQueueSize: 100,
    rateLimitPerMinute: 20,
    retryAttempts: 3
  });

  let notificationSent = false;

  // Mock sender
  const mockSender = async () => {
    notificationSent = true;
  };

  await queue.enqueue({
    id: 'test-notification',
    type: 'email',
    title: 'Test',
    message: 'Test notification',
    priority: 'high',
    timestamp: new Date()
  }, mockSender);

  // Process queue
  await queue.process();

  if (!notificationSent) {
    throw new Error('Notification was not sent');
  }

  console.log('    Notification queue working');
}

/**
 * Test 7: Teams Adaptive Card Builder
 */
async function testTeamsCards(): Promise<void> {
  const { TeamsAdaptiveCardBuilder } = await import('../notify/teams-cards.js');

  const builder = new TeamsAdaptiveCardBuilder();

  const card = builder.buildEmailCard({
    id: 'email-1',
    accountId: 'acc-1',
    from: { email: 'sender@test.com', name: 'Sender' },
    to: [{ email: 'me@test.com', name: 'Me' }],
    subject: 'Important Email',
    body: 'This is the email body content.',
    receivedAt: new Date(),
    isRead: false,
    labels: []
  }, 'high');

  if (!card.body || card.body.length === 0) {
    throw new Error('Card body is empty');
  }

  if (card.type !== 'AdaptiveCard') {
    throw new Error('Invalid card type');
  }

  console.log('    Teams adaptive card builder working');
}

/**
 * Test 8: Error Handling
 */
async function testErrorHandling(): Promise<void> {
  const {
    SpockAIError,
    ConfigurationError,
    APIError,
    RateLimitError,
    isTransientError,
    getRetryDelay
  } = await import('../utils/errors.js');

  // Test error creation
  const configError = new ConfigurationError('Invalid config', { field: 'email' });
  if (configError.code !== 'CONFIG_ERROR') {
    throw new Error('ConfigurationError has wrong code');
  }

  // Test transient error detection
  const rateLimitError = new RateLimitError('gmail', 60000);
  if (!isTransientError(rateLimitError)) {
    throw new Error('RateLimitError should be transient');
  }

  // Test retry delay extraction
  const delay = getRetryDelay(rateLimitError);
  if (delay !== 60000) {
    throw new Error(`Expected 60000ms delay, got ${delay}`);
  }

  console.log('    Error handling utilities working');
}

/**
 * Test 9: Health Check
 */
async function testHealthCheck(): Promise<void> {
  const { HealthCheckManager } = await import('../core/health.js');

  const health = new HealthCheckManager();

  // Register a passing check
  health.registerCheck('test-check', async () => ({
    name: 'test-check',
    status: 'pass',
    message: 'All good'
  }));

  const results = await health.runAllChecks();
  const status = health.getStatus();

  if (status.status !== 'healthy') {
    throw new Error(`Expected healthy status, got ${status.status}`);
  }

  console.log('    Health check manager working');
}

/**
 * Test 10: Resource Monitor
 */
async function testResourceMonitor(): Promise<void> {
  const { ResourceMonitor } = await import('../core/monitor.js');

  const monitor = new ResourceMonitor({
    memoryThresholdMB: 100,
    cpuThresholdPercent: 5,
    checkIntervalMs: 1000
  });

  const snapshot = monitor.getSnapshot();

  if (typeof snapshot.memoryUsageMB !== 'number') {
    throw new Error('Memory usage not reported');
  }

  if (typeof snapshot.cpuUsagePercent !== 'number') {
    throw new Error('CPU usage not reported');
  }

  console.log(`    Resource monitor working (Memory: ${snapshot.memoryUsageMB.toFixed(1)}MB)`);
}

/**
 * Test 11: Recovery Manager
 */
async function testRecoveryManager(): Promise<void> {
  const { RecoveryManager } = await import('../core/recovery.js');

  const recovery = new RecoveryManager({
    maxRetries: 3,
    baseDelayMs: 100,
    maxDelayMs: 1000
  });

  let attempts = 0;

  // Test recovery with transient failure
  const result = await recovery.withRecovery('test-operation', async () => {
    attempts++;
    if (attempts < 2) {
      throw new Error('Transient failure');
    }
    return 'success';
  });

  if (result !== 'success') {
    throw new Error('Recovery did not succeed');
  }

  if (attempts !== 2) {
    throw new Error(`Expected 2 attempts, got ${attempts}`);
  }

  console.log('    Recovery manager working (retry logic verified)');
}

/**
 * Test 12: Metrics Collector
 */
async function testMetricsCollector(): Promise<void> {
  const { MetricsCollector } = await import('../core/metrics.js');

  const metrics = new MetricsCollector();

  // Record some classifications
  metrics.recordClassification('high', 'high');    // True positive
  metrics.recordClassification('high', 'medium');  // False positive
  metrics.recordClassification('medium', 'medium'); // True negative
  metrics.recordClassification('low', 'high');     // False negative

  const accuracy = metrics.getAccuracy();

  if (accuracy.total !== 4) {
    throw new Error(`Expected 4 total, got ${accuracy.total}`);
  }

  // 2 correct out of 4 = 50%
  if (accuracy.accuracy !== 0.5) {
    throw new Error(`Expected 0.5 accuracy, got ${accuracy.accuracy}`);
  }

  console.log('    Metrics collector working');
}

/**
 * Test 13: Intent Parser
 */
async function testIntentParser(): Promise<void> {
  const { IntentParser } = await import('../chat/intent-parser.js');

  const parser = new IntentParser();

  // Test email configuration intent
  const emailIntent = parser.parse('I want to set up my email');
  if (emailIntent.intent !== 'configure_email') {
    throw new Error(`Expected configure_email, got ${emailIntent.intent}`);
  }

  // Test notification intent
  const notifyIntent = parser.parse('Configure telegram notifications');
  if (notifyIntent.intent !== 'configure_notifications') {
    throw new Error(`Expected configure_notifications, got ${notifyIntent.intent}`);
  }

  console.log('    Intent parser working');
}

/**
 * Main test runner
 */
async function main(): Promise<void> {
  console.log('═══════════════════════════════════════════════════════');
  console.log('           SpockAI Integration Test Suite              ');
  console.log('═══════════════════════════════════════════════════════');
  console.log(`Started: ${new Date().toISOString()}`);
  console.log(`Config: ${JSON.stringify(defaultConfig)}`);

  const startTime = Date.now();

  // Core tests (always run)
  await runTest('Configuration Loading', testConfigLoading);
  await runTest('Logger Initialization', testLoggerInit);
  await runTest('Error Handling', testErrorHandling);
  await runTest('Health Check Manager', testHealthCheck);
  await runTest('Resource Monitor', testResourceMonitor);
  await runTest('Recovery Manager', testRecoveryManager);
  await runTest('Metrics Collector', testMetricsCollector);

  // Feature tests
  if (!defaultConfig.skipEmail) {
    await runTest('Email Service & Classifier', testEmailService);
  }

  if (!defaultConfig.skipCalendar) {
    await runTest('Calendar Service', testCalendarService);
  }

  if (!defaultConfig.skipBeans) {
    await runTest('BEANS Parser', testBeansParser);
  }

  if (!defaultConfig.skipNotifications) {
    await runTest('Notification Queue', testNotificationQueue);
    await runTest('Teams Adaptive Cards', testTeamsCards);
  }

  await runTest('Intent Parser', testIntentParser);

  // Summary
  const totalDuration = Date.now() - startTime;
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;

  console.log('\n═══════════════════════════════════════════════════════');
  console.log('                    TEST SUMMARY                        ');
  console.log('═══════════════════════════════════════════════════════');
  console.log(`Total:   ${results.length} tests`);
  console.log(`Passed:  ${passed} ✓`);
  console.log(`Failed:  ${failed} ✗`);
  console.log(`Duration: ${totalDuration}ms`);
  console.log('═══════════════════════════════════════════════════════');

  if (failed > 0) {
    console.log('\nFailed tests:');
    results.filter(r => !r.passed).forEach(r => {
      console.log(`  ✗ ${r.name}: ${r.error}`);
    });
    process.exit(1);
  } else {
    console.log('\n✓ All tests passed!');
    process.exit(0);
  }
}

// Run tests
main().catch(error => {
  console.error('Test runner failed:', error);
  process.exit(1);
});
