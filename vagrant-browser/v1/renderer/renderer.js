/*
 * Vagrant Browser — ConsciousNode SoftWorks
 * MIT License
 * 
 * Renderer Process - Chrome UI logic and IPC communication
 */

/* ╔══════════════════════════╗
   ║     CONFIG               ║
   ╚══════════════════════════╝ */

const CONFIG = {
  zoomStep: 0.1,
  minZoom: 0.25,
  maxZoom: 5,
  memoryWarningThreshold: 200 * 1024 * 1024, // 200MB in bytes
  memoryCriticalThreshold: 500 * 1024 * 1024 // 500MB in bytes
};

/* ╔══════════════════════════╗
   ║     STATE                ║
   ╚══════════════════════════╝ */

const state = {
  tabs: [],
  activeTabId: null,
  zoomLevel: 1,
  readingMode: false,
  findActive: false,
  findResults: null,
  resourcePanelOpen: false,
  settings: {},
  closedTabs: []
};

/* ╔══════════════════════════╗
   ║     DOM ELEMENTS         ║
   ╚══════════════════════════╝ */

const elements = {
  // Titlebar
  titlebar: document.getElementById('titlebar'),
  minimizeBtn: document.getElementById('minimizeBtn'),
  maximizeBtn: document.getElementById('maximizeBtn'),
  closeBtn: document.getElementById('closeBtn'),
  cpuStat: document.getElementById('cpuStat'),
  memStat: document.getElementById('memStat'),
  
  // Tab strip
  tabsContainer: document.getElementById('tabsContainer'),
  newTabBtn: document.getElementById('newTabBtn'),
  
  // Navigation
  backBtn: document.getElementById('backBtn'),
  forwardBtn: document.getElementById('forwardBtn'),
  reloadBtn: document.getElementById('reloadBtn'),
  addressBar: document.getElementById('addressBar'),
  securityIndicator: document.getElementById('securityIndicator'),
  bookmarkBtn: document.getElementById('bookmarkBtn'),
  menuBtn: document.getElementById('menuBtn'),
  
  // Toolbar
  findBtn: document.getElementById('findBtn'),
  zoomOutBtn: document.getElementById('zoomOutBtn'),
  zoomInBtn: document.getElementById('zoomInBtn'),
  zoomLevel: document.getElementById('zoomLevel'),
  readingModeBtn: document.getElementById('readingModeBtn'),
  viewSourceBtn: document.getElementById('viewSourceBtn'),
  savePageBtn: document.getElementById('savePageBtn'),
  resourcePanelBtn: document.getElementById('resourcePanelBtn'),
  
  // Find bar
  findBar: document.getElementById('findBar'),
  findInput: document.getElementById('findInput'),
  findResult: document.getElementById('findResult'),
  findPrevBtn: document.getElementById('findPrevBtn'),
  findNextBtn: document.getElementById('findNextBtn'),
  findCloseBtn: document.getElementById('findCloseBtn'),
  matchCase: document.getElementById('matchCase'),
  
  // Status bar
  statusText: document.getElementById('statusText'),
  tabMemory: document.getElementById('tabMemory'),
  loadingIndicator: document.getElementById('loadingIndicator'),
  
  // Resource panel
  resourcePanel: document.getElementById('resourcePanel'),
  closeResourcePanel: document.getElementById('closeResourcePanel'),
  sysTotalRam: document.getElementById('sysTotalRam'),
  sysFreeRam: document.getElementById('sysFreeRam'),
  ramBar: document.getElementById('ramBar'),
  sysCpu: document.getElementById('sysCpu'),
  sysVersions: document.getElementById('sysVersions'),
  tabResourcesList: document.getElementById('tabResourcesList'),
  defaultMemoryLimit: document.getElementById('defaultMemoryLimit'),
  autoSuspendGlobal: document.getElementById('autoSuspendGlobal'),
  suspendAllBtn: document.getElementById('suspendAllBtn'),
  resumeAllBtn: document.getElementById('resumeAllBtn'),
  reloadAllBtn: document.getElementById('reloadAllBtn'),
  
  // Bookmark modal
  bookmarkModal: document.getElementById('bookmarkModal'),
  bookmarkName: document.getElementById('bookmarkName'),
  bookmarkUrl: document.getElementById('bookmarkUrl'),
  bookmarkTags: document.getElementById('bookmarkTags'),
  bookmarkNotes: document.getElementById('bookmarkNotes'),
  bookmarkSize: document.getElementById('bookmarkSize'),
  bookmarkWarning: document.getElementById('bookmarkWarning'),
  cancelBookmark: document.getElementById('cancelBookmark'),
  saveBookmark: document.getElementById('saveBookmark'),
  
  // Menus
  contextMenu: document.getElementById('contextMenu'),
  mainMenu: document.getElementById('mainMenu')
};

