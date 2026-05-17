const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const express = require('express');
const cors = require('cors');
const { spawn } = require('child_process');
const { execSync } = require('child_process');

let mainWindow;
let expressApp = null;
let server = null;
const BACKEND_PORT = 3001;
const BACKEND_URL = `http://localhost:${BACKEND_PORT}`;
const MODEL = 'orca-mini';
const OLLAMA_URL = 'http://localhost:11434';

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

// Función para explorar carpetas recursivamente
function exploreFolderStructure(folderPath, maxDepth = 5, currentDepth = 0) {
  if (currentDepth >= maxDepth) {
    return { name: path.basename(folderPath), type: 'folder', path: folderPath, children: [] };
  }

  try {
    const files = fs.readdirSync(folderPath);
    const structure = {
      name: path.basename(folderPath),
      type: 'folder',
      path: folderPath,
      children: [],
    };

    for (const file of files) {
      if (file.startsWith('.')) continue; // Skip hidden files

      const filePath = path.join(folderPath, file);
      const stat = fs.statSync(filePath);

      if (stat.isDirectory()) {
        structure.children.push(exploreFolderStructure(filePath, maxDepth, currentDepth + 1));
      } else {
        structure.children.push({
          name: file,
          type: 'file',
          path: filePath,
          size: stat.size,
          extension: path.extname(file),
        });
      }
    }

    return structure;
  } catch (error) {
    console.error('Error exploring folder:', error);
    return { name: path.basename(folderPath), type: 'folder', path: folderPath, children: [], error: error.message };
  }
}

// Función para leer archivos soportados
function readFilesFromFolder(folderPath) {
  const supportedExtensions = ['.pdf', '.txt', '.docx', '.doc', '.xlsx', '.xls', '.md', '.json', '.csv'];
  const files = [];

  function walkDir(dir) {
    try {
      const items = fs.readdirSync(dir);
      for (const item of items) {
        if (item.startsWith('.')) continue;

        const filePath = path.join(dir, item);
        const stat = fs.statSync(filePath);

        if (stat.isDirectory()) {
          walkDir(filePath);
        } else {
          const ext = path.extname(filePath).toLowerCase();
          if (supportedExtensions.includes(ext)) {
            try {
              const content = fs.readFileSync(filePath, 'utf-8');
              files.push({
                path: filePath,
                name: item,
                content: content.substring(0, 5000), // Limit size
              });
            } catch (e) {
              console.log(`Could not read ${filePath}:`, e.message);
            }
          }
        }
      }
    } catch (error) {
      console.error('Error walking directory:', error);
    }
  }

  walkDir(folderPath);
  return files;
}

// Check if Ollama is running
async function isOllamaRunning() {
  try {
    const response = await fetch(`${OLLAMA_URL}/api/tags`, { timeout: 2000 });
    return response.ok;
  } catch {
    return false;
  }
}

