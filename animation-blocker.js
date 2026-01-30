(function() {
    'use strict';

    // Debug Log
    // console.log('🎮 Animation Blocker Loaded - Waiting For Settings');
    
    let isEnabled = false;
    let styleElement = null;
    
    // Load Setting from Storage
    chrome.storage.sync.get(['blockAnimations'], (result) => {
        if (result.blockAnimations !== undefined) {
            isEnabled = result.blockAnimations;

            // Debug Log
            // console.log('⚙️ Animation Blocker Setting:', isEnabled ? 'ENABLED' : 'DISABLED');

            updateBlocker();
        }
    });
    
    // Listen for Setting Changes
    chrome.storage.onChanged.addListener((changes, namespace) => {
        if (namespace === 'sync' && changes.blockAnimations) {
            isEnabled = changes.blockAnimations.newValue;

            // Debug Log
            // console.log('⚙️ Animation Blocker Setting Changed:', isEnabled ? 'ENABLED' : 'DISABLED');

            updateBlocker();
        }
    });
    
    // Listen for Direct Messages from Popup
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (message.type === 'updateSettings' && message.blockAnimations !== undefined) {
            isEnabled = message.blockAnimations;

            // Debug Log
            // console.log('⚙️ Animation Blocker Setting Updated:', isEnabled ? 'ENABLED' : 'DISABLED');

            updateBlocker();
        }
    });
    
    const isRaid = () => location.href.includes('#raid') || location.href.includes('#multi');
    
    function updateBlocker() {
        if (!isEnabled) {
            // Disable Blocker
            if (styleElement) {
                styleElement.remove();
                styleElement = null;
            }
            // Debug Log
            // console.log('✅ Animation Blocker Disabled');
            return;
        }
        
        // Enable Blocker
        if (!styleElement) {
            styleElement = document.createElement('style');
            styleElement.id = 'raid-animation-blocker';
            document.head.appendChild(styleElement);
        }
        
        const css = `
            ${isRaid() ? `
                *, *::before, *::after {
                    animation: none !important;
                    transition: none !important;
                    animation-duration: 0s !important;
                    transition-duration: 0s !important;
                    animation-delay: 0s !important;
                    transition-delay: 0s !important;
                }
                canvas, [class*="effect"], [class*="animation"] {
                    display: none !important;
                    visibility: hidden !important;
                }
            ` : ''}
        `;
        
        styleElement.textContent = css;
        
        // Update CSS when URL changes
        let lastUrl = location.href;
        const updateInterval = setInterval(() => {
            if (location.href !== lastUrl) {
                lastUrl = location.href;
                styleElement.textContent = isRaid() ? `
                    * { animation: none !important; transition: none !important; }
                    canvas { display: none !important; }
                ` : '';
            }
        }, 300);
        
        // Debug Log
        // console.log('🚫 Animation Blocker ENABLED');
        
        // Clean Up Interval When Disabled
        return () => clearInterval(updateInterval);
    }
    
    // Initial Setup
    let cleanup = updateBlocker();
    
    // Re-initialize if Page Reloads
    document.addEventListener('DOMContentLoaded', () => {
        if (cleanup) cleanup();
        cleanup = updateBlocker();
    });
})();