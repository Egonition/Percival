'use strict';

class CaptchaSolver {
  constructor(apiKey) {
    this.apiKey = apiKey;
  }

  // ==========================================================
  // Solve
  // ==========================================================

  async solve(imgElement) {
    console.log('📸 Captcha Image Element Found:', imgElement);
    console.log('📸 Captcha Image Src:', imgElement.src);

    const base64 = await this.imageToBase64(imgElement);
    if (!base64) {
      console.error('❌ Failed to Convert Image to Base64.');
      await this.saveLog({ step: 'imageToBase64', error: 'Failed to convert image to base64' });
      return null;
    }

    console.log('✅ Image Converted to Base64 Successfully.');

    try {
      console.log('📡 Sending Image to Service Worker...');

      const solution = await new Promise((resolve) => {
        const timeout = setTimeout(() => {
          console.warn('⚠️ Captcha Solve Timed Out.');
          chrome.runtime.onMessage.removeListener(listener);
          resolve(null);
        }, 30000);

        const listener = (msg) => {
          if (msg.type === 'captchaSolution') {
            clearTimeout(timeout);
            chrome.runtime.onMessage.removeListener(listener);
            resolve(msg.solution);
          }
        };

        chrome.runtime.onMessage.addListener(listener);

        chrome.runtime.sendMessage({
          type:   'solveCaptcha',
          image:  base64,
          apiKey: this.apiKey
        });
      });

      if (!solution) {
        console.error('❌ No Solution Returned.');
        await this.saveLog({ step: 'apiResponse', error: 'No solution returned' });
        return null;
      }

      console.log(`🔐 Captcha Solution: "${solution}"`);

      await this.saveLog({
        step:     'solved',
        solution: solution,
        image:    base64
      });

      return solution;

    } catch (error) {
      console.error('❌ Captcha Solve Failed:', error);
      await this.saveLog({ step: 'solve', error: error.message });
      return null;
    }
  }

  // ==========================================================
  // Submit
  // ==========================================================

  async submitSolution(solution) {
    if (!solution) return false;

    console.log(`📝 Attempting to Submit Solution: "${solution}"`);

    const input = document.querySelector('.prt-popup-body textarea.frm-message');
    console.log('📝 Textarea Element Found:', input);

    if (!input) {
      console.warn('⚠️ Captcha Input Not Found.');
      await this.saveLog({ step: 'submit', error: 'Textarea not found' });
      return false;
    }

    // Focus and Clear
    input.focus();
    input.value = '';

    // Type Each Character to Trigger Framework Events
    for (const char of solution) {
      input.dispatchEvent(new KeyboardEvent('keydown',  { key: char, bubbles: true }));
      input.value += char;
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new KeyboardEvent('keypress', { key: char, bubbles: true }));
      input.dispatchEvent(new KeyboardEvent('keyup',    { key: char, bubbles: true }));

      await new Promise(resolve => setTimeout(resolve, 50 + Math.random() * 50));
    }

    input.dispatchEvent(new Event('change', { bubbles: true }));
    console.log('📝 Textarea Value Set to:', input.value);

    await new Promise(resolve => setTimeout(resolve, 500 + Math.random() * 300));

    const submitButton = document.querySelector('.prt-popup-body .btn-talk-message');
    console.log('🖱️ Submit Button Found:', submitButton);

    if (submitButton) {
      await this.saveLog({ step: 'submit', solution, buttonFound: true });

      submitButton.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
      await new Promise(resolve => setTimeout(resolve, 50));
      submitButton.dispatchEvent(new MouseEvent('mouseup',   { bubbles: true }));
      submitButton.dispatchEvent(new MouseEvent('click',     { bubbles: true }));
      submitButton.click();

      console.log('✅ Captcha Submitted.');
      return true;
    }

    console.warn('⚠️ Captcha Submit Button Not Found.');
    await this.saveLog({ step: 'submit', error: 'Submit button not found' });
    return false;
  }

  // ==========================================================
  // Image Conversion
  // ==========================================================

  async imageToBase64(imgElement) {
    try {
      if (imgElement.complete && imgElement.naturalWidth > 0) {
        return this.canvasToBase64(imgElement);
      }
      return await new Promise((resolve) => {
        imgElement.onload  = () => resolve(this.canvasToBase64(imgElement));
        imgElement.onerror = () => resolve(null);
      });
    } catch (e) {
      console.error('❌ Image to Base64 Failed:', e);
      return null;
    }
  }

  canvasToBase64(imgElement) {
    const scale  = 5;
    const canvas = document.createElement('canvas');
    canvas.width  = imgElement.naturalWidth  * scale;
    canvas.height = imgElement.naturalHeight * scale;

    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(imgElement, 0, 0, canvas.width, canvas.height);

    return canvas.toDataURL('image/png').split(',')[1];
  }

  // ==========================================================
  // Logging
  // ==========================================================

  async saveLog(data) {
    return new Promise((resolve) => {
      chrome.storage.local.get(['captchaDebugLogs'], (stored) => {
        const logs = stored.captchaDebugLogs || [];

        logs.push({
          timestamp: new Date().toISOString(),
          ...data
        });

        if (logs.length > 50) logs.shift();

        chrome.storage.local.set({ captchaDebugLogs: logs }, resolve);
      });
    });
  }
}