// Start Ollama if not running
async function startOllama() {
  if (await isOllamaRunning()) {
    console.log('✅ Ollama already running');
    return true;
  }

  console.log('🚀 Starting Ollama...');
  try {
    // Try to find Ollama
    try {
      execSync('which ollama', { stdio: 'ignore' });
    } catch {
      // Ollama not found, try to install it
      console.log('📦 Installing Ollama automatically...');

      const homeDir = os.homedir();
      const ollamaDir = path.join(homeDir, '.aimple', 'ollama');
      const ollamaPath = path.join(ollamaDir, 'ollama');

      // Check if we already downloaded it
      if (!fs.existsSync(ollamaPath)) {
        try {
          // Create directory
          if (!fs.existsSync(ollamaDir)) {
            fs.mkdirSync(ollamaDir, { recursive: true });
          }

          // Download Ollama for Mac
          console.log('⬇️ Downloading Ollama (this may take a moment)...');
          const downloadUrl = 'https://ollama.ai/download/Ollama-darwin.zip';

          // Use curl to download (built-in on macOS)
          execSync(`curl -L -o /tmp/ollama.zip ${downloadUrl}`, { stdio: 'inherit' });

          // Extract
          console.log('📦 Extracting Ollama...');
          execSync(`unzip -q -o /tmp/ollama.zip -d /tmp/`, { stdio: 'inherit' });

          // Move to .aimple directory
          execSync(`mv /tmp/Ollama.app/Contents/MacOS/ollama ${ollamaPath}`, { stdio: 'inherit' });
          execSync(`chmod +x ${ollamaPath}`, { stdio: 'inherit' });

          console.log('✅ Ollama installed');
        } catch (error) {
          console.error('Failed to auto-install Ollama:', error.message);
          return false;
        }
      }

      // Add to PATH
      process.env.PATH = `${ollamaDir}:${process.env.PATH}`;
    }

    // Start Ollama
    const ollamaProcess = spawn('ollama', ['serve'], {
      detached: true,
      stdio: 'ignore',
    });
    ollamaProcess.unref();

    // Wait for Ollama to start
    for (let i = 0; i < 30; i++) {
      if (await isOllamaRunning()) {
        console.log('✅ Ollama ready');
        return true;
      }
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  } catch (error) {
    console.error('❌ Error with Ollama:', error.message);
    return false;
  }
  return false;
}

// Ensure model exists
async function ensureModel() {
  try {
    const response = await fetch(`${OLLAMA_URL}/api/tags`);
    const data = await response.json();
    const hasModel = data.models?.some((m) => m.name.startsWith(MODEL));

    if (!hasModel) {
      console.log(`📦 Downloading ${MODEL} model (first time)...`);
      await fetch(`${OLLAMA_URL}/api/pull`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: MODEL, stream: false }),
      });
    }
    return true;
  } catch (error) {
    console.error('Error with model:', error.message);
    return false;
  }
}

// Setup Express endpoints
function setupExpressEndpoints(app) {
  app.post('/api/query', async (req, res) => {
    try {
      const { question, files } = req.body;

      if (!question) {
        return res.status(400).json({ error: 'Question is required' });
      }

      if (!files || files.length === 0) {
        return res.status(400).json({ error: 'No files provided' });
      }

      // Build context from files
      const context = files
        .map((file) => `[${file.path}]\n${file.content}`)
        .join('\n\n---\n\n');

      // Call Ollama
      const response = await fetch(`${OLLAMA_URL}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: MODEL,
          prompt: `You are an expert deal analyst for PE/VC funds. Analyze the provided documents and answer questions about deals, operations, and investments. Be specific and cite your sources.

Documents:
${context}

Question: ${question}

Answer:`,
          stream: false,
        }),
      });

      if (!response.ok) {
        throw new Error(`Ollama error: ${response.statusText}`);
      }

      const data = await response.json();

      res.json({
        answer: data.response || 'No response',
        filesAnalyzed: files.length,
        model: MODEL,
      });
    } catch (error) {
      console.error('Error:', error);
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
  const structure = exploreFolderStructure(folderPath);

  return {
    path: folderPath,
    structure: structure,
  };
});

ipcMain.handle('query-claude', async (event, { question, folderPath }) => {
  try {
    const files = readFilesFromFolder(folderPath);

    if (files.length === 0) {
      return {
        error: 'No supported files found in folder. Supported: PDF, TXT, DOCX, XLSX, MD, JSON, CSV',
      };
    }

    // Send request to backend API
    const response = await fetch(`${BACKEND_URL}/api/query`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        question,
        files,
      }),
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
  } catch (error) {
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
  const ollamaOk = await startOllama();
  if (!ollamaOk) {
    console.error('❌ Ollama not available. Install from https://ollama.ai');
    mainWindow?.destroy();
    app.quit();
    return;
  }

  // Ensure model
  await ensureModel();

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
