# AImple Desktop App - Deployment Guide

## Quick Start

### Local Development
```bash
npm install
npm start
```

### Build Installer (macOS)
```bash
npm run build
```
Creates a `.dmg` installer in the `dist/` folder.

## Deployment Pipeline (GitHub Actions)

The app automatically builds and releases when you create a git tag.

### How to Deploy:

1. **Commit your changes**
   ```bash
   git add .
   git commit -m "Your changes"
   git push
   ```

2. **Create a version tag**
   ```bash
   git tag v1.0.1
   git push origin v1.0.1
   ```

3. **GitHub Actions automatically:**
   - Builds the macOS installer (.dmg)
   - Creates a GitHub Release
   - Uploads the installer for download

4. **Download & distribute**
   - Go to GitHub Releases
   - Users can download the `.dmg` file
   - Double-click to install on their Macs

## Version Format

Use semantic versioning: `v1.0.0`, `v1.0.1`, `v1.1.0`, etc.

### Update version in package.json before creating a tag:
```json
"version": "1.0.1"
```

## Environment Variables

Users need to create a `.env` file with:
```
ANTHROPIC_API_KEY=your_key_here
```

## Build Output

- `dist/AImple.dmg` - macOS installer
- `dist/AImple*.zip` - Portable version

## Troubleshooting

**Issue: Build fails locally**
```bash
rm -rf node_modules dist
npm install
npm run build
```

**Issue: Code signing (optional)**
By default, code signing is disabled (`sign: false` in package.json).
For production, add Apple Developer certificates to `electron-builder` config.
