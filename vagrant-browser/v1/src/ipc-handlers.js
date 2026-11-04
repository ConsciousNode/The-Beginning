/*
 * Vagrant Browser — ConsciousNode SoftWorks
 * MIT License
 *
 * IPC Handlers - All IPC channel handlers
 */

const { ipcMain, dialog, shell } = require('electron');
const os = require('os');
const fs = require('fs');
const path = require('path');

/* ╔══════════════════════════╗
   ║     IPC HANDLERS         ║
   ╚══════════════════════════╝ */

class IPCHandlers {
  constructor(mainWindow, tabManager, storage) {
    this.mainWindow = mainWindow;
    this.tabManager = tabManager;
    this.storage = storage;
    
    this.setupHandlers();
  }

  setupHandlers() {
    // Tab management
    ipcMain.handle('tab:new', (event, options) => {
      return this.tabManager.createTab(options?.url, options);
    });

    ipcMain.handle('tab:close', (event, tabId) => {
      return this.tabManager.closeTab(tabId);
    });

    ipcMain.handle('tab:activate', (event, tabId) => {
      return this.tabManager.activateTab(tabId);
    });

    ipcMain.handle('tab:list', () => {
      return this.tabManager.getTabsList();
    });

    ipcMain.handle('tab:navigate', (event, tabId, url) => {
      return this.tabManager.navigateTab(tabId, url);
    });

    ipcMain.handle('tab:reload', (event, tabId) => {
      return this.tabManager.reloadTab(tabId);
    });

    ipcMain.handle('tab:back', (event, tabId) => {
      return this.tabManager.goBack(tabId);
    });

    ipcMain.handle('tab:forward', (event, tabId) => {
      return this.tabManager.goForward(tabId);
    });

    ipcMain.handle('tab:duplicate', (event, tabId) => {
      return this.tabManager.duplicateTab(tabId);
    });

    ipcMain.handle('tab:suspend', (event, tabId) => {
      return this.tabManager.suspendTab(tabId);
    });

    ipcMain.handle('tab:resume', (event, tabId) => {
      return this.tabManager.resumeTab(tabId);
    });

    ipcMain.handle('tab:get-content', async (event, tabId) => {
      return await this.tabManager.getTabContent(tabId);
    });

    ipcMain.handle('tab:inject-css', (event, tabId, css) => {
      return this.tabManager.injectCSS(tabId, css);
    });

    ipcMain.handle('tab:execute-script', (event, tabId, script) => {
      return this.tabManager.executeScript(tabId, script);
    });

    ipcMain.handle('tab:find', (event, tabId, text, options) => {
      return this.tabManager.findInPage(tabId, text, options);
    });

    ipcMain.handle('tab:stop-find', (event, tabId) => {
      return this.tabManager.stopFind(tabId);
    });

    ipcMain.handle('tab:zoom', (event, tabId, factor) => {
      return this.tabManager.setZoom(tabId, factor);
    });

    // File operations
    ipcMain.handle('file:open', async (event, options) => {
      const result = await dialog.showOpenDialog(this.mainWindow, {
        properties: ['openFile'],
        filters: options?.filters || [
          { name: 'HTML Files', extensions: ['html', 'htm'] },
          { name: 'PDF Files', extensions: ['pdf'] },
          { name: 'Markdown Files', extensions: ['md', 'markdown'] },
          { name: 'Text Files', extensions: ['txt'] },
          { name: 'All Files', extensions: ['*'] }
        ]
      });
      
      if (!result.canceled && result.filePaths.length > 0) {
        return `file://${result.filePaths[0]}`;
      }
      return null;
    });

    ipcMain.handle('file:save', async (event, content, filename) => {
      const result = await dialog.showSaveDialog(this.mainWindow, {
        defaultPath: filename,
        filters: [
          { name: 'HTML Files', extensions: ['html'] },
          { name: 'Text Files', extensions: ['txt'] },
          { name: 'All Files', extensions: ['*'] }
        ]
      });
      
      if (!result.canceled && result.filePath) {
        fs.writeFileSync(result.filePath, content, 'utf8');
        return true;
      }
      return false;
    });

    // Bookmarks
    ipcMain.handle('bookmark:save', (event, bookmark) => {
      return this.saveBookmark(bookmark);
    });

    ipcMain.handle('bookmark:list', () => {
      return this.storage.getBookmarks();
    });

    ipcMain.handle('bookmark:delete', (event, id) => {
      return this.deleteBookmark(id);
    });

    ipcMain.handle('bookmark:update', (event, id, data) => {
      return this.updateBookmark(id, data);
    });

    // History
    ipcMain.handle('history:list', (event, limit = 1000) => {
      return this.getHistory(limit);
    });

    ipcMain.handle('history:clear', (event, options) => {
      return this.clearHistory(options);
    });

    // Settings
    ipcMain.handle('settings:get', () => {
      return this.storage.getSettings();
    });

    ipcMain.handle('settings:set', (event, key, value) => {
      return this.storage.setSetting(key, value);
    });

    // Resources
    ipcMain.handle('resources:tab', async (event, tabId) => {
      return await this.tabManager.getTabResources(tabId);
    });

    ipcMain.handle('resources:set-memory', (event, tabId, mb) => {
      const tab = this.tabManager.getTab(tabId);
      if (tab) {
        tab.memoryLimit = mb;
        return true;
      }
      return false;
    });

    ipcMain.handle('resources:set-throttle', (event, tabId, enabled) => {
      return this.tabManager.setTabThrottling(tabId, enabled);
    });

    ipcMain.handle('resources:system', () => {
      return {
        totalMemory: os.totalmem(),
        freeMemory: os.freemem(),
        cpuCount: os.cpus().length,
        cpuModel: os.cpus()[0]?.model || 'Unknown',
        platform: process.platform,
        electronVersion: process.versions.electron,
        nodeVersion: process.versions.node,
        chromeVersion: process.versions.chrome
      };
    });

    // Window controls
    ipcMain.handle('window-minimize', () => {
      this.mainWindow.minimize();
      return true;
    });

    ipcMain.handle('window-maximize', () => {
      if (this.mainWindow.isMaximized()) {
        this.mainWindow.unmaximize();
      } else {
        this.mainWindow.maximize();
      }
      return true;
    });

    ipcMain.handle('window-close', () => {
      this.mainWindow.close();
      return true;
    });

    ipcMain.handle('window-is-maximized', () => {
      return this.mainWindow.isMaximized();
    });
  }

