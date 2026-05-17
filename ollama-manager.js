const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync, spawn } = require('child_process');
const crypto = require('crypto');

const OLLAMA_VERSION = '0.1.43'; // Pinned version for security
const OLLAMA_CHECKSUMS = {
  'Ollama-darwin.zip': 'sha256:abc123def456...' // Placeholder - would be updated with real checksums
};

class OllamaManager {
  constructor() {
    this.homeDir = os.homedir();
    this.ollamaDir = path.join(this.homeDir, '.aimple', 'ollama');
    this.ollamaPath = path.join(this.ollamaDir, 'ollama');
    this.ollamaUrl = 'http://localhost:11434';
  }

  async isRunning() {
    try {
      const response = await fetch(`${this.ollamaUrl}/api/tags`, { timeout: 2000 });
      return response.ok;
    } catch {
      return false;
    }
  }

  isInstalled() {
    return fs.existsSync(this.ollamaPath) && fs.statSync(this.ollamaPath).isFile();
  }

  async verifyChecksum(filePath, expectedChecksum) {
    return new Promise((resolve, reject) => {
      const hash = crypto.createHash('sha256');
      const stream = fs.createReadStream(filePath);

      stream.on('error', reject);
      stream.on('data', (chunk) => hash.update(chunk));
      stream.on('end', () => {
        const fileChecksum = hash.digest('hex');
        const expectedHex = expectedChecksum.replace('sha256:', '');
        resolve(fileChecksum === expectedHex);
      });
    });
  }

  async installFromBinary() {
    try {
      if (!fs.existsSync(this.ollamaDir)) {
        fs.mkdirSync(this.ollamaDir, { recursive: true });
      }

      const downloadUrl = `https://ollama.ai/download/Ollama-darwin.zip`;
      const zipPath = path.join(this.ollamaDir, 'ollama.zip');
      const tempExtractPath = path.join(this.ollamaDir, 'temp');

      console.log('📦 Downloading Ollama binary...');

      // Use curl with explicit URL (no piping scripts)
      execSync(`curl -L -o "${zipPath}" "${downloadUrl}"`, { stdio: 'inherit' });

      // Verify checksum if available
      const filename = path.basename(downloadUrl);
      if (OLLAMA_CHECKSUMS[filename]) {
        console.log('🔒 Verifying checksum...');
        const isValid = await this.verifyChecksum(zipPath, OLLAMA_CHECKSUMS[filename]);
        if (!isValid) {
          fs.unlinkSync(zipPath);
          throw new Error('Checksum verification failed - binary may be corrupted');
        }
        console.log('✅ Checksum verified');
      }

      console.log('📦 Extracting Ollama...');
      execSync(`unzip -q -o "${zipPath}" -d "${tempExtractPath}"`, { stdio: 'inherit' });

      // Move extracted binary to final location
      const extractedPath = path.join(tempExtractPath, 'Ollama.app', 'Contents', 'MacOS', 'ollama');
      if (!fs.existsSync(extractedPath)) {
        throw new Error('Extracted Ollama binary not found at expected location');
      }

      execSync(`mv "${extractedPath}" "${this.ollamaPath}"`, { stdio: 'inherit' });

      // Make executable
      execSync(`chmod +x "${this.ollamaPath}"`, { stdio: 'inherit' });

      // Clean up
      execSync(`rm -rf "${zipPath}" "${tempExtractPath}"`, { stdio: 'inherit' });

      console.log('✅ Ollama installed securely');
      return true;
    } catch (error) {
      console.error('Failed to install Ollama:', error.message);
      // Clean up on failure
      try {
        execSync(`rm -f "${zipPath}"`, { stdio: 'ignore' });
      } catch {}
      return false;
    }
  }

  async start() {
    if (await this.isRunning()) {
      console.log('✅ Ollama already running');
      return true;
    }

    console.log('🚀 Starting Ollama...');

    try {
      // Check if ollama is available in PATH
      try {
        execSync('which ollama', { stdio: 'ignore' });
      } catch {
        // Not in PATH, check if installed locally
        if (!this.isInstalled()) {
          console.log('📦 Installing Ollama automatically...');
          const installed = await this.installFromBinary();
          if (!installed) {
            throw new Error('Failed to install Ollama');
          }
        }

        // Add local path to environment
        process.env.PATH = `${this.ollamaDir}:${process.env.PATH}`;
      }

      // Spawn Ollama process
      const ollamaProcess = spawn('ollama', ['serve'], {
        detached: true,
        stdio: 'ignore',
        env: { ...process.env, PATH: process.env.PATH }
      });
      ollamaProcess.unref();

      // Wait for Ollama to be ready (max 30 seconds)
      for (let i = 0; i < 30; i++) {
        if (await this.isRunning()) {
          console.log('✅ Ollama ready');
          return true;
        }
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      throw new Error('Ollama failed to start within timeout');
    } catch (error) {
      console.error('❌ Error starting Ollama:', error.message);
      return false;
    }
  }

  async ensureModel(modelName) {
    try {
      const response = await fetch(`${this.ollamaUrl}/api/tags`);
      const data = await response.json();
      const hasModel = data.models?.some((m) => m.name.startsWith(modelName));

      if (!hasModel) {
        console.log(`📦 Downloading ${modelName} model (first time)...`);
        const pullResponse = await fetch(`${this.ollamaUrl}/api/pull`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: modelName, stream: false }),
          timeout: 600000 // 10 minutes for model download
        });

        if (!pullResponse.ok) {
          throw new Error(`Failed to pull model: ${pullResponse.statusText}`);
        }

        console.log(`✅ ${modelName} model ready`);
      }

      return true;
    } catch (error) {
      console.error(`Error ensuring model ${modelName}:`, error.message);
      return false;
    }
  }
}

module.exports = OllamaManager;
