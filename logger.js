const fs = require('fs');
const path = require('path');
const os = require('os');

class Logger {
  constructor(logFile = null) {
    this.logFile = logFile;
    this.logLevel = process.env.LOG_LEVEL || 'info';
    this.levels = {
      debug: 0,
      info: 1,
      warn: 2,
      error: 3,
      fatal: 4
    };
    this.currentLevel = this.levels[this.logLevel];

    if (this.logFile) {
      const logDir = path.dirname(this.logFile);
      if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir, { recursive: true });
      }
    }
  }

  formatTimestamp() {
    return new Date().toISOString();
  }

  formatLog(level, message, data = {}) {
    const timestamp = this.formatTimestamp();
    return JSON.stringify({
      timestamp,
      level: level.toUpperCase(),
      message,
      ...data
    });
  }

  write(logLine) {
    console.log(logLine);
    if (this.logFile) {
      try {
        fs.appendFileSync(this.logFile, logLine + '\n');
      } catch (error) {
        console.error('Failed to write to log file:', error.message);
      }
    }
  }

  shouldLog(level) {
    return this.levels[level] >= this.currentLevel;
  }

  debug(message, data) {
    if (this.shouldLog('debug')) {
      this.write(this.formatLog('debug', message, data));
    }
  }

  info(message, data) {
    if (this.shouldLog('info')) {
      this.write(this.formatLog('info', message, data));
    }
  }

  warn(message, data) {
    if (this.shouldLog('warn')) {
      this.write(this.formatLog('warn', message, data));
    }
  }

  error(message, error = null, data = {}) {
    if (this.shouldLog('error')) {
      const errorData = error ? {
        error_name: error.name || 'Error',
        error_message: error.message,
        error_stack: error.stack,
        error_code: error.code
      } : {};
      this.write(this.formatLog('error', message, { ...errorData, ...data }));
    }
  }

  fatal(message, error = null, data = {}) {
    const errorData = error ? {
      error_name: error.name || 'Error',
      error_message: error.message,
      error_stack: error.stack,
      error_code: error.code
    } : {};
    this.write(this.formatLog('fatal', message, { ...errorData, ...data }));
  }

  // Structured logging methods for specific events
  logStartup(version) {
    this.info('Application startup', { version, platform: process.platform, node_version: process.version });
  }

  logShutdown() {
    this.info('Application shutdown', { uptime: process.uptime() });
  }

  logRequestStart(method, path, ip = 'unknown') {
    this.debug(`${method} ${path}`, { ip, type: 'request_start' });
  }

  logRequestEnd(method, path, statusCode, duration) {
    this.info(`${method} ${path} ${statusCode}`, { status: statusCode, duration_ms: duration, type: 'request_end' });
  }

  logOllamaEvent(event, data = {}) {
    this.info(`Ollama: ${event}`, { component: 'ollama', ...data });
  }

  logSecurityEvent(event, data = {}) {
    this.warn(`Security: ${event}`, { component: 'security', ...data });
  }

  logDatabaseOperation(operation, duration, success = true, details = {}) {
    const level = success ? 'debug' : 'warn';
    this[level](`Database: ${operation}`, {
      operation,
      duration_ms: duration,
      success,
      ...details
    });
  }
}

// Create a singleton instance
const logDir = path.join(os.homedir(), '.aimple', 'logs');
const logFile = path.join(logDir, `aimple-${new Date().toISOString().split('T')[0]}.log`);
const logger = new Logger(logFile);

module.exports = logger;
