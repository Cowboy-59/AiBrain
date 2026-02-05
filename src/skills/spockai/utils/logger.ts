/**
 * SpockAI Logging Utility
 * Provides structured logging with Pino
 */

import pino from 'pino';
import { join } from 'path';
import { homedir } from 'os';

const LOG_DIR = join(homedir(), '.openclaw', 'logs');

// Determine log level from environment
const LOG_LEVEL = process.env['SPOCKAI_LOG_LEVEL'] || process.env['LOG_LEVEL'] || 'info';

// Create base logger configuration
const baseConfig: pino.LoggerOptions = {
  level: LOG_LEVEL,
  formatters: {
    level: (label) => ({ level: label }),
    bindings: (bindings) => ({
      pid: bindings.pid,
      host: bindings.hostname,
      name: 'spockai'
    })
  },
  timestamp: pino.stdTimeFunctions.isoTime
};

// Create transport configuration based on environment
function createTransport(): pino.TransportMultiOptions | undefined {
  if (process.env['NODE_ENV'] === 'production') {
    // In production, log to file
    return {
      targets: [
        {
          target: 'pino/file',
          options: { destination: join(LOG_DIR, 'spockai.log'), mkdir: true },
          level: 'info'
        },
        {
          target: 'pino/file',
          options: { destination: join(LOG_DIR, 'spockai-error.log'), mkdir: true },
          level: 'error'
        }
      ]
    };
  }

  // In development, use pretty printing
  return {
    targets: [
      {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'SYS:standard',
          ignore: 'pid,hostname'
        },
        level: LOG_LEVEL
      }
    ]
  };
}

// Create the logger instance
const transport = createTransport();
export const logger = transport
  ? pino(baseConfig, pino.transport(transport))
  : pino(baseConfig);

// Child logger factory for specific modules
export function createChildLogger(module: string): pino.Logger {
  return logger.child({ module });
}

// Utility type for log context
export interface LogContext {
  [key: string]: unknown;
}

// Convenience wrapper class for module-specific logging
export class ModuleLogger {
  private childLogger: pino.Logger;

  constructor(module: string) {
    this.childLogger = createChildLogger(module);
  }

  debug(message: string, context?: LogContext): void {
    this.childLogger.debug(context ?? {}, message);
  }

  info(message: string, context?: LogContext): void {
    this.childLogger.info(context ?? {}, message);
  }

  warn(message: string, context?: LogContext): void {
    this.childLogger.warn(context ?? {}, message);
  }

  error(message: string, context?: LogContext): void {
    this.childLogger.error(context ?? {}, message);
  }

  fatal(message: string, context?: LogContext): void {
    this.childLogger.fatal(context ?? {}, message);
  }

  // Create a child logger with additional context
  child(bindings: Record<string, unknown>): pino.Logger {
    return this.childLogger.child(bindings);
  }
}

// Pre-configured loggers for common modules
export const emailLogger = new ModuleLogger('email');
export const calendarLogger = new ModuleLogger('calendar');
export const beansLogger = new ModuleLogger('beans');
export const notifyLogger = new ModuleLogger('notify');
export const servicesLogger = new ModuleLogger('services');
export const chatLogger = new ModuleLogger('chat');
export const configLogger = new ModuleLogger('config');
