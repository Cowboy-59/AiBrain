/**
 * SpockAI Error Handling
 * Comprehensive error types and handling utilities
 */

import { coreLogger } from './logger.js';

/**
 * Base SpockAI error class
 */
export class SpockAIError extends Error {
  public readonly code: string;
  public readonly context?: Record<string, unknown>;
  public readonly recoverable: boolean;
  public readonly timestamp: Date;

  constructor(
    message: string,
    code: string,
    options: {
      cause?: Error;
      context?: Record<string, unknown>;
      recoverable?: boolean;
    } = {}
  ) {
    super(message, { cause: options.cause });
    this.name = 'SpockAIError';
    this.code = code;
    this.context = options.context;
    this.recoverable = options.recoverable ?? true;
    this.timestamp = new Date();

    // Capture stack trace
    Error.captureStackTrace(this, this.constructor);
  }

  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      context: this.context,
      recoverable: this.recoverable,
      timestamp: this.timestamp.toISOString(),
      stack: this.stack
    };
  }
}

/**
 * Configuration errors
 */
export class ConfigurationError extends SpockAIError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, 'CONFIG_ERROR', { context, recoverable: false });
    this.name = 'ConfigurationError';
  }
}

/**
 * Authentication errors
 */
export class AuthenticationError extends SpockAIError {
  constructor(message: string, provider: string, cause?: Error) {
    super(message, 'AUTH_ERROR', {
      cause,
      context: { provider },
      recoverable: true
    });
    this.name = 'AuthenticationError';
  }
}

/**
 * API errors (external service failures)
 */
export class APIError extends SpockAIError {
  public readonly statusCode?: number;
  public readonly service: string;

  constructor(
    message: string,
    service: string,
    options: {
      statusCode?: number;
      cause?: Error;
      context?: Record<string, unknown>;
    } = {}
  ) {
    super(message, 'API_ERROR', {
      cause: options.cause,
      context: { service, statusCode: options.statusCode, ...options.context },
      recoverable: isRecoverableStatusCode(options.statusCode)
    });
    this.name = 'APIError';
    this.statusCode = options.statusCode;
    this.service = service;
  }
}

/**
 * Rate limit errors
 */
export class RateLimitError extends SpockAIError {
  public readonly retryAfterMs: number;

  constructor(service: string, retryAfterMs: number) {
    super(`Rate limit exceeded for ${service}`, 'RATE_LIMIT', {
      context: { service, retryAfterMs },
      recoverable: true
    });
    this.name = 'RateLimitError';
    this.retryAfterMs = retryAfterMs;
  }
}

/**
 * Validation errors
 */
export class ValidationError extends SpockAIError {
  public readonly field?: string;
  public readonly value?: unknown;

  constructor(message: string, field?: string, value?: unknown) {
    super(message, 'VALIDATION_ERROR', {
      context: { field, value },
      recoverable: false
    });
    this.name = 'ValidationError';
    this.field = field;
    this.value = value;
  }
}

/**
 * Timeout errors
 */
export class TimeoutError extends SpockAIError {
  public readonly operation: string;
  public readonly timeoutMs: number;

  constructor(operation: string, timeoutMs: number) {
    super(`Operation '${operation}' timed out after ${timeoutMs}ms`, 'TIMEOUT', {
      context: { operation, timeoutMs },
      recoverable: true
    });
    this.name = 'TimeoutError';
    this.operation = operation;
    this.timeoutMs = timeoutMs;
  }
}

/**
 * Resource not found errors
 */
export class NotFoundError extends SpockAIError {
  public readonly resource: string;
  public readonly id?: string;

  constructor(resource: string, id?: string) {
    super(id ? `${resource} not found: ${id}` : `${resource} not found`, 'NOT_FOUND', {
      context: { resource, id },
      recoverable: false
    });
    this.name = 'NotFoundError';
    this.resource = resource;
    this.id = id;
  }
}

/**
 * Network errors
 */
export class NetworkError extends SpockAIError {
  constructor(message: string, cause?: Error) {
    super(message, 'NETWORK_ERROR', {
      cause,
      recoverable: true
    });
    this.name = 'NetworkError';
  }
}

/**
 * Check if HTTP status code is recoverable
 */
function isRecoverableStatusCode(statusCode?: number): boolean {
  if (!statusCode) return true;
  // 4xx except 429 (rate limit) are not recoverable
  // 5xx are recoverable (server issues)
  if (statusCode >= 400 && statusCode < 500 && statusCode !== 429) {
    return false;
  }
  return true;
}

/**
 * Wrap an async function with error handling
 */
export async function withErrorHandling<T>(
  fn: () => Promise<T>,
  context: string
): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    if (error instanceof SpockAIError) {
      coreLogger.error(`${context}: ${error.message}`, error.toJSON());
      throw error;
    }

    const wrapped = new SpockAIError(
      error instanceof Error ? error.message : String(error),
      'UNKNOWN_ERROR',
      {
        cause: error instanceof Error ? error : undefined,
        context: { operation: context }
      }
    );
    coreLogger.error(`${context}: ${wrapped.message}`, wrapped.toJSON());
    throw wrapped;
  }
}

/**
 * Create error handler for specific service
 */
export function createServiceErrorHandler(serviceName: string) {
  return function handleError(error: unknown): never {
    if (error instanceof SpockAIError) {
      throw error;
    }

    if (error instanceof Error) {
      // Check for common error patterns
      if (error.message.includes('ENOTFOUND') || error.message.includes('ECONNREFUSED')) {
        throw new NetworkError(`Failed to connect to ${serviceName}`, error);
      }
      if (error.message.includes('timeout')) {
        throw new TimeoutError(serviceName, 30000);
      }
      if (error.message.includes('401') || error.message.includes('unauthorized')) {
        throw new AuthenticationError(`Authentication failed for ${serviceName}`, serviceName, error);
      }
      if (error.message.includes('429')) {
        throw new RateLimitError(serviceName, 60000);
      }

      throw new APIError(error.message, serviceName, { cause: error });
    }

    throw new APIError(String(error), serviceName);
  };
}

/**
 * Format error for user display
 */
export function formatErrorForUser(error: unknown): string {
  if (error instanceof SpockAIError) {
    switch (error.code) {
      case 'AUTH_ERROR':
        return `Authentication failed. Please check your credentials for ${(error.context as Record<string, unknown>)?.provider || 'the service'}.`;
      case 'RATE_LIMIT':
        return `Rate limit reached. Please wait a moment and try again.`;
      case 'NETWORK_ERROR':
        return `Network error. Please check your internet connection.`;
      case 'CONFIG_ERROR':
        return `Configuration error: ${error.message}`;
      case 'VALIDATION_ERROR':
        return `Invalid input: ${error.message}`;
      case 'NOT_FOUND':
        return error.message;
      case 'TIMEOUT':
        return `Request timed out. Please try again.`;
      default:
        return `An error occurred: ${error.message}`;
    }
  }

  if (error instanceof Error) {
    return `An error occurred: ${error.message}`;
  }

  return 'An unexpected error occurred.';
}

/**
 * Check if error is transient (worth retrying)
 */
export function isTransientError(error: unknown): boolean {
  if (error instanceof SpockAIError) {
    return error.recoverable;
  }
  return true; // Assume unknown errors might be transient
}

/**
 * Extract retry delay from error
 */
export function getRetryDelay(error: unknown): number {
  if (error instanceof RateLimitError) {
    return error.retryAfterMs;
  }
  if (error instanceof TimeoutError) {
    return 5000; // 5 seconds for timeout
  }
  return 1000; // Default 1 second
}
