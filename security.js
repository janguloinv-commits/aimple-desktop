const path = require('path');

const ALLOWED_MODELS = ['neural-chat', 'mistral', 'llama2', 'dolphin-mixtral'];
const SUPPORTED_FILE_EXTENSIONS = ['.txt', '.pdf', '.docx', '.md', '.json'];

function validatePath(basePath, requestedPath) {
  try {
    const resolvedBase = path.resolve(basePath);
    const resolvedRequested = path.resolve(basePath, requestedPath);

    if (!resolvedRequested.startsWith(resolvedBase)) {
      throw new Error(`Path traversal attempt detected: ${requestedPath}`);
    }

    return resolvedRequested;
  } catch (error) {
    throw new Error(`Invalid path: ${error.message}`);
  }
}

function isValidModel(model) {
  if (!model || typeof model !== 'string') {
    return false;
  }
  return ALLOWED_MODELS.includes(model.toLowerCase());
}

function sanitizePrompt(prompt) {
  if (!prompt || typeof prompt !== 'string') {
    throw new Error('Prompt must be a non-empty string');
  }

  if (prompt.length > 50000) {
    throw new Error('Prompt exceeds maximum length of 50000 characters');
  }

  return prompt.trim();
}

function validateFolderPath(folderPath) {
  if (!folderPath || typeof folderPath !== 'string') {
    throw new Error('Folder path must be a non-empty string');
  }

  const resolved = path.resolve(folderPath);
  return resolved;
}

function isSupportedFile(filename) {
  const ext = path.extname(filename).toLowerCase();
  return SUPPORTED_FILE_EXTENSIONS.includes(ext);
}

module.exports = {
  validatePath,
  isValidModel,
  sanitizePrompt,
  validateFolderPath,
  isSupportedFile,
  ALLOWED_MODELS,
  SUPPORTED_FILE_EXTENSIONS
};
