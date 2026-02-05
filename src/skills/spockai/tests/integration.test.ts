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
 * Test 3: Email Classifier
 */
async function testEmailClassifier(): Promise<void> {
  const { PriorityClassifier } = await import('../email/classifier.js');

  // Test classifier with proper GlobalEmailRules structure
  const classifier = new PriorityClassifier({
    priorityKeywords: ['urgent', 'asap', 'critical'],
    vipSenders: ['boss@company.com']
  });

  // Mock email with correct structure matching Email interface
  const mockEmail = {
    id: 'test-1',
    accountId: 'test-account',
    sender: 'Sender Name',
    senderEmail: 'sender@example.com',
    subject: 'URGENT: Please review this ASAP',
    snippet: 'This is urgent...',
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
 * Test 4: Calendar Service
 */
async function testCalendarService(): Promise<void> {
  const { CalendarService } = await import('../calendar/service.js');

  const service = new CalendarService();

  // Test service instantiation and basic methods
  const sources = service.getSources();
  if (!Array.isArray(sources)) {
    throw new Error('Expected sources to be an array');
  }

  const statuses = service.getSourceStatuses();
  if (!Array.isArray(statuses)) {
    throw new Error('Expected statuses to be an array');
  }

  // Test upcoming appointments method
  const upcoming = service.getUpcomingAppointments(5);
  if (!Array.isArray(upcoming)) {
    throw new Error('Expected upcoming to be an array');
  }

  console.log('    Calendar service working');
}

/**
 * Test 5: BEANS Parser
 */
async function testBeansParser(): Promise<void> {
  const { BeansParser } = await import('../beans/parser.js');

  const parser = new BeansParser();

  // Test parseFilename method
  const fileInfo = parser.parseFilename('/test/beans-abc123.md');
  if (!fileInfo) {
    throw new Error('Failed to parse BEANS filename');
  }

  if (fileInfo.id !== 'abc123') {
    throw new Error(`Expected id 'abc123', got '${fileInfo.id}'`);
  }

  // Test isPriorityOne
  const highPriorityBean = {
    id: 'test',
    title: 'Test',
    status: 'todo' as const,
    priority: 1,
    body: 'Test body',
    sourceFile: '/test/beans-test.md'
  };

  if (!parser.isPriorityOne(highPriorityBean)) {
    throw new Error('Expected isPriorityOne to return true for priority 1');
  }

  console.log('    BEANS parser working');
}

/**
 * Test 6: Notification Queue
 */
async function testNotificationQueue(): Promise<void> {
  const { NotificationQueue } = await import('../notify/queue.js');

  // Create queue with default digest interval
  const queue = new NotificationQueue(5);

  // Test enqueue returns an ID
  const notificationId = queue.enqueue({
    type: 'email',
    title: 'Test',
    message: 'Test notification',
    priority: 'high',
    timestamp: new Date()
  });

  if (typeof notificationId !== 'string') {
    throw new Error('Expected enqueue to return string ID');
  }

  // Test status
  const status = queue.getStatus();
  if (status.digestBufferSize !== 1) {
    throw new Error(`Expected digestBufferSize 1, got ${status.digestBufferSize}`);
  }

  // Clean up
  queue.clear();

  console.log('    Notification queue working');
}

/**
 * Test 7: Teams Adaptive Card Builder
 */
async function testTeamsCards(): Promise<void> {
  const { TeamsAdaptiveCardBuilder } = await import('../notify/teams-cards.js');

  const builder = new TeamsAdaptiveCardBuilder();

  // Test with proper email structure
  const card = builder.buildEmailCard({
    id: 'email-1',
    accountId: 'acc-1',
    sender: 'Sender Name',
    senderEmail: 'sender@test.com',
    subject: 'Important Email',
    snippet: 'This is the email snippet.',
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
    ConfigurationError,
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

  await health.runAllChecks();
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
    sampleIntervalMs: 1000,
    thresholds: {
      maxMemoryMB: 100,
      maxCpuPercent: 5,
      warningMemoryMB: 80,
      warningCpuPercent: 4
    }
  });

  const metrics = monitor.getMetrics();

  if (typeof metrics.memoryUsageMB !== 'number') {
    throw new Error('Memory usage not reported');
  }

  if (typeof metrics.cpuUsagePercent !== 'number') {
    throw new Error('CPU usage not reported');
  }

  console.log(`    Resource monitor working (Memory: ${metrics.memoryUsageMB.toFixed(1)}MB)`);
}

/**
 * Test 11: Recovery Manager
 */
async function testRecoveryManager(): Promise<void> {
  const { RecoveryManager } = await import('../core/recovery.js');

  const recovery = new RecoveryManager({
    maxRetries: 3,
    retryDelayMs: 10, // Short delay for testing
    backoffMultiplier: 2,
    maxBackoffMs: 100,
    resetAfterMs: 300000
  });

  // Test failure reporting
  const shouldRetry = await recovery.reportFailure(new Error('Test error'), 'test-context');

  if (!shouldRetry) {
    throw new Error('Expected recovery to allow retry');
  }

  const state = recovery.getState();
  if (state.failureCount !== 1) {
    throw new Error(`Expected failureCount 1, got ${state.failureCount}`);
  }

  // Test success reporting resets state
  recovery.reportSuccess();
  const stateAfterSuccess = recovery.getState();
  if (stateAfterSuccess.failureCount !== 0) {
    throw new Error('Success should reset failure count');
  }

  recovery.shutdown();
  console.log('    Recovery manager working (failure/success tracking verified)');
}

/**
 * Test 12: Metrics Collector
 */
async function testMetricsCollector(): Promise<void> {
  const { MetricsCollector } = await import('../core/metrics.js');

  const metrics = new MetricsCollector();

  // Record some classifications (predicted, actual, isCorrect)
  metrics.recordClassification('high', 'high', true);     // Correct
  metrics.recordClassification('high', 'medium', false);  // Incorrect
  metrics.recordClassification('medium', 'medium', true); // Correct
  metrics.recordClassification('low', 'high', false);     // Incorrect

  const classMetrics = metrics.getClassificationMetrics();

  if (classMetrics.totalClassified !== 4) {
    throw new Error(`Expected 4 total, got ${classMetrics.totalClassified}`);
  }

  // 2 correct out of 4 = 50%
  if (classMetrics.accuracy !== 0.5) {
    throw new Error(`Expected 0.5 accuracy, got ${classMetrics.accuracy}`);
  }

  console.log('    Metrics collector working');
}

/**
 * Test 13: Intent Parser
 */
async function testIntentParser(): Promise<void> {
  const { IntentParser } = await import('../chat/intent-parser.js');

  const parser = new IntentParser();

  // Test email configuration intent - uses 'add_email_account' type
  const emailIntent = parser.parse('I want to set up my email');
  if (emailIntent.type !== 'add_email_account') {
    throw new Error(`Expected add_email_account, got ${emailIntent.type}`);
  }

  // Test notification intent
  const notifyIntent = parser.parse('enable notifications');
  if (notifyIntent.type !== 'configure_notifications') {
    throw new Error(`Expected configure_notifications, got ${notifyIntent.type}`);
  }

  // Test help intent
  const helpIntent = parser.parse('help me');
  if (helpIntent.type !== 'help') {
    throw new Error(`Expected help, got ${helpIntent.type}`);
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
    await runTest('Email Classifier', testEmailClassifier);
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
