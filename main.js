const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const express = require('express');
const cors = require('cors');
const { spawn } = require('child_process');
const { execSync } = require('child_process');
const security = require('./security');
const OllamaManager = require('./ollama-manager');

let mainWindow;
let expressApp = null;
let server = null;
const BACKEND_PORT = 3001;
const BACKEND_URL = `http://localhost:${BACKEND_PORT}`;
const MODEL = 'orca-mini';
const ollamaManager = new OllamaManager();

// Create Express app for serving API
function createExpressApp() {
  const app = express();
  app.use(cors());
  app.use(express.json({ limit: '50mb' }));

  // Health check
  app.get('/health', (req, res) => {
    res.json({ status: 'ok', service: 'aimple' });
  });

  return app;
}

// Explore folder structure asynchronously to prevent UI blocking
async function exploreFolderStructure(folderPath, maxDepth = 5, currentDepth = 0) {
  if (currentDepth >= maxDepth) {
    return { name: path.basename(folderPath), type: 'folder', path: folderPath, children: [] };
  }

  try {
    const files = await fs.promises.readdir(folderPath);
    const structure = {
      name: path.basename(folderPath),
      type: 'folder',
      path: folderPath,
      children: [],
    };

    // Process files in parallel batches to improve performance
    const batchSize = 10;
    for (let i = 0; i < files.length; i += batchSize) {
      const batch = files.slice(i, i + batchSize);
      const results = await Promise.all(batch.map(async (file) => {
        try {
          if (file.startsWith('.')) return null; // Skip hidden files

          const filePath = path.join(folderPath, file);
          const stat = await fs.promises.stat(filePath);

          if (stat.isDirectory()) {
            return await exploreFolderStructure(filePath, maxDepth, currentDepth + 1);
          } else {
            return {
              name: file,
              type: 'file',
              path: filePath,
              size: stat.size,
              extension: path.extname(file),
            };
          }
        } catch (error) {
          console.error(`Error processing ${file}:`, error.message);
          return null;
        }
      }));

      structure.children.push(...results.filter(r => r !== null));
    }

    return structure;
  } catch (error) {
    console.error('Error exploring folder:', error);
    return { name: path.basename(folderPath), type: 'folder', path: folderPath, children: [], error: error.message };
  }
}

// Read files from folder asynchronously with security validation
async function readFilesFromFolder(folderPath) {
  const files = [];

  try {
    const validatedPath = security.validateFolderPath(folderPath);

    async function walkDir(dir) {
      try {
        const items = await fs.promises.readdir(dir);

        // Process files in parallel batches for efficiency
        const batchSize = 10;
        for (let i = 0; i < items.length; i += batchSize) {
          const batch = items.slice(i, i + batchSize);
          const results = await Promise.all(batch.map(async (item) => {
            try {
              if (item.startsWith('.')) return null;

              const filePath = path.join(dir, item);

              // Validate path to prevent traversal attacks
              try {
                security.validatePath(validatedPath, path.relative(validatedPath, filePath));
              } catch (error) {
                console.error(`Security: Skipping invalid path ${filePath}:`, error.message);
                return null;
              }

              const stat = await fs.promises.stat(filePath);

              if (stat.isDirectory()) {
                // Recursively walk subdirectories
                await walkDir(filePath);
                return null;
              } else if (security.isSupportedFile(filePath)) {
                try {
                  const content = await fs.promises.readFile(filePath, 'utf-8');
                  return {
                    path: filePath,
                    name: item,
                    content: content.substring(0, 5000),
                  };
                } catch (e) {
                  console.log(`Could not read ${filePath}:`, e.message);
                  return null;
                }
              }
            } catch (error) {
              console.error(`Error processing ${item}:`, error.message);
              return null;
            }
            return null;
          }));

          files.push(...results.filter(r => r !== null));
        }
      } catch (error) {
        console.error('Error walking directory:', error);
      }
    }

    await walkDir(validatedPath);
    return files;
  } catch (error) {
    console.error('Invalid folder path:', error.message);
    return [];
  }
}

// Removed - now using OllamaManager class for secure Ollama operations