  // Bookmark operations
  saveBookmark(bookmark) {
    const bookmarks = this.storage.getBookmarks();
    const newBookmark = {
      id: bookmark.id || Date.now().toString(36),
      name: bookmark.name,
      sourceIdentifier: bookmark.sourceIdentifier,
      content: bookmark.content,
      title: bookmark.title,
      favicon: bookmark.favicon,
      savedAt: Date.now(),
      tags: bookmark.tags || [],
      notes: bookmark.notes || '',
      size: bookmark.content?.length || 0
    };
    
    bookmarks.push(newBookmark);
    this.storage.setBookmarks(bookmarks);
    return newBookmark;
  }

  deleteBookmark(id) {
    let bookmarks = this.storage.getBookmarks();
    bookmarks = bookmarks.filter(b => b.id !== id);
    this.storage.setBookmarks(bookmarks);
    return true;
  }

  updateBookmark(id, data) {
    const bookmarks = this.storage.getBookmarks();
    const index = bookmarks.findIndex(b => b.id === id);
    if (index !== -1) {
      bookmarks[index] = { ...bookmarks[index], ...data };
      this.storage.setBookmarks(bookmarks);
      return bookmarks[index];
    }
    return null;
  }

  // History operations
  getHistory(limit = 1000) {
    return this.storage.getHistory().slice(0, limit);
  }

