'use strict';

document.addEventListener('DOMContentLoaded', () => {

  // =========================================================
  // State
  // =========================================================

  let isPlaying = true;
  let elements  = {};

  // =========================================================
  // Constants
  // =========================================================

  const labels = {
    goBackOnAttack: 'Back On Attack',
    reloadAttack:   'Reload On Attack',
    goBackOnSummon: 'Back On Summon',
    reloadSummon:   'Reload On Summon',
    reloadSkill:    'Reload On Skill',
    redirectFarm:   'Redirect to Farm',
    autoRaid:       'Auto Raid',
    autoCombat:     'Auto Combat',
    quickAttack:    'Quick Attack',
    enableBreaks:   'Enable Breaks'
  };

  // =========================================================
  // DOM References
  // =========================================================

  const playPauseBtn    = document.getElementById('playPauseBtn');
  const deactivateTopBtn = document.getElementById('deactivateTopBtn');
  const dropContainer   = document.getElementById('dropContainer');

  // =========================================================
  // Tabs
  // =========================================================

  const tabs        = document.querySelectorAll('.tab');
  const tabContents = document.querySelectorAll('.tab-content');

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      tabContents.forEach(c => c.style.display = 'none');
      tab.classList.add('active');
      const content = document.getElementById(tab.dataset.tab);
      if (content) content.style.display = 'block';
    });
  });

  // =========================================================
  // Helpers
  // =========================================================

  // Send Message to Active Tab
  function sendToActiveTab(message) {
    return chrome.tabs.query({ active: true, currentWindow: true }).then(tabs => {
      if (tabs[0]?.id) {
        return chrome.tabs.sendMessage(tabs[0].id, message);
      }
    }).catch(err => console.log('Content Script Not Ready:', err));
  }

  // Format Time
  function formatTime(ms) {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;
  }

  // =========================================================
  // Play / Pause
  // =========================================================

  chrome.storage.local.get('isPlaying', (data) => {
    isPlaying = data.isPlaying !== undefined ? data.isPlaying : true;
    updatePlayPauseButton();
  });

  function updatePlayPauseButton() {
    playPauseBtn.textContent      = isPlaying ? '⏸️ Pause' : '▶️ Start';
    playPauseBtn.style.backgroundColor = isPlaying ? '#ff9800' : '#4CAF50';
  }

  playPauseBtn.addEventListener('click', () => {
    isPlaying = !isPlaying;
    chrome.storage.local.set({ isPlaying });
    updatePlayPauseButton();
    sendToActiveTab({ type: 'toggleAutomation', action: isPlaying ? 'play' : 'pause' });
  });

  // =========================================================
  // Deactivate All
  // =========================================================

  deactivateTopBtn.addEventListener('click', () => {
    allKeys.forEach(key => {
      if (elements[key]) elements[key].checked = false;
    });

    chrome.storage.sync.set(storageDefaults);

    if (isPlaying) {
      isPlaying = false;
      chrome.storage.local.set({ isPlaying: false });
      updatePlayPauseButton();
      sendToActiveTab({ type: 'toggleAutomation', action: 'pause' });
    }

    updateRaidStatus();
  });

  // =========================================================
  // Settings
  // =========================================================

  const container = document.getElementById('options');
  container.innerHTML = '';

  for (const [categoryName, keys] of Object.entries(categories)) {
    const header = document.createElement('h3');
    header.textContent        = categoryName;
    header.style.margin       = '8px 0 2px';
    header.style.fontSize     = '14px';
    header.style.borderBottom = '1px solid #ccc';
    header.style.gridColumn   = 'span 2';
    container.appendChild(header);

    keys.forEach(key => {
      const div      = document.createElement('div');
      div.className  = 'setting-item';

      const checkbox  = document.createElement('input');
      checkbox.type   = 'checkbox';
      checkbox.id     = key;

      const label     = document.createElement('label');
      label.htmlFor   = key;
      label.textContent = ' ' + labels[key];

      div.appendChild(checkbox);
      div.appendChild(label);
      container.appendChild(div);

      elements[key] = checkbox;
    });
  }

  // =========================================================
  // Status Display
  // =========================================================

  const statusDiv = document.createElement('div');
  statusDiv.id = 'raidStatus';
  Object.assign(statusDiv.style, {
    gridColumn:      '1',
    padding:         '8px',
    backgroundColor: '#f5f5f5',
    borderRadius:    '6px',
    fontSize:        '11px',
    borderLeft:      '4px solid #ddd',
    minHeight:       '45px',
    overflow:        'hidden',
    wordWrap:        'break-word',
    marginTop:       '4px',
    marginBottom:    '6px'
  });
  statusDiv.innerHTML = '<div style="color: #666; font-style: italic; font-size: 11px;">Enable automation features</div>';
  container.appendChild(statusDiv);

  function updateRaidStatus(message = null) {
    if (!statusDiv) return;

    const autoRaidEnabled  = elements.autoRaid?.checked  || false;
    const autoCombatEnabled = elements.autoCombat?.checked || false;

    // Handle Raid Status Update
    if (message?.type === 'raidStatusUpdate') {
      if (message.active && isPlaying) {
        const features = [
          autoRaidEnabled  && 'Raid',
          autoCombatEnabled && 'Auto'
        ].filter(Boolean).join('+');

        setStatus(statusDiv, {
          dotColor: '#4CAF50',
          title:    `▶️ ${features}`,
          titleColor: '#2e7d32',
          body:     message.lastAction || 'Running...',
          bg:       '#e8f5e8',
          border:   '#4CAF50',
          pulse:    true
        });
      } else {
        setStatus(statusDiv, {
          dotColor:   '#9e9e9e',
          title:      '⏸️ PAUSED',
          titleColor: '#666',
          body:       message.lastAction || 'Click Start to begin',
          bg:         '#f5f5f5',
          border:     '#ddd'
        });
      }
      return;
    }

    // Handle Popup Detected
    if (message?.type === 'popupDetected') {
      setStatus(statusDiv, {
        dotColor:   '#FF5722',
        title:      '⚠️ POPUP DETECTED',
        titleColor: '#D32F2F',
        body:       message.popupInfo?.text || 'Unknown Popup',
        footer:     'Automation Paused - Close Popup and Click Start',
        bg:         '#FFEBEE',
        border:     '#FF5722'
      });
      return;
    }

    // Default State
    if (autoRaidEnabled || autoCombatEnabled) {
      const features = [
        autoRaidEnabled   && 'Raid',
        autoCombatEnabled && 'Auto'
      ].filter(Boolean).join('+');

      setStatus(statusDiv, {
        dotColor:   '#4CAF50',
        title:      features,
        titleColor: '#2e7d32',
        body:       autoRaidEnabled && !autoCombatEnabled ? 'Waiting for raid'
                  : !autoRaidEnabled && autoCombatEnabled ? 'Waiting for battle'
                  : 'Ready',
        bg:         '#e8f5e8',
        border:     '#4CAF50',
        pulse:      true
      });
    } else {
      setStatus(statusDiv, {
        body:   'Enable features',
        bg:     '#f5f5f5',
        border: '#ddd',
        italic: true
      });
    }
  }

  // Build Status HTML
  function setStatus(el, { dotColor, title, titleColor, body, footer, bg, border, pulse, italic } = {}) {
    el.style.backgroundColor = bg     || '#f5f5f5';
    el.style.borderLeftColor = border || '#ddd';

    const pulseStyle = `
      @keyframes pulse {
        0%   { opacity: 1; }
        50%  { opacity: 0.5; }
        100% { opacity: 1; }
      }
    `;

    el.innerHTML = `
      ${pulse ? `<style>${pulseStyle}</style>` : ''}
      ${dotColor ? `
        <div style="display:flex; align-items:center; margin-bottom:2px;">
          <div style="
            width:6px; height:6px;
            background-color:${dotColor};
            border-radius:50%;
            margin-right:4px;
            flex-shrink:0;
            ${pulse ? 'animation:pulse 1.5s infinite;' : ''}
          "></div>
          ${title ? `<strong style="color:${titleColor || '#333'}; font-size:10px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${title}</strong>` : ''}
        </div>
      ` : ''}
      ${body ? `<div style="font-size:9px; color:#666; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; ${italic ? 'font-style:italic;' : ''}">${body}</div>` : ''}
      ${footer ? `<div style="font-size:8px; color:#FF9800; margin-top:2px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${footer}</div>` : ''}
    `;
  }

  // =========================================================
  // Break Controls
  // =========================================================

  const breakControls  = document.createElement('div');
  breakControls.id     = 'breakControls';
  Object.assign(breakControls.style, {
    gridColumn:      '2',
    padding:         '6px',
    backgroundColor: '#f8f9fa',
    borderRadius:    '6px',
    borderLeft:      '4px solid #4CAF50',
    display:         'none',
    fontSize:        '10px',
    textAlign:       'center',
    minWidth:        '0',
    overflow:        'hidden',
    marginTop:       '4px',
    marginBottom:    '6px'
  });

  const breakTitle        = document.createElement('div');
  breakTitle.textContent  = 'Break';
  Object.assign(breakTitle.style, {
    fontWeight:    'bold',
    color:         '#2e7d32',
    marginBottom:  '2px',
    fontSize:      '10px',
    whiteSpace:    'nowrap',
    overflow:      'hidden',
    textOverflow:  'ellipsis'
  });

  const breakStatusEl = document.createElement('div');
  breakStatusEl.id    = 'breakStatus';
  breakStatusEl.innerHTML = 'Ready';
  Object.assign(breakStatusEl.style, {
    minHeight:      '20px',
    display:        'flex',
    flexDirection:  'column',
    justifyContent: 'center',
    fontSize:       '10px',
    lineHeight:     '1.2',
    whiteSpace:     'nowrap',
    overflow:       'hidden',
    textOverflow:   'ellipsis'
  });

  const forceEndBreakBtn        = document.createElement('button');
  forceEndBreakBtn.id           = 'forceEndBreakBtn';
  forceEndBreakBtn.textContent  = 'End Break';
  Object.assign(forceEndBreakBtn.style, {
    width:           '100%',
    padding:         '3px 0',
    marginTop:       '4px',
    backgroundColor: '#ff9800',
    color:           'white',
    border:          'none',
    borderRadius:    '4px',
    cursor:          'pointer',
    fontSize:        '10px',
    fontWeight:      'bold',
    display:         'none',
    whiteSpace:      'nowrap',
    overflow:        'hidden',
    textOverflow:    'ellipsis'
  });

  breakControls.appendChild(breakTitle);
  breakControls.appendChild(breakStatusEl);
  breakControls.appendChild(forceEndBreakBtn);
  container.appendChild(breakControls);

  forceEndBreakBtn.addEventListener('click', () => {
    breakStatusEl.innerHTML    = 'Ending...';
    breakStatusEl.style.color  = '#ff9800';

    sendToActiveTab({ type: 'forceEndBreak' }).then(response => {
      if (response?.success) {
        breakStatusEl.innerHTML   = '✅ Ended';
        breakStatusEl.style.color = '#4CAF50';
        forceEndBreakBtn.style.display = 'none';

        setTimeout(() => {
          breakStatusEl.innerHTML   = 'Ready';
          breakStatusEl.style.color = '#4CAF50';
        }, 2000);

        updateBreakControls({ isOnBreak: false, raidsSinceLastBreak: 0 });
      } else {
        breakStatusEl.innerHTML   = '❌ Failed';
        breakStatusEl.style.color = '#f44336';
      }
    }).catch(() => {
      breakStatusEl.innerHTML   = '❌ Error';
      breakStatusEl.style.color = '#f44336';
      setTimeout(() => {
        breakStatusEl.innerHTML   = 'Ready';
        breakStatusEl.style.color = '#4CAF50';
      }, 2000);
    });
  });

  function updateBreakControls(breakData) {
    if (!breakData) return;

    const enableBreaks = elements.enableBreaks?.checked || false;

    if (!enableBreaks) {
      breakControls.style.display = 'none';
      return;
    }

    breakControls.style.display = 'block';

    if (breakData.isOnBreak) {
      forceEndBreakBtn.style.display      = 'block';
      breakControls.style.borderLeftColor = '#ff9800';
      breakTitle.style.color              = '#ff9800';
      breakTitle.textContent              = 'Break (active)';
      breakStatusEl.style.color           = '#ff9800';
      breakStatusEl.innerHTML             = breakData.timeLeft > 0
        ? `⏸️ ${formatTime(breakData.timeLeft)}`
        : '⏸️ Active';
    } else {
      forceEndBreakBtn.style.display      = 'none';
      breakControls.style.borderLeftColor = '#4CAF50';
      breakTitle.style.color              = '#2e7d32';
      breakTitle.textContent              = 'Break';
      breakStatusEl.style.color           = '#4CAF50';
      breakStatusEl.innerHTML             = breakData.raidsSinceLastBreak !== undefined
        ? `✅ ${breakData.raidsSinceLastBreak} raids`
        : '✅ Ready';
    }
  }

  // =========================================================
  // Load Settings
  // =========================================================

  chrome.storage.sync.get(storageDefaults, (data) => {
    allKeys.forEach(key => {
      if (elements[key]) elements[key].checked = !!data[key];
    });

    updateRaidStatus();

    sendToActiveTab({ type: 'getStatus' }).then(response => {
      if (response) {
        updateRaidStatus(response);
        updateBreakControls(response);
      }
    });
  });

  // Save Settings on Change
  for (const key in elements) {
    elements[key].onchange = (e) => {
      chrome.storage.sync.set({ [key]: e.target.checked });

      if (['autoRaid', 'autoCombat', 'enableBreaks', 'quickAttack'].includes(key)) {
        sendToActiveTab({
          type:         'updateSettings',
          autoRaid:     elements.autoRaid?.checked     || false,
          autoCombat:   elements.autoCombat?.checked   || false,
          quickAttack:  elements.quickAttack?.checked  || false,
          enableBreaks: elements.enableBreaks?.checked || false
        });
      }

      updateRaidStatus();
      updateBreakControls({ isOnBreak: false, raidsSinceLastBreak: 0 });
    };
  }

  // =========================================================
  // Storage Changes
  // =========================================================

  chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace !== 'sync') return;
    for (const key in changes) {
      if (elements[key]) elements[key].checked = !!changes[key].newValue;
    }
    updateRaidStatus();
  });

  // =========================================================
  // Message Listener
  // =========================================================

  chrome.runtime.onMessage.addListener((msg) => {
    switch (msg.type) {
      case 'playStateChanged':
        isPlaying = msg.isPlaying;
        updatePlayPauseButton();
        updateRaidStatus({
          type:       'raidStatusUpdate',
          active:     isPlaying,
          lastAction: isPlaying ? 'Toggled via hotkey' : 'Paused via hotkey'
        });
        break;

      case 'inventoryUpdated':
        renderDrops(msg.inventory);
        break;

      case 'raidStatusUpdate':
        updateRaidStatus(msg);
        break;

      case 'popupDetected':
        if (isPlaying) {
          isPlaying = false;
          chrome.storage.local.set({ isPlaying: false });
          updatePlayPauseButton();
          sendToActiveTab({ type: 'toggleAutomation', action: 'pause' });
        }
        updateRaidStatus(msg);
        break;

      case 'breakStatusUpdate':
        updateRaidStatus(msg);
        updateBreakControls(msg);
        break;
    }
  });

  // =========================================================
  // Drop List
  // =========================================================

  function renderDrops(inventory) {
    dropContainer.innerHTML = '';

    if (!inventory || Object.keys(inventory).length === 0) {
      const msg     = document.createElement('em');
      msg.textContent = 'Inventory not loaded yet...';
      dropContainer.appendChild(msg);
      return;
    }

    if (typeof DROP_DATA === 'undefined') return;

    DROP_DATA.forEach(categoryObj => {
      const header        = document.createElement('h3');
      header.textContent  = categoryObj.category || 'Inventory';
      dropContainer.appendChild(header);

      const ul = document.createElement('ul');

      categoryObj.drops.forEach(drop => {
        const count = inventory[drop.id]?.count || 0;
        const li    = document.createElement('li');
        if (count === 0) li.classList.add('empty');

        const img    = document.createElement('img');
        img.src      = inventory[drop.id]?.src || '';
        img.alt      = drop.name;
        img.width    = 32;
        img.height   = 32;
        img.style.verticalAlign = 'middle';
        img.style.marginRight   = '8px';

        li.appendChild(img);
        li.appendChild(document.createTextNode(`${drop.name} — ${count}`));
        ul.appendChild(li);
      });

      dropContainer.appendChild(ul);
    });
  }

  chrome.storage.local.get('gbfInventory', (data) => {
    renderDrops(data.gbfInventory || {});
  });

});