// Setup Express endpoints with input validation
function setupExpressEndpoints(app) {
  app.post('/api/query', async (req, res) => {
    try {
      const { question, files, model = MODEL } = req.body;

      // Validate question
      if (!question) {
        return res.status(400).json({ error: 'Question is required' });
      }

      let sanitizedQuestion;
      try {
        sanitizedQuestion = security.sanitizePrompt(question);
      } catch (error) {
        return res.status(400).json({ error: error.message });
      }

      // Validate model if provided
      if (!security.isValidModel(model)) {
        return res.status(400).json({
          error: `Invalid model. Allowed models: ${security.ALLOWED_MODELS.join(', ')}`
        });
      }

      // Validate files
      if (!files || !Array.isArray(files) || files.length === 0) {
        return res.status(400).json({ error: 'No files provided' });
      }

      // Build context from files
      const context = files
        .map((file) => `[${file.path}]\n${file.content}`)
        .join('\n\n---\n\n');

      // Call Ollama with timeout
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 60000); // 60 second timeout

      try {
        const response = await fetch(`${ollamaManager.ollamaUrl}/api/generate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: model.toLowerCase(),
            prompt: `You are an expert deal analyst for PE/VC funds. Analyze the provided documents and answer questions about deals, operations, and investments. Be specific and cite your sources.

Documents:
${context}

Question: ${sanitizedQuestion}

Answer:`,
            stream: false,
          }),
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(`Ollama error: ${response.statusText}`);
        }

        const data = await response.json();

        res.json({
          answer: data.response || 'No response',
          filesAnalyzed: files.length,
          model: model.toLowerCase(),
        });
      } finally {
        clearTimeout(timeout);
      }
    } catch (error) {
      console.error('Query error:', error);

      // Differentiate error types
      if (error.name === 'AbortError') {
        return res.status(504).json({
          error: 'Request timeout - Ollama took too long to respond',
        });
      }

      res.status(500).json({
        error: error.message || 'Failed to process query',
      });
    }
  });
}

// IPC Handlers
ipcMain.handle('check-backend', async () => {
  try {
    const response = await fetch(`${BACKEND_URL}/health`, { timeout: 2000 });
    return response.ok;
  } catch {
    return false;
  }
});

ipcMain.handle('select-folder', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory'],
    title: 'Select Folder with Deal Documents',
  });

  if (result.canceled) {
    return null;
  }

  const folderPath = result.filePaths[0];
  const structure = await exploreFolderStructure(folderPath);

  return {
    path: folderPath,
    structure: structure,
  };
});

ipcMain.handle('query-claude', async (event, { question, folderPath }) => {
  try {
    // Validate inputs
    if (!question) {
      return { error: 'Question is required' };
    }

    try {
      security.sanitizePrompt(question);
    } catch (error) {
      return { error: error.message };
    }

    if (!folderPath) {
      return { error: 'Folder path is required' };
    }

    try {
      security.validateFolderPath(folderPath);
    } catch (error) {
      return { error: 'Invalid folder path' };
    }

    const files = await readFilesFromFolder(folderPath);

    if (files.length === 0) {
      return {
        error: `No supported files found in folder. Supported: ${security.SUPPORTED_FILE_EXTENSIONS.join(', ')}`,
      };
    }

    // Send request to backend API with timeout
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 120000); // 120 second timeout

    try {
      const response = await fetch(`${BACKEND_URL}/api/query`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          question,
          files,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorData = await response.json();
        return {
          error: errorData.error || `Server error: ${response.status}`,
        };
      }

      const data = await response.json();
      return {
        answer: data.answer,
        filesAnalyzed: data.filesAnalyzed,
      };
    } finally {
      clearTimeout(timeout);
    }
  } catch (error) {
    if (error.name === 'AbortError') {
      return { error: 'Request timeout - took too long to process' };
    }
    return {
      error: error.message || 'Failed to connect to backend server',
    };
  }
});

function startExpressServer() {
  return new Promise((resolve) => {
    expressApp = createExpressApp();
    setupExpressEndpoints(expressApp);

    server = expressApp.listen(BACKEND_PORT, () => {
      console.log(`✅ Backend ready on ${BACKEND_URL}`);
      resolve();
    });
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  mainWindow.loadFile('index.html');
  // mainWindow.webDevTools.openDevTools();
}

app.on('ready', async () => {
  console.log('🔄 Initializing AImple...');

  // Start Express server
  await startExpressServer();

  // Start Ollama
  const ollamaOk = await ollamaManager.start();
  if (!ollamaOk) {
    console.error('❌ Ollama not available. Install from https://ollama.ai');
    mainWindow?.destroy();
    app.quit();
    return;
  }

  // Ensure model
  await ollamaManager.ensureModel(MODEL);

  // Create window
  createWindow();
  console.log('✅ AImple ready!');
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});
