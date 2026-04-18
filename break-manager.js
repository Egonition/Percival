'use strict';

class BreakManager {
  constructor(settings = {}) {
    this.settings = {
      enableBreaks:    settings.enableBreaks    || false,
      breakInterval:   settings.breakInterval   || 10,   // Raids Between Breaks
      breakDuration:   settings.breakDuration   || 5,    // Minutes
      randomizeBreaks: settings.randomizeBreaks || false
    };

    this.state = {
      isOnBreak:            false,
      breakStartTime:       0,
      breakEndTime:         0,
      raidsSinceLastBreak:  0,
      lastBreakTime:        0,
      totalBreaks:          0
    };

    this.timing = {
      // Break Probability Settings
      BREAK_CHANCE_PER_RAID:      0.18,
      MIN_RAIDS_BETWEEN_BREAKS:   3,
      MAX_RAIDS_BETWEEN_BREAKS:   12,

      // Break Duration Settings (ms)
      SHORT_BREAK_MIN:   30000,    // 30 seconds
      SHORT_BREAK_MAX:   120000,   // 2 minutes
      MEDIUM_BREAK_MIN:  120000,   // 2 minutes
      MEDIUM_BREAK_MAX:  300000,   // 5 minutes
      LONG_BREAK_MIN:    600000,   // 10 minutes
      LONG_BREAK_MAX:    1200000,  // 20 minutes

      // Break Type Probabilities
      SHORT_BREAK_CHANCE:  0.70,   // 70%
      MEDIUM_BREAK_CHANCE: 0.25,   // 25%
      LONG_BREAK_CHANCE:   0.05    // 5%
    };

    this.breakTimer = null;
    this.onBreakEndCallback = null;
  }

  // Update Settings
  updateSettings(newSettings) {
    this.settings = { ...this.settings, ...newSettings };
    if (!this.settings.enableBreaks && this.state.isOnBreak) {
      this.endBreak();
    }
  }

  // Save State
  saveState() {
    return {
      settings: this.settings,
      state: { ...this.state }
    };
  }

  // Load State
  loadState(savedState) {
    if (!savedState) return;

    const currentEnableBreaks = this.settings.enableBreaks;

    if (savedState.settings) {
      this.settings = { ...this.settings, ...savedState.settings };
    }

    if (savedState.state) {
      this.state = { ...this.state, ...savedState.state };
    }

    // Preserve Current Enable Breaks Setting
    this.settings.enableBreaks = currentEnableBreaks;
  }

  // Called After Each Raid Completes
  onRaidComplete() {
    if (!this.settings.enableBreaks || this.state.isOnBreak) return false;

    this.state.raidsSinceLastBreak++;

    if (this.shouldTakeBreak()) {
      this.startBreak();
      return true;
    }

    return false;
  }

  // Determine if a Break Should be Taken
  shouldTakeBreak() {
    if (!this.settings.enableBreaks || this.state.isOnBreak) return false;

    // At Least 1 Minute Since Last Break
    const timeSinceLastBreak = Date.now() - this.state.lastBreakTime;
    if (timeSinceLastBreak < 60000) return false;

    // Minimum Raids Between Breaks
    if (this.state.raidsSinceLastBreak < this.timing.MIN_RAIDS_BETWEEN_BREAKS) return false;

    // Maximum Raids Between Breaks - Force Break
    if (this.state.raidsSinceLastBreak >= this.timing.MAX_RAIDS_BETWEEN_BREAKS) return true;

    // Random Chance Based on Raids Completed
    const breakChance = this.timing.BREAK_CHANCE_PER_RAID *
      (this.state.raidsSinceLastBreak / this.timing.MIN_RAIDS_BETWEEN_BREAKS);

    return Math.random() < breakChance;
  }

  // Start Break
  async startBreak() {
    if (!this.settings.enableBreaks) return;

    const breakType = this.determineBreakType();
    let breakDuration = this.getBreakDuration(breakType);

    // Apply Randomization if Enabled
    if (this.settings.randomizeBreaks) {
      breakDuration = Math.floor(breakDuration * (0.8 + Math.random() * 0.4));
    }

    this.state.isOnBreak       = true;
    this.state.breakStartTime  = Date.now();
    this.state.breakEndTime    = Date.now() + breakDuration;
    this.state.lastBreakTime   = Date.now();
    this.state.totalBreaks++;

    const mins = Math.floor(breakDuration / 60000);
    const secs = Math.round((breakDuration % 60000) / 1000);
    console.log(`⏸️ Taking ${breakType} Break After ${this.state.raidsSinceLastBreak} Raids For ${mins > 0 ? mins + 'm ' : ''}${secs}s`);

    this.breakTimer = setTimeout(() => this.endBreak(), breakDuration);

    return {
      type:     breakType,
      duration: breakDuration,
      endTime:  this.state.breakEndTime
    };
  }

