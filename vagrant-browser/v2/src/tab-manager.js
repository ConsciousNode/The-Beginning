/*
 * Vagrant Browser — ConsciousNode SoftWorks
 * MIT License
 *
 * Tab Manager - BrowserView lifecycle and tab management
 */

const { BrowserView, session } = require('electron');
const path = require('path');
const { killNetwork } = require('./network-kill');

/* ╔══════════════════════════╗
   ║     TAB MANAGER          ║
   ╚══════════════════════════╝ */

class TabManager {
  constructor(mainWindow, storage) {
    this.mainWindow = mainWindow;
    this.storage = storage;
    this.tabs = new Map(); // tabId -> { view, url, title, favicon, history, historyIndex, suspended, suspendedUrl, memoryLimit, isBuiltIn }
    this.activeTabId = null;
    this.tabCounter = 0;
    this.closedTabs = []; // For reopening closed tabs
    
    // Chrome UI dimensions (must match renderer)
    this.chromeHeight = {
      titlebar: 32,
      tabstrip: 40,
      navbar: 48,
      toolbar: 36,
      statusbar: 24
    };
  }

  /**
   * Generate a unique tab ID
   */
  generateTabId() {
    return `tab-${Date.now()}-${++this.tabCounter}`;
  }

  /**
   * Get the default memory limit for new tabs
   */
  getDefaultMemoryLimit() {
    if (this.storage) {
      const settings = this.storage.getSettings();
      return settings.defaultTabMemoryLimit || 512;
    }
    return 512;
  }

  /**
   * Create a new tab with a BrowserView
   */
  createTab(url = 'about:newtab', options = {}) {
    const tabId = this.generateTabId();
    const partition = `persist:${tabId}`;
    const tabSession = session.fromPartition(partition);
    
    // Immediately kill network on new tab session
    killNetwork(tabSession);
    
    const memoryLimit = options.memoryLimit || this.getDefaultMemoryLimit();
    
    // Check if this is a built-in page
    const isBuiltIn = url && url.startsWith('about:');
    const preloadPath = isBuiltIn
      ? path.join(__dirname, 'preload-builtin.js')
      : null;
    
    const view = new BrowserView({
      webPreferences: {
        session: tabSession,
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: !isBuiltIn,   // MUST be false for preload to work with contextBridge
        webSecurity: true,
        allowRunningInsecureContent: false,
        additionalArguments: [`--max-old-space-size=${memoryLimit}`],
        ...(preloadPath ? { preload: preloadPath } : {})
      }
    });
    
    this.mainWindow.addBrowserView(view);
    
    // Store tab info
    this.tabs.set(tabId, {
      view,
      url: url || 'about:newtab',
      title: 'New Tab',
      favicon: null,
      history: [],
      historyIndex: -1,
      suspended: false,
      suspendedUrl: null,
      memoryLimit,
      isThrottled: false,
      canGoBack: false,
      canGoForward: false,
      isLoading: false,
      isBuiltIn: isBuiltIn || false
    });
    
    // Set up event handlers for this tab
    this.setupTabEventHandlers(tabId, view);
    
    // Position the view
    this.updateTabBounds(tabId);
    
    // Navigate to initial URL
    this.navigateTab(tabId, url || 'about:newtab');
    
    // Activate the new tab
    this.activateTab(tabId);
    
    return tabId;
  }

