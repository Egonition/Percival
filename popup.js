'use strict';

document.addEventListener('DOMContentLoaded', () => {
  // --- Tabs ---
  const tabs = document.querySelectorAll('.tab');
  const tabContents = document.querySelectorAll('.tab-content');

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      tabContents.forEach(c => c.style.display = 'none');

      tab.classList.add('active');
      const contentId = tab.dataset.tab;
      const contentDiv = document.getElementById(contentId);
      if (contentDiv) contentDiv.style.display = 'block';
    });
  });

  // --- Settings Tab ---
  const labels = {
    goBackOnAttack: "Back On Attack",
    reloadAttack: "Reload On Attack",
    goBackOnSummon: "Back On Summon", 
    reloadSummon: "Reload On Summon",
    reloadSkill: "Reload On Skill",
    redirectFarm: "Redirect to Farm",
    arcaMode: "Arca Mode",
    autoRaid: "Start Raid",
    autoCombat: "Full Auto",
    enableBreaks: "Enable Breaks"
  };

  const categories = {
    "Automation": ["autoRaid", "autoCombat", "enableBreaks"],
    "Navigation": ["arcaMode", "redirectFarm"],
    "Attack Settings": ["goBackOnAttack", "reloadAttack"],
    "Skill Settings": ["reloadSkill"],
    "Summon Settings": ["goBackOnSummon", "reloadSummon"],
  };

  const allKeys = Object.values(categories).flat();
  
  // Default Settings
  const storageDefaults = {};
  allKeys.forEach(key => {
    storageDefaults[key] = false; // Default to False
  });

  const container = document.getElementById("options");
  let elements = {};

  for (let [categoryName, keys] of Object.entries(categories)) {
    const header = document.createElement("h3");
    header.textContent = categoryName;
    header.style.margin = "10px 0 4px";
    header.style.fontSize = "14px";
    header.style.borderBottom = "1px solid #ccc";
    container.appendChild(header);

    keys.forEach(key => {
      const label = document.createElement("label");
      label.style.display = "block";
      label.style.margin = "4px 0";

      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.id = key;

      label.appendChild(checkbox);
      label.appendChild(document.createTextNode(" " + labels[key]));
      container.appendChild(label);

      elements[key] = checkbox;
    });
  }

  // --- Raid Automation Status ---
  const statusDiv = document.createElement("div");
  statusDiv.id = "raidStatus";
  statusDiv.style.margin = "15px 0 10px";
  statusDiv.style.padding = "12px";
  statusDiv.style.backgroundColor = "#f5f5f5";
  statusDiv.style.borderRadius = "6px";
  statusDiv.style.fontSize = "12px";
  statusDiv.style.borderLeft = "4px solid #ddd";
  statusDiv.style.minHeight = "60px";
  statusDiv.innerHTML = `
    <div style="color: #666; font-style: italic;">
      Enable "Start Raid" or "Full Auto" to begin automation
    </div>
  `;
  container.appendChild(statusDiv);

  // Function to Update Raid Status Display
  function updateRaidStatusDisplay(message = null) {
    const statusDiv = document.getElementById("raidStatus");
    if (!statusDiv) return;
    
    const autoRaidEnabled = elements.autoRaid?.checked || false;
    const autoCombatEnabled = elements.autoCombat?.checked || false;
    
    // If Message Provided, Use It to Update Status
    if (message && message.type === 'raidStatusUpdate') {
      if (message.active) {
        let features = [];
        if (autoRaidEnabled) features.push('Start Raid');
        if (autoCombatEnabled) features.push('Full Auto');

        // Break Status
        let breakStatus = '';
        if (message.isOnBreak) {
          const timeLeft = message.timeLeft || 0;
          const minutes = Math.floor(timeLeft / 60000);
          const seconds = Math.floor((timeLeft % 60000) / 1000);
          breakStatus = `<div style="margin-top: 8px; padding: 8px; background: #fff3cd; border-radius: 4px; border-left: 3px solid #ffc107;">
            ⏸️ <strong>On Break</strong> - ${minutes > 0 ? minutes + 'm ' : ''}${seconds}s remaining
          </div>`;
        } else if (enableBreaks && message.raidsSinceLastBreak !== undefined) {
          breakStatus = `<div style="margin-top: 8px; color: #666; font-size: 11px;">
            ✅ Breaks Enabled - ${message.raidsSinceLastBreak} Raids since Last Break
          </div>`;
        }
        
        statusDiv.innerHTML = `
          <div style="display: flex; align-items: center; margin-bottom: 8px;">
            <div style="width: 10px; height: 10px; background-color: #4CAF50; border-radius: 50%; margin-right: 8px; animation: pulse 1.5s infinite;"></div>
            <strong style="color: #2e7d32;">ACTIVE: ${features.join(' + ')}</strong>
          </div>
          <div style="margin-left: 18px; font-size: 11px; line-height: 1.4;">
            <div>📝 ${message.lastAction || 'Monitoring...'}</div>
            ${message.totalClicks ? `<div>👆 Clicks: ${message.totalClicks}</div>` : ''}
            ${message.timestamp ? `<div style="color: #777; font-size: 10px; margin-top: 4px;">${message.timestamp}</div>` : ''}
          </div>
          <style>
            @keyframes pulse {
              0% { opacity: 1; }
              50% { opacity: 0.5; }
              100% { opacity: 1; }
            }
          </style>
        `;
        statusDiv.style.backgroundColor = "#e8f5e8";
        statusDiv.style.borderLeftColor = "#4CAF50";
      } else {
        statusDiv.innerHTML = `
          <div style="display: flex; align-items: center; margin-bottom: 8px;">
            <div style="width: 10px; height: 10px; background-color: #9e9e9e; border-radius: 50%; margin-right: 8px;"></div>
            <strong style="color: #666;">INACTIVE</strong>
          </div>
          <div style="margin-left: 18px; font-size: 11px; color: #777;">
            Enable Automation Features to Start
          </div>
        `;
        statusDiv.style.backgroundColor = "#f5f5f5";
        statusDiv.style.borderLeftColor = "#ddd";
      }
      return;
    }
    
    // No Message, Just Update Based on Current Settings
    if (autoRaidEnabled || autoCombatEnabled) {
      let features = [];
      if (autoRaidEnabled) features.push('Start Raid');
      if (autoCombatEnabled) features.push('Full Auto');

      // Break Status
      let breakStatus = '';
      if (enableBreaks) {
        breakStatus = `<div style="margin-top: 8px; color: #666; font-size: 11px;">
          ✅ Breaks Enabled
        </div>`;
      }

      let statusMessage = 'Monitoring for buttons...'; // Default Message
      if (autoRaidEnabled && !autoCombatEnabled) {
        statusMessage = 'Waiting to Start Raid.';
      } else if (!autoRaidEnabled && autoCombatEnabled) {
        statusMessage = 'Waiting for Battle Screen.';
      } else if (autoRaidEnabled && autoCombatEnabled) {
        statusMessage = 'Waiting to Start Raid and Full Auto.';
      }
      
      statusDiv.innerHTML = `
        <div style="display: flex; align-items: center; margin-bottom: 8px;">
          <div style="width: 10px; height: 10px; background-color: #4CAF50; border-radius: 50%; margin-right: 8px; animation: pulse 1.5s infinite;"></div>
          <strong style="color: #2e7d32;">ACTIVE: ${features.join(' + ')}</strong>
        </div>
        <div style="margin-left: 18px; font-size: 11px; color: #666;">
          ${statusMessage}
        </div>
      `;
      statusDiv.style.backgroundColor = "#e8f5e8";
      statusDiv.style.borderLeftColor = "#4CAF50";
    } else {
      // Inactive with break status
      let breakStatus = '';
      if (enableBreaks) {
        breakStatus = `<div style="margin-top: 8px; color: #666; font-size: 11px;">
          ✅ Breaks Enabled - Will Activate with Automation
        </div>`;
      }

      statusDiv.innerHTML = `
        <div style="color: #666; font-style: italic;">
          Enable "Start Raid" or "Full Auto" to begin automation
        </div>
      `;
      statusDiv.style.backgroundColor = "#f5f5f5";
      statusDiv.style.borderLeftColor = "#ddd";
    }
  }

  // Handle Popup Detected Message
  function handlePopupDetected(message) {
    const statusDiv = document.getElementById("raidStatus");
    if (!statusDiv) return;
    
    const popupText = message.popupInfo?.text || 'Unknown popup';
    
    statusDiv.innerHTML = `
      <div style="display: flex; align-items: center; margin-bottom: 8px;">
        <div style="width: 10px; height: 10px; background-color: #FF5722; border-radius: 50%; margin-right: 8px;"></div>
        <strong style="color: #D32F2F;">PAUSED: Popup Detected</strong>
      </div>
      <div style="margin-left: 18px; font-size: 11px; line-height: 1.4;">
        <div>⚠️ ${popupText}</div>
        <div style="color: #FF9800; margin-top: 4px;">
          <small>Automation paused. Close popup and re-enable features.</small>
        </div>
        ${message.timestamp ? `<div style="color: #777; font-size: 10px; margin-top: 4px;">${message.timestamp}</div>` : ''}
      </div>
    `;
    statusDiv.style.backgroundColor = "#FFEBEE";
    statusDiv.style.borderLeftColor = "#FF5722";
    
    // Disable Automation Checkboxes
    const autoRaidCheckbox = document.querySelector('#autoRaid');
    const autoCombatCheckbox = document.querySelector('#autoCombat');
    
    if (autoRaidCheckbox) autoRaidCheckbox.checked = false;
    if (autoCombatCheckbox) autoCombatCheckbox.checked = false;
    
    // Save Disabled State to Storage
    if (elements.autoRaid) {
      chrome.storage.sync.set({ autoRaid: false });
    }
    if (elements.autoCombat) {
      chrome.storage.sync.set({ autoCombat: false });
    }
  }

  // Load Settings from Storage
  chrome.storage.sync.get(storageDefaults, (data) => {
    for (let key of allKeys) {
      if (elements[key]) {
        elements[key].checked = !!data[key];
      }
    }
    // Initial
    updateRaidStatusDisplay();
    
    // Request Current Status from Content Script
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]?.id) {
        chrome.tabs.sendMessage(tabs[0].id, { 
          type: 'getStatus' 
        }, (response) => {
          if (chrome.runtime.lastError) {
            // Content Script Not Available
            console.log('Content script not available:', chrome.runtime.lastError.message);
          } else if (response) {
            updateRaidStatusDisplay(response);
          }
        });
      }
    });
  });

  // Save Settings on Change
  for (let key in elements) {
    elements[key].onchange = e => {
      const isChecked = e.target.checked;
      
      // Save to Storage
      chrome.storage.sync.set({ [key]: isChecked }, () => {
        if (chrome.runtime.lastError) {
          console.error('Error saving to storage:', chrome.runtime.lastError);
        }
      });
      
      // Notify Content Script of Setting Change
      if (key === 'autoRaid' || key === 'autoCombat') {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
          if (tabs[0]?.id) {
            chrome.tabs.sendMessage(tabs[0].id, {
              type: 'updateSettings',
              autoRaid: elements.autoRaid?.checked || false,
              autoCombat: elements.autoCombat?.checked || false,
              enableBreaks: elements.enableBreaks?.checked || false
            }).catch(err => {
              console.log('Content script not ready yet:', err);
            });
          }
        });
      }
      
      // Update Status Display
      updateRaidStatusDisplay();
    };
  }

  // Listen for Storage Changes to Update UI
  chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === 'sync') {
      for (let key in changes) {
        if (elements[key]) {
          elements[key].checked = !!changes[key].newValue;
        }
      }
      // Update Status Display
      updateRaidStatusDisplay();
    }
  });

  // --- Drop List Tab ---
  const dropContainer = document.getElementById("dropContainer");

  function renderDrops(inventory) {
    dropContainer.innerHTML = "";

    if (!inventory || Object.keys(inventory).length === 0) {
      const msg = document.createElement("em");
      msg.textContent = "Inventory not loaded yet...";
      dropContainer.appendChild(msg);
      return;
    }

    if (typeof DROP_DATA !== 'undefined') {
      DROP_DATA.forEach(categoryObj => {
        const header = document.createElement("h3");
        header.textContent = categoryObj.category || "Inventory";
        dropContainer.appendChild(header);

        const ul = document.createElement("ul");

        categoryObj.drops.forEach(drop => {
          const count = inventory[drop.id]?.count || 0;
          const li = document.createElement("li");
          if (count === 0) li.classList.add("empty");

          const img = document.createElement("img");
          img.src = inventory[drop.id]?.src || "";
          img.alt = drop.name;
          img.width = 32;
          img.height = 32;
          img.style.verticalAlign = "middle";
          img.style.marginRight = "8px";
          li.appendChild(img);

          const text = document.createTextNode(`${drop.name} — ${count}`);
          li.appendChild(text);

          ul.appendChild(li);
        });

        dropContainer.appendChild(ul);
      });
    }
  }

  // Initial Render
  chrome.storage.local.get("gbfInventory", (data) => {
    renderDrops(data.gbfInventory || {});
  });

  // Listen for Inventory Updates
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === "inventoryUpdated") {
      renderDrops(msg.inventory);
    }
    // Raid Status Update
    else if (msg.type === "raidStatusUpdate") {
      updateRaidStatusDisplay(msg);
    }
    // Popup Detected
    else if (msg.type === "popupDetected") {
      handlePopupDetected(msg);
    }
    else if (msg.type === "breakStatusUpdate") {
      updateRaidStatusDisplay(msg);
    }
  });

});