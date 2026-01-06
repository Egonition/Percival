class RaidAutomator {
  constructor() {
    this.settings = {
      autoRaid: false,
      autoCombat: false
    };
    
    this.state = {
      active: false,
      lastAction: 'Ready',
      totalClicks: 0,
      lastCheck: 0,
      autoCombatActive: false,
      currentScreen: 'unknown' // Track which screen we're on
    };
    
    this.cooldowns = {
      ok: 0,
      auto: 0
    };
    
    // Timing configurations
    this.timing = {
      COOLDOWN: 3000,
      CHECK_INTERVAL: 1000,
      RAID_LOAD_MIN: 10000,
      RAID_LOAD_MAX: 15000,
      MOUSE_STEPS: 10,
      STEP_DELAY: 15
    };
    
    this.observer = null;
    this.interval = null;
    this.init();
  }
  
  async init() {
    await this.loadSettings();
    this.setupListeners();
    this.setupObserver();
    
    // Start if either feature is enabled
    if (this.settings.autoRaid || this.settings.autoCombat) {
      this.start();
    }
  }
  
  async loadSettings() {
    return new Promise(resolve => {
      chrome.storage.sync.get(['autoRaid', 'autoCombat'], data => {
        this.settings.autoRaid = data.autoRaid || false;
        this.settings.autoCombat = data.autoCombat || false;
        resolve();
      });
    });
  }
  
  setupListeners() {
    chrome.runtime.onMessage.addListener((msg, sender, respond) => {
      if (msg.type === 'updateSettings') {
        this.updateSettings(msg);
        respond({ success: true });
      }
      else if (msg.type === 'getStatus') {
        respond({
          type: 'raidStatusUpdate',
          active: this.state.active,
          lastAction: this.state.lastAction,
          totalClicks: this.state.totalClicks,
          autoCombatActive: this.state.autoCombatActive,
          currentScreen: this.state.currentScreen,
          timestamp: new Date().toLocaleTimeString()
        });
      }
      return true;
    });
    
    chrome.storage.onChanged.addListener(changes => {
      if (changes.autoRaid || changes.autoCombat) {
        this.loadSettings().then(() => {
          if ((this.settings.autoRaid || this.settings.autoCombat) && !this.state.active) {
            this.start();
          }
          else if (!this.settings.autoRaid && !this.settings.autoCombat && this.state.active) {
            this.stop();
          }
        });
      }
    });
  }
  
  setupObserver() {
    this.observer = new MutationObserver(() => {
      if (this.state.active) {
        this.detectCurrentScreen();
        this.checkButtons();
      }
    });
    
    this.observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }
  
  detectCurrentScreen() {
    const previousScreen = this.state.currentScreen;
    
    // Check if we're on raid start screen (has OK button)
    const okButton = document.querySelector('.btn-usual-ok.se-quest-start');
    const isStartScreen = okButton && this.isVisible(okButton);
    
    // Check if we're in battle (has auto button)
    const autoButton = document.querySelector('.btn-auto');
    const isBattleScreen = autoButton && this.isVisible(autoButton);
    
    // Update screen state
    if (isStartScreen) {
      this.state.currentScreen = 'start';
      // Reset auto combat state when back to start screen
      if (previousScreen === 'battle' && this.state.autoCombatActive) {
        this.state.autoCombatActive = false;
        this.updateStatus('Returned to start screen - auto combat reset');
      }
    } else if (isBattleScreen) {
      this.state.currentScreen = 'battle';
    } else {
      this.state.currentScreen = 'other';
    }
    
    // Log screen changes
    if (previousScreen !== this.state.currentScreen) {
      console.log(`Screen changed: ${previousScreen} → ${this.state.currentScreen}`);
    }
  }
  
  updateSettings(msg) {
    this.settings.autoRaid = msg.autoRaid ?? this.settings.autoRaid;
    this.settings.autoCombat = msg.autoCombat ?? this.settings.autoCombat;
    
    if ((this.settings.autoRaid || this.settings.autoCombat) && !this.state.active) {
      this.start();
    }
    else if (!this.settings.autoRaid && !this.settings.autoCombat && this.state.active) {
      this.stop();
    }
  }
  
  start() {
    if (this.state.active) return;
    
    this.state.active = true;
    this.interval = setInterval(() => {
      this.detectCurrentScreen();
      this.checkButtons();
    }, this.timing.CHECK_INTERVAL);
    
    let statusMessage = 'Automation active: ';
    const features = [];
    if (this.settings.autoRaid) features.push('Start Raid');
    if (this.settings.autoCombat) features.push('Full Auto');
    statusMessage += features.join(' + ');
    
    this.updateStatus(statusMessage);
  }
  
  stop() {
    if (!this.state.active) return;
    
    this.state.active = false;
    clearInterval(this.interval);
    this.interval = null;
    this.state.autoCombatActive = false;
    this.state.currentScreen = 'unknown';
    this.updateStatus('Automation stopped');
  }
  
  getRandomDelay(min, max) {
    return min + Math.random() * (max - min);
  }
  
  checkButtons() {
    if (!this.state.active) return;
    
    const now = Date.now();
    if (now - this.state.lastCheck < 500) return;
    this.state.lastCheck = now;
    
    // Check for OK button only if autoRaid is enabled AND we're on start screen
    if (this.settings.autoRaid && this.canClick('ok') && this.state.currentScreen === 'start') {
      const okButton = this.findOkButton();
      if (okButton) {
        this.clickRaidStart(okButton);
      }
    }
    
    // Check for auto button only if autoCombat is enabled AND we're in battle
    if (this.settings.autoCombat && this.canClick('auto') && this.state.currentScreen === 'battle') {
      const autoButton = this.findAutoButton();
      if (autoButton && !this.state.autoCombatActive) {
        this.clickAutoCombat(autoButton);
      }
    }
  }
  
  clickRaidStart(button) {
    this.cooldowns.ok = Date.now();
    
    // Reset auto combat state when starting new raid
    this.state.autoCombatActive = false;
    
    // Click with mouse simulation
    this.simulateClick(button, 'OK (Start Raid)');
    
    // If auto combat is also enabled, schedule it after raid loads
    if (this.settings.autoCombat) {
      const raidLoadTime = this.getRandomDelay(
        this.timing.RAID_LOAD_MIN,
        this.timing.RAID_LOAD_MAX
      );
      
      this.updateStatus(`Starting raid... Auto combat in ${Math.round(raidLoadTime/1000)}s`);
      
      // Schedule auto combat click after raid loads
      setTimeout(() => {
        this.checkAutoButton();
      }, raidLoadTime);
    } else {
      this.updateStatus('Raid started');
    }
  }
  
  clickAutoCombat(button) {
    this.cooldowns.auto = Date.now();
    
    // Check if button is already active before clicking
    if (this.isAutoButtonActive(button)) {
      this.state.autoCombatActive = true;
      this.updateStatus('Auto combat already active');
      return;
    }
    
    this.simulateClick(button, 'FULL Auto');
    this.state.autoCombatActive = true;
    this.updateStatus('Auto combat enabled');
  }
  
  checkAutoButton() {
    const autoButton = this.findAutoButton();
    if (autoButton && !this.state.autoCombatActive) {
      this.clickAutoCombat(autoButton);
    } else if (!autoButton) {
      // Auto button not found yet, retry after 1 second
      setTimeout(() => {
        this.checkAutoButton();
      }, 1000);
    }
  }
  
  findOkButton() {
    const button = document.querySelector('.btn-usual-ok.se-quest-start');
    return button && this.isVisible(button) ? button : null;
  }
  
  findAutoButton() {
    const button = document.querySelector('.btn-auto');
    return button && this.isVisible(button) ? button : null;
  }
  
  isVisible(element) {
    if (!element) return false;
    
    const style = window.getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    
    return style.display !== 'none' &&
           style.visibility !== 'hidden' &&
           rect.width > 0 &&
           rect.height > 0;
  }
  
  isAutoButtonActive(button) {
    if (!button) return false;
    
    // Check various indicators that auto is already active
    if (button.classList.contains('active')) {
      return true;
    }
    
    const style = window.getComputedStyle(button);
    const bgColor = style.backgroundColor;
    const activeColors = [
      'rgb(0, 100, 0)',
      'rgb(46, 125, 50)',
      'rgb(76, 175, 80)',
      'rgb(56, 142, 60)',
      'rgb(27, 94, 32)'
    ];
    
    if (activeColors.some(color => bgColor.includes(color))) {
      return true;
    }
    
    const buttonText = button.textContent || '';
    if (buttonText.includes('ON') || buttonText.includes('On') || buttonText.includes('Active')) {
      return true;
    }
    
    if (button.getAttribute('data-active') === 'true' || 
        button.getAttribute('data-state') === 'active') {
      return true;
    }
    
    return false;
  }
  
  canClick(type) {
    return Date.now() - this.cooldowns[type] > this.timing.COOLDOWN;
  }
  
  simulateClick(element, actionName) {
    if (!element) return;
    
    const rect = element.getBoundingClientRect();
    const x = rect.left + Math.random() * rect.width;
    const y = rect.top + Math.random() * rect.height;
    
    this.moveMouseTo(x, y);
    
    setTimeout(() => {
      this.performClick(element, x, y);
      this.state.totalClicks++;
      this.sendStatusUpdate(actionName);
    }, 100 + Math.random() * 200);
  }
  
  moveMouseTo(targetX, targetY) {
    const startX = Math.random() * window.innerWidth;
    const startY = Math.random() * window.innerHeight;
    
    for (let i = 0; i <= this.timing.MOUSE_STEPS; i++) {
      const progress = i / this.timing.MOUSE_STEPS;
      const currentX = startX + (targetX - startX) * progress;
      const currentY = startY + (targetY - startY) * progress;
      
      const event = new MouseEvent('mousemove', {
        view: window,
        bubbles: true,
        cancelable: true,
        clientX: currentX,
        clientY: currentY
      });
      
      document.dispatchEvent(event);
    }
  }
  
  performClick(element, x, y) {
    const mouseDown = new MouseEvent('mousedown', {
      view: window,
      bubbles: true,
      cancelable: true,
      clientX: x,
      clientY: y,
      buttons: 1
    });
    
    setTimeout(() => {
      const mouseUp = new MouseEvent('mouseup', {
        view: window,
        bubbles: true,
        cancelable: true,
        clientX: x,
        clientY: y
      });
      
      const clickEvent = new MouseEvent('click', {
        view: window,
        bubbles: true,
        cancelable: true,
        clientX: x,
        clientY: y
      });
      
      element.dispatchEvent(mouseDown);
      element.dispatchEvent(mouseUp);
      element.dispatchEvent(clickEvent);
      
      if (typeof element.click === 'function') {
        element.click();
      }
    }, 50 + Math.random() * 100);
  }
  
  sendStatusUpdate(actionName) {
    const status = {
      type: 'raidStatusUpdate',
      active: this.state.active,
      lastAction: actionName,
      totalClicks: this.state.totalClicks,
      autoCombatActive: this.state.autoCombatActive,
      currentScreen: this.state.currentScreen,
      timestamp: new Date().toLocaleTimeString()
    };
    
    chrome.runtime.sendMessage(status).catch(() => {});
    chrome.storage.local.set({ raidStatus: status });
  }
  
  updateStatus(message) {
    this.state.lastAction = message;
    
    const status = {
      type: 'raidStatusUpdate',
      active: this.state.active,
      lastAction: message,
      totalClicks: this.state.totalClicks,
      autoCombatActive: this.state.autoCombatActive,
      currentScreen: this.state.currentScreen,
      timestamp: new Date().toLocaleTimeString()
    };
    
    chrome.runtime.sendMessage(status).catch(() => {});
    chrome.storage.local.set({ raidStatus: status });
  }
}

// Initialize
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    window.raidAutomator = new RaidAutomator();
  });
} else {
  window.raidAutomator = new RaidAutomator();
}