  /**
   * Set up event handlers for a tab's webContents
   */
  setupTabEventHandlers(tabId, view) {
    const webContents = view.webContents;
    const tab = this.tabs.get(tabId);
    
    // Navigation events
    webContents.on('did-navigate', (event, url) => {
      tab.url = url;
      tab.canGoBack = webContents.canGoBack();
      tab.canGoForward = webContents.canGoForward();
      this.addToHistory(tabId, url, tab.title);
      this.notifyRenderer('tab:nav-state', { tabId, canGoBack: tab.canGoBack, canGoForward: tab.canGoForward });
    });
    
    webContents.on('did-navigate-in-page', (event, url, isMainFrame) => {
      if (isMainFrame) {
        tab.url = url;
        tab.canGoBack = webContents.canGoBack();
        tab.canGoForward = webContents.canGoForward();
        this.addToHistory(tabId, url, tab.title);
        this.notifyRenderer('tab:nav-state', { tabId, canGoBack: tab.canGoBack, canGoForward: tab.canGoForward });
      }
    });
    
    webContents.on('page-title-updated', (event, title) => {
      tab.title = title;
      this.notifyRenderer('tab:title-updated', { tabId, title });
    });
    
    webContents.on('page-favicon-updated', (event, favicons) => {
      if (favicons && favicons.length > 0) {
        tab.favicon = favicons[0];
        this.notifyRenderer('tab:favicon-updated', { tabId, favicon: tab.favicon });
      }
    });
    
    webContents.on('did-start-loading', () => {
      tab.isLoading = true;
      this.notifyRenderer('tab:loading', { tabId, loading: true });
    });
    
    webContents.on('did-stop-loading', () => {
      tab.isLoading = false;
      this.notifyRenderer('tab:loading', { tabId, loading: false });
    });
    
    webContents.on('render-process-gone', (event, details) => {
      this.notifyRenderer('tab:crashed', { tabId, reason: details.reason });
    });
    
    webContents.on('found-in-page', (event, result) => {
      this.notifyRenderer('find:result', { tabId, result });
    });
    
    // Context menu
    webContents.on('context-menu', (event, params) => {
      this.showContextMenu(tabId, params);
    });
  }

  /**
   * Show context menu for a tab
   */
  showContextMenu(tabId, params) {
    const { Menu } = require('electron');
    const tab = this.tabs.get(tabId);
    if (!tab) return;
    
    const template = [
      {
        label: 'Back',
        enabled: tab.canGoBack,
        click: () => this.goBack(tabId)
      },
      {
        label: 'Forward',
        enabled: tab.canGoForward,
        click: () => this.goForward(tabId)
      },
      {
        label: 'Reload',
        click: () => this.reloadTab(tabId)
      },
      { type: 'separator' },
      {
        label: 'Save Page As...',
        click: () => this.savePageAs(tabId)
      },
      {
        label: 'View Source',
        click: () => this.viewSource(tabId)
      },
      { type: 'separator' },
      {
        label: 'Inspect Element',
        click: () => tab.view.webContents.inspectElement(params.x, params.y)
      }
    ];
    
    const menu = Menu.buildFromTemplate(template);
    menu.popup();
  }

  /**
   * Add URL to tab's history
   */
  addToHistory(tabId, url, title) {
    const tab = this.tabs.get(tabId);
    if (!tab) return;
    
    // Remove forward history if we navigated to a new page
    if (tab.historyIndex < tab.history.length - 1) {
      tab.history = tab.history.slice(0, tab.historyIndex + 1);
    }
    
    tab.history.push({ url, title, timestamp: Date.now() });
    tab.historyIndex = tab.history.length - 1;
  }

  /**
   * Close a tab
   */
  closeTab(tabId) {
    const tab = this.tabs.get(tabId);
    if (!tab) return false;
    
    // Store for reopening
    this.closedTabs.push({
      url: tab.suspended ? tab.suspendedUrl : tab.url,
      title: tab.title,
      history: [...tab.history],
      historyIndex: tab.historyIndex
    });
    
    // Keep only last 10 closed tabs
    if (this.closedTabs.length > 10) {
      this.closedTabs.shift();
    }
    
    // Remove the BrowserView
    this.mainWindow.removeBrowserView(tab.view);
    tab.view.webContents.destroy();
    
    // Remove from tabs map
    this.tabs.delete(tabId);
    
    // Activate another tab if this was active
    if (this.activeTabId === tabId) {
      const remainingTabs = Array.from(this.tabs.keys());
      if (remainingTabs.length > 0) {
        this.activateTab(remainingTabs[remainingTabs.length - 1]);
      } else {
        this.activeTabId = null;
        // Create a new tab if all closed
        this.createTab('about:newtab');
      }
    }
    
    return true;
  }

