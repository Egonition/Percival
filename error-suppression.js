(function() {
  'use strict';
  
  console.log('[GBF Auto] Error suppression enabled');
  
  // 1. Monkey patch chrome.runtime.sendMessage
  const originalSendMessage = chrome.runtime.sendMessage;
  
  chrome.runtime.sendMessage = function(message, callback) {
    // Always provide a callback if none was given
    const safeCallback = callback || function() {};
    
    // Call the original with our safe callback
    return originalSendMessage.call(chrome.runtime, message, function(response) {
      if (chrome.runtime.lastError) {
        // Check if it's the error we want to suppress
        const errorMsg = chrome.runtime.lastError.message || '';
        if (errorMsg.includes('Could not establish connection') || 
            errorMsg.includes('Receiving end does not exist')) {
          // Silently ignore - popup is closed
          return;
        }
        // For other errors, you might want to handle them differently
      }
      
      // Call the original callback if it exists
      if (callback) {
        callback(response);
      }
    });
  };
  
  // 2. Also patch chrome.tabs.sendMessage if you use it
  if (chrome.tabs && chrome.tabs.sendMessage) {
    const originalTabsSendMessage = chrome.tabs.sendMessage;
    
    chrome.tabs.sendMessage = function(tabId, message, callback) {
      const safeCallback = callback || function() {};
      
      return originalTabsSendMessage.call(chrome.tabs, tabId, message, function(response) {
        if (chrome.runtime.lastError) {
          const errorMsg = chrome.runtime.lastError.message || '';
          if (errorMsg.includes('Could not establish connection') || 
              errorMsg.includes('Receiving end does not exist')) {
            return;
          }
        }
        
        if (callback) {
          callback(response);
        }
      });
    };
  }
  
  // 3. Optional: Catch any remaining unhandled promise rejections
  window.addEventListener('unhandledrejection', function(event) {
    const errorMessage = event.reason?.message || '';
    if (errorMessage.includes('Could not establish connection') || 
        errorMessage.includes('Receiving end does not exist')) {
      event.preventDefault();
      event.stopPropagation();
    }
  });
  
})();