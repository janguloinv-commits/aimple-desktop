const path = require('path');
const os = require('os');

// Default configuration values
const defaults = {
  // Backend server
  BACKEND_PORT: 3001,
  BACKEND_HOST: 'localhost',

  // Ollama configuration
  OLLAMA_HOST: 'localhost',
  OLLAMA_PORT: 11434,
  OLLAMA_MODEL: 'orca-mini',
  OLLAMA_TIMEOUT: 600000, // 10 minutes in ms
  OLLAMA_REQUEST_TIMEOUT: 60000, // 60 seconds in ms

  // Paths
  AIMPLE_HOME: path.join(os.homedir(), '.aimple'),
  LOG_LEVEL: 'info',

  // Feature flags
  ENABLE_REMOTE_LOGGING: false,
  ENABLE_ANALYTICS: false,

  // File operations
  MAX_FILE_CONTENT_SIZE: 5000, // characters
  MAX_FOLDER_DEPTH: 5,
  FOLDER_TRAVERSE_BATCH_SIZE: 10,

  // Security
  ENABLE_HTTPS: false,
  SESSION_TIMEOUT: 3600000, // 1 hour in ms

  // Database/Cache
  CACHE_ENABLED: true,
  CACHE_TTL: 5000, // 5 seconds in ms
};

// Load from environment variables
function loadConfig() {
  const config = { ...defaults };

  // Override with environment variables (with type conversion)
  if (process.env.BACKEND_PORT) config.BACKEND_PORT = parseInt(process.env.BACKEND_PORT, 10);
  if (process.env.BACKEND_HOST) config.BACKEND_HOST = process.env.BACKEND_HOST;

  if (process.env.OLLAMA_HOST) config.OLLAMA_HOST = process.env.OLLAMA_HOST;
  if (process.env.OLLAMA_PORT) config.OLLAMA_PORT = parseInt(process.env.OLLAMA_PORT, 10);
  if (process.env.OLLAMA_MODEL) config.OLLAMA_MODEL = process.env.OLLAMA_MODEL;
  if (process.env.OLLAMA_TIMEOUT) config.OLLAMA_TIMEOUT = parseInt(process.env.OLLAMA_TIMEOUT, 10);
  if (process.env.OLLAMA_REQUEST_TIMEOUT) config.OLLAMA_REQUEST_TIMEOUT = parseInt(process.env.OLLAMA_REQUEST_TIMEOUT, 10);

  if (process.env.AIMPLE_HOME) config.AIMPLE_HOME = process.env.AIMPLE_HOME;
  if (process.env.LOG_LEVEL) config.LOG_LEVEL = process.env.LOG_LEVEL;

  if (process.env.ENABLE_REMOTE_LOGGING) config.ENABLE_REMOTE_LOGGING = process.env.ENABLE_REMOTE_LOGGING === 'true';
  if (process.env.ENABLE_ANALYTICS) config.ENABLE_ANALYTICS = process.env.ENABLE_ANALYTICS === 'true';

  if (process.env.MAX_FILE_CONTENT_SIZE) config.MAX_FILE_CONTENT_SIZE = parseInt(process.env.MAX_FILE_CONTENT_SIZE, 10);
  if (process.env.MAX_FOLDER_DEPTH) config.MAX_FOLDER_DEPTH = parseInt(process.env.MAX_FOLDER_DEPTH, 10);
  if (process.env.FOLDER_TRAVERSE_BATCH_SIZE) config.FOLDER_TRAVERSE_BATCH_SIZE = parseInt(process.env.FOLDER_TRAVERSE_BATCH_SIZE, 10);

  if (process.env.ENABLE_HTTPS) config.ENABLE_HTTPS = process.env.ENABLE_HTTPS === 'true';
  if (process.env.SESSION_TIMEOUT) config.SESSION_TIMEOUT = parseInt(process.env.SESSION_TIMEOUT, 10);

  if (process.env.CACHE_ENABLED) config.CACHE_ENABLED = process.env.CACHE_ENABLED === 'true';
  if (process.env.CACHE_TTL) config.CACHE_TTL = parseInt(process.env.CACHE_TTL, 10);

  // Computed properties
  config.BACKEND_URL = `http://${config.BACKEND_HOST}:${config.BACKEND_PORT}`;
  config.OLLAMA_URL = `http://${config.OLLAMA_HOST}:${config.OLLAMA_PORT}`;
  config.LOG_DIR = path.join(config.AIMPLE_HOME, 'logs');
  config.DATA_DIR = path.join(config.AIMPLE_HOME, 'data');

  return config;
}

const config = loadConfig();

// Validation
function validateConfig() {
  const errors = [];

  if (config.BACKEND_PORT < 1 || config.BACKEND_PORT > 65535) {
    errors.push('BACKEND_PORT must be between 1 and 65535');
  }

  if (config.OLLAMA_PORT < 1 || config.OLLAMA_PORT > 65535) {
    errors.push('OLLAMA_PORT must be between 1 and 65535');
  }

  if (!['debug', 'info', 'warn', 'error', 'fatal'].includes(config.LOG_LEVEL)) {
    errors.push('LOG_LEVEL must be one of: debug, info, warn, error, fatal');
  }

  if (config.MAX_FILE_CONTENT_SIZE < 100) {
    errors.push('MAX_FILE_CONTENT_SIZE must be at least 100 characters');
  }

  if (config.MAX_FOLDER_DEPTH < 1 || config.MAX_FOLDER_DEPTH > 50) {
    errors.push('MAX_FOLDER_DEPTH must be between 1 and 50');
  }

  if (errors.length > 0) {
    throw new Error(`Configuration validation failed:\n${errors.join('\n')}`);
  }
}

try {
  validateConfig();
} catch (error) {
  console.error('Configuration error:', error.message);
  process.exit(1);
}

module.exports = config;
