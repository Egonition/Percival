'use strict';

class MouseSimulator {

  constructor(timing) {
    this.timing = timing;
    this.lastMousePosition = { x: 0, y: 0 };
  }

  // ==========================================================
  // Click Point
  // ==========================================================

  getRandomClickPoint(element) {
    const rect     = element.getBoundingClientRect();
    const safeArea = 0.9;
    const wPad     = rect.width  * (1 - safeArea) / 2;
    const hPad     = rect.height * (1 - safeArea) / 2;
    const left     = rect.left   + wPad;
    const right    = rect.right  - wPad;
    const top      = rect.top    + hPad;
    const bottom   = rect.bottom - hPad;
    const w        = right - left;
    const h        = bottom - top;

    const bias = Math.random();
    let x, y;

    if (bias < 0.3) {
      // 30%: Near Center
      x = left + w / 2 + (Math.random() - 0.5) * w * 0.2;
      y = top  + h / 2 + (Math.random() - 0.5) * h * 0.2;
    } else if (bias < 0.6) {
      // 30%: Top-Left Quadrant
      x = left + Math.random() * (w * 0.5);
      y = top  + Math.random() * (h * 0.5);
    } else {
      // 40%: Fully Random
      x = left + Math.random() * w;
      y = top  + Math.random() * h;
    }

    // Small Random Offset
    x += (Math.random() - 0.5) * 4;
    y += (Math.random() - 0.5) * 4;

    // Clamp to Safe Area
    x = Math.max(left, Math.min(x, right));
    y = Math.max(top,  Math.min(y, bottom));

    return { x, y };
  }

  // ==========================================================
  // Micro Adjust
  // ==========================================================

  async applyMicroAdjust(x, y) {
    if (Math.random() >= 0.4) return;
    document.dispatchEvent(new MouseEvent('mousemove', {
      view: window, bubbles: true, cancelable: true,
      clientX: x + (Math.random() - 0.5) * 6,
      clientY: y + (Math.random() - 0.5) * 6
    }));
    await this.sleep(20 + Math.random() * 50);
  }

  // ==========================================================
  // Human Click
  // ==========================================================

  async simulateHumanClick(element, actionName, onPopupCheck) {
    if (!element) return;

    if (onPopupCheck?.()) return;

    const { x, y } = this.getRandomClickPoint(element);
    this.lastMousePosition = { x, y };

    await this.simulateHumanMouseMovement(x, y);
    if (onPopupCheck?.()) return;

    await this.sleep(this.getRandomDelay(50, 200));
    if (onPopupCheck?.()) return;

    await this.applyMicroAdjust(x, y);
    if (onPopupCheck?.()) return;

    await this.performSingleReliableClick(element, x, y, actionName);
    return { x, y };
  }

  async performSingleReliableClick(element, x, y, actionName = '') {
    try {
      if (!Number.isFinite(x) || !Number.isFinite(y)) {
        console.error(`Invalid Coordinates for ${actionName}: x=${x}, y=${y}`);
        const rect = element.getBoundingClientRect();
        x = rect.left + rect.width  / 2;
        y = rect.top  + rect.height / 2;
      }

      const mouseDownDuration = this.getRandomDelay(30, 80);
      const betweenDownUp     = this.getRandomDelay(5,  20);

      element.dispatchEvent(new MouseEvent('mousedown', {
        bubbles: true, cancelable: true, clientX: x, clientY: y, button: 0, buttons: 1
      }));
      await this.sleep(mouseDownDuration);

      element.dispatchEvent(new MouseEvent('mouseup', {
        bubbles: true, cancelable: true, clientX: x, clientY: y, button: 0, buttons: 0
      }));
      await this.sleep(betweenDownUp);

      element.dispatchEvent(new MouseEvent('click', {
        bubbles: true, cancelable: true, clientX: x, clientY: y, button: 0
      }));

      if (typeof element.click === 'function') {
        await this.sleep(10);
        element.click();
      }

      return true;
    } catch (error) {
      console.error(`❌ Click Failed for ${actionName}:`, error);
      return false;
    }
  }

  // ==========================================================
  // Mouse Movement
  // ==========================================================

  async simulateHumanMouseMovement(targetX, targetY) {
    let startX, startY;

    const rand = Math.random();
    if (rand < 0.6 && this.lastMousePosition.x > 0) {
      startX = this.lastMousePosition.x;
      startY = this.lastMousePosition.y;
    } else if (rand < 0.8) {
      startX = window.innerWidth  * 0.8 + Math.random() * window.innerWidth  * 0.2;
      startY = window.innerHeight * 0.8 + Math.random() * window.innerHeight * 0.2;
    } else {
      startX = Math.random() * window.innerWidth;
      startY = Math.random() * window.innerHeight;
    }

    const steps        = Math.floor(this.getRandomDelay(this.timing.MOUSE_STEPS_MIN, this.timing.MOUSE_STEPS_MAX));
    const pathType     = Math.random();
    const useOvershoot = pathType >= 0.9;
    const pathFn       = pathType < 0.4 ? this.easeInOutQuad.bind(this)
                       : pathType < 0.7 ? this.easeInOutCubic.bind(this)
                       : pathType < 0.9 ? (t) => t
                       : this.easeOutBack.bind(this);

    for (let i = 0; i <= steps; i++) {
      const progress = i / steps;
      const eased    = pathFn(progress);
      let currentX, currentY;

      if (useOvershoot) {
        const overshootX = startX + (targetX - startX) * 1.2;
        const overshootY = startY + (targetY - startY) * 1.2;

        if (progress < 0.8) {
          currentX = startX + (overshootX - startX) * eased;
          currentY = startY + (overshootY - startY) * eased;
        } else {
          const corrEase = this.easeInOutQuad((progress - 0.8) / 0.2);
          currentX = overshootX + (targetX - overshootX) * corrEase;
          currentY = overshootY + (targetY - overshootY) * corrEase;
        }
      } else {
        currentX = startX + (targetX - startX) * eased;
        currentY = startY + (targetY - startY) * eased;
      }

      document.dispatchEvent(new MouseEvent('mousemove', {
        view: window, bubbles: true, cancelable: true,
        clientX: currentX, clientY: currentY
      }));

      if (i < steps) {
        await this.sleep(this.getRandomDelay(this.timing.STEP_DELAY_MIN, this.timing.STEP_DELAY_MAX));
      }
    }

    // Final Micro Adjust
    if (Math.random() < 0.3) {
      await this.sleep(30 + Math.random() * 70);
      document.dispatchEvent(new MouseEvent('mousemove', {
        view: window, bubbles: true, cancelable: true,
        clientX: targetX + (Math.random() - 0.5) * 6,
        clientY: targetY + (Math.random() - 0.5) * 6
      }));
    }
  }

  // ==========================================================
  // Easing Functions
  // ==========================================================

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

  // ==========================================================
  // Utilities
  // ==========================================================

  getRandomDelay(min, max) {
    return min + Math.random() * (max - min);
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}