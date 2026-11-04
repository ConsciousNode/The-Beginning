/*
 * Vagrant Browser — ConsciousNode SoftWorks
 * MIT License
 *
 * Storage Module - electron-store wrapper for settings, bookmarks, and history
 */

const Store = require('electron-store');

/* ╔══════════════════════════╗
   ║     STORAGE              ║
   ╚══════════════════════════╝ */

class Storage {
  constructor() {
    this.store = new Store({
      name: 'vagrant-browser-data',
      defaults: {
        settings: {},
        bookmarks: [],
        history: []
      }
    });
  }

  /* ═══════════════════════════════════════
     SETTINGS
     ═══════════════════════════════════════ */

  /**
   * Get all settings
   */
  getSettings() {
    return this.store.get('settings', {});
  }

  /**
   * Get a specific setting
   */
  getSetting(key) {
    const settings = this.getSettings();
    return settings[key];
  }

  /**
   * Set a setting value
   */
  setSetting(key, value) {
    const settings = this.getSettings();
    settings[key] = value;
    this.store.set('settings', settings);
    return true;
  }

  /**
   * Reset all settings to defaults
   */
  resetSettings() {
    this.store.set('settings', {});
    return true;
  }

  /* ═══════════════════════════════════════
     BOOKMARKS
     ═══════════════════════════════════════ */

  /**
   * Get all bookmarks
   */
  getBookmarks() {
    return this.store.get('bookmarks', []);
  }

  /**
   * Get a specific bookmark by ID
   */
  getBookmark(id) {
    const bookmarks = this.getBookmarks();
    return bookmarks.find(b => b.id === id);
  }

  /**
   * Set all bookmarks (replaces existing)
   */
  setBookmarks(bookmarks) {
    this.store.set('bookmarks', bookmarks);
    return true;
  }

  /**
   * Add a single bookmark
   */
  addBookmark(bookmark) {
    const bookmarks = this.getBookmarks();
    bookmarks.push(bookmark);
    this.store.set('bookmarks', bookmarks);
    return bookmark;
  }

  /**
   * Delete a bookmark by ID
   */
  deleteBookmark(id) {
    let bookmarks = this.getBookmarks();
    bookmarks = bookmarks.filter(b => b.id !== id);
    this.store.set('bookmarks', bookmarks);
    return true;
  }

  /**
   * Update a bookmark
   */
  updateBookmark(id, updates) {
    const bookmarks = this.getBookmarks();
    const index = bookmarks.findIndex(b => b.id === id);
    if (index !== -1) {
      bookmarks[index] = { ...bookmarks[index], ...updates };
      this.store.set('bookmarks', bookmarks);
      return bookmarks[index];
    }
    return null;
  }

  /**
   * Search bookmarks
   */
  searchBookmarks(query) {
    const bookmarks = this.getBookmarks();
    const lowerQuery = query.toLowerCase();
    return bookmarks.filter(b => 
      (b.name && b.name.toLowerCase().includes(lowerQuery)) ||
      (b.title && b.title.toLowerCase().includes(lowerQuery)) ||
      (b.sourceIdentifier && b.sourceIdentifier.toLowerCase().includes(lowerQuery)) ||
      (b.tags && b.tags.some(t => t.toLowerCase().includes(lowerQuery)))
    );
  }

  /**
   * Get bookmarks by tag
   */
  getBookmarksByTag(tag) {
    const bookmarks = this.getBookmarks();
    return bookmarks.filter(b => b.tags && b.tags.includes(tag));
  }

  /**
   * Clear all bookmarks
   */
  clearBookmarks() {
    this.store.set('bookmarks', []);
    return true;
  }

  /* ═══════════════════════════════════════
     HISTORY
     ═══════════════════════════════════════ */

  /**
   * Get all history entries
   */
  getHistory() {
    return this.store.get('history', []);
  }

  /**
   * Set all history (replaces existing)
   */
  setHistory(history) {
    this.store.set('history', history);
    return true;
  }

  /**
   * Add a history entry
   */
  addHistoryEntry(entry) {
    const history = this.getHistory();
    
    // Don't add duplicates for the same URL within 1 minute
    const lastEntry = history[history.length - 1];
    if (lastEntry && lastEntry.url === entry.url && 
        (entry.timestamp - lastEntry.timestamp) < 60000) {
      return false;
    }
    
    history.push(entry);
    
    // Prune to limit (default 1000)
    const settings = this.getSettings();
    const limit = settings.historyLimit || 1000;
    if (history.length > limit) {
      history.shift();
    }
    
    this.store.set('history', history);
    return true;
  }

  /**
   * Search history
   */
  searchHistory(query, limit = 100) {
    const history = this.getHistory();
    const lowerQuery = query.toLowerCase();
    return history
      .filter(h => 
        (h.title && h.title.toLowerCase().includes(lowerQuery)) ||
        (h.url && h.url.toLowerCase().includes(lowerQuery))
      )
      .slice(-limit)
      .reverse();
  }

  /**
   * Get history grouped by day
   */
  getHistoryByDay() {
    const history = this.getHistory();
    const grouped = {};
    
    history.forEach(entry => {
      const day = new Date(entry.timestamp).toLocaleDateString();
      if (!grouped[day]) {
        grouped[day] = [];
      }
      grouped[day].push(entry);
    });
    
    return grouped;
  }

  /**
   * Clear history before a certain date
   */
  clearHistoryBefore(timestamp) {
    let history = this.getHistory();
    history = history.filter(h => h.timestamp >= timestamp);
    this.store.set('history', history);
    return true;
  }

  /**
   * Clear all history
   */
  clearHistory() {
    this.store.set('history', []);
    return true;
  }

  /* ═══════════════════════════════════════
     DATA EXPORT/IMPORT
     ═══════════════════════════════════════ */

  /**
   * Export all data as JSON
   */
  exportData() {
    return {
      version: '1.0.0',
      exportedAt: Date.now(),
      settings: this.getSettings(),
      bookmarks: this.getBookmarks(),
      history: this.getHistory()
    };
  }

  /**
   * Import data from JSON
   */
  importData(data) {
    if (data.settings) {
      this.store.set('settings', data.settings);
    }
    if (data.bookmarks) {
      this.store.set('bookmarks', data.bookmarks);
    }
    if (data.history) {
      this.store.set('history', data.history);
    }
    return true;
  }

  /**
   * Clear all data
   */
  clearAllData() {
    this.store.clear();
    return true;
  }

  /**
   * Get storage size info
   */
  async getStorageInfo() {
    const storeSize = JSON.stringify(this.store.store).length;
    return {
      storeSize,
      bookmarksSize: JSON.stringify(this.getBookmarks()).length,
      historySize: JSON.stringify(this.getHistory()).length,
      settingsSize: JSON.stringify(this.getSettings()).length,
      totalSize: storeSize,
      bookmarkCount: this.getBookmarks().length,
      historyCount: this.getHistory().length,
      tabSessions: 0 // Would need to count from session partitions
    };
  }
}

module.exports = { Storage };
