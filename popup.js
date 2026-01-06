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
    autoCombat: "Full Auto"
  };

  const categories = {
    "Automation": ["autoRaid", "autoCombat"],
    "Navigation": ["arcaMode", "redirectFarm"],
    "Attack Settings": ["goBackOnAttack", "reloadAttack"],
    "Skill Settings": ["reloadSkill"],
    "Summon Settings": ["goBackOnSummon", "reloadSummon"],
  };

  const allKeys = Object.values(categories).flat();
  
  // Define defaults for ALL settings
  const storageDefaults = {};
  allKeys.forEach(key => {
    storageDefaults[key] = false; // All checkboxes start unchecked by default
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

  // Add status display for raid automation
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

  // Function to update raid automation status display
  function updateRaidStatusDisplay(message = null) {
    const statusDiv = document.getElementById("raidStatus");
    if (!statusDiv) return;
    
    const autoRaidEnabled = elements.autoRaid?.checked || false;
    const autoCombatEnabled = elements.autoCombat?.checked || false;
    
    // If we have a specific message from content script
    if (message && message.type === 'raidStatusUpdate') {
      if (message.active) {
        let features = [];
        if (autoRaidEnabled) features.push('Start Raid');
        if (autoCombatEnabled) features.push('Full Auto');
        
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
            Enable automation features above
          </div>
        `;
        statusDiv.style.backgroundColor = "#f5f5f5";
        statusDiv.style.borderLeftColor = "#ddd";
      }
      return;
    }
    
    // Default status based on checkbox states
    if (autoRaidEnabled || autoCombatEnabled) {
      let features = [];
      if (autoRaidEnabled) features.push('Start Raid');
      if (autoCombatEnabled) features.push('Full Auto');
      
      statusDiv.innerHTML = `
        <div style="display: flex; align-items: center; margin-bottom: 8px;">
          <div style="width: 10px; height: 10px; background-color: #4CAF50; border-radius: 50%; margin-right: 8px; animation: pulse 1.5s infinite;"></div>
          <strong style="color: #2e7d32;">ACTIVE: ${features.join(' + ')}</strong>
        </div>
        <div style="margin-left: 18px; font-size: 11px; color: #666;">
          Monitoring for buttons...
        </div>
      `;
      statusDiv.style.backgroundColor = "#e8f5e8";
      statusDiv.style.borderLeftColor = "#4CAF50";
    } else {
      statusDiv.innerHTML = `
        <div style="color: #666; font-style: italic;">
          Enable "Start Raid" or "Full Auto" to begin automation
        </div>
      `;
      statusDiv.style.backgroundColor = "#f5f5f5";
      statusDiv.style.borderLeftColor = "#ddd";
    }
  }

  // Load saved settings and update status
  chrome.storage.sync.get(storageDefaults, (data) => {
    for (let key of allKeys) {
      if (elements[key]) {
        elements[key].checked = !!data[key];
      }
    }
    // Update status display after loading settings
    updateRaidStatusDisplay();
    
    // Try to get current status from content script
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]?.id) {
        chrome.tabs.sendMessage(tabs[0].id, { 
          type: 'getStatus' 
        }, (response) => {
          if (chrome.runtime.lastError) {
            // Content script not ready or not on GBF page
            console.log('Content script not available:', chrome.runtime.lastError.message);
          } else if (response) {
            updateRaidStatusDisplay(response);
          }
        });
      }
    });
  });

  // Save settings and send updates to content script
  for (let key in elements) {
    elements[key].onchange = e => {
      const isChecked = e.target.checked;
      
      // Save to storage
      chrome.storage.sync.set({ [key]: isChecked }, () => {
        if (chrome.runtime.lastError) {
          console.error('Error saving to storage:', chrome.runtime.lastError);
        }
      });
      
      // If it's an automation setting, send message to content script
      if (key === 'autoRaid' || key === 'autoCombat') {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
          if (tabs[0]?.id) {
            chrome.tabs.sendMessage(tabs[0].id, {
              type: 'updateSettings',
              autoRaid: elements.autoRaid?.checked || false,
              autoCombat: elements.autoCombat?.checked || false
            }).catch(err => {
              console.log('Content script not ready yet:', err);
              // That's okay - content script will load settings from storage
            });
          }
        });
      }
      
      // Update status display
      updateRaidStatusDisplay();
    };
  }

  // Listen for storage changes (keeps checkboxes in sync)
  chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === 'sync') {
      for (let key in changes) {
        if (elements[key]) {
          elements[key].checked = !!changes[key].newValue;
        }
      }
      // Update status when settings change
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

    // Assuming DROP_DATA is defined elsewhere
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

  // Initial load from storage
  chrome.storage.local.get("gbfInventory", (data) => {
    renderDrops(data.gbfInventory || {});
  });

  // Listen for live updates from content script
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === "inventoryUpdated") {
      renderDrops(msg.inventory);
    }
    // Add this for raid automation status
    else if (msg.type === "raidStatusUpdate") {
      updateRaidStatusDisplay(msg);
    }
  });

});