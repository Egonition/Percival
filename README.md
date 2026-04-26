# Percival

![Version](https://img.shields.io/badge/version-1.3.0-blue)
![Manifest](https://img.shields.io/badge/manifest-v3-green)
![Platform](https://img.shields.io/badge/platform-Chromium-orange)
![Status](https://img.shields.io/badge/status-active-success)

**Percival** is a browser extension for automating gameplay in *Granblue Fantasy*. It streamlines raid participation, farming loops, and inventory tracking through lightweight in-browser automation tools.

---

## Overview

Percival is designed to reduce repetitive interaction during farming and raid sessions while maintaining configurable control over automation behavior.

It operates entirely client-side as a Chromium extension.

---

## Features

### Automation
- Automatic raid initiation
- Full auto combat handling
- Quick attack execution
- Optional reload triggers (attack / summon events)
- Configurable timing and input simulation

### Farm Routing
- Redirects to a user-defined farming location
- Uses a browser bookmark named `farm` as a routing reference
- Enables continuous farming loops between sessions

### Captcha Handling
- Optional captcha resolution system
- Requires external API key configuration in `config.js`
- Disabled by default until configured

### Drop Tracking
- Logs and tracks in-game item drops
- Provides a compact dropdown UI inside the extension
- Supports long-session farming analysis

---

## Installation

### Load Extension

1. Clone or download the repository:

```bash
git clone https://github.com/yourusername/percival.git
```

2. Open your browser and go to:

```text
chrome://extensions/
```

3. Enable **Developer Mode**

4. Click **Load unpacked**

5. Select the extension folder

---

## Configuration

### Captcha Solver (Optional)

Open `config.js` and set your API key:

```js
const CAPTCHA_API_KEY = "YOUR_API_KEY_HERE";
```

If not configured, captcha features remain disabled.

---

### Farm Redirect Setup

Create a browser bookmark named:

```text
farm
```

Set it to your preferred farming URL.

Percival will use it as the redirect target.

---

## Permissions

- storage — persistent settings  
- tabs — navigation control  
- scripting — content injection  
- webRequest — network monitoring  
- bookmarks — farm routing system  
- notifications — optional alerts  

---

## File Structure

```
Percival/
├── manifest.json
├── service-worker.js
├── config.js
├── raid-automation.js
├── captcha-solver.js
├── drop-data.js
├── content-inventory.js
├── break-manager.js
├── mouse-simulator.js
├── error-suppression.js
├── popup.html
└── images/
```

---

## Keyboard Shortcuts

| Action | Shortcut |
|--------|----------|
| Toggle Automation | Ctrl + Shift + Space (Windows/Linux) / Cmd + Shift + Space (Mac) |

---

## Notes

- Requires Chromium-based browser (Chrome, Edge, Brave)
- Designed for Granblue Fantasy web client
- Captcha solver requires external API configuration
- Farm routing depends on a bookmark named `farm`
- All automation runs locally in the browser

---

## Version

1.3.0

---

## License

Private / Internal Use