/* ╔══════════════════════════╗
   ║     TAB STRIP            ║
   ╚══════════════════════════╝ */

function renderTabs() {
  elements.tabsContainer.innerHTML = '';
  
  state.tabs.forEach(tab => {
    const tabEl = document.createElement('div');
    tabEl.className = `tab ${tab.active ? 'active' : ''} ${tab.suspended ? 'suspended' : ''}`;
    tabEl.dataset.tabId = tab.id;
    tabEl.draggable = true;
    
    // Memory badge
    if (tab.memoryUsage) {
      const usedMB = tab.memoryUsage.used / (1024 * 1024);
      if (usedMB > 200) {
        const badge = document.createElement('div');
        badge.className = `tab-memory-badge ${usedMB > 500 ? 'critical' : ''}`;
        tabEl.appendChild(badge);
      }
    }
    
    // Favicon
    const favicon = document.createElement('div');
    favicon.className = 'tab-favicon';
    if (tab.favicon) {
      const img = document.createElement('img');
      img.src = tab.favicon;
      img.onerror = () => { favicon.textContent = '📄'; };
      favicon.appendChild(img);
    } else {
      favicon.textContent = tab.suspended ? '⏸' : '📄';
    }
    
    // Title
    const title = document.createElement('span');
    title.className = 'tab-title';
    title.textContent = tab.title || 'New Tab';
    title.title = tab.title || 'New Tab';
    
    // Close button
    const closeBtn = document.createElement('button');
    closeBtn.className = 'tab-close';
    closeBtn.textContent = '×';
    closeBtn.title = 'Close tab';
    closeBtn.onclick = (e) => {
      e.stopPropagation();
      closeTab(tab.id);
    };
    
    tabEl.appendChild(favicon);
    tabEl.appendChild(title);
    tabEl.appendChild(closeBtn);
    
    // Events
    tabEl.onclick = () => activateTab(tab.id);
    tabEl.onauxclick = (e) => {
      if (e.button === 1) { // Middle click
        closeTab(tab.id);
      }
    };
    tabEl.oncontextmenu = (e) => showTabContextMenu(e, tab.id);
    
    // Drag events
    tabEl.ondragstart = (e) => {
      e.dataTransfer.setData('text/plain', tab.id);
      tabEl.style.opacity = '0.5';
    };
    tabEl.ondragend = () => {
      tabEl.style.opacity = '1';
    };
    tabEl.ondragover = (e) => {
      e.preventDefault();
    };
    tabEl.ondrop = (e) => {
      e.preventDefault();
      const draggedId = e.dataTransfer.getData('text/plain');
      if (draggedId !== tab.id) {
        reorderTabs(draggedId, tab.id);
      }
    };
    
    elements.tabsContainer.appendChild(tabEl);
  });
}

async function createTab(url = 'about:newtab') {
  const tabId = await window.vagrantAPI.newTab({ url });
  await refreshTabs();
  return tabId;
}

async function closeTab(tabId) {
  const tab = state.tabs.find(t => t.id === tabId);
  if (tab) {
    state.closedTabs.push({ url: tab.url, title: tab.title });
  }
  
  await window.vagrantAPI.closeTab(tabId);
  await refreshTabs();
}

async function activateTab(tabId) {
  await window.vagrantAPI.activateTab(tabId);
  state.activeTabId = tabId;
  await refreshTabs();
  updateNavigationState();
}

async function refreshTabs() {
  state.tabs = await window.vagrantAPI.getTabs();
  const activeTab = state.tabs.find(t => t.active);
  if (activeTab) {
    state.activeTabId = activeTab.id;
    elements.addressBar.value = activeTab.url || '';
  }
  renderTabs();
  updateNavigationState();
}

