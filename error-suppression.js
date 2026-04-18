(() => {
  'use strict';

  // Errors to Suppress
  const SUPPRESSED_ERRORS = [
    'Could not establish connection',
    'Receiving end does not exist'
  ];

  // Check if Error Should be Suppressed
  function isSuppressedError(message) {
    return SUPPRESSED_ERRORS.some(err => message.includes(err));
  }

  // Create Safe Message Handler
  function createSafeHandler(callback) {
    return (response) => {
      if (chrome.runtime.lastError) {
        const errorMsg = chrome.runtime.lastError.message || '';
        if (isSuppressedError(errorMsg)) return;
      }
      if (callback) callback(response);
    };
  }

  // Patch chrome.runtime.sendMessage
  const originalSendMessage = chrome.runtime.sendMessage;
  chrome.runtime.sendMessage = function(message, callback) {
    return originalSendMessage.call(chrome.runtime, message, createSafeHandler(callback));
  };

  // Patch chrome.tabs.sendMessage
  if (chrome.tabs?.sendMessage) {
    const originalTabsSendMessage = chrome.tabs.sendMessage;
    chrome.tabs.sendMessage = function(tabId, message, callback) {
      return originalTabsSendMessage.call(chrome.tabs, tabId, message, createSafeHandler(callback));
    };
  }

  // Suppress Unhandled Promise Rejections
  window.addEventListener('unhandledrejection', (event) => {
    const errorMsg = event.reason?.message || '';
    if (isSuppressedError(errorMsg)) {
      event.preventDefault();
      event.stopPropagation();
    }
  });

})();