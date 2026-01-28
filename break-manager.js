'use strict';

class BreakManager {
  constructor(settings = {}) {
    this.settings = {
      enableBreaks: settings.enableBreaks || false,
      breakInterval: settings.breakInterval || 10,  // raids between breaks
      breakDuration: settings.breakDuration || 5,   // minutes
      randomizeBreaks: settings.randomizeBreaks || false
    };
    
    this.state = {
      isOnBreak: false,
      breakStartTime: 0,
      breakEndTime: 0,
      raidsSinceLastBreak: 0,
      lastBreakTime: 0,
      totalBreaks: 0
    };
    
    this.timing = {
      // Break Probability Settings
      BREAK_CHANCE_PER_RAID: 0.18,
      MIN_RAIDS_BETWEEN_BREAKS: 3,
      MAX_RAIDS_BETWEEN_BREAKS: 12,
      
      // Break Duration Settings
      SHORT_BREAK_MIN: 30000,     // 30 seconds
      SHORT_BREAK_MAX: 120000,    // 2 minutes
      MEDIUM_BREAK_MIN: 120000,   // 2 minutes
      MEDIUM_BREAK_MAX: 300000,   // 5 minutes
      LONG_BREAK_MIN: 600000,     // 10 minutes
      LONG_BREAK_MAX: 1200000,    // 20 minutes
      
      // Break Type Probabilities
      SHORT_BREAK_CHANCE: 0.7,    // 70% short breaks
      MEDIUM_BREAK_CHANCE: 0.25,  // 25% medium breaks
      LONG_BREAK_CHANCE: 0.05     // 5% long breaks
    };
    
    this.breakTimer = null;
    this.onBreakEndCallback = null;
  }
  
  // Update settings
  updateSettings(newSettings) {
    this.settings = { ...this.settings, ...newSettings };
    
    // If breaks are disabled, end any ongoing break
    if (!this.settings.enableBreaks && this.state.isOnBreak) {
      this.endBreak();
    }
  }
  
  // Called after each raid completes
  onRaidComplete() {
    if (!this.settings.enableBreaks) return false;
    
    this.state.raidsSinceLastBreak++;
    
    // Check if it's time for a break
    if (this.shouldTakeBreak()) {
      this.startBreak();
      return true;
    }
    
    return false;
  }
  
  shouldTakeBreak() {
    if (!this.settings.enableBreaks) return false;
    
    // Ensure some time has passed since last break
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
  
  async startBreak() {
    if (!this.settings.enableBreaks) return;
    
    // Determine break type
    const breakType = this.determineBreakType();
    const breakTime = this.getBreakDuration(breakType);
    
    // Apply randomization if enabled
    if (this.settings.randomizeBreaks) {
      const randomFactor = 0.8 + Math.random() * 0.4; // ±20%
      breakTime = Math.floor(breakTime * randomFactor);
    }
    
    // Set break state
    this.state.isOnBreak = true;
    this.state.breakStartTime = Date.now();
    this.state.breakEndTime = Date.now() + breakTime;
    this.state.totalBreaks++;
    this.state.lastBreakTime = Date.now();
    
    const breakMinutes = Math.round(breakTime / 60000);
    const breakSeconds = Math.round((breakTime % 60000) / 1000);
    
    console.log(`⏸️ Taking ${breakType} break after ${this.state.raidsSinceLastBreak} raids for ${breakMinutes > 0 ? breakMinutes + 'm ' : ''}${breakSeconds}s`);
    
    // Start break timer
    this.breakTimer = setTimeout(() => {
      this.endBreak();
    }, breakTime);
    
    return {
      type: breakType,
      duration: breakTime,
      endTime: this.state.breakEndTime
    };
  }
  
  endBreak() {
    if (!this.state.isOnBreak) return;
    
    this.state.isOnBreak = false;
    this.state.raidsSinceLastBreak = 0;
    
    if (this.breakTimer) {
      clearTimeout(this.breakTimer);
      this.breakTimer = null;
    }
    
    console.log(`✅ Break ended, resuming automation`);
    
    // Call callback if set
    if (this.onBreakEndCallback) {
      this.onBreakEndCallback();
    }
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
  
  getRandomDelay(min, max) {
    return min + Math.random() * (max - min);
  }
  
  // Get current break status
  getStatus() {
    if (!this.state.isOnBreak) {
      return {
        isOnBreak: false,
        raidsSinceLastBreak: this.state.raidsSinceLastBreak,
        totalBreaks: this.state.totalBreaks
      };
    }
    
    const timeLeft = Math.max(0, this.state.breakEndTime - Date.now());
    const minutesLeft = Math.floor(timeLeft / 60000);
    const secondsLeft = Math.floor((timeLeft % 60000) / 1000);
    
    return {
      isOnBreak: true,
      timeLeft,
      minutesLeft,
      secondsLeft,
      breakStartTime: this.state.breakStartTime,
      breakEndTime: this.state.breakEndTime,
      raidsSinceLastBreak: this.state.raidsSinceLastBreak,
      totalBreaks: this.state.totalBreaks
    };
  }
  
  // Set callback for when break ends
  setOnBreakEndCallback(callback) {
    this.onBreakEndCallback = callback;
  }
  
  // Force end break (for manual override)
  forceEndBreak() {
    this.endBreak();
  }
  
  // Reset all break counters
  reset() {
    this.state.raidsSinceLastBreak = 0;
    this.state.lastBreakTime = 0;
    this.endBreak();
  }
  
  // Save/Load state for persistence
  saveState() {
    return {
      state: this.state,
      settings: this.settings
    };
  }
  
  loadState(savedState) {
    if (savedState) {
      this.state = { ...this.state, ...savedState.state };
      this.settings = { ...this.settings, ...savedState.settings };
    }
  }
}