function reorderTabs(draggedId, targetId) {
  const draggedIndex = state.tabs.findIndex(t => t.id === draggedId);
  const targetIndex = state.tabs.findIndex(t => t.id === targetId);
  
  if (draggedIndex !== -1 && targetIndex !== -1) {
    const [dragged] = state.tabs.splice(draggedIndex, 1);
    state.tabs.splice(targetIndex, 0, dragged);
    renderTabs();
  }
}

function updateNavigationState() {
  const activeTab = state.tabs.find(t => t.id === state.activeTabId);
  if (activeTab) {
    elements.backBtn.disabled = !activeTab.canGoBack;
    elements.forwardBtn.disabled = !activeTab.canGoForward;
  }
}

/* ╔══════════════════════════╗
   ║     ADDRESS BAR          ║
   ╚══════════════════════════╝ */

async function navigateTo(url) {
  if (!state.activeTabId) return;
  
  // Handle special URLs
  let processedUrl = url.trim();
  
  if (processedUrl.startsWith('about:')) {
    // Built-in pages
  } else if (processedUrl.startsWith('file://')) {
    // File URLs
  } else if (processedUrl.startsWith('http://') || processedUrl.startsWith('https://')) {
    // Block network URLs - show error
    showStatus('Network access is disabled', 'error');
    return;
  } else if (processedUrl.startsWith('/')) {
    // Absolute path
    processedUrl = `file://${processedUrl}`;
  } else if (processedUrl.includes('/') || processedUrl.includes('\\')) {
    // Likely a file path
    processedUrl = `file://${processedUrl}`;
  } else {
    // Try as about: URL
    processedUrl = `about:${processedUrl}`;
  }
  
  await window.vagrantAPI.navigateTab(state.activeTabId, processedUrl);
  elements.addressBar.blur();
}

function showStatus(text, type = 'info') {
  elements.statusText.textContent = text;
  elements.statusText.className = 'status-text';
  if (type === 'error') {
    elements.statusText.style.color = 'var(--error)';
  } else {
    elements.statusText.style.color = '';
  }
  
  setTimeout(() => {
    elements.statusText.textContent = '';
    elements.statusText.style.color = '';
  }, 3000);
}

/* ╔══════════════════════════╗
   ║     TOOLBAR ACTIONS      ║
   ╚══════════════════════════╝ */

async function toggleFindBar() {
  state.findActive = !state.findActive;
  elements.findBar.classList.toggle('hidden', !state.findActive);
  
  if (state.findActive) {
    elements.findInput.focus();
    elements.findInput.select();
  } else {
    await window.vagrantAPI.stopFind(state.activeTabId);
    elements.findResult.textContent = '';
  }
}

async function findInPage(direction = 'next') {
  if (!state.activeTabId || !elements.findInput.value) return;
  
  const options = {
    forward: direction === 'next',
    matchCase: elements.matchCase.checked
  };
  
  await window.vagrantAPI.findInPage(state.activeTabId, elements.findInput.value, options);
}

async function zoomIn() {
  if (!state.activeTabId) return;
  state.zoomLevel = Math.min(state.zoomLevel + CONFIG.zoomStep, CONFIG.maxZoom);
  await window.vagrantAPI.setZoom(state.activeTabId, state.zoomLevel);
  updateZoomDisplay();
}

async function zoomOut() {
  if (!state.activeTabId) return;
  state.zoomLevel = Math.max(state.zoomLevel - CONFIG.zoomStep, CONFIG.minZoom);
  await window.vagrantAPI.setZoom(state.activeTabId, state.zoomLevel);
  updateZoomDisplay();
}

async function resetZoom() {
  if (!state.activeTabId) return;
  state.zoomLevel = 1;
  await window.vagrantAPI.setZoom(state.activeTabId, state.zoomLevel);
  updateZoomDisplay();
}

function updateZoomDisplay() {
  elements.zoomLevel.textContent = `${Math.round(state.zoomLevel * 100)}%`;
}

