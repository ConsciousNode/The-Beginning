/*
 * Vagrant Browser — ConsciousNode SoftWorks
 * MIT License
 *
 * Built-in Page Preload Bridge
 * Bridges built-in page ↔ main process communication.
 * Attached only to BrowserViews rendering about:* pages.
 */

const { ipcRenderer, contextBridge } = require('electron');

contextBridge.exposeInMainWorld('vagrantBridge', {
  // Send a command to the main process (navigate, save setting, etc.)
  send: (type, payload) => {
    ipcRenderer.send('builtin:command', { type, payload });
  },
  // Receive data pushed from main process into this page
  onData: (callback) => {
    ipcRenderer.on('builtin:data', (event, data) => callback(data));
  }
});
