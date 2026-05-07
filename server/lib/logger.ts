type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const MIN_LEVEL: LogLevel = ((): LogLevel => {
  const env = (process.env.LOG_LEVEL || '').toLowerCase();
  if (env in LEVEL_PRIORITY) return env as LogLevel;
  return process.env.NODE_ENV === 'production' ? 'info' : 'debug';
})();

function formatTimestamp(): string {
  return new Date().toISOString();
}

function formatHuman(level: LogLevel, module: string, message: string, context?: Record<string, unknown>): string {
  const ts = formatTimestamp();
  const levelStr = level.toUpperCase().padEnd(5);
  const ctx = context && Object.keys(context).length ? ' ' + JSON.stringify(context) : '';
  return `${ts} [${levelStr}] [${module}] ${message}${ctx}`;
}

function formatJson(level: LogLevel, module: string, message: string, context?: Record<string, unknown>): string {
  const entry: Record<string, unknown> = {
    timestamp: formatTimestamp(),
    level,
    module,
    message,
  };
  if (context) {
    for (const [key, value] of Object.entries(context)) {
      entry[key] = value;
    }
  }
  return JSON.stringify(entry);
}

function shouldLog(level: LogLevel): boolean {
  return LEVEL_PRIORITY[level] >= LEVEL_PRIORITY[MIN_LEVEL];
}

function output(level: LogLevel, module: string, message: string, context?: Record<string, unknown>) {
  if (!shouldLog(level)) return;

  const isProd = process.env.NODE_ENV === 'production';
  const line = isProd
    ? formatJson(level, module, message, context)
    : formatHuman(level, module, message, context);

  // ERROR is always synchronous — never lose crash data
  if (level === 'error') {
    process.stderr.write(line + '\n');
    return;
  }

  // Other levels: async-safe via setImmediate to avoid blocking hot paths
  setImmediate(() => {
    const stream = level === 'warn' ? process.stderr : process.stdout;
    stream.write(line + '\n');
  });
}

const REDACTED_KEYS = new Set([
  'password', 'token', 'secret', 'authorization', 'cookie',
  'api_key', 'apikey', 'access_token', 'refresh_token',
  'jwt', 'session_id', 'credit_card', 'cvv',
]);

function redactSensitive(context?: Record<string, unknown>): Record<string, unknown> | undefined {
  if (!context) return undefined;
  const cleaned: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(context)) {
    cleaned[key] = REDACTED_KEYS.has(key.toLowerCase()) ? '[REDACTED]' : value;
  }
  return cleaned;
}

export interface Logger {
  debug(message: string, context?: Record<string, unknown>): void;
  info(message: string, context?: Record<string, unknown>): void;
  warn(message: string, context?: Record<string, unknown>): void;
  error(message: string, context?: Record<string, unknown>): void;
  child(module: string): Logger;
}

export function createLogger(module: string): Logger {
  return {
    debug(message: string, context?: Record<string, unknown>) {
      output('debug', module, message, redactSensitive(context));
    },
    info(message: string, context?: Record<string, unknown>) {
      output('info', module, message, redactSensitive(context));
    },
    warn(message: string, context?: Record<string, unknown>) {
      output('warn', module, message, redactSensitive(context));
    },
    error(message: string, context?: Record<string, unknown>) {
      output('error', module, message, redactSensitive(context));
    },
    child(childModule: string) {
      return createLogger(`${module}:${childModule}`);
    },
  };
}

// Attach request ID to logger context for correlation
export function withRequestId(logger: Logger, requestId: string): Logger {
  return {
    debug(message: string, context?: Record<string, unknown>) {
      logger.debug(message, { requestId, ...context });
    },
    info(message: string, context?: Record<string, unknown>) {
      logger.info(message, { requestId, ...context });
    },
    warn(message: string, context?: Record<string, unknown>) {
      logger.warn(message, { requestId, ...context });
    },
    error(message: string, context?: Record<string, unknown>) {
      logger.error(message, { requestId, ...context });
    },
    child(module: string) {
      return withRequestId(logger.child(module), requestId);
    },
  };
}
