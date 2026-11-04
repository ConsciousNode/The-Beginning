/*
 * Vagrant Browser — ConsciousNode SoftWorks
 * MIT License
 *
 * Preload script - Context bridge for secure renderer-main communication
 */

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('vagrantAPI', {
  // Tab management
  newTab: (options) => ipcRenderer.invoke('tab:new', options),
  closeTab: (tabId) => ipcRenderer.invoke('tab:close', tabId),
  activateTab: (tabId) => ipcRenderer.invoke('tab:activate', tabId),
  getTabs: () => ipcRenderer.invoke('tab:list'),
  navigateTab: (tabId, url) => ipcRenderer.invoke('tab:navigate', tabId, url),
  reloadTab: (tabId) => ipcRenderer.invoke('tab:reload', tabId),
  goBack: (tabId) => ipcRenderer.invoke('tab:back', tabId),
  goForward: (tabId) => ipcRenderer.invoke('tab:forward', tabId),
  duplicateTab: (tabId) => ipcRenderer.invoke('tab:duplicate', tabId),
  
  // Navigation
  openFilePicker: (options) => ipcRenderer.invoke('file:open', options),
  saveFile: (content, filename) => ipcRenderer.invoke('file:save', content, filename),
  
  // Bookmarks
  saveBookmark: (bookmark) => ipcRenderer.invoke('bookmark:save', bookmark),
  getBookmarks: () => ipcRenderer.invoke('bookmark:list'),
  deleteBookmark: (id) => ipcRenderer.invoke('bookmark:delete', id),
  updateBookmark: (id, data) => ipcRenderer.invoke('bookmark:update', id, data),
  
  // History
  getHistory: (limit) => ipcRenderer.invoke('history:list', limit),
  clearHistory: (options) => ipcRenderer.invoke('history:clear', options),
  
  // Settings
  getSettings: () => ipcRenderer.invoke('settings:get'),
  setSetting: (key, value) => ipcRenderer.invoke('settings:set', key, value),
  
  // Resource management
  getTabResources: (tabId) => ipcRenderer.invoke('resources:tab', tabId),
  setTabMemoryLimit: (tabId, mb) => ipcRenderer.invoke('resources:set-memory', tabId, mb),
  setTabThrottling: (tabId, enabled) => ipcRenderer.invoke('resources:set-throttle', tabId, enabled),
  getSystemResources: () => ipcRenderer.invoke('resources:system'),
  suspendTab: (tabId) => ipcRenderer.invoke('tab:suspend', tabId),
  resumeTab: (tabId) => ipcRenderer.invoke('tab:resume', tabId),
  
  // Tab content
  getTabContent: (tabId) => ipcRenderer.invoke('tab:get-content', tabId),
  injectCSS: (tabId, css) => ipcRenderer.invoke('tab:inject-css', tabId, css),
  executeScript: (tabId, script) => ipcRenderer.invoke('tab:execute-script', tabId, script),
  findInPage: (tabId, text, options) => ipcRenderer.invoke('tab:find', tabId, text, options),
  stopFind: (tabId) => ipcRenderer.invoke('tab:stop-find', tabId),
  setZoom: (tabId, factor) => ipcRenderer.invoke('tab:zoom', tabId, factor),
  
  // Window
  minimizeWindow: () => ipcRenderer.invoke('window-minimize'),
  maximizeWindow: () => ipcRenderer.invoke('window-maximize'),
  closeWindow: () => ipcRenderer.invoke('window-close'),
  isMaximized: () => ipcRenderer.invoke('window-is-maximized'),
  
  // Events from main → renderer
  on: (channel, listener) => {
    const validChannels = [
      'tab:title-updated', 'tab:favicon-updated', 'tab:loading',
      'tab:nav-state', 'tab:crashed', 'tab:resource-update',
      'find:result'
    ];
    if (validChannels.includes(channel)) {
      ipcRenderer.on(channel, (event, ...args) => listener(...args));
    }
  },
  off: (channel, listener) => ipcRenderer.removeListener(channel, listener)
});