  /**
   * Activate a tab (bring to front)
   */
  activateTab(tabId) {
    const tab = this.tabs.get(tabId);
    if (!tab) return false;
    
    // Hide current active tab
    if (this.activeTabId && this.activeTabId !== tabId) {
      const activeTab = this.tabs.get(this.activeTabId);
      if (activeTab) {
        activeTab.view.webContents.setBackgroundThrottling(true);
      }
    }
    
    // Show and focus new tab
    this.mainWindow.setTopBrowserView(tab.view);
    tab.view.webContents.setBackgroundThrottling(false);
    
    this.activeTabId = tabId;
    this.updateTabBounds(tabId);
    
    return true;
  }

  /**
   * Navigate a tab to a URL
   */
  navigateTab(tabId, url) {
    const tab = this.tabs.get(tabId);
    if (!tab) return false;
    
    if (tab.suspended) {
      this.resumeTab(tabId);
    }
    
    // Handle built-in pages
    if (url.startsWith('about:')) {
      // If navigating to a built-in page but tab wasn't created as built-in,
      // recreate the tab to get the proper preload script
      if (!tab.isBuiltIn) {
        const newTabId = this.createTab(url);
        this.closeTab(tabId);
        return true;
      }
      
      const builtInPage = this.generateBuiltInPage(url);
      tab.view.webContents.loadURL(`data:text/html,${encodeURIComponent(builtInPage)}`);
    } else if (url.startsWith('file://') || url.startsWith('data:') || url.startsWith('blob:')) {
      tab.view.webContents.loadURL(url);
    } else {
      // Reject non-allowed URLs
      return false;
    }
    
    tab.url = url;
    return true;
  }

  /**
   * Generate built-in page HTML
   */
  generateBuiltInPage(url) {
    // This will be expanded in ipc-handlers.js
    const { generateBuiltInPage } = require('./ipc-handlers');
    return generateBuiltInPage(url);
  }

  /**
   * Reload a tab
   */
  reloadTab(tabId) {
    const tab = this.tabs.get(tabId);
    if (!tab) return false;
    
    if (tab.suspended) {
      this.resumeTab(tabId);
    } else {
      tab.view.webContents.reload();
    }
    return true;
  }

  /**
   * Go back in tab history
   */
  goBack(tabId) {
    const tab = this.tabs.get(tabId);
    if (!tab) return false;
    
    if (tab.suspended) {
      // Resume and then go back
      this.resumeTab(tabId);
      setTimeout(() => {
        tab.view.webContents.goBack();
      }, 100);
    } else {
      tab.view.webContents.goBack();
    }
    return true;
  }

  /**
   * Go forward in tab history
   */
  goForward(tabId) {
    const tab = this.tabs.get(tabId);
    if (!tab) return false;
    
    tab.view.webContents.goForward();
    return true;
  }

  /**
   * Duplicate a tab
   */
  duplicateTab(tabId) {
    const tab = this.tabs.get(tabId);
    if (!tab) return null;
    
    return this.createTab(tab.url);
  }

  /**
   * Suspend a tab (free memory)
   */
  suspendTab(tabId) {
    const tab = this.tabs.get(tabId);
    if (!tab || tab.suspended) return false;
    
    tab.suspendedUrl = tab.url;
    tab.suspended = true;
    tab.view.webContents.loadURL('about:blank');
    
    return true;
  }

  /**
   * Resume a suspended tab
   */
  resumeTab(tabId) {
    const tab = this.tabs.get(tabId);
    if (!tab || !tab.suspended) return false;
    
    tab.suspended = false;
    if (tab.suspendedUrl) {
      this.navigateTab(tabId, tab.suspendedUrl);
      tab.suspendedUrl = null;
    }
    
    return true;
  }

