class AppError extends Error {
  constructor(message, code, statusCode = 500, details = {}) {
    super(message);
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
    this.name = 'AppError';
  }

  toJSON() {
    return {
      error: this.message,
      code: this.code,
      ...(Object.keys(this.details).length > 0 && { details: this.details })
    };
  }
}

class NetworkError extends AppError {
  constructor(message, details = {}) {
    super(message, 'NETWORK_ERROR', 503, details);
    this.name = 'NetworkError';
  }
}

class TimeoutError extends AppError {
  constructor(message, duration, details = {}) {
    super(
      `${message} (timeout after ${duration}ms)`,
      'REQUEST_TIMEOUT',
      504,
      { timeout_ms: duration, ...details }
    );
    this.name = 'TimeoutError';
  }
}

class ValidationError extends AppError {
  constructor(message, field = null, details = {}) {
    super(message, 'VALIDATION_ERROR', 400, { field, ...details });
    this.name = 'ValidationError';
  }
}

class OllamaError extends AppError {
  constructor(message, statusCode = 503, details = {}) {
    super(message, 'OLLAMA_ERROR', statusCode, details);
    this.name = 'OllamaError';
  }
}

class FileSystemError extends AppError {
  constructor(message, code = 'FS_ERROR', details = {}) {
    super(message, code, 500, details);
    this.name = 'FileSystemError';
  }
}

function classifyError(error) {
  if (error instanceof AppError) {
    return error;
  }

  if (error.name === 'AbortError') {
    return new TimeoutError('Request was aborted', error.timeout || 'unknown');
  }

  if (error.code === 'ECONNREFUSED') {
    return new NetworkError('Connection refused - service may not be running', {
      system_code: error.code,
      address: error.address,
      port: error.port
    });
  }

  if (error.code === 'ENOTFOUND') {
    return new NetworkError('DNS resolution failed', {
      system_code: error.code,
      hostname: error.hostname
    });
  }

  if (error.code === 'ETIMEDOUT') {
    return new TimeoutError('Connection timed out', 'network');
  }

  if (error.code === 'ENOENT') {
    return new FileSystemError(`File or directory not found: ${error.path}`, 'FILE_NOT_FOUND', {
      path: error.path
    });
  }

  if (error.code === 'EACCES') {
    return new FileSystemError(`Permission denied: ${error.path}`, 'PERMISSION_DENIED', {
      path: error.path
    });
  }

  if (error.code === 'EISDIR') {
    return new FileSystemError(`Expected file but found directory: ${error.path}`, 'IS_DIRECTORY', {
      path: error.path
    });
  }

  // Generic error
  return new AppError(
    error.message || 'An unexpected error occurred',
    'INTERNAL_ERROR',
    500,
    { original_error: error.name }
  );
}

function handleExpressError(error, res) {
  const appError = classifyError(error);

  console.error(`[${appError.name}] ${appError.message}`, {
    code: appError.code,
    statusCode: appError.statusCode,
    details: appError.details
  });

  res.status(appError.statusCode).json(appError.toJSON());
}

function handleIPCError(error) {
  const appError = classifyError(error);

  console.error(`[${appError.name}] ${appError.message}`, {
    code: appError.code,
    details: appError.details
  });

  return appError.toJSON();
}

module.exports = {
  AppError,
  NetworkError,
  TimeoutError,
  ValidationError,
  OllamaError,
  FileSystemError,
  classifyError,
  handleExpressError,
  handleIPCError
};