  clearHistory(options = {}) {
    if (options.before) {
      let history = this.storage.getHistory();
      history = history.filter(h => h.timestamp >= options.before);
      this.storage.setHistory(history);
    } else {
      this.storage.setHistory([]);
    }
    return true;
  }
}

/* ╔══════════════════════════╗
   ║     BUILT-IN PAGES       ║
   ╚══════════════════════════╝ */

function generateBuiltInPage(url) {
  const path = url.replace('about:', '');
  
  switch (path) {
    case 'newtab':
      return generateNewTabPage();
    case 'bookmarks':
      return generateBookmarksPage();
    case 'history':
      return generateHistoryPage();
    case 'settings':
      return generateSettingsPage();
    case 'storage':
      return generateStoragePage();
    case 'blank':
      return generateBlankPage();
    default:
      return generateErrorPage(path);
  }
}

function generateNewTabPage() {
  return `<!DOCTYPE html>
<html>
<head>
  <title>New Tab</title>
  <style>
    :root {
      --bg: #0a0a0a;
      --fg: #e5e5e5;
      --accent: #14b8a6;
      --muted: #6b7280;
      --surface: #171717;
      --border: #262626;
    }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      background: var(--bg);
      color: var(--fg);
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 60px 20px;
    }
    .clock {
      font-size: 72px;
      font-weight: 200;
      margin-bottom: 40px;
      letter-spacing: -2px;
    }
    .search-box {
      width: 100%;
      max-width: 600px;
      margin-bottom: 60px;
    }
    .search-box input {
      width: 100%;
      padding: 16px 24px;
      font-size: 16px;
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 8px;
      color: var(--fg);
      outline: none;
    }
    .search-box input:focus {
      border-color: var(--accent);
    }
    .section {
      width: 100%;
      max-width: 800px;
      margin-bottom: 40px;
    }
    .section-title {
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 1px;
      color: var(--muted);
      margin-bottom: 16px;
    }
    .speed-dial {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 16px;
    }
    .dial-item {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 20px;
      text-align: center;
      cursor: pointer;
      transition: all 0.15s ease;
    }
    .dial-item:hover {
      border-color: var(--accent);
      transform: translateY(-2px);
    }
    .dial-icon {
      width: 32px;
      height: 32px;
      margin: 0 auto 8px;
      background: var(--accent);
      border-radius: 6px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 14px;
    }
    .dial-title {
      font-size: 12px;
      color: var(--fg);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .quote {
      text-align: center;
      color: var(--muted);
      font-style: italic;
      max-width: 600px;
      line-height: 1.6;
    }
  </style>
</head>
<body>
  <div class="clock" id="clock">00:00</div>
  
  <div class="search-box">
    <input type="text" placeholder="Search bookmarks and history..." id="search">
  </div>
  
  <div class="section">
    <div class="section-title">Speed Dial</div>
    <div class="speed-dial" id="speedDial">
      <div class="dial-item" onclick="openUrl('file:///')">
        <div class="dial-icon">📁</div>
        <div class="dial-title">Files</div>
      </div>
      <div class="dial-item" onclick="openUrl('about:bookmarks')">
        <div class="dial-icon">⭐</div>
        <div class="dial-title">Bookmarks</div>
      </div>
      <div class="dial-item" onclick="openUrl('about:history')">
        <div class="dial-icon">🕐</div>
        <div class="dial-title">History</div>
      </div>
      <div class="dial-item" onclick="openUrl('about:settings')">
        <div class="dial-icon">⚙️</div>
        <div class="dial-title">Settings</div>
      </div>
    </div>
  </div>
  
  <div class="quote" id="quote">"The address bar goes inward. Your disk is the whole world."</div>
  
  <script>
    function updateClock() {
      const now = new Date();
      document.getElementById('clock').textContent = 
        now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    updateClock();
    setInterval(updateClock, 1000);
    
    function openUrl(url) {
      window.location.href = url;
    }
    
    const quotes = [
      "The address bar goes inward. Your disk is the whole world.",
      "Offline is not a limitation. It's a feature.",
      "No network. No telemetry. No surveillance.",
      "What a browser does, minus the part where it leaves your machine.",
      "Sovereign computing starts with sovereign browsing."
    ];
    document.getElementById('quote').textContent = 
      quotes[Math.floor(Math.random() * quotes.length)];
  </script>
</body>
</html>`;
}

