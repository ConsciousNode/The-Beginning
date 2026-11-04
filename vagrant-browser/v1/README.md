# Vagrant Browser

**A fully-featured offline browser. No network. Your disk is the world.**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

---

## What is Vagrant Browser?

Vagrant Browser is a complete, production-ready Electron application that functions as a modern web browser with one key difference: **it cannot connect to the internet**. 

Instead of browsing the web, Vagrant Browser treats your local disk as the entire internet. It renders HTML, runs JavaScript, displays PDFs, handles local files, and manages multiple tabs — each in its own isolated renderer process.

### Key Features

- **Multi-tab browsing** with isolated BrowserView processes
- **Complete network kill switch** - blocks all HTTP/HTTPS/WebSocket traffic at the session level
- **Bookmarks** with full page content capture
- **History** tracking with search
- **Find in page** functionality
- **Reading mode** for distraction-free reading
- **Resource monitor** with per-tab memory/CPU tracking
- **Tab suspension** to free memory
- **Full settings system** with persistence
- **Customizable themes** (Dark/Light/System)
- **Keyboard shortcuts** for power users
- **Cross-platform** builds for Windows, Linux, and macOS

---

## Installation

### Prerequisites

- Node.js 18+ 
- npm or yarn

### Setup

```bash
# Clone or download the repository
cd vagrant-browser

# Install dependencies
npm install

# Run in development mode
npm start
```

---

## Building

Build standalone executables for your platform:

```bash
# Build for current platform
npm run build

# Build for specific platforms
npm run build:win      # Windows (NSIS installer)
npm run build:linux    # Linux (AppImage + DEB)
npm run build:mac      # macOS (DMG)
```

Built files will be in the `dist/` directory.

---

## Usage

### Opening Files

- Press `Ctrl+O` to open the file picker
- Drag and drop files onto the browser
- Type a file path in the address bar (e.g., `/path/to/file.html`)

### Built-in Pages

- `about:newtab` - New tab page with clock and speed dial
- `about:bookmarks` - Bookmark manager
- `about:history` - History browser
- `about:settings` - Settings panel
- `about:storage` - Storage inspector
- `about:blank` - Empty page

### Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+T` | New tab |
| `Ctrl+W` | Close active tab |
| `Ctrl+Tab` | Next tab |
| `Ctrl+Shift+Tab` | Previous tab |
| `Ctrl+L` | Focus address bar |
| `Ctrl+D` | Bookmark current page |
| `Ctrl+F` | Find in page |
| `Ctrl+R` / `F5` | Reload tab |
| `Ctrl++` | Zoom in |
| `Ctrl+-` | Zoom out |
| `Ctrl+0` | Reset zoom |
| `Ctrl+S` | Save page as HTML |
| `Ctrl+O` | Open file picker |
| `Alt+Left` | Back |
| `Alt+Right` | Forward |
| `Ctrl+H` | Open history |
| `Ctrl+Shift+O` | Open bookmarks |
| `Ctrl+,` | Open settings |
| `Ctrl+Shift+M` | Toggle resource panel |
| `Ctrl+1-8` | Switch to tab N |
| `Ctrl+9` | Switch to last tab |
| `Ctrl+Shift+T` | Reopen closed tab |
| `F11` | Fullscreen |

---

## Architecture

### Security Model

Vagrant Browser implements a defense-in-depth security model:

1. **Network Kill Switch**: All network requests are blocked at the Electron session level before they can leave the machine
2. **Context Isolation**: Renderer processes run with `contextIsolation: true` and `nodeIntegration: false`
3. **Sandbox**: All BrowserViews run in Chromium's sandbox
4. **Process Isolation**: Each tab runs in its own renderer process

### Project Structure

```
vagrant-browser/
├── package.json          # Dependencies and build config
├── main.js               # Electron main process
├── preload.js            # Context bridge for IPC
├── src/
│   ├── network-kill.js   # Network interception module
│   ├── tab-manager.js    # Tab/BrowserView lifecycle
│   ├── ipc-handlers.js   # IPC channel handlers
│   ├── storage.js        # electron-store wrapper
│   └── resource-monitor.js # Per-tab resource tracking
├── renderer/
│   ├── index.html        # Browser chrome UI
│   ├── style.css         # Chrome UI styles
│   └── renderer.js       # Chrome UI logic
└── dist/                 # Build output
```

---

## Configuration

Settings are stored in Electron's user data directory and persist between sessions:

- **Windows**: `%APPDATA%/vagrant-browser/`
- **macOS**: `~/Library/Application Support/vagrant-browser/`
- **Linux**: `~/.config/vagrant-browser/`

### Available Settings

- Theme (Dark/Light/System)
- Accent color
- UI font size
- Default tab memory limit
- Auto-suspend settings
- Background CPU throttling
- History limit
- Security options (JavaScript, images)
- Developer options

---

## License

MIT License - See [LICENSE](LICENSE) for details.

---

## Credits

**ConsciousNode SoftWorks**

*The address bar goes inward. Your disk is the whole world.*
