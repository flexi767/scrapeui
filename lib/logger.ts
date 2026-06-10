// Structured leveled logger. Adoption is incremental — remaining console.* sites
// across the codebase should migrate to this module over time.

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface Logger {
  debug(message: string, ...args: unknown[]): void;
  info(message: string, ...args: unknown[]): void;
  warn(message: string, ...args: unknown[]): void;
  error(message: string, ...args: unknown[]): void;
  /** Returns a new logger that prepends [scope] to every message. */
  child(scope: string): Logger;
}

function formatPrefix(level: LogLevel, scope?: string): string {
  const ts = new Date().toISOString();
  return scope ? `[${ts}] [${level.toUpperCase()}] [${scope}]` : `[${ts}] [${level.toUpperCase()}]`;
}

function createLogger(scope?: string): Logger {
  return {
    debug(message, ...args) {
      console.debug(formatPrefix('debug', scope), message, ...args);
    },
    info(message, ...args) {
      console.info(formatPrefix('info', scope), message, ...args);
    },
    warn(message, ...args) {
      console.warn(formatPrefix('warn', scope), message, ...args);
    },
    error(message, ...args) {
      console.error(formatPrefix('error', scope), message, ...args);
    },
    child(childScope) {
      return createLogger(scope ? `${scope}:${childScope}` : childScope);
    },
  };
}

/** Root logger — use .child(scope) to add a named scope. */
export const logger: Logger = createLogger();