  /**
   * Reopen last closed tab
   */
  reopenClosedTab() {
    if (this.closedTabs.length === 0) return null;
    
    const closedTab = this.closedTabs.pop();
    const newTabId = this.createTab(closedTab.url);
    const newTab = this.tabs.get(newTabId);
    
    if (newTab) {
      newTab.title = closedTab.title;
      newTab.history = closedTab.history;
      newTab.historyIndex = closedTab.historyIndex;
    }
    
    return newTabId;
  }

  /**
   * Get tab content (HTML)
   */
  async getTabContent(tabId) {
    const tab = this.tabs.get(tabId);
    if (!tab || tab.suspended) return null;
    
    try {
      const html = await tab.view.webContents.executeJavaScript('document.documentElement.outerHTML');
      return html;
    } catch (e) {
      return null;
    }
  }

  /**
   * Inject CSS into a tab
   */
  injectCSS(tabId, css) {
    const tab = this.tabs.get(tabId);
    if (!tab || tab.suspended) return false;
    
    return tab.view.webContents.insertCSS(css);
  }

  /**
   * Execute script in a tab
   */
  executeScript(tabId, script) {
    const tab = this.tabs.get(tabId);
    if (!tab || tab.suspended) return false;
    
    return tab.view.webContents.executeJavaScript(script);
  }

  /**
   * Find text in page
   */
  findInPage(tabId, text, options = {}) {
    const tab = this.tabs.get(tabId);
    if (!tab || tab.suspended) return false;
    
    const findOptions = {
      forward: options.forward !== false,
      findNext: options.findNext || false,
      matchCase: options.matchCase || false
    };
    
    tab.view.webContents.findInPage(text, findOptions);
    return true;
  }

  /**
   * Stop find in page
   */
  stopFind(tabId, action = 'clearSelection') {
    const tab = this.tabs.get(tabId);
    if (!tab || tab.suspended) return false;
    
    tab.view.webContents.stopFindInPage(action);
    return true;
  }

  /**
   * Set zoom factor for a tab
   */
  setZoom(tabId, factor) {
    const tab = this.tabs.get(tabId);
    if (!tab || tab.suspended) return false;
    
    tab.view.webContents.setZoomFactor(factor);
    return true;
  }

  /**
   * Get zoom factor for a tab
   */
  getZoom(tabId) {
    const tab = this.tabs.get(tabId);
    if (!tab || tab.suspended) return 1;
    
    return tab.view.webContents.getZoomFactor();
  }

  /**
   * Save page as HTML file
   */
  async savePageAs(tabId) {
    const tab = this.tabs.get(tabId);
    if (!tab || tab.suspended) return false;
    
    const { dialog } = require('electron');
    const fs = require('fs');
    
    const result = await dialog.showSaveDialog(this.mainWindow, {
      defaultPath: `${tab.title || 'page'}.html`,
      filters: [
        { name: 'HTML Files', extensions: ['html', 'htm'] },
        { name: 'All Files', extensions: ['*'] }
      ]
    });
    
    if (!result.canceled && result.filePath) {
      const html = await this.getTabContent(tabId);
      if (html) {
        fs.writeFileSync(result.filePath, html, 'utf8');
        return true;
      }
    }
    
    return false;
  }

