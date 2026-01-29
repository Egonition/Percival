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
      currentScreen: 'unknown',

      // Human Behavior Tracking
      lastHumanAction: Date.now(),
      sessionStart: Date.now(),
      totalRaids: 0,
      lastMousePosition: { x: 0, y: 0 },

      // URL Tracking
      lastUrl: window.location.href,

      // Raid Completion Tracking
      lastRaidStartTime: 0,
      raidInProgress: false,
      lastRaidCompletionLog: 0,
      
      // Auto Combat Click Tracking
      autoClickAttempted: false,

      // UI State Tracking
      hasSeenAutoButton: false
    };
    
    this.cooldowns = {
      ok: 0,
      auto: 0
    };
    
    // Timing Settings
    this.timing = {
      COOLDOWN: 2000 + Math.random() * 3000, // 2-5 seconds
      CHECK_INTERVAL: 800 + Math.random() * 700, // 0.8-1.5 seconds
      RAID_LOAD_MIN: 9000,   // 9 seconds minimum
      RAID_LOAD_MAX: 16000,  // 16 seconds maximum
      MOUSE_STEPS_MIN: 8,
      MOUSE_STEPS_MAX: 20,   // Variable Mouse Movement
      STEP_DELAY_MIN: 10,
      STEP_DELAY_MAX: 30,    // Variable Step Timing

      // Human Delay Settings
      HUMAN_DELAY_CHANCE: 0.3, // 30% chance of extra delay
      HUMAN_DELAY_MIN: 500,    // 0.5 second minimum extra delay
      HUMAN_DELAY_MAX: 3000,   // 3 second maximum extra delay
    };

    // Initialize Break Manager
    this.breakManager = new BreakManager({
      enableBreaks: false
    });
    
    this.observer = null;
    this.interval = null;
    this.init();
  }
  
  async init() {
    // Load Settings from Storage
    await this.loadSettings();

    // Update Break Manager Settings
    if (this.breakManager) {
      this.breakManager.updateSettings({ enableBreaks: this.settings.enableBreaks });
    }

    // Load Break Manager State
    await this.loadBreakManagerState();

    // Setup Break Manager State Saving
    this.setupBreakManagerState();

    // Load Persistent State
    await this.loadPersistentState();
    
    // Setup Listeners and Observer
    this.setupListeners();
    this.setupObserver();

    // Auto Start if Either Feature is Enabled and Not on Break
    const breakStatus = this.breakManager.getStatus();
    if (!breakStatus.isOnBreak && (this.settings.autoRaid || this.settings.autoCombat)) {
      this.start();
    }
  }
  
  // Load Settings from Storage
  async loadSettings() {
    return new Promise(resolve => {
      chrome.storage.sync.get(['autoRaid', 'autoCombat', 'enableBreaks'], data => {
        this.settings.autoRaid = data.autoRaid || false;
        this.settings.autoCombat = data.autoCombat || false;
        this.settings.enableBreaks = data.enableBreaks || false;
        resolve();
      });
    });
  }

  // Load Persistent State
  async loadPersistentState() {
    return new Promise(resolve => {
      chrome.storage.local.get(['raidAutomatorState'], data => {
        if (data.raidAutomatorState) {
          const saved = data.raidAutomatorState;
          this.state.totalRaids = saved.totalRaids || 0;
          this.state.sessionStart = saved.sessionStart || Date.now();
          
          // Debug Log
          // console.log(`📊 Loaded: ${this.state.totalRaids} Raids, ${this.state.raidsSinceLastBreak} Since Last Break`);
        }
        resolve();
      });
    });
  }

  // Save Persistent State
  async savePersistentState() {
    const stateToSave = {
      totalRaids: this.state.totalRaids,
      sessionStart: this.state.sessionStart,
    };

    chrome.storage.local.set({ raidAutomatorState: stateToSave }, () => {
      // Debug Log
      // console.log(`💾 Saved: ${this.state.totalRaids} Raids, ${this.state.raidsSinceLastBreak} Since Last Break`);
    });
  }

  // Load Break Manager State
  async loadBreakManagerState() {
    return new Promise(resolve => {
      chrome.storage.local.get(['breakManagerState'], data => {
        if (data.breakManagerState && this.breakManager) {
          // Debug Log
          // console.log('🔄 Loading Break Manager State:', data.breakManagerState);
          
          // Load State into Break Manager
          this.breakManager.loadState(data.breakManagerState);

          if (this.breakManager.settings.enableBreaks) {
            const status = this.breakManager.getStatus();
            console.log(`Raids Since Last Break: ${status.raidsSinceLastBreak}`);
          }

          
        } else {
          // Debug Log
          // console.log('ℹ️ No Break Manager State Found to Load.');
        }
        resolve();
      });
    });
  }

  // Save Break Manager State
  setupBreakManagerState() {
    const originalOnRaidComplete = this.breakManager.onRaidComplete.bind(this.breakManager);
    this.breakManager.onRaidComplete = () => {
      const result = originalOnRaidComplete();
      if (result) {
        this.saveBreakManagerState();
      }
      return result;
    };

    this.breakManager.setOnBreakEndCallback(() => {
      this.saveBreakManagerState();
      this.updateStatus('Break Ended. Resuming Automation...');
      if (this.settings.autoRaid || this.settings.autoCombat) {
        this.start();
      }
    });
  }

  async saveBreakManagerState() {
    if (this.breakManager) {
      const state = this.breakManager.saveState();
      // Debug Log
      // console.log('🔄 Saving Break Manager State:', state);
      chrome.storage.local.set({ breakManagerState: state }, () => {
        // Debug Log
        // console.log('✅ Break Manager State Saved.');
      });
    }
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
          timestamp: new Date().toLocaleTimeString(),
          totalRaids: this.state.totalRaids,

          // Break Status
          isOnBreak: this.breakManager?.state?.isOnBreak || false,
          timeLeft: this.breakManager?.state?.isOnBreak && this.breakManager.state.breakEndTime 
            ? Math.max(0, this.breakManager.state.breakEndTime - Date.now())
            : 0,
          raidsSinceLastBreak: this.breakManager?.state?.raidsSinceLastBreak || 0
        });
      }
      else if (msg.type === 'forceEndBreak') {
        console.log('🚀 Received Force End Break Command');
        
        if (this.breakManager) {
          const success = this.breakManager.forceEndBreak();
          
          // Prepare Status Update
          const statusUpdate = {
            type: 'breakStatusUpdate',
            isOnBreak: false,
            raidsSinceLastBreak: 0
          };
          
          // Respond to Sender
          respond({ 
            success: success,
            message: success ? 'Break Force Ended' : 'No Active Break to End'
          });
          
          // Send Update to Popup
          this.safeSendMessage(statusUpdate);

          // Resume Automation if Enabled
          if (success && (this.settings.autoRaid || this.settings.autoCombat) && !this.state.active) {
            this.start();
          }
        } else {
          respond({ 
            success: false,
            message: 'Break Manager Not Available'
          });
        }
      }
      else if (msg.type === 'getBreakStatus') {
        respond({
          isOnBreak: this.breakManager?.state?.isOnBreak || false,
          timeLeft: this.breakManager?.state?.isOnBreak && this.breakManager.state.breakEndTime 
            ? Math.max(0, this.breakManager.state.breakEndTime - Date.now())
            : 0,
          raidsSinceLastBreak: this.breakManager?.state?.raidsSinceLastBreak || 0,
          totalBreaks: this.breakManager?.state?.totalBreaks || 0
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

      // Update Break Manager Settings if Changed
      if (changes.enableBreaks && this.breakManager) {
        this.breakManager.updateSettings({
          enableBreaks: changes.enableBreaks.newValue
        });
      }
    });
  }
  
  setupObserver() {
    this.observer = new MutationObserver((mutations) => {
      if (this.state.active) {
        // Check for Popups in Added Nodes
        mutations.forEach((mutation) => {
          if (mutation.addedNodes.length > 0) {
            mutation.addedNodes.forEach((node) => {
              if (node.nodeType === 1) { // Element Node
                // Quick Check for Popups
                if (this.hasBlockingPopup().found) {
                  this.handlePopupDetected();
                  return;
                }
              }
            });
          }
        });
        
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
    // Skip if on Break
    const breakStatus = this.breakManager.getStatus();
    if (breakStatus.isOnBreak) {
      this.state.currentScreen = 'break';
      return; 
    }

    // Check for URL Change
    const previousScreen = this.state.currentScreen;
    
    // Check if in Raid Start Screen - Use findOkButton() to check both button types
    const okButton = this.findOkButton();
    const isStartScreen = okButton && this.isVisible(okButton);
    
    // Check if in Battle Screen
    const autoButton = this.findAutoButton();
    const isBattleScreen = autoButton && this.isVisible(autoButton);

    // Get Current URL
    const currentUrl = window.location.href;
    const urlChanged = this.state.lastUrl && this.state.lastUrl !== currentUrl;
    
    // Update Current Screen State
    if (isStartScreen) {
      this.state.currentScreen = 'start';
      
      // Check if Came from Battle Screen
      if (previousScreen === 'battle' && this.state.raidInProgress) {
        this.handleRaidCompletion();
      }
      
      // Reset Battle Tracking
      this.state.raidInProgress = false;
      this.state.autoCombatActive = false;
      this.state.autoClickAttempted = false;
      this.state.hasSeenAutoButton = false;
      
    } else if (isBattleScreen) {
      this.state.currentScreen = 'battle';
      
      // Mark Raid as In Progress
      if (!this.state.raidInProgress) {
        this.state.raidInProgress = true;
        this.state.lastRaidStartTime = Date.now();
        this.updateStatus(`Raid ${this.state.totalRaids + 1} In Progress...`);

        // Reset Auto Combat UI State
        this.state.hasSeenAutoButton = false;
        this.state.autoCombatActive = false;
        this.state.autoClickAttempted = false;
      }

      if (!this.state.hasSeenAutoButton) {
        this.state.hasSeenAutoButton = true;
      }
      
    } else {
      if (urlChanged && previousScreen === 'battle' && this.state.raidInProgress) {
        const wasBattleUrl = this.state.lastUrl.includes('/#raid/') ||
                          this.state.lastUrl.includes('/#battle/');
        const isNotBattleUrl = !currentUrl.includes('/#raid/') &&
                          !currentUrl.includes('/#battle/');
        
        if (wasBattleUrl && isNotBattleUrl) {
          // Debug Log
          // console.log('🎯 URL Change Detected: Raid Completion.');
          this.handleRaidCompletion();
          this.state.raidInProgress = false;
        }
      }
    }

    // Track URL Changes
    this.state.lastUrl = currentUrl;
  }

  handleRaidCompletion() {
    // Prevent Duplicate Logs
    if (Date.now() - this.state.lastRaidCompletionLog < 1000) return;
    
    this.state.totalRaids++;
    this.state.lastRaidCompletionLog = Date.now();
    
    const raidDuration = Date.now() - this.state.lastRaidStartTime;
    const durationSeconds = Math.round(raidDuration / 1000);
    
    this.updateStatus(`Raid ${this.state.totalRaids} Complete! (${durationSeconds}s)`);
    console.log(`✅ Raid ${this.state.totalRaids} Completed in ${durationSeconds} Seconds.`);

    // Check for Break
    if (this.breakManager.onRaidComplete()) {
      this.stop();
      this.updateStatus('⏸️ Taking a Break. Automation Paused.');

      // Send Break Status Update
      const breakStatus = this.breakManager.getStatus();
      this.safeSendMessage({
        type: 'breakStatusUpdate',
        isOnBreak: true,
        timeLeft: breakStatus.timeLeft || 0,
        raidsSinceLastBreak: breakStatus.raidsSinceLastBreak || 0
      });
    }

    // Save State
    this.savePersistentState();
    this.saveBreakManagerState();

    // Track Raid Durations for Averages
    this.state.raidDurations = this.state.raidDurations || [];
    this.state.raidDurations.push(raidDuration);
    
    // Log Average Raid Time Every 10 Raids
    if (this.state.totalRaids % 10 === 0) {
      const avgDuration = this.state.raidDurations.reduce((a, b) => a + b, 0) / this.state.raidDurations.length;
      // Debug Log
      console.log(`📊 Average Raid Time: ${Math.round(avgDuration/1000)}s`);
    }
  }
  
  hasBlockingPopup() {
    // Check for Common Popup Elements
    const popupHeader = document.querySelector('.prt-popup-header');
    if (popupHeader && this.isVisible(popupHeader)) {
      // Get Popup Text
      const popupText = popupHeader.textContent?.trim() || '';
      
      // Empty Popup Check
      if (popupText.length === 0) {
        return { found: false };
      }
      
      const popupTextLower = popupText.toLowerCase();
      
      // Check for AP Related Popups
      const isAPPopup = popupTextLower.includes('ap') || 
                       popupTextLower.includes('aap');
      
      if (isAPPopup) {
        return {
          found: true,
          element: popupHeader,
          type: 'APPopup',
          text: popupText
        };
      }
      
      // Check for Blocking Room Full Popups
      const isBlockingPopup = popupTextLower.includes('満員') ||
                             popupTextLower.includes('満室'); 
      
      if (isBlockingPopup) {
        return {
          found: true,
          element: popupHeader,
          type: 'BlockingPopup',
          text: popupText
        };
      }

      // Check for Access Verification Popups
      const isAccessVerification = popupTextLower.includes('access') ||
                                  popupTextLower.includes('verification') ||
                                  popupTextLower.includes('アクセス') ||
                                  popupTextLower.includes('確認');
      
      if (isAccessVerification) {
        return {
          found: true,
          element: popupHeader,
          type: 'AccessVerification',
          text: popupText
        };
      }

    }
    
    return { found: false };
  }
  
  handlePopupDetected() {
    if (!this.state.active) return;
    
    const popupInfo = this.hasBlockingPopup();
    if (popupInfo.found) {
      // Update Local Settings
      this.settings.autoRaid = false;
      this.settings.autoCombat = false;
      
      this.stop();

      let statusMessage;
      if (popupInfo.type === 'AccessVerification') {
        statusMessage = `Access Verification Required. Please Complete the Verification Manually.`;
      } else {
        statusMessage = `Popup Detected: ${popupInfo.text}`;
      }

      this.updateStatus(statusMessage);
      
      // Disable Checkboxes in Storage
      chrome.storage.sync.set({
        autoRaid: false,
        autoCombat: false
      }, () => {
        // Console Log
        console.log('🛑 Automation Disabled.');
        
        // Notify Background Script of Settings Change
        this.safeSendMessage({
          type: 'settingsChanged',
          autoRaid: false,
          autoCombat: false
        });
      });
      
      // Log Status
      const status = {
        type: 'popupDetected',
        active: false,
        lastAction: statusMessage,
        popupInfo: popupInfo,
        timestamp: new Date().toLocaleTimeString()
      };
      
      this.safeSendMessage(status);
      chrome.storage.local.set({ raidStatus: status });
      
      // Console Warning
      console.warn('⚠️ Popup Detected.', popupInfo.text);
    }
  }

  // Safe Send Message Wrapper
  safeSendMessage(message) {
    return new Promise((resolve) => {
      try {
        chrome.runtime.sendMessage(message, (response) => {
          // Check for Last Error
          if (chrome.runtime.lastError) {
            // Silent Ignore Receiving End Error
            const errorMsg = chrome.runtime.lastError.message || '';
            if (!errorMsg.includes('Receiving end does not exist')) {
              // Debug Log
              // console.log('Message Send Error:', errorMsg);
            }
          }
          resolve(response);
        });
      } catch (error) {
        // Silent Ignore Errors
        resolve();
      }
    });
  }

  updateSettings(msg) {
    this.settings.autoRaid = msg.autoRaid ?? this.settings.autoRaid;
    this.settings.autoCombat = msg.autoCombat ?? this.settings.autoCombat;

    // Update Break Manager Settings
    if (this.breakManager && msg.enableBreaks !== undefined) {
      this.breakManager.updateSettings({ enableBreaks: msg.enableBreaks });
    }
    
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
    
    let statusMessage = 'Automation Active: ';
    const features = [];
    if (this.settings.autoRaid) features.push('Start Raid');
    if (this.settings.autoCombat) features.push('Full Auto');
    statusMessage += features.join(' + ');
    
    this.updateStatus(statusMessage);
  }
  
  stop() {
    if (!this.state.active) return;
    
    this.state.active = false;
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
    this.updateStatus('Automation Stopped');
  }
  
  getRandomDelay(min, max) {
    return min + Math.random() * (max - min);
  }
  
  checkButtons() {
    // Skip if on Break
    const breakStatus = this.breakManager.getStatus();
    if (breakStatus.isOnBreak) { return; }

    if (!this.state.active) return;
    
    // Check for Popups
    if (this.hasBlockingPopup().found) {
      this.handlePopupDetected();
      return;
    }
    
    const now = Date.now();
    if (now - this.state.lastCheck < 500) return;
    this.state.lastCheck = now;
    
    // Check for OK button if autoRaid is enabled AND in start screen
    if (this.settings.autoRaid && this.canClick('ok') && this.state.currentScreen === 'start') {
      const okButton = this.findOkButton();
      if (okButton) {
        // Check for Popup before Clicking OK Button
        if (this.hasBlockingPopup().found) {
          this.handlePopupDetected();
          return;
        }
        this.clickRaidStart(okButton);
      }
    }
    
    // Check for Auto button if autoCombat is enabled AND in battle screen
    if (this.settings.autoCombat && this.canClick('auto') && 
        this.state.currentScreen === 'battle' &&
        this.state.hasSeenAutoButton &&
        !this.state.autoClickAttempted &&
        !this.state.autoCombatActive) {
      const autoButton = this.findAutoButton();
      if (autoButton) {
        // Check for Popup before Clicking Auto Button
        if (this.hasBlockingPopup().found) {
          this.handlePopupDetected();
          return;
        }
        this.clickAutoCombat(autoButton);
      }
    }
  }
  
  async clickRaidStart(button) {
    // Check for Popups
    if (this.hasBlockingPopup().found) {
      this.handlePopupDetected();
      return;
    }
    
    this.cooldowns.ok = Date.now();
    
    // Reset Auto Combat State
    this.state.autoCombatActive = false;
    this.state.autoClickAttempted = false; // Reset for New Battle

    // Increment Total Raids
    const nextRaidNumber = this.state.totalRaids + 1;
    this.updateStatus(`Starting Raid ${nextRaidNumber}...`);

    // Save State Before Starting Raid
    await this.savePersistentState();
    await this.saveBreakManagerState();
    
    // Add Human-Like Delay before Action
    if (Math.random() < this.timing.HUMAN_DELAY_CHANCE) {
      const extraDelay = this.getRandomDelay(
        this.timing.HUMAN_DELAY_MIN,
        this.timing.HUMAN_DELAY_MAX
      );
      this.updateStatus(`Thinking... (+${Math.round(extraDelay/1000)}s)`);
      await this.sleep(extraDelay);
      
      // Check for Popup during Delay
      if (this.hasBlockingPopup().found) {
        this.handlePopupDetected();
        return;
      }
    }
    
    // Check for Popup before Click 
    if (this.hasBlockingPopup().found) {
      this.handlePopupDetected();
      return;
    }
    
    // Perform Click
    await this.simulateHumanClick(button, 'OK');

    // Update Status
    this.updateStatus(`Raid Started - Waiting for Battle Screen...`);
  }
  
  async clickAutoCombat(button) {
    // Check for Popup
    if (this.hasBlockingPopup().found) {
      this.handlePopupDetected();
      return;
    }
    
    // Mark Auto Click as Attempted
    this.state.autoClickAttempted = true;
    this.cooldowns.auto = Date.now();
    
    // Add Human-Like Delay before Action
    if (Math.random() < this.timing.HUMAN_DELAY_CHANCE) {
      const extraDelay = this.getRandomDelay(
        this.timing.HUMAN_DELAY_MIN,
        this.timing.HUMAN_DELAY_MAX
      );
      await this.sleep(extraDelay);
      
      // Check for Popup during Delay
      if (this.hasBlockingPopup().found) {
        this.handlePopupDetected();
        return;
      }
    }
    
    // Get Click Coordinates within the Button
    const rect = button.getBoundingClientRect();
    
    const safeAreaPercent = 0.9; // 90% Safe Area
    const widthPadding = rect.width * (1 - safeAreaPercent) / 2;
    const heightPadding = rect.height * (1 - safeAreaPercent) / 2;

    const clickableLeft = rect.left + widthPadding;
    const clickableRight = rect.right - widthPadding;
    const clickableTop = rect.top + heightPadding;
    const clickableBottom = rect.bottom - heightPadding;

    const clickableWidth = clickableRight - clickableLeft;
    const clickableHeight = clickableBottom - clickableTop;
    
    // Choose Random Point within the Safe Area
    let x, y;
    const hotspotBias = Math.random();
    
    if (hotspotBias < 0.3) {
      // 30% chance: Click Near Center
      const centerX = clickableLeft + clickableWidth / 2;
      const centerY = clickableTop + clickableHeight / 2;
      const variance = Math.min(clickableWidth, clickableHeight) * 0.2;
      x = centerX + (Math.random() - 0.5) * variance;
      y = centerY + (Math.random() - 0.5) * variance;
    } else if (hotspotBias < 0.6) {
      // 30% chance: Click in Top-Left Quadrant
      x = clickableLeft + Math.random() * (clickableWidth * 0.5);
      y = clickableTop + Math.random() * (clickableHeight * 0.5);
    } else {
      // 40% chance: Completely Random within Safe Area
      x = clickableLeft + Math.random() * clickableWidth;
      y = clickableTop + Math.random() * clickableHeight;
    }
    
    // Add Random Offset
    x += (Math.random() - 0.5) * 4;
    y += (Math.random() - 0.5) * 4;
    
    // Ensure Coordinates are within Safe Bounds
    x = Math.max(clickableLeft, Math.min(x, clickableRight));
    y = Math.max(clickableTop, Math.min(y, clickableBottom));
    
    // Human-Like Mouse Movement to the Point
    await this.simulateHumanMouseMovement(x, y);
    
    // Variable Click Timing
    const clickDelay = this.getRandomDelay(50, 200);
    await this.sleep(clickDelay);
    
    // Micro Adjustment
    if (Math.random() < 0.4) {
      const microX = x + (Math.random() - 0.5) * 6;
      const microY = y + (Math.random() - 0.5) * 6;
      const microEvent = new MouseEvent('mousemove', {
        view: window,
        bubbles: true,
        cancelable: true,
        clientX: microX,
        clientY: microY
      });
      document.dispatchEvent(microEvent);
      await this.sleep(20 + Math.random() * 50);
    }
    
    // Perform Click
    const clicked = await this.performSingleReliableClick(button, x, y, 'Auto Combat');
    
    if (clicked) {
      this.state.autoCombatActive = true;
      this.updateStatus('Auto Combat Enabled');
    } else {
      // Mark Click as Attempted to Prevent Endless Retries
      this.state.autoCombatActive = true;
      this.updateStatus('Auto Combat Enabled.');

      // Debug Log
      // console.log('⚠️ Auto combat has been marked as enabled.');
    }
  }
  
  findOkButton() {
    // Check both button types
    const button1 = document.querySelector('.btn-usual-ok.se-quest-start');
    const button2 = document.querySelector('.btn-usual-ok.btn-silent-se');
    
    // Return first visible button found
    if (button1 && this.isVisible(button1)) return button1;
    if (button2 && this.isVisible(button2)) return button2;
    
    return null;
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
           rect.height > 0 &&
           rect.top >= 0 &&
           rect.left >= 0;
  }
  
  canClick(type) {
    return Date.now() - this.cooldowns[type] > this.timing.COOLDOWN;
  }
  
  async simulateHumanClick(element, actionName) {
    if (!element) return;
    
    // Check for Popup before Click
    if (this.hasBlockingPopup().found) {
      this.handlePopupDetected();
      return;
    }
    
    const rect = element.getBoundingClientRect();
    
    const safeAreaPercent = 0.9; // 90% Safe Area
    const widthPadding = rect.width * (1 - safeAreaPercent) / 2;
    const heightPadding = rect.height * (1 - safeAreaPercent) / 2;

    const clickableLeft = rect.left + widthPadding;
    const clickableRight = rect.right - widthPadding;
    const clickableTop = rect.top + heightPadding;
    const clickableBottom = rect.bottom - heightPadding;

    const clickableWidth = clickableRight - clickableLeft;
    const clickableHeight = clickableBottom - clickableTop;
    
    let x, y;
    
    // Add Hotspot Bias - Humans Tend to Click Certain Areas More
    const hotspotBias = Math.random();
    if (hotspotBias < 0.3) {
      // 30% chance: Click Near Center
      const centerX = clickableLeft + clickableWidth / 2;
      const centerY = clickableTop + clickableHeight / 2;
      const variance = Math.min(clickableWidth, clickableHeight) * 0.2;
      x = centerX + (Math.random() - 0.5) * variance;
      y = centerY + (Math.random() - 0.5) * variance;
    } else if (hotspotBias < 0.6) {
      // 30% chance: Click in Top-Left Quadrant
      x = clickableLeft + Math.random() * (clickableWidth * 0.5);
      y = clickableTop + Math.random() * (clickableHeight * 0.5);
    } else {
      // 40% chance: Completely Random within Safe Area
      x = clickableLeft + Math.random() * clickableWidth;
      y = clickableTop + Math.random() * clickableHeight;
    }
    
    // Add Random Offset (±2px)
    x += (Math.random() - 0.5) * 4;
    y += (Math.random() - 0.5) * 4;
    
    // Ensure Coordinates are within Safe Bounds
    x = Math.max(clickableLeft, Math.min(x, clickableRight));
    y = Math.max(clickableTop, Math.min(y, clickableBottom));
    
    // Save Mouse Position for Next Movement
    this.state.lastMousePosition = { x, y };
    
    // Human-like Mouse Movement to the Randomized Point
    await this.simulateHumanMouseMovement(x, y);
    
    // Check for Popup after Mouse Movement
    if (this.hasBlockingPopup().found) {
      this.handlePopupDetected();
      return;
    }
    
    // Variable Click Time
    const clickDelay = this.getRandomDelay(50, 200); // 50-200ms delay
    await this.sleep(clickDelay);
    
    // Check for Popup during Click Delay
    if (this.hasBlockingPopup().found) {
      this.handlePopupDetected();
      return;
    }
    
    // Micro Adjust Mouse before Click
    if (Math.random() < 0.4) {
      const microX = x + (Math.random() - 0.5) * 6;
      const microY = y + (Math.random() - 0.5) * 6;
      const microEvent = new MouseEvent('mousemove', {
        view: window,
        bubbles: true,
        cancelable: true,
        clientX: microX,
        clientY: microY
      });
      document.dispatchEvent(microEvent);
      await this.sleep(20 + Math.random() * 50);
      
      // Check for Popup during Micro Adjust
      if (this.hasBlockingPopup().found) {
        this.handlePopupDetected();
        return;
      }
    }
    
    // Perform Click
    await this.performSingleReliableClick(element, x, y, actionName);
    this.state.totalClicks++;
    
    // Update Status
    this.sendStatusUpdate(actionName);
    
    // Debug Log
    // console.log(`📍 ${actionName} at ${Math.round(x)},${Math.round(y)} (${Math.round(((x - rect.left) / rect.width) * 100)}%,${Math.round(((y - rect.top) / rect.height) * 100)}%)`);
  }
  
  async performSingleReliableClick(element, x, y, actionName = '') {
    try {
      // Validate Coordinates are Finite Numbers
      if (!Number.isFinite(x) || !Number.isFinite(y)) {
        console.error(`Invalid coordinates for ${actionName}: x=${x}, y=${y}`);
        
        // Fallback to Center of Element
        const rect = element.getBoundingClientRect();
        x = rect.left + rect.width / 2;
        y = rect.top + rect.height / 2;

        // Debug Log
        // console.log(`Using fallback coordinates: x=${x}, y=${y}`);
      }
      
      // Human-like Click Timing
      const mouseDownDuration = this.getRandomDelay(30, 80);
      const betweenDownUp = this.getRandomDelay(5, 20);
      
      // Mouse Down
      const mouseDown = new MouseEvent('mousedown', {
        bubbles: true,
        cancelable: true,
        clientX: x,
        clientY: y,
        button: 0,
        buttons: 1
      });
      
      element.dispatchEvent(mouseDown);
      await this.sleep(mouseDownDuration);
      
      // Mouse Up
      const mouseUp = new MouseEvent('mouseup', {
        bubbles: true,
        cancelable: true,
        clientX: x,
        clientY: y,
        button: 0,
        buttons: 0
      });
      
      // Click Event
      const clickEvent = new MouseEvent('click', {
        bubbles: true,
        cancelable: true,
        clientX: x,
        clientY: y,
        button: 0
      });
      
      element.dispatchEvent(mouseUp);
      await this.sleep(betweenDownUp);
      element.dispatchEvent(clickEvent);
      
      // Try the Click Method
      if (typeof element.click === 'function') {
        await this.sleep(10);
        element.click();
      }
      
      // Debug Log
      // console.log(`✅ ${actionName} Click at ${Math.round(x)},${Math.round(y)}`);

      return true;
    } catch (error) {

      // Debug Log
      // console.log(`❌ Click failed for ${actionName}:`, error);

      return false;
    }
  }
  
  async simulateHumanMouseMovement(targetX, targetY) {
    // Start from Realistic Positions
    let startX, startY;
    
    // Humans Move from Previous Interaction Points
    if (Math.random() < 0.6 && this.state.lastMousePosition.x > 0) {
      // 60% chance: Start from Last Known Mouse Position
      startX = this.state.lastMousePosition.x;
      startY = this.state.lastMousePosition.y;
    } else if (Math.random() < 0.8) {
      // 20% chance: Start from Typical Resting Position
      startX = window.innerWidth * 0.8 + Math.random() * window.innerWidth * 0.2;
      startY = window.innerHeight * 0.8 + Math.random() * window.innerHeight * 0.2;
    } else {
      // 20% chance: Start from Completely Random Position
      startX = Math.random() * window.innerWidth;
      startY = Math.random() * window.innerHeight;
    }
    
    // Variable Number of Steps
    const steps = Math.floor(this.getRandomDelay(
      this.timing.MOUSE_STEPS_MIN,
      this.timing.MOUSE_STEPS_MAX
    ));
    
    // Choose Path Type
    const pathType = Math.random();
    let pathFunction;
    
    if (pathType < 0.4) {
      // 40%: Direct but Slight Curve
      pathFunction = this.easeInOutQuad;
    } else if (pathType < 0.7) {
      // 30%: More Curve
      pathFunction = this.easeInOutCubic;
    } else if (pathType < 0.9) {
      // 20%: Linear
      pathFunction = (t) => t;
    } else {
      // 10%: Overshoot and Correction
      pathFunction = this.easeOutBack;
    }
    
    // Move In Steps
    for (let i = 0; i <= steps; i++) {
      const progress = i / steps;
      const easedProgress = pathFunction(progress);
      
      let currentX, currentY;
      
      // For Overshoot Path Handle
      if (pathFunction === this.easeOutBack) {
        const overshoot = 0.2;
        const overshootProgress = progress < 0.8 ? progress / 0.8 : 1;
        const overshootX = startX + (targetX - startX) * 1.2;
        const overshootY = startY + (targetY - startY) * 1.2;
        
        if (progress < 0.8) {
          currentX = startX + (overshootX - startX) * easedProgress;
          currentY = startY + (overshootY - startY) * easedProgress;
        } else {
          const correctionProgress = (progress - 0.8) / 0.2;
          const correctionEase = this.easeInOutQuad(correctionProgress);
          currentX = overshootX + (targetX - overshootX) * correctionEase;
          currentY = overshootY + (targetY - overshootY) * correctionEase;
        }
      } else {
        currentX = startX + (targetX - startX) * easedProgress;
        currentY = startY + (targetY - startY) * easedProgress;
      }
      
      // Dispatch Mouse Move Event
      const event = new MouseEvent('mousemove', {
        view: window,
        bubbles: true,
        cancelable: true,
        clientX: currentX,
        clientY: currentY
      });
      
      document.dispatchEvent(event);
      
      // Variable Delay between Steps
      if (i < steps) {
        const stepDelay = this.getRandomDelay(
          this.timing.STEP_DELAY_MIN,
          this.timing.STEP_DELAY_MAX
        );
        await this.sleep(stepDelay);
      }
    }
    
    // Final Micro Adjust
    if (Math.random() < 0.3) {
      await this.sleep(30 + Math.random() * 70);
      const finalX = targetX + (Math.random() - 0.5) * 6;
      const finalY = targetY + (Math.random() - 0.5) * 6;
      
      const finalEvent = new MouseEvent('mousemove', {
        view: window,
        bubbles: true,
        cancelable: true,
        clientX: finalX,
        clientY: finalY
      });
      document.dispatchEvent(finalEvent);
    }
  }
  
  // Easing Function for Natural Movement
  easeInOutQuad(t) {
    return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
  }
  
  easeInOutCubic(t) {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }
  
  easeOutBack(t) {
    const c1 = 1.70158;
    const c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  }
  
  // Utility Sleep Function
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  
  sendStatusUpdate(actionName) {
    const status = {
      type: 'raidStatusUpdate',
      active: this.state.active,
      lastAction: actionName,
      totalClicks: this.state.totalClicks,
      autoCombatActive: this.state.autoCombatActive,
      currentScreen: this.state.currentScreen,
      totalRaids: this.state.totalRaids,
      timestamp: new Date().toLocaleTimeString()
    };

    // Include Break Status if Applicable
    if (this.breakManager) {
      const breakStatus = this.breakManager.getStatus();
      Object.assign(status, breakStatus);
    }      
    
    this.safeSendMessage(status);
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
      totalRaids: this.state.totalRaids,
      timestamp: new Date().toLocaleTimeString()
    };
    
    this.safeSendMessage(status);
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