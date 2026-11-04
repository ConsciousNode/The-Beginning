/*
 * Vagrant Browser — ConsciousNode SoftWorks
 * MIT License
 *
 * A fully-featured browser that treats your disk as the internet.
 * No network. No telemetry. No external resources. No surveillance.
 * What a browser does, minus the part where it leaves your machine.
 *
 * Stack: Electron + Chromium + Node.js
 * Network: dead by architecture, not by configuration
 * Tabs: isolated BrowserView processes
 * Storage: electron-store + IndexedDB per partition
 * Resource control: per-tab memory limits, CPU throttling, suspension
 *
 * The address bar goes inward.
 * Your disk is the whole world.
 */

/* ╔══════════════════════════╗
   ║     CONFIG               ║
   ╚══════════════════════════╝ */

const { app, BrowserWindow, BrowserView, ipcMain, session, dialog, Menu, shell } = require('electron');
const path = require('path');
const os = require('os');
const fs = require('fs');

// Source modules
const { killNetwork } = require('./src/network-kill');
const { TabManager } = require('./src/tab-manager');
const { IPCHandlers } = require('./src/ipc-handlers');
const { Storage } = require('./src/storage');
const { ResourceMonitor } = require('./src/resource-monitor');

// Global references
let mainWindow = null;
let tabManager = null;
let ipcHandlers = null;
let storage = null;
let resourceMonitor = null;

// Default settings
const DEFAULT_SETTINGS = {
  theme: 'dark',
  accentColor: '#14b8a6',
  uiFontSize: 14,
  tabStripPosition: 'top',
  showTabMemoryBadges: true,
  defaultTabMemoryLimit: 512,
  autoSuspendOverLimit: false,
  autoSuspendBackgroundAfter: 'never',
  backgroundCpuThrottling: true,
  rendererProcessPriority: 'normal',
  preloadHistory: false,
  maxConcurrentTabs: 20,
  historyLimit: 1000,
  defaultOpenDirectory: 'last-used',
  markdownRendering: true,
  pdfRendering: true,
  autoDetectFileType: true,
  enableJavaScript: true,
  enableImages: true,
  showSecurityIndicator: true,
  enableDevTools: false,
  showAboutStorage: false,
  enableJuntoNode: false
};

/* ╔══════════════════════════╗
   ║     NETWORK KILL         ║
   ╚══════════════════════════╝ */

// Apply network kill to default session immediately
killNetwork(session.defaultSession);

/* ╔══════════════════════════╗
   ║     WINDOW SETUP         ║
   ╚══════════════════════════╝ */

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    frame: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    },
    backgroundColor: '#0a0a0a',
    show: false
  });

  mainWindow.loadFile('renderer/index.html');

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    
    // Initialize tab manager after window is ready
    tabManager = new TabManager(mainWindow, storage);
    ipcHandlers = new IPCHandlers(mainWindow, tabManager, storage);
    resourceMonitor = new ResourceMonitor(tabManager, mainWindow);
    
    // Create initial tab
    tabManager.createTab('about:newtab');
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
    tabManager = null;
    ipcHandlers = null;
    resourceMonitor = null;
  });

  mainWindow.on('resize', () => {
    if (tabManager) {
      tabManager.updateAllTabBounds();
    }
  });

  return mainWindow;
}

/* ╔══════════════════════════╗
   ║     APP LIFECYCLE        ║
   ╚══════════════════════════╝ */

app.whenReady().then(() => {
  // Initialize storage
  storage = new Storage();
  
  // Ensure default settings exist
  const settings = storage.getSettings();
  for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
    if (settings[key] === undefined) {
      storage.setSetting(key, value);
    }
  }

  createMainWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Prevent new window creation (force all links to open in same window)
app.on('web-contents-created', (event, contents) => {
  contents.setWindowOpenHandler(({ url }) => {
    if (tabManager && mainWindow) {
      tabManager.createTab(url);
    }
    return { action: 'deny' };
  });
});

/* ╔══════════════════════════╗
   ║     EXPORTS              ║
   ╚══════════════════════════╝ */

module.exports = {
  getMainWindow: () => mainWindow,
  getTabManager: () => tabManager,
  getStorage: () => storage,
  getResourceMonitor: () => resourceMonitor
};