  /**
   * View source of current page
   */
  async viewSource(tabId) {
    const html = await this.getTabContent(tabId);
    if (html) {
      const newTabId = this.createTab('about:blank');
      const escaped = html
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
      
      const sourceHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>View Source</title>
          <style>
            body { background: #0a0a0a; color: #e5e5e5; font-family: monospace; padding: 20px; }
            pre { white-space: pre-wrap; word-wrap: break-word; }
            .tag { color: #14b8a6; }
            .attr { color: #f59e0b; }
            .value { color: #22c55e; }
            .comment { color: #6b7280; }
            .doctype { color: #a855f7; }
          </style>
        </head>
        <body><pre>${escaped}</pre></body>
        </html>
      `;
      
      const newTab = this.tabs.get(newTabId);
      newTab.view.webContents.loadURL(`data:text/html,${encodeURIComponent(sourceHtml)}`);
    }
  }

  /**
   * Update bounds for a single tab
   */
  updateTabBounds(tabId) {
    const tab = this.tabs.get(tabId);
    if (!tab) return;
    
    const bounds = this.mainWindow.getBounds();
    const contentHeight = bounds.height - this.chromeHeight.titlebar - this.chromeHeight.tabstrip - 
                          this.chromeHeight.navbar - this.chromeHeight.toolbar - this.chromeHeight.statusbar;
    
    tab.view.setBounds({
      x: 0,
      y: this.chromeHeight.titlebar + this.chromeHeight.tabstrip + this.chromeHeight.navbar + this.chromeHeight.toolbar,
      width: bounds.width,
      height: contentHeight
    });
  }

  /**
   * Update bounds for all tabs
   */
  updateAllTabBounds() {
    for (const tabId of this.tabs.keys()) {
      this.updateTabBounds(tabId);
    }
  }

  /**
   * Get all tabs info for renderer
   */
  getTabsList() {
    const list = [];
    for (const [tabId, tab] of this.tabs) {
      list.push({
        id: tabId,
        title: tab.suspended ? `⏸ ${tab.title}` : tab.title,
        url: tab.suspended ? tab.suspendedUrl : tab.url,
        favicon: tab.favicon,
        active: tabId === this.activeTabId,
        suspended: tab.suspended,
        isLoading: tab.isLoading,
        canGoBack: tab.canGoBack,
        canGoForward: tab.canGoForward
      });
    }
    return list;
  }

  /**
   * Get a specific tab's info
   */
  getTab(tabId) {
    return this.tabs.get(tabId);
  }

  /**
   * Get the active tab ID
   */
  getActiveTabId() {
    return this.activeTabId;
  }

  /**
   * Set background throttling for a tab
   */
  setTabThrottling(tabId, enabled) {
    const tab = this.tabs.get(tabId);
    if (!tab) return false;
    
    tab.isThrottled = enabled;
    tab.view.webContents.setBackgroundThrottling(enabled);
    return true;
  }

  /**
   * Force kill a tab's renderer process
   */
  forceKillTab(tabId) {
    const tab = this.tabs.get(tabId);
    if (!tab) return false;
    
    tab.view.webContents.forcefullyCrashRenderer();
    return true;
  }

  /**
   * Notify renderer of an event
   */
  notifyRenderer(channel, data) {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send(channel, data);
    }
  }

  /**
   * Get resource info for a tab
   */
  async getTabResources(tabId) {
    const tab = this.tabs.get(tabId);
    if (!tab) return null;
    
    const result = {
      pid: tab.view.webContents.getOSProcessId(),
      memoryUsage: null,
      processMemory: null,
      isThrottled: tab.isThrottled,
      isSuspended: tab.suspended,
      zoomFactor: 1
    };
    
    if (!tab.suspended) {
      try {
        const memoryInfo = await tab.view.webContents.executeJavaScript(`
          performance.memory ? JSON.stringify({
            used: performance.memory.usedJSHeapSize,
            total: performance.memory.totalJSHeapSize,
            limit: performance.memory.jsHeapSizeLimit
          }) : null
        `);
        result.memoryUsage = memoryInfo ? JSON.parse(memoryInfo) : null;
        result.zoomFactor = tab.view.webContents.getZoomFactor();
      } catch (e) {
        // Memory info not available
      }
      
      try {
        if (process.getProcessMemoryInfo) {
          result.processMemory = await process.getProcessMemoryInfo();
        }
      } catch (e) {
        // Process memory info not available
      }
    }
    
    return result;
  }
}

module.exports = { TabManager };
