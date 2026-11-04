/*
 * Vagrant Browser — ConsciousNode SoftWorks
 * MIT License
 *
 * Resource Monitor - Per-tab memory/CPU tracking and management
 */

const os = require('os');

/* ╔══════════════════════════╗
   ║     RESOURCE MONITOR     ║
   ╚══════════════════════════╝ */

class ResourceMonitor {
  constructor(tabManager, mainWindow) {
    this.tabManager = tabManager;
    this.mainWindow = mainWindow;
    this.stats = new Map(); // tabId -> { pid, memoryUsage, lastUpdate }
    this.interval = null;
    this.pollInterval = 3000; // 3 seconds
    
    this.startMonitoring();
  }

  /**
   * Start the resource monitoring loop
   */
  startMonitoring() {
    if (this.interval) {
      clearInterval(this.interval);
    }
    
    this.interval = setInterval(() => {
      this.pollResources();
    }, this.pollInterval);
  }

  /**
   * Stop the resource monitoring loop
   */
  stopMonitoring() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }

  /**
   * Poll resources for all tabs
   */
  async pollResources() {
    if (!this.tabManager || !this.mainWindow) return;
    
    const tabs = this.tabManager.getTabsList();
    const updates = [];
    
    for (const tab of tabs) {
      try {
        const resources = await this.tabManager.getTabResources(tab.id);
        if (resources) {
          this.stats.set(tab.id, {
            ...resources,
            lastUpdate: Date.now()
          });
          
          updates.push({
            tabId: tab.id,
            ...resources
          });
          
          // Check memory limit
          this.checkMemoryLimit(tab.id, resources);
        }
      } catch (e) {
        // Tab may have been closed
      }
    }
    
    // Broadcast update to renderer
    if (updates.length > 0 && this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send('tab:resource-update', updates);
    }
  }

  /**
   * Check if a tab exceeds its memory limit
   */
  checkMemoryLimit(tabId, resources) {
    const tab = this.tabManager.getTab(tabId);
    if (!tab || !resources.memoryUsage) return;
    
    const usedMB = resources.memoryUsage.used / (1024 * 1024);
    const limitMB = tab.memoryLimit;
    
    // Soft limit warning
    if (usedMB > limitMB) {
      // Notify renderer of memory warning
      if (this.mainWindow && !this.mainWindow.isDestroyed()) {
        this.mainWindow.webContents.send('tab:memory-warning', {
          tabId,
          used: usedMB,
          limit: limitMB
        });
      }
      
      // Auto-suspend if enabled (would check settings here)
      // For now, just warn
    }
  }

  /**
   * Get current stats for a tab
   */
  getStats(tabId) {
    return this.stats.get(tabId);
  }

  /**
   * Get all stats
   */
  getAllStats() {
    const result = {};
    for (const [tabId, stats] of this.stats) {
      result[tabId] = stats;
    }
    return result;
  }

  /**
   * Get system resource info
   */
  getSystemResources() {
    return {
      totalMemory: os.totalmem(),
      freeMemory: os.freemem(),
      usedMemory: os.totalmem() - os.freemem(),
      cpuCount: os.cpus().length,
      cpuModel: os.cpus()[0]?.model || 'Unknown',
      platform: process.platform,
      electronVersion: process.versions.electron,
      nodeVersion: process.versions.node,
      chromeVersion: process.versions.chrome
    };
  }

  /**
   * Suspend all background tabs
   */
  suspendAllBackgroundTabs() {
    const activeTabId = this.tabManager.getActiveTabId();
    const tabs = this.tabManager.getTabsList();
    
    for (const tab of tabs) {
      if (tab.id !== activeTabId && !tab.suspended) {
        this.tabManager.suspendTab(tab.id);
      }
    }
  }

  /**
   * Resume all suspended tabs
   */
  resumeAllTabs() {
    const tabs = this.tabManager.getTabsList();
    
    for (const tab of tabs) {
      if (tab.suspended) {
        this.tabManager.resumeTab(tab.id);
      }
    }
  }

  /**
   * Reload all tabs
   */
  reloadAllTabs() {
    const tabs = this.tabManager.getTabsList();
    
    for (const tab of tabs) {
      this.tabManager.reloadTab(tab.id);
    }
  }

  /**
   * Set the polling interval
   */
  setPollInterval(ms) {
    this.pollInterval = ms;
    this.startMonitoring(); // Restart with new interval
  }

  /**
   * Force kill a tab (nuclear option)
   */
  forceKillTab(tabId) {
    return this.tabManager.forceKillTab(tabId);
  }

  /**
   * Get memory usage summary
   */
  getMemorySummary() {
    let totalUsed = 0;
    let totalLimit = 0;
    const tabStats = [];
    
    for (const [tabId, stats] of this.stats) {
      const tab = this.tabManager.getTab(tabId);
      if (stats.memoryUsage) {
        const usedMB = stats.memoryUsage.used / (1024 * 1024);
        const limitMB = tab ? tab.memoryLimit : 512;
        
        totalUsed += usedMB;
        totalLimit += limitMB;
        
        tabStats.push({
          tabId,
          used: usedMB,
          limit: limitMB,
          suspended: stats.isSuspended
        });
      }
    }
    
    return {
      totalUsed: Math.round(totalUsed),
      totalLimit: Math.round(totalLimit),
      tabCount: this.stats.size,
      tabStats
    };
  }
}

module.exports = { ResourceMonitor };