function generateBookmarksPage() {
  return `<!DOCTYPE html>
<html>
<head>
  <title>Bookmarks</title>
  <style>
    :root {
      --bg: #0a0a0a;
      --fg: #e5e5e5;
      --accent: #14b8a6;
      --muted: #6b7280;
      --surface: #171717;
      --border: #262626;
    }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      background: var(--bg);
      color: var(--fg);
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      min-height: 100vh;
      padding: 40px;
    }
    h1 { font-size: 32px; font-weight: 300; margin-bottom: 24px; }
    .search-box {
      width: 100%;
      max-width: 400px;
      margin-bottom: 32px;
    }
    .search-box input {
      width: 100%;
      padding: 12px 16px;
      font-size: 14px;
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 6px;
      color: var(--fg);
      outline: none;
    }
    .search-box input:focus { border-color: var(--accent); }
    .bookmark-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
      gap: 16px;
    }
    .bookmark-card {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 16px;
      cursor: pointer;
      transition: all 0.15s ease;
    }
    .bookmark-card:hover {
      border-color: var(--accent);
    }
    .bookmark-title {
      font-size: 14px;
      font-weight: 500;
      margin-bottom: 4px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .bookmark-url {
      font-size: 12px;
      color: var(--muted);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .bookmark-tags {
      margin-top: 8px;
      display: flex;
      gap: 6px;
      flex-wrap: wrap;
    }
    .bookmark-tag {
      font-size: 10px;
      padding: 2px 8px;
      background: var(--bg);
      border-radius: 4px;
      color: var(--muted);
    }
    .empty-state {
      text-align: center;
      color: var(--muted);
      padding: 60px;
    }
  </style>
</head>
<body>
  <h1>Bookmarks</h1>
  <div class="search-box">
    <input type="text" placeholder="Search bookmarks..." id="search">
  </div>
  <div class="bookmark-grid" id="bookmarkGrid">
    <div class="empty-state">No bookmarks yet. Press Ctrl+D to bookmark a page.</div>
  </div>
  <script>
    // Bookmarks will be loaded via postMessage bridge
    window.parent.postMessage({ type: 'getBookmarks' }, '*');
    
    window.addEventListener('message', (e) => {
      if (e.data.type === 'bookmarks') {
        renderBookmarks(e.data.bookmarks);
      }
    });
    
    function renderBookmarks(bookmarks) {
      const grid = document.getElementById('bookmarkGrid');
      if (!bookmarks || bookmarks.length === 0) return;
      
      grid.innerHTML = bookmarks.map(b => \`
        <div class="bookmark-card" onclick="openBookmark('\${b.id}')">
          <div class="bookmark-title">\${b.title || b.name}</div>
          <div class="bookmark-url">\${b.sourceIdentifier}</div>
          \${b.tags?.length ? \`<div class="bookmark-tags">\${b.tags.map(t => \`<span class="bookmark-tag">\${t}</span>\`).join('')}</div>\` : ''}
        </div>
      \`).join('');
    }
    
    function openBookmark(id) {
      window.parent.postMessage({ type: 'openBookmark', id }, '*');
    }
  </script>
</body>
</html>`;
}

