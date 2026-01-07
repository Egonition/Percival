(function() {
  'use strict';
  
  console.log('[GBF Auto] Error Suppression Enabled');
  
  // Monkey Patch
  const originalSendMessage = chrome.runtime.sendMessage;
  
  chrome.runtime.sendMessage = function(message, callback) {
    // Create a Safe Callback to Avoid Errors
    const safeCallback = callback || function() {};
    
    // Call the Original Function
    return originalSendMessage.call(chrome.runtime, message, function(response) {
      if (chrome.runtime.lastError) {
        // Check for Specific Error Messages to Suppress
        const errorMsg = chrome.runtime.lastError.message || '';
        if (errorMsg.includes('Could not establish connection') || 
            errorMsg.includes('Receiving end does not exist')) {
          // Silent Ignore
          return;
        }
        // Optionally Log Other Errors
      }
      
      // Call the Original Callback if Provided
      if (callback) {
        callback(response);
      }
    });
  };
  
  // 2. Patch Similar
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
  
  // Global Unhandled Rejection Handler
  window.addEventListener('unhandledrejection', function(event) {
    const errorMessage = event.reason?.message || '';
    if (errorMessage.includes('Could not establish connection') || 
        errorMessage.includes('Receiving end does not exist')) {
      event.preventDefault();
      event.stopPropagation();
    }
  });
  
})();