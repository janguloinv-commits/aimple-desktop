# 📥 How to Install AImple Desktop

## For Non-Technical Users - Easy 3-Step Install

### Step 1️⃣ Download
Visit **aimple.es/app** and click the download button.

This will download `AImple-1.0.0-arm64.dmg` (109 MB) to your Downloads folder.

### Step 2️⃣ Open the Installer
1. Open your **Downloads** folder (or look for the downloaded file)
2. **Double-click** the `AImple-1.0.0-arm64.dmg` file
3. A window will open showing the AImple icon and an Applications folder

### Step 3️⃣ Install to Applications
1. **Drag** the AImple icon to the Applications folder
2. Wait for the copy to complete (usually 10-30 seconds)
3. Close the installer window

✅ **Done! AImple is now installed.**

---

## Launch AImple

1. Open **Finder** (or press Cmd+Space and type "Finder")
2. Click **Applications** in the sidebar
3. Find **AImple** in the list
4. **Double-click** AImple to launch

---

## First Launch

When you open AImple for the first time:
- ✅ It will automatically check for Ollama (the AI engine)
- ✅ If needed, it will download Ollama (~400MB)
- ✅ It will download the AI model (~2GB)
- ✅ This only happens once - future launches are fast!

**First launch may take 5-10 minutes depending on your internet speed.**

---

## System Requirements

| Requirement | Details |
|---|---|
| **Operating System** | macOS 10.13 or newer (Apple Silicon - M1/M2/M3) |
| **RAM** | 4GB minimum (8GB recommended) |
| **Storage** | ~3GB free for Ollama + models |
| **Internet** | Required only for first-time setup |

---

## Troubleshooting

### "App is damaged" message?
This happens because the app isn't code-signed. To fix:

1. Open **Terminal** (press Cmd+Space, type "Terminal")
2. Copy and paste this command:
   ```
   xattr -d com.apple.quarantine /Applications/AImple.app
   ```
3. Press Enter
4. Try launching AImple again

### Ollama download fails?
- Check your internet connection
- Restart the app
- If it still fails, visit https://ollama.ai and install Ollama manually

### App crashes?
- Check the logs: Open **Terminal** and type:
  ```
  tail -f ~/.aimple/logs/aimple-*.log
  ```
- Try restarting your Mac
- Contact support if the issue persists

---

## Getting Started

Once installed, AImple can:

✅ **Analyze Deal Documents**
- Upload your deal docs (PDF, Word, Excel, etc.)
- Ask questions about the deals
- Get AI-powered analysis

✅ **Works Offline**
- After first setup, no internet needed
- All analysis happens locally on your Mac
- Your data never leaves your computer

✅ **Professional Features**
- AI-powered deal analysis
- Local Ollama LLM
- Secure file handling
- Structured logging

---

## Uninstall

To remove AImple:

1. Open **Finder**
2. Click **Applications**
3. Find **AImple**
4. Drag it to the **Trash**

Optional: Remove data files with:
```
rm -rf ~/.aimple
```

---

## Need Help?

📧 **Email**: jon.angulo@abe-cp.com
🌐 **Website**: aimple.es
📚 **Docs**: Check SECURITY.md and TESTING.md for detailed information

---

## What's Inside

AImple is built with:
- **Electron** - Cross-platform desktop app
- **Node.js** - Fast server backend
- **Ollama** - Local AI engine
- **Express** - API server
- **Security** - Enterprise-grade protection

🔒 **All processing is local** - Your documents never leave your computer.