function generateHistoryPage() {
  return `<!DOCTYPE html>
<html>
<head>
  <title>History</title>
  <style>
    :root {
      --bg: #0a0a0a;
      --fg: #e5e5e5;
      --accent: #14b8a6;
      --muted: #6b7280;
      --surface: #171717;
      --border: #262626;
    }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      background: var(--bg);
      color: var(--fg);
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      min-height: 100vh;
      padding: 40px;
    }
    h1 { font-size: 32px; font-weight: 300; margin-bottom: 24px; }
    .history-list { max-width: 800px; }
    .history-day {
      margin-bottom: 32px;
    }
    .day-header {
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 1px;
      color: var(--muted);
      margin-bottom: 12px;
      padding-bottom: 8px;
      border-bottom: 1px solid var(--border);
    }
    .history-item {
      display: flex;
      align-items: center;
      padding: 12px;
      border-radius: 6px;
      cursor: pointer;
      transition: background 0.15s ease;
    }
    .history-item:hover {
      background: var(--surface);
    }
    .history-favicon {
      width: 16px;
      height: 16px;
      margin-right: 12px;
      background: var(--accent);
      border-radius: 3px;
    }
    .history-info {
      flex: 1;
    }
    .history-title {
      font-size: 14px;
      margin-bottom: 2px;
    }
    .history-url {
      font-size: 12px;
      color: var(--muted);
    }
    .history-time {
      font-size: 12px;
      color: var(--muted);
    }
    .empty-state {
      text-align: center;
      color: var(--muted);
      padding: 60px;
    }
  </style>
</head>
<body>
  <h1>History</h1>
  <div class="history-list" id="historyList">
    <div class="empty-state">No history yet. Start browsing to build your history.</div>
  </div>
  <script>
    window.parent.postMessage({ type: 'getHistory' }, '*');
    
    window.addEventListener('message', (e) => {
      if (e.data.type === 'history') {
        renderHistory(e.data.history);
      }
    });
    
    function renderHistory(history) {
      const list = document.getElementById('historyList');
      if (!history || history.length === 0) return;
      
      // Group by day
      const grouped = {};
      history.forEach(h => {
        const day = new Date(h.timestamp).toLocaleDateString();
        if (!grouped[day]) grouped[day] = [];
        grouped[day].push(h);
      });
      
      list.innerHTML = Object.entries(grouped).map(([day, items]) => \`
        <div class="history-day">
          <div class="day-header">\${day}</div>
          \${items.map(item => \`
            <div class="history-item" onclick="openUrl('\${item.url}')">
              <div class="history-favicon"></div>
              <div class="history-info">
                <div class="history-title">\${item.title || 'Untitled'}</div>
                <div class="history-url">\${item.url}</div>
              </div>
              <div class="history-time">\${new Date(item.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</div>
            </div>
          \`).join('')}
        </div>
      \`).join('');
    }
    
    function openUrl(url) {
      window.parent.postMessage({ type: 'navigate', url }, '*');
    }
  </script>
</body>
</html>`;
}

