/*
 * Vagrant Browser — ConsciousNode SoftWorks
 * MIT License
 *
 * Network Kill Module - Blocks all network requests at the session level
 */

/* ╔══════════════════════════╗
   ║     NETWORK KILL         ║
   ╚══════════════════════════╝ */

/**
 * Kills all network access for a given Electron session.
 * This is implemented at the main process level and cannot be bypassed by renderer code.
 * 
 * Allowed protocols:
 * - file:// (local files)
 * - about: (internal pages)
 * - blob: (blob URLs)
 * - data: (data URIs)
 * - devtools: (Chrome DevTools)
 * - chrome-extension: (extensions)
 * 
 * Blocked protocols:
 * - http://
 * - https://
 * - ws:// (WebSocket)
 * - wss:// (Secure WebSocket)
 * - ftp://
 * - All other network protocols
 */
function killNetwork(targetSession) {
  // Block ALL network requests from BrowserViews (tab content)
  targetSession.webRequest.onBeforeRequest({ urls: ['*://*/*'] }, (details, callback) => {
    const url = details.url;
    
    // Allow: file:// protocol, about: protocol, blob:, data:
    if (
      url.startsWith('file://') ||
      url.startsWith('about:') ||
      url.startsWith('blob:') ||
      url.startsWith('data:') ||
      url.startsWith('devtools:') ||
      url.startsWith('chrome-extension:')
    ) {
      callback({ cancel: false });
    } else {
      // Block everything else — http, https, ws, wss, ftp, all of it
      callback({ cancel: true });
    }
  });

  // Also kill DNS prefetch and other background network activity
  targetSession.setSpellCheckerEnabled(false); // no cloud spellcheck
  targetSession.setProxy({ mode: 'direct' });   // no proxy leaks
  
  // Disable speculative connections
  targetSession.allowNTLMCredentialsForDomains('');
}

module.exports = { killNetwork };
