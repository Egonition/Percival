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

      // Break Tracking
      isOnBreak: false,
      breakStartTime: 0,
      breakEndTime: 0,
      raidsSinceLastBreak: 0,
      lastBreakTime: 0,
      
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

      // Break Probability Settings
      BREAK_CHANCE_PER_RAID: 0.18, // 18% chance to take a break after any raid
      MIN_RAIDS_BETWEEN_BREAKS: 3,  // At least 3 raids between breaks
      MAX_RAIDS_BETWEEN_BREAKS: 12,  // At most 12 raids between breaks
      
      // Break Duration Settings
      SHORT_BREAK_MIN: 30000,     // 30 seconds
      SHORT_BREAK_MAX: 120000,    // 2 minutes
      MEDIUM_BREAK_MIN: 120000,    // 2 minutes
      MEDIUM_BREAK_MAX: 300000,    // 5 minutes
      LONG_BREAK_MIN: 600000,     // 10 minutes
      LONG_BREAK_MAX: 1200000,     // 20 minutes
      
      // Break Type Probabilities
      SHORT_BREAK_CHANCE: 0.7,    // 70% short breaks (most common)
      MEDIUM_BREAK_CHANCE: 0.25,   // 25% medium breaks
      LONG_BREAK_CHANCE: 0.05      // 5% long breaks (rare)
    };
    
    this.observer = null;
    this.interval = null;
    this.init();
  }
  
  async init() {
    await this.loadSettings();
    await this.loadPersistentState(); // Load Saved Raid Count

    // Check for Ongoing Break
    if (this.state.isOnBreak && this.state.breakEndTime > Date.now()) {
      const timeLife = Math.ceil((this.state.breakEndTime - Date.now()) / 1000);
      this.updateStatus(`⏸️ On Break for ${timeLife} More Seconds...`);

      // Resume Break Monitoring
      this.monitorBreak();
      return;
    } else if (this.state.isOnBreak) {
      // Break has Ended
      this.state.isOnBreak = false;
      this.savePersistentState();
    }
    
    this.setupListeners();
    this.setupObserver();
    
    // Start if Either Feature is Enabled
    if (this.settings.autoRaid || this.settings.autoCombat) {
      this.start();
    }
  }

  monitorBreak() {
    const breakMessages = [
      "Taking a quick break...",
      "Stretching...",
      "Checking notifications...",
      "Getting some water...",
      "Looking away from screen...",
      "Quick rest..."
    ];
    
    const checkBreak = () => {
      if (this.state.isOnBreak && this.state.breakEndTime > Date.now()) {
        const timeLeft = Math.ceil((this.state.breakEndTime - Date.now()) / 1000);
        
        // Update Status Every 15 Seconds with Random Message
        if (timeLeft % 15 === 0) {
          const randomMessage = breakMessages[Math.floor(Math.random() * breakMessages.length)];
          this.updateStatus(`${randomMessage} (${timeLeft}s left)`);
        } else {
          this.updateStatus(`⏸️ Break: ${timeLeft}s remaining`);
        }
        
        setTimeout(checkBreak, 1000);
      } else if (this.state.isOnBreak) {
        // Break has Ended
        this.state.isOnBreak = false;
        this.savePersistentState();
        
        const resumeMessages = [
          "Back to it!",
          "Break over, resuming...",
          "Ready to go again!",
          "Let's continue!"
        ];
        const randomResume = resumeMessages[Math.floor(Math.random() * resumeMessages.length)];
        this.updateStatus(randomResume);

        // Resume Automation if Enabled
        this.setupListeners();
        this.setupObserver();

        if (this.settings.autoRaid || this.settings.autoCombat) {
          this.start();
        }
      }
    };

    checkBreak();
  }
  
  // Load Settings from Storage
  async loadSettings() {
    return new Promise(resolve => {
      chrome.storage.sync.get(['autoRaid', 'autoCombat'], data => {
        this.settings.autoRaid = data.autoRaid || false;
        this.settings.autoCombat = data.autoCombat || false;
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
          this.state.raidsSinceLastBreak = saved.raidsSinceLastBreak || 0;
          this.state.lastBreakTime = saved.lastBreakTime || 0;
          this.state.isOnBreak = saved.isOnBreak || false;
          this.state.breakStartTime = saved.breakStartTime || 0;
          this.state.breakEndTime = saved.breakEndTime || 0;
          
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
      raidsSinceLastBreak: this.state.raidsSinceLastBreak,
      lastBreakTime: this.state.lastBreakTime,
      isOnBreak: this.state.isOnBreak,
      breakStartTime: this.state.breakStartTime,
      breakEndTime: this.state.breakEndTime
    };

    chrome.storage.local.set({ raidAutomatorState: stateToSave }, () => {
      // Debug Log
      // console.log(`💾 Saved: ${this.state.totalRaids} Raids, ${this.state.raidsSinceLastBreak} Since Last Break`);
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
          timestamp: new Date().toLocaleTimeString(),
          totalRaids: this.state.totalRaids
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
    if (this.state.isOnBreak && this.state.breakEndTime > Date.now()) {
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
    // Skip if on Break
    if (this.state.isOnBreak && this.state.breakEndTime > Date.now()) {
      return;
    }

    // Prevent Duplicate Logs
    if (Date.now() - this.state.lastRaidCompletionLog < 1000) return;
    
    this.state.totalRaids++;
    this.state.raidsSinceLastBreak++;
    this.state.lastRaidCompletionLog = Date.now();
    
    const raidDuration = Date.now() - this.state.lastRaidStartTime;
    const durationSeconds = Math.round(raidDuration / 1000);

    this.savePersistentState();
    
    this.updateStatus(`Raid ${this.state.totalRaids} complete! (${durationSeconds}s)`);

    // Debug Log
    console.log(`✅ Raid ${this.state.totalRaids} Completed in ${durationSeconds} Seconds.`);
    
    // Check if it's time for a break
    if (this.shouldTakeBreak()) {
      this.takeHumanBreak();
    }

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

  shouldTakeBreak() {
    // Ensure Some Time has Passed Since Last Break
    if (Date.now() - this.state.lastBreakTime < 60000) return false;
    
    // Minimum raids between breaks
    if (this.state.raidsSinceLastBreak < this.timing.MIN_RAIDS_BETWEEN_BREAKS) return false;
    
    // Maximum raids between breaks
    if (this.state.raidsSinceLastBreak >= this.timing.MAX_RAIDS_BETWEEN_BREAKS) return true;
    
    // Random chance based on raids completed
    const breakChance = this.timing.BREAK_CHANCE_PER_RAID * 
                      (this.state.raidsSinceLastBreak / this.timing.MIN_RAIDS_BETWEEN_BREAKS);
    
    return Math.random() < breakChance;
  }
  
  async takeHumanBreak() {
    if (!this.state.active) return;

    // Determine Break Type
    const breakType = this.determineBreakType();
    const breakTime = this.getBreakDuration(breakType);
    
    // Set Break State
    this.state.isOnBreak = true;
    this.state.breakStartTime = Date.now();
    this.state.breakEndTime = Date.now() + breakTime;
    this.state.raidsSinceLastBreak = 0;
    this.state.lastBreakTime = Date.now();

    const breakMinutes = Math.round(breakTime / 60000);
    const breakSeconds = Math.round((breakTime % 60000) / 1000);
      
    this.updateStatus(`${breakType} break: ${breakMinutes > 0 ? breakMinutes + 'm ' : ''}${breakSeconds}s`);
    console.log(`⏸️ Taking ${breakType.charAt(0).toUpperCase() + breakType.slice(1)} Break after ${this.state.totalRaids} Raids for ${breakMinutes > 0 ? breakMinutes + 'm ' : ''}${breakSeconds}s`);

    // Save State
    await this.savePersistentState();
    
    // Stop Automation
    this.stop();
    
    // Start Monitoring Break
    this.monitorBreak();
  }

  determineBreakType() {
    const rand = Math.random();
    if (rand < this.timing.SHORT_BREAK_CHANCE) return 'short';
    if (rand < this.timing.SHORT_BREAK_CHANCE + this.timing.MEDIUM_BREAK_CHANCE) return 'medium';
    return 'long';
  }

  getBreakDuration(breakType) {
    switch (breakType) {
      case 'short':
        return this.getRandomDelay(this.timing.SHORT_BREAK_MIN, this.timing.SHORT_BREAK_MAX);
      case 'medium':
        return this.getRandomDelay(this.timing.MEDIUM_BREAK_MIN, this.timing.MEDIUM_BREAK_MAX);
      case 'long':
        return this.getRandomDelay(this.timing.LONG_BREAK_MIN, this.timing.LONG_BREAK_MAX);
      default:
        return this.getRandomDelay(this.timing.SHORT_BREAK_MIN, this.timing.SHORT_BREAK_MAX);
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
    if (this.state.isOnBreak && this.state.breakEndTime > Date.now()) {
      return;
    }

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

    await this.savePersistentState(); // Save Updated Raid Count
    
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