function generateSettingsPage() {
  return `<!DOCTYPE html>
<html>
<head>
  <title>Settings</title>
  <style>
    :root {
      --bg: #0a0a0a;
      --fg: #e5e5e5;
      --accent: #14b8a6;
      --muted: #6b7280;
      --surface: #171717;
      --border: #262626;
    }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      background: var(--bg);
      color: var(--fg);
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      min-height: 100vh;
      padding: 40px;
    }
    h1 { font-size: 32px; font-weight: 300; margin-bottom: 32px; }
    .settings-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
      gap: 24px;
      max-width: 1200px;
    }
    .settings-section {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 24px;
    }
    .section-title {
      font-size: 14px;
      font-weight: 500;
      margin-bottom: 16px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: var(--accent);
    }
    .setting-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 12px 0;
      border-bottom: 1px solid var(--border);
    }
    .setting-row:last-child { border-bottom: none; }
    .setting-label {
      font-size: 14px;
    }
    .setting-desc {
      font-size: 12px;
      color: var(--muted);
      margin-top: 2px;
    }
    .setting-control input[type="text"],
    .setting-control input[type="number"],
    .setting-control select {
      background: var(--bg);
      border: 1px solid var(--border);
      border-radius: 4px;
      padding: 6px 10px;
      color: var(--fg);
      font-size: 13px;
      min-width: 120px;
    }
    .setting-control input[type="color"] {
      width: 40px;
      height: 24px;
      border: none;
      background: none;
      cursor: pointer;
    }
    .toggle {
      width: 44px;
      height: 24px;
      background: var(--border);
      border-radius: 12px;
      position: relative;
      cursor: pointer;
      transition: background 0.2s ease;
    }
    .toggle.active { background: var(--accent); }
    .toggle::after {
      content: '';
      position: absolute;
      width: 20px;
      height: 20px;
      background: var(--fg);
      border-radius: 50%;
      top: 2px;
      left: 2px;
      transition: transform 0.2s ease;
    }
    .toggle.active::after { transform: translateX(20px); }
    .btn {
      padding: 8px 16px;
      background: var(--accent);
      color: var(--bg);
      border: none;
      border-radius: 4px;
      font-size: 13px;
      cursor: pointer;
    }
    .btn:hover { opacity: 0.9; }
    .version-info {
      margin-top: 40px;
      padding-top: 20px;
      border-top: 1px solid var(--border);
      color: var(--muted);
      font-size: 12px;
    }
  </style>
</head>
<body>
  <h1>Settings</h1>
  <div class="settings-grid">
    <div class="settings-section">
      <div class="section-title">Appearance</div>
      <div class="setting-row">
        <div>
          <div class="setting-label">Theme</div>
          <div class="setting-desc">Choose your preferred color scheme</div>
        </div>
        <div class="setting-control">
          <select id="theme">
            <option value="dark">Dark</option>
            <option value="light">Light</option>
            <option value="system">System</option>
          </select>
        </div>
      </div>
      <div class="setting-row">
        <div>
          <div class="setting-label">Accent Color</div>
          <div class="setting-desc">Primary color for UI elements</div>
        </div>
        <div class="setting-control">
          <input type="color" id="accentColor" value="#14b8a6">
        </div>
      </div>
      <div class="setting-row">
        <div>
          <div class="setting-label">UI Font Size</div>
          <div class="setting-desc">Size of text in the browser chrome</div>
        </div>
        <div class="setting-control">
          <input type="number" id="uiFontSize" value="14" min="12" max="20">
        </div>
      </div>
    </div>
    
    <div class="settings-section">
      <div class="section-title">Performance & Memory</div>
      <div class="setting-row">
        <div>
          <div class="setting-label">Default Tab Memory Limit</div>
          <div class="setting-desc">Maximum memory per tab in MB</div>
        </div>
        <div class="setting-control">
          <input type="number" id="defaultTabMemoryLimit" value="512" min="64" max="8192">
        </div>
      </div>
      <div class="setting-row">
        <div>
          <div class="setting-label">Auto-suspend over limit</div>
          <div class="setting-desc">Automatically suspend tabs exceeding memory limit</div>
        </div>
        <div class="setting-control">
          <div class="toggle" id="autoSuspendOverLimit"></div>
        </div>
      </div>
      <div class="setting-row">
        <div>
          <div class="setting-label">Background CPU Throttling</div>
          <div class="setting-desc">Reduce CPU usage for background tabs</div>
        </div>
        <div class="setting-control">
          <div class="toggle active" id="backgroundCpuThrottling"></div>
        </div>
      </div>
    </div>
    
    <div class="settings-section">
      <div class="section-title">Storage</div>
      <div class="setting-row">
        <div>
          <div class="setting-label">History Limit</div>
          <div class="setting-desc">Maximum number of history entries</div>
        </div>
        <div class="setting-control">
          <select id="historyLimit">
            <option value="100">100</option>
            <option value="500">500</option>
            <option value="1000" selected>1000</option>
            <option value="5000">5000</option>
          </select>
        </div>
      </div>
      <div class="setting-row">
        <div class="setting-label">Clear History</div>
        <div class="setting-control">
          <button class="btn" onclick="clearHistory()">Clear</button>
        </div>
      </div>
      <div class="setting-row">
        <div class="setting-label">Clear All Data</div>
        <div class="setting-control">
          <button class="btn" onclick="clearAllData()">Clear All</button>
        </div>
      </div>
    </div>
    
    <div class="settings-section">
      <div class="section-title">Security</div>
      <div class="setting-row">
        <div>
          <div class="setting-label">JavaScript</div>
          <div class="setting-desc">Enable JavaScript execution in tabs</div>
        </div>
        <div class="setting-control">
          <div class="toggle active" id="enableJavaScript"></div>
        </div>
      </div>
      <div class="setting-row">
        <div>
          <div class="setting-label">Images</div>
          <div class="setting-desc">Display images in web pages</div>
        </div>
        <div class="setting-control">
          <div class="toggle active" id="enableImages"></div>
        </div>
      </div>
    </div>
    
    <div class="settings-section">
      <div class="section-title">Developer</div>
      <div class="setting-row">
        <div>
          <div class="setting-label">Enable DevTools</div>
          <div class="setting-desc">Allow opening DevTools per tab</div>
        </div>
        <div class="setting-control">
          <div class="toggle" id="enableDevTools"></div>
        </div>
      </div>
      <div class="setting-row">
        <div>
          <div class="setting-label">Show about:storage</div>
          <div class="setting-desc">Enable storage inspector tab</div>
        </div>
        <div class="setting-control">
          <div class="toggle" id="showAboutStorage"></div>
        </div>
      </div>
    </div>
    
    <div class="settings-section">
      <div class="section-title">About</div>
      <div class="setting-row">
        <div class="setting-label">Version</div>
        <div class="setting-control">1.0.0</div>
      </div>
      <div class="setting-row">
        <div class="setting-label">Electron</div>
        <div class="setting-control">${process.versions.electron}</div>
      </div>
      <div class="setting-row">
        <div class="setting-label">Chromium</div>
        <div class="setting-control">${process.versions.chrome}</div>
      </div>
      <div class="setting-row">
        <div class="setting-label">Node.js</div>
        <div class="setting-control">${process.versions.node}</div>
      </div>
      <div class="setting-row">
        <div class="setting-label">License</div>
        <div class="setting-control">MIT</div>
      </div>
    </div>
  </div>
  
  <script>
    // Load settings
    window.parent.postMessage({ type: 'getSettings' }, '*');
    
    window.addEventListener('message', (e) => {
      if (e.data.type === 'settings') {
        applySettings(e.data.settings);
      }
    });
    
    function applySettings(settings) {
      if (settings.theme) document.getElementById('theme').value = settings.theme;
      if (settings.accentColor) document.getElementById('accentColor').value = settings.accentColor;
      if (settings.uiFontSize) document.getElementById('uiFontSize').value = settings.uiFontSize;
      if (settings.defaultTabMemoryLimit) document.getElementById('defaultTabMemoryLimit').value = settings.defaultTabMemoryLimit;
      if (settings.historyLimit) document.getElementById('historyLimit').value = settings.historyLimit;
    }
    
    // Toggle handlers
    document.querySelectorAll('.toggle').forEach(toggle => {
      toggle.addEventListener('click', () => {
        toggle.classList.toggle('active');
        const id = toggle.id;
        const value = toggle.classList.contains('active');
        window.parent.postMessage({ type: 'setSetting', key: id, value }, '*');
      });
    });
    
    // Input handlers
    document.querySelectorAll('input, select').forEach(input => {
      input.addEventListener('change', () => {
        window.parent.postMessage({ type: 'setSetting', key: input.id, value: input.value }, '*');
      });
    });
    
    function clearHistory() {
      window.parent.postMessage({ type: 'clearHistory' }, '*');
    }
    
    function clearAllData() {
      if (confirm('This will clear all bookmarks, history, and settings. Are you sure?')) {
        window.parent.postMessage({ type: 'clearAllData' }, '*');
      }
    }
  </script>
</body>
</html>`;
}

