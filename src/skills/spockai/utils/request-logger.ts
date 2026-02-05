/**
 * SpockAI Request/Response Logger
 * Comprehensive logging for debugging and monitoring
 */

import { coreLogger } from './logger.js';

export interface RequestLogEntry {
  id: string;
  timestamp: Date;
  method: string;
  url: string;
  headers?: Record<string, string>;
  body?: unknown;
  service: string;
}

export interface ResponseLogEntry {
  id: string;
  timestamp: Date;
  statusCode: number;
  headers?: Record<string, string>;
  body?: unknown;
  durationMs: number;
  service: string;
}

export interface RequestLoggerConfig {
  enabled: boolean;
  logHeaders: boolean;
  logBody: boolean;
  maxBodyLength: number;
  sensitiveHeaders: string[];
  sensitiveBodyFields: string[];
}

const DEFAULT_CONFIG: RequestLoggerConfig = {
  enabled: true,
  logHeaders: false,
  logBody: false,
  maxBodyLength: 1000,
  sensitiveHeaders: [
    'authorization',
    'x-api-key',
    'cookie',
    'set-cookie'
  ],
  sensitiveBodyFields: [
    'password',
    'token',
    'secret',
    'apiKey',
    'accessToken',
    'refreshToken',
    'clientSecret'
  ]
};

/**
 * Request/Response Logger
 */
export class RequestLogger {
  private config: RequestLoggerConfig;
  private requestCounter = 0;

  constructor(config: Partial<RequestLoggerConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Generate unique request ID
   */
  generateRequestId(): string {
    this.requestCounter++;
    return `req-${Date.now()}-${this.requestCounter}`;
  }

  /**
   * Log outgoing request
   */
  logRequest(
    service: string,
    method: string,
    url: string,
    options: {
      headers?: Record<string, string>;
      body?: unknown;
      requestId?: string;
    } = {}
  ): string {
    if (!this.config.enabled) {
      return options.requestId || this.generateRequestId();
    }

    const requestId = options.requestId || this.generateRequestId();

    const entry: RequestLogEntry = {
      id: requestId,
      timestamp: new Date(),
      method: method.toUpperCase(),
      url: this.sanitizeUrl(url),
      service
    };

    if (this.config.logHeaders && options.headers) {
      entry.headers = this.sanitizeHeaders(options.headers);
    }

    if (this.config.logBody && options.body) {
      entry.body = this.sanitizeBody(options.body);
    }

    coreLogger.debug('Outgoing request', {
      requestId,
      service,
      method: entry.method,
      url: entry.url,
      ...(entry.headers && { headers: entry.headers }),
      ...(entry.body && { body: entry.body })
    });

    return requestId;
  }

  /**
   * Log incoming response
   */
  logResponse(
    requestId: string,
    service: string,
    statusCode: number,
    startTime: number,
    options: {
      headers?: Record<string, string>;
      body?: unknown;
    } = {}
  ): void {
    if (!this.config.enabled) {
      return;
    }

    const durationMs = Date.now() - startTime;

    const entry: ResponseLogEntry = {
      id: requestId,
      timestamp: new Date(),
      statusCode,
      durationMs,
      service
    };

    if (this.config.logHeaders && options.headers) {
      entry.headers = this.sanitizeHeaders(options.headers);
    }

    if (this.config.logBody && options.body) {
      entry.body = this.sanitizeBody(options.body);
    }

    const logLevel = statusCode >= 400 ? 'warn' : 'debug';

    coreLogger[logLevel]('Response received', {
      requestId,
      service,
      statusCode,
      durationMs,
      ...(entry.headers && { headers: entry.headers }),
      ...(entry.body && { body: entry.body })
    });
  }

  /**
   * Log request error
   */
  logError(
    requestId: string,
    service: string,
    error: Error,
    startTime: number
  ): void {
    if (!this.config.enabled) {
      return;
    }

    const durationMs = Date.now() - startTime;

    coreLogger.error('Request failed', {
      requestId,
      service,
      error: error.message,
      durationMs,
      stack: error.stack
    });
  }

  /**
   * Sanitize URL to remove sensitive query params
   */
  private sanitizeUrl(url: string): string {
    try {
      const parsed = new URL(url);
      const sensitiveParams = ['token', 'key', 'apiKey', 'secret', 'password'];

      for (const param of sensitiveParams) {
        if (parsed.searchParams.has(param)) {
          parsed.searchParams.set(param, '[REDACTED]');
        }
      }

      return parsed.toString();
    } catch {
      return url;
    }
  }

  /**
   * Sanitize headers to hide sensitive values
   */
  private sanitizeHeaders(headers: Record<string, string>): Record<string, string> {
    const sanitized: Record<string, string> = {};

    for (const [key, value] of Object.entries(headers)) {
      const lowerKey = key.toLowerCase();
      if (this.config.sensitiveHeaders.includes(lowerKey)) {
        sanitized[key] = '[REDACTED]';
      } else {
        sanitized[key] = value;
      }
    }

    return sanitized;
  }

  /**
   * Sanitize body to hide sensitive fields
   */
  private sanitizeBody(body: unknown): unknown {
    if (body === null || body === undefined) {
      return body;
    }

    if (typeof body === 'string') {
      if (body.length > this.config.maxBodyLength) {
        return body.substring(0, this.config.maxBodyLength) + '... [TRUNCATED]';
      }
      return body;
    }

    if (Array.isArray(body)) {
      return body.map(item => this.sanitizeBody(item));
    }

    if (typeof body === 'object') {
      const sanitized: Record<string, unknown> = {};

      for (const [key, value] of Object.entries(body as Record<string, unknown>)) {
        if (this.config.sensitiveBodyFields.includes(key)) {
          sanitized[key] = '[REDACTED]';
        } else if (typeof value === 'object' && value !== null) {
          sanitized[key] = this.sanitizeBody(value);
        } else {
          sanitized[key] = value;
        }
      }

      return sanitized;
    }

    return body;
  }

  /**
   * Create a fetch wrapper with automatic logging
   */
  createLoggingFetch(service: string): typeof fetch {
    return async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      const url = typeof input === 'string' ? input : input.toString();
      const method = init?.method || 'GET';
      const startTime = Date.now();

      const requestId = this.logRequest(service, method, url, {
        headers: init?.headers as Record<string, string>,
        body: init?.body
      });

      try {
        const response = await fetch(input, init);

        this.logResponse(requestId, service, response.status, startTime, {
          headers: Object.fromEntries(response.headers.entries())
        });

        return response;
      } catch (error) {
        this.logError(requestId, service, error as Error, startTime);
        throw error;
      }
    };
  }
}

/**
 * Default request logger instance
 */
export const requestLogger = new RequestLogger();

/**
 * Create logging fetch for a service
 */
export function createLoggingFetch(service: string): typeof fetch {
  return requestLogger.createLoggingFetch(service);
}

/**
 * Wrap an async function with request timing
 */
export async function withTiming<T>(
  operation: string,
  fn: () => Promise<T>
): Promise<T> {
  const startTime = Date.now();
  const requestId = requestLogger.generateRequestId();

  coreLogger.debug('Operation started', { requestId, operation });

  try {
    const result = await fn();
    const durationMs = Date.now() - startTime;
    coreLogger.debug('Operation completed', { requestId, operation, durationMs });
    return result;
  } catch (error) {
    const durationMs = Date.now() - startTime;
    coreLogger.error('Operation failed', {
      requestId,
      operation,
      durationMs,
      error: error instanceof Error ? error.message : String(error)
    });
    throw error;
  }
}