async function toggleReadingMode() {
  if (!state.activeTabId) return;
  
  state.readingMode = !state.readingMode;
  elements.readingModeBtn.classList.toggle('active', state.readingMode);
  
  if (state.readingMode) {
    const readingCSS = `
      body > *:not(main):not(article):not([role="main"]):not(.content):not(#content) { display: none !important; }
      body { background: #0a0a0a !important; color: #e5e5e5 !important; font-family: Georgia, serif !important; }
      main, article, [role="main"], .content, #content { max-width: 680px !important; margin: 40px auto !important; padding: 0 24px !important; font-size: 18px !important; line-height: 1.7 !important; display: block !important; }
      img { max-width: 100% !important; }
      a { color: #14b8a6 !important; }
    `;
    await window.vagrantAPI.injectCSS(state.activeTabId, readingCSS);
    showStatus('Reading mode enabled');
  } else {
    await window.vagrantAPI.reloadTab(state.activeTabId);
    showStatus('Reading mode disabled');
  }
}

async function viewSource() {
  if (!state.activeTabId) return;
  await window.vagrantAPI.executeScript(state.activeTabId, 'viewSource()');
}

async function savePage() {
  if (!state.activeTabId) return;
  const activeTab = state.tabs.find(t => t.id === state.activeTabId);
  if (activeTab) {
    const content = await window.vagrantAPI.getTabContent(state.activeTabId);
    if (content) {
      const filename = `${activeTab.title || 'page'}.html`;
      await window.vagrantAPI.saveFile(content, filename);
      showStatus('Page saved');
    }
  }
}

/* ╔══════════════════════════╗
   ║     BOOKMARKS            ║
   ╚══════════════════════════╝ */

async function showBookmarkModal() {
  if (!state.activeTabId) return;
  
  const activeTab = state.tabs.find(t => t.id === state.activeTabId);
  if (!activeTab) return;
  
  elements.bookmarkName.value = activeTab.title || '';
  elements.bookmarkUrl.value = activeTab.url || '';
  elements.bookmarkTags.value = '';
  elements.bookmarkNotes.value = '';
  elements.bookmarkWarning.classList.add('hidden');
  
  // Get page content for size estimation
  const content = await window.vagrantAPI.getTabContent(state.activeTabId);
  const size = content ? content.length : 0;
  elements.bookmarkSize.textContent = formatBytes(size);
  
  if (size > 5 * 1024 * 1024) {
    elements.bookmarkWarning.textContent = 'Warning: Large page (>5MB). Bookmark may use significant storage.';
    elements.bookmarkWarning.classList.remove('hidden');
  } else if (size > 1024 * 1024) {
    elements.bookmarkWarning.textContent = 'Note: Page is >1MB';
    elements.bookmarkWarning.classList.remove('hidden');
  }
  
  elements.bookmarkModal.classList.remove('hidden');
}

async function saveBookmark() {
  if (!state.activeTabId) return;
  
  const content = await window.vagrantAPI.getTabContent(state.activeTabId);
  
  const bookmark = {
    name: elements.bookmarkName.value || 'Untitled',
    sourceIdentifier: elements.bookmarkUrl.value,
    content: content || '',
    title: elements.bookmarkName.value,
    favicon: state.tabs.find(t => t.id === state.activeTabId)?.favicon,
    tags: elements.bookmarkTags.value.split(',').map(t => t.trim()).filter(Boolean),
    notes: elements.bookmarkNotes.value
  };
  
  await window.vagrantAPI.saveBookmark(bookmark);
  elements.bookmarkModal.classList.add('hidden');
  showStatus('Bookmark saved');
}

/* ╔══════════════════════════╗
   ║     RESOURCE PANEL       ║
   ╚══════════════════════════╝ */

function toggleResourcePanel() {
  state.resourcePanelOpen = !state.resourcePanelOpen;
  elements.resourcePanel.classList.toggle('open', state.resourcePanelOpen);
  
  if (state.resourcePanelOpen) {
    updateResourcePanel();
  }
}