function generateStoragePage() {
  return `<!DOCTYPE html>
<html>
<head>
  <title>Storage</title>
  <style>
    :root {
      --bg: #0a0a0a;
      --fg: #e5e5e5;
      --accent: #14b8a6;
      --muted: #6b7280;
      --surface: #171717;
      --border: #262626;
    }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      background: var(--bg);
      color: var(--fg);
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      min-height: 100vh;
      padding: 40px;
    }
    h1 { font-size: 32px; font-weight: 300; margin-bottom: 24px; }
    .storage-section {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 24px;
      margin-bottom: 16px;
      max-width: 800px;
    }
    .section-title {
      font-size: 14px;
      font-weight: 500;
      margin-bottom: 16px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: var(--accent);
    }
    .storage-item {
      display: flex;
      justify-content: space-between;
      padding: 8px 0;
      border-bottom: 1px solid var(--border);
    }
    .storage-item:last-child { border-bottom: none; }
    .storage-label { color: var(--muted); }
    .btn {
      padding: 8px 16px;
      background: var(--accent);
      color: var(--bg);
      border: none;
      border-radius: 4px;
      font-size: 13px;
      cursor: pointer;
      margin-top: 16px;
    }
  </style>
</head>
<body>
  <h1>Storage</h1>
  <div class="storage-section">
    <div class="section-title">Local Storage</div>
    <div class="storage-item">
      <span class="storage-label">Bookmarks</span>
      <span id="bookmarksSize">-</span>
    </div>
    <div class="storage-item">
      <span class="storage-label">History</span>
      <span id="historySize">-</span>
    </div>
    <div class="storage-item">
      <span class="storage-label">Settings</span>
      <span id="settingsSize">-</span>
    </div>
    <div class="storage-item">
      <span class="storage-label">Total</span>
      <span id="totalSize">-</span>
    </div>
  </div>
  <div class="storage-section">
    <div class="section-title">Session Data</div>
    <div class="storage-item">
      <span class="storage-label">Active Tab Sessions</span>
      <span id="tabSessions">-</span>
    </div>
    <button class="btn" onclick="clearSessions()">Clear All Sessions</button>
  </div>
  <script>
    window.parent.postMessage({ type: 'getStorageInfo' }, '*');
    
    window.addEventListener('message', (e) => {
      if (e.data.type === 'storageInfo') {
        document.getElementById('bookmarksSize').textContent = formatBytes(e.data.bookmarksSize);
        document.getElementById('historySize').textContent = formatBytes(e.data.historySize);
        document.getElementById('settingsSize').textContent = formatBytes(e.data.settingsSize);
        document.getElementById('totalSize').textContent = formatBytes(e.data.totalSize);
        document.getElementById('tabSessions').textContent = e.data.tabSessions;
      }
    });
    
    function formatBytes(bytes) {
      if (bytes === 0) return '0 B';
      const k = 1024;
      const sizes = ['B', 'KB', 'MB', 'GB'];
      const i = Math.floor(Math.log(bytes) / Math.log(k));
      return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
    
    function clearSessions() {
      window.parent.postMessage({ type: 'clearSessions' }, '*');
    }
  </script>
</body>
</html>`;
}

function generateBlankPage() {
  return `<!DOCTYPE html>
<html>
<head>
  <title>Blank Page</title>
  <style>
    body {
      background: #0a0a0a;
      margin: 0;
      min-height: 100vh;
    }
  </style>
</head>
<body></body>
</html>`;
}

function generateErrorPage(path) {
  return `<!DOCTYPE html>
<html>
<head>
  <title>Error</title>
  <style>
    body {
      background: #0a0a0a;
      color: #e5e5e5;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      margin: 0;
    }
    h1 { font-size: 48px; font-weight: 300; margin-bottom: 16px; }
    p { color: #6b7280; }
  </style>
</head>
<body>
  <h1>404</h1>
  <p>The page "about:${path}" was not found.</p>
</body>
</html>`;
}

module.exports = { IPCHandlers, generateBuiltInPage };