  // End Break
  endBreak() {
    if (!this.state.isOnBreak) return;

    this.state.isOnBreak           = false;
    this.state.raidsSinceLastBreak = 0;

    if (this.breakTimer) {
      clearTimeout(this.breakTimer);
      this.breakTimer = null;
    }

    console.log('✅ Break Ended - Resuming Raids.');
    this.saveState();

    if (this.onBreakEndCallback) {
      this.onBreakEndCallback();
    }
  }

  // Force End Break
  forceEndBreak() {
    if (!this.state.isOnBreak) {
      console.warn('⚠️ No Active Break to End.');
      return false;
    }

    this.state.isOnBreak           = false;
    this.state.raidsSinceLastBreak = 0;

    if (this.breakTimer) {
      clearTimeout(this.breakTimer);
      this.breakTimer = null;
    }

    console.log('✅ Break Force Ended.');
    this.saveState();

    chrome.runtime.sendMessage({
      type: 'breakStatusUpdate',
      isOnBreak: false,
      raidsSinceLastBreak: 0
    });

    if (this.onBreakEndCallback) {
      this.onBreakEndCallback();
    }

    return true;
  }

  // Determine Break Type
  determineBreakType() {
    const rand = Math.random();
    if (rand < this.timing.SHORT_BREAK_CHANCE) return 'short';
    if (rand < this.timing.SHORT_BREAK_CHANCE + this.timing.MEDIUM_BREAK_CHANCE) return 'medium';
    return 'long';
  }

  // Get Break Duration
  getBreakDuration(breakType) {
    switch (breakType) {
      case 'short':  return this.getRandomDelay(this.timing.SHORT_BREAK_MIN,  this.timing.SHORT_BREAK_MAX);
      case 'medium': return this.getRandomDelay(this.timing.MEDIUM_BREAK_MIN, this.timing.MEDIUM_BREAK_MAX);
      case 'long':   return this.getRandomDelay(this.timing.LONG_BREAK_MIN,   this.timing.LONG_BREAK_MAX);
      default:       return this.getRandomDelay(this.timing.SHORT_BREAK_MIN,  this.timing.SHORT_BREAK_MAX);
    }
  }

  // Get Random Delay
  getRandomDelay(min, max) {
    return min + Math.random() * (max - min);
  }

  // Get Current Break Status
  getStatus() {
    if (!this.state.isOnBreak) {
      return {
        isOnBreak:           false,
        raidsSinceLastBreak: this.state.raidsSinceLastBreak,
        totalBreaks:         this.state.totalBreaks
      };
    }

    const timeLeft = Math.max(0, this.state.breakEndTime - Date.now());

    return {
      isOnBreak:           true,
      timeLeft:            timeLeft,
      minutesLeft:         Math.floor(timeLeft / 60000),
      secondsLeft:         Math.floor((timeLeft % 60000) / 1000),
      breakStartTime:      this.state.breakStartTime,
      breakEndTime:        this.state.breakEndTime,
      raidsSinceLastBreak: this.state.raidsSinceLastBreak,
      totalBreaks:         this.state.totalBreaks
    };
  }

  // Set Break End Callback
  setOnBreakEndCallback(callback) {
    this.onBreakEndCallback = callback;
  }

  // Reset Break Counter
  reset() {
    this.state.raidsSinceLastBreak = 0;
    this.state.lastBreakTime       = 0;
    this.endBreak();
  }

  // Send Status Update
  sendStatusUpdate() {
    if (!this.state.isOnBreak) return;

    chrome.runtime.sendMessage({
      type:                'breakStatusUpdate',
      isOnBreak:           true,
      timeLeft:            Math.max(0, this.state.breakEndTime - Date.now()),
      raidsSinceLastBreak: this.state.raidsSinceLastBreak
    });
  }
}