async function updateResourcePanel() {
  // System resources
  const sysResources = await window.vagrantAPI.getSystemResources();
  elements.sysTotalRam.textContent = formatBytes(sysResources.totalMemory);
  elements.sysFreeRam.textContent = formatBytes(sysResources.freeMemory);
  elements.sysCpu.textContent = `${sysResources.cpuCount} cores`;
  elements.sysVersions.textContent = `Electron ${sysResources.electronVersion} · Chromium ${sysResources.chromeVersion}`;
  
  const usedRam = sysResources.totalMemory - sysResources.freeMemory;
  const ramPercent = (usedRam / sysResources.totalMemory) * 100;
  elements.ramBar.style.width = `${ramPercent}%`;
  
  // Tab resources
  const tabResources = [];
  for (const tab of state.tabs) {
    const resources = await window.vagrantAPI.getTabResources(tab.id);
    if (resources) {
      tabResources.push({ tabId: tab.id, title: tab.title, ...resources });
    }
  }
  
  renderTabResources(tabResources);
}

function renderTabResources(tabResources) {
  elements.tabResourcesList.innerHTML = '';
  
  tabResources.forEach(res => {
    const item = document.createElement('div');
    item.className = 'tab-resource-item';
    
    const usedMB = res.memoryUsage ? res.memoryUsage.used / (1024 * 1024) : 0;
    const limitMB = res.memoryUsage ? res.memoryUsage.limit / (1024 * 1024) : 512;
    const percent = Math.min((usedMB / limitMB) * 100, 100);
    
    let fillClass = 'normal';
    if (percent > 80) fillClass = 'critical';
    else if (percent > 60) fillClass = 'warning';
    
    item.innerHTML = `
      <div class="tab-resource-header">
        <span class="tab-resource-title">${res.title || 'Untitled'}</span>
        <div class="tab-resource-actions">
          <button class="tab-action-btn" title="Suspend" onclick="suspendTab('${res.tabId}')">⏸</button>
          <button class="tab-action-btn danger" title="Kill" onclick="killTab('${res.tabId}')">✕</button>
        </div>
      </div>
      <div class="tab-memory-bar">
        <div class="tab-memory-fill ${fillClass}" style="width: ${percent}%"></div>
      </div>
      <div class="tab-resource-controls">
        <span>${Math.round(usedMB)}MB / ${Math.round(limitMB)}MB</span>
        <input type="number" value="${Math.round(limitMB)}" min="64" max="4096" 
               onchange="setTabMemoryLimit('${res.tabId}', this.value)">
      </div>
    `;
    
    elements.tabResourcesList.appendChild(item);
  });
}

async function suspendTab(tabId) {
  await window.vagrantAPI.suspendTab(tabId);
  await refreshTabs();
  updateResourcePanel();
}

async function resumeTab(tabId) {
  await window.vagrantAPI.resumeTab(tabId);
  await refreshTabs();
  updateResourcePanel();
}

async function killTab(tabId) {
  if (confirm('Force kill this tab? Unsaved data will be lost.')) {
    // This would need to be implemented in tab-manager
    await refreshTabs();
    updateResourcePanel();
  }
}

async function setTabMemoryLimit(tabId, mb) {
  await window.vagrantAPI.setTabMemoryLimit(tabId, parseInt(mb));
}

/* ╔══════════════════════════╗
   ║     CONTEXT MENUS        ║
   ╚══════════════════════════╝ */

let contextMenuTargetTabId = null;

function showTabContextMenu(e, tabId) {
  e.preventDefault();
  contextMenuTargetTabId = tabId;
  
  elements.contextMenu.style.left = `${e.clientX}px`;
  elements.contextMenu.style.top = `${e.clientY}px`;
  elements.contextMenu.classList.remove('hidden');
}

function hideContextMenu() {
  elements.contextMenu.classList.add('hidden');
  contextMenuTargetTabId = null;
}

function showMainMenu() {
  const rect = elements.menuBtn.getBoundingClientRect();
  elements.mainMenu.style.left = `${rect.right - 180}px`;
  elements.mainMenu.style.top = `${rect.bottom + 4}px`;
  elements.mainMenu.classList.remove('hidden');
}

function hideMainMenu() {
  elements.mainMenu.classList.add('hidden');
}

/* ╔══════════════════════════╗
   ║     KEYBOARD SHORTCUTS   ║
   ╚══════════════════════════╝ */

document.addEventListener('keydown', async (e) => {
  // Don't handle if in input/textarea
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
    if (e.key === 'Escape') {
      e.target.blur();
    }
    return;
  }
  
  const ctrl = e.ctrlKey || e.metaKey;
  
  // Tab management
  if (ctrl && e.key === 't') {
    e.preventDefault();
    await createTab();
  } else if (ctrl && e.key === 'w') {
    e.preventDefault();
    if (state.activeTabId) {
      await closeTab(state.activeTabId);
    }
  } else if (ctrl && e.key === 'Tab') {
    e.preventDefault();
    const currentIndex = state.tabs.findIndex(t => t.id === state.activeTabId);
    const nextIndex = e.shiftKey 
      ? (currentIndex - 1 + state.tabs.length) % state.tabs.length
      : (currentIndex + 1) % state.tabs.length;
    if (state.tabs[nextIndex]) {
      await activateTab(state.tabs[nextIndex].id);
    }
  } else if (ctrl && e.shiftKey && e.key === 'T') {
    e.preventDefault();
    // Reopen closed tab
    if (state.closedTabs.length > 0) {
      const closed = state.closedTabs.pop();
      await createTab(closed.url);
    }
  }
  
  // Navigation
  else if (ctrl && e.key === 'l') {
    e.preventDefault();
    elements.addressBar.focus();
    elements.addressBar.select();
  } else if (ctrl && e.key === 'r') {
    e.preventDefault();
    if (state.activeTabId) {
      await window.vagrantAPI.reloadTab(state.activeTabId);
    }
  } else if (e.key === 'F5') {
    e.preventDefault();
    if (state.activeTabId) {
      await window.vagrantAPI.reloadTab(state.activeTabId);
    }
  } else if (e.altKey && e.key === 'ArrowLeft') {
    e.preventDefault();
    if (state.activeTabId) {
      await window.vagrantAPI.goBack(state.activeTabId);
    }
  } else if (e.altKey && e.key === 'ArrowRight') {
    e.preventDefault();
    if (state.activeTabId) {
      await window.vagrantAPI.goForward(state.activeTabId);
    }
  }
  
  // Bookmarks & History
  else if (ctrl && e.key === 'd') {
    e.preventDefault();
    await showBookmarkModal();
  } else if (ctrl && e.shiftKey && e.key === 'O') {
    e.preventDefault();
    await createTab('about:bookmarks');
  } else if (ctrl && e.key === 'h') {
    e.preventDefault();
    await createTab('about:history');
  }
  
  // Find
  else if (ctrl && e.key === 'f') {
    e.preventDefault();
    await toggleFindBar();
  } else if (e.key === 'Escape') {
    if (state.findActive) {
      await toggleFindBar();
    } else if (state.resourcePanelOpen) {
      toggleResourcePanel();
    } else {
      hideContextMenu();
      hideMainMenu();
    }
  }
  
  // Zoom
  else if (ctrl && (e.key === '=' || e.key === '+')) {
    e.preventDefault();
    await zoomIn();
  } else if (ctrl && e.key === '-') {
    e.preventDefault();
    await zoomOut();
  } else if (ctrl && e.key === '0') {
    e.preventDefault();
    await resetZoom();
  }
  
  // File operations
  else if (ctrl && e.key === 's') {
    e.preventDefault();
    await savePage();
  } else if (ctrl && e.key === 'o') {
    e.preventDefault();
    const url = await window.vagrantAPI.openFilePicker();
    if (url) {
      await createTab(url);
    }
  }
  
  // Settings & Resources
  else if (ctrl && e.key === ',') {
    e.preventDefault();
    await createTab('about:settings');
  } else if (ctrl && e.shiftKey && e.key === 'M') {
    e.preventDefault();
    toggleResourcePanel();
  }
  
  // View source
  else if (ctrl && e.key === 'u') {
    e.preventDefault();
    await viewSource();
  }
  
  // Fullscreen
  else if (e.key === 'F11') {
    // Handled by Electron
  }
  
  // Tab switching (Ctrl+1-8, Ctrl+9)
  else if (ctrl && e.key >= '1' && e.key <= '8') {
    e.preventDefault();
    const index = parseInt(e.key) - 1;
    if (state.tabs[index]) {
      await activateTab(state.tabs[index].id);
    }
  } else if (ctrl && e.key === '9') {
    e.preventDefault();
    if (state.tabs.length > 0) {
      await activateTab(state.tabs[state.tabs.length - 1].id);
    }
  }
});

/* ╔══════════════════════════╗
   ║     EVENT LISTENERS      ║
   ╚══════════════════════════╝ */

// Window controls
elements.minimizeBtn.onclick = () => window.vagrantAPI.minimizeWindow();
elements.maximizeBtn.onclick = () => window.vagrantAPI.maximizeWindow();
elements.closeBtn.onclick = () => window.vagrantAPI.closeWindow();

// Tab strip
elements.newTabBtn.onclick = () => createTab();

// Navigation
elements.backBtn.onclick = () => state.activeTabId && window.vagrantAPI.goBack(state.activeTabId);
elements.forwardBtn.onclick = () => state.activeTabId && window.vagrantAPI.goForward(state.activeTabId);
elements.reloadBtn.onclick = () => state.activeTabId && window.vagrantAPI.reloadTab(state.activeTabId);

elements.addressBar.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    navigateTo(elements.addressBar.value);
  }
});

elements.bookmarkBtn.onclick = showBookmarkModal;
elements.menuBtn.onclick = showMainMenu;

// Toolbar
elements.findBtn.onclick = toggleFindBar;
elements.zoomOutBtn.onclick = zoomOut;
elements.zoomInBtn.onclick = zoomIn;
elements.readingModeBtn.onclick = toggleReadingMode;
elements.viewSourceBtn.onclick = viewSource;
elements.savePageBtn.onclick = savePage;
elements.resourcePanelBtn.onclick = toggleResourcePanel;

// Find bar
elements.findInput.addEventListener('input', () => findInPage('next'));
elements.findPrevBtn.onclick = () => findInPage('prev');
elements.findNextBtn.onclick = () => findInPage('next');
elements.findCloseBtn.onclick = toggleFindBar;

// Resource panel
elements.closeResourcePanel.onclick = toggleResourcePanel;
elements.suspendAllBtn.onclick = async () => {
  for (const tab of state.tabs) {
    if (tab.id !== state.activeTabId) {
      await window.vagrantAPI.suspendTab(tab.id);
    }
  }
  await refreshTabs();
  updateResourcePanel();
};
elements.resumeAllBtn.onclick = async () => {
  for (const tab of state.tabs) {
    if (tab.suspended) {
      await window.vagrantAPI.resumeTab(tab.id);
    }
  }
  await refreshTabs();
  updateResourcePanel();
};
elements.reloadAllBtn.onclick = async () => {
  if (confirm('Reload all tabs?')) {
    for (const tab of state.tabs) {
      await window.vagrantAPI.reloadTab(tab.id);
    }
  }
};

// Bookmark modal
elements.cancelBookmark.onclick = () => elements.bookmarkModal.classList.add('hidden');
elements.saveBookmark.onclick = saveBookmark;

// Context menu
elements.contextMenu.querySelectorAll('.menu-item').forEach(item => {
  item.onclick = async () => {
    const action = item.dataset.action;
    const tabId = contextMenuTargetTabId;
    
    switch (action) {
      case 'close':
        await closeTab(tabId);
        break;
      case 'closeOthers':
        for (const tab of state.tabs) {
          if (tab.id !== tabId) {
            await closeTab(tab.id);
          }
        }
        break;
      case 'closeRight':
        const index = state.tabs.findIndex(t => t.id === tabId);
        for (let i = state.tabs.length - 1; i > index; i--) {
          await closeTab(state.tabs[i].id);
        }
        break;
      case 'duplicate':
        await window.vagrantAPI.duplicateTab(tabId);
        await refreshTabs();
        break;
      case 'pin':
        // Pin functionality would be implemented
        break;
      case 'suspend':
        await window.vagrantAPI.suspendTab(tabId);
        await refreshTabs();
        break;
      case 'reload':
        await window.vagrantAPI.reloadTab(tabId);
        break;
    }
    hideContextMenu();
  };
});

// Main menu
elements.mainMenu.querySelectorAll('.menu-item').forEach(item => {
  item.onclick = async () => {
    const action = item.dataset.action;
    
    switch (action) {
      case 'newTab':
        await createTab();
        break;
      case 'newWindow':
        // Would need additional implementation
        break;
      case 'bookmarks':
        await createTab('about:bookmarks');
        break;
      case 'history':
        await createTab('about:history');
        break;
      case 'downloads':
        // Would need download manager
        break;
      case 'zoomIn':
        await zoomIn();
        break;
      case 'zoomOut':
        await zoomOut();
        break;
      case 'resetZoom':
        await resetZoom();
        break;
      case 'settings':
        await createTab('about:settings');
        break;
      case 'help':
        // Would show help page
        break;
      case 'exit':
        window.vagrantAPI.closeWindow();
        break;
    }
    hideMainMenu();
  };
});

// Close menus on click outside
document.addEventListener('click', (e) => {
  if (!elements.contextMenu.contains(e.target)) {
    hideContextMenu();
  }
  if (!elements.mainMenu.contains(e.target) && !elements.menuBtn.contains(e.target)) {
    hideMainMenu();
  }
});

// IPC Events from main
window.vagrantAPI.on('tab:title-updated', ({ tabId, title }) => {
  const tab = state.tabs.find(t => t.id === tabId);
  if (tab) {
    tab.title = title;
    renderTabs();
  }
});

window.vagrantAPI.on('tab:favicon-updated', ({ tabId, favicon }) => {
  const tab = state.tabs.find(t => t.id === tabId);
  if (tab) {
    tab.favicon = favicon;
    renderTabs();
  }
});

window.vagrantAPI.on('tab:loading', ({ tabId, loading }) => {
  const tab = state.tabs.find(t => t.id === tabId);
  if (tab) {
    tab.isLoading = loading;
    if (tab.active) {
      elements.loadingIndicator.classList.toggle('hidden', !loading);
    }
    renderTabs();
  }
});

window.vagrantAPI.on('tab:nav-state', ({ tabId, canGoBack, canGoForward }) => {
  const tab = state.tabs.find(t => t.id === tabId);
  if (tab) {
    tab.canGoBack = canGoBack;
    tab.canGoForward = canGoForward;
    if (tab.active) {
      updateNavigationState();
    }
  }
});

window.vagrantAPI.on('tab:crashed', ({ tabId, reason }) => {
  showStatus(`Tab crashed: ${reason}`, 'error');
});

window.vagrantAPI.on('tab:resource-update', (updates) => {
  updates.forEach(update => {
    const tab = state.tabs.find(t => t.id === update.tabId);
    if (tab) {
      tab.memoryUsage = update.memoryUsage;
    }
  });
  renderTabs();
  
  if (state.resourcePanelOpen) {
    updateResourcePanel();
  }
});

window.vagrantAPI.on('find:result', ({ tabId, result }) => {
  if (result && result.matches > 0) {
    elements.findResult.textContent = `${result.activeMatchOrdinal} of ${result.matches}`;
  } else {
    elements.findResult.textContent = '0/0';
  }
});

/* ╔══════════════════════════╗
   ║     UTILITIES            ║
   ╚══════════════════════════╝ */

function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/* ╔══════════════════════════╗
   ║     INITIALIZATION       ║
   ╚══════════════════════════╝ */

async function init() {
  // Load settings
  state.settings = await window.vagrantAPI.getSettings();
  
  // Apply theme
  if (state.settings.theme === 'light') {
    document.body.classList.remove('theme-dark');
    document.body.classList.add('theme-light');
  }
  
  // Apply accent color
  if (state.settings.accentColor) {
    document.documentElement.style.setProperty('--accent', state.settings.accentColor);
  }
  
  // Initial tab load
  await refreshTabs();
  
  // Update maximize button based on window state
  const isMaximized = await window.vagrantAPI.isMaximized();
  updateMaximizeButton(isMaximized);
}

function updateMaximizeButton(isMaximized) {
  const svg = elements.maximizeBtn.querySelector('svg');
  if (isMaximized) {
    svg.innerHTML = '<rect x="2" y="2" width="8" height="8" fill="none" stroke="currentColor" stroke-width="1"/><rect x="4" y="4" width="6" height="6" fill="none" stroke="currentColor" stroke-width="1"/>';
  } else {
    svg.innerHTML = '<rect x="1.5" y="1.5" width="9" height="9" fill="none" stroke="currentColor" stroke-width="1"/>';
  }
}

// Start
init();
