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

  // Play/Pause Functionality
  const playPauseBtn = document.getElementById('playPauseBtn');
  const deactivateTopBtn = document.getElementById('deactivateTopBtn');
  let isPlaying = true;

  // Load Saved Play State
  chrome.storage.local.get('isPlaying', (data) => {
    isPlaying = data.isPlaying !== undefined ? data.isPlaying : true;
    updatePlayPauseButton();
  });

  function updatePlayPauseButton() {
    if (isPlaying) {
      playPauseBtn.textContent = '⏸️ Pause';
      playPauseBtn.style.backgroundColor = '#ff9800';
    } else {
      playPauseBtn.textContent = '▶️ Start';
      playPauseBtn.style.backgroundColor = '#4CAF50'; 
    }
  }

  // Play/Pause Button Click
  playPauseBtn.addEventListener('click', () => {
    isPlaying = !isPlaying;
    
    // Save State
    chrome.storage.local.set({ isPlaying });
    
    // Update Button Appearance
    updatePlayPauseButton();
    
    // Send Command to Content Script
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]?.id) {
        chrome.tabs.sendMessage(tabs[0].id, {
          type: 'toggleAutomation',
          action: isPlaying ? 'play' : 'pause'
        }).then(response => {
          console.log('✅ Automation Toggle Response:', response);
        }).catch(err => {
          console.log('Content Script Not Ready:', err);
        });
      }
    });
  });

  // Deactivate All from Top Button
  deactivateTopBtn.addEventListener('click', () => {
    // Turn Off All Checkboxes
    allKeys.forEach(key => {
      if (elements[key]) {
        elements[key].checked = false;
      }
    });

    // Save to Storage
    const allFalse = {};
    allKeys.forEach(key => {
      allFalse[key] = false;
    });
    chrome.storage.sync.set(allFalse);

    // If Playing, Pause
    if (isPlaying) {
      isPlaying = false;
      chrome.storage.local.set({ isPlaying: false });
      updatePlayPauseButton();

      // Send Pause Command
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]?.id) {
          chrome.tabs.sendMessage(tabs[0].id, {
            type: 'toggleAutomation',
            action: 'pause'
          }).catch(err => {
            console.log('Content Script Not Ready:', err);
          });
        }
      });
    }

    // Update Status
    if (document.getElementById('settingsContent').style.display === 'block') {
      updateRaidStatusDisplay();
    }
  });

  // --- Settings Tab ---
  const labels = {
    goBackOnAttack: "Back On Attack",
    reloadAttack: "Reload On Attack",
    goBackOnSummon: "Back On Summon", 
    reloadSummon: "Reload On Summon",
    reloadSkill: "Reload On Skill",
    redirectFarm: "Redirect to Farm",
    autoRaid: "Start Raid",
    autoCombat: "Full Auto",
    enableBreaks: "Enable Breaks"
  };

  const categories = {
    "Automation": ["autoRaid", "autoCombat", "enableBreaks"],
    "Navigation": ["redirectFarm"],
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

  // Clear Container
  container.innerHTML = '';

  for (let [categoryName, keys] of Object.entries(categories)) {
    const header = document.createElement("h3");
    header.textContent = categoryName;
    header.style.margin = "8px 0 2px";
    header.style.fontSize = "14px";
    header.style.borderBottom = "1px solid #ccc";
    header.style.gridColumn = "span 2";
    container.appendChild(header);

    keys.forEach(key => {
      const div = document.createElement("div");
      div.className = "setting-item";

      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.id = key;

      const label = document.createElement("label");
      label.htmlFor = key;
      label.textContent = " " + labels[key];

      div.appendChild(checkbox);
      div.appendChild(label);
      container.appendChild(div);

      elements[key] = checkbox;
    });
  }

  // --- Raid Automation Status (left column) ---
  const statusDiv = document.createElement("div");
  statusDiv.id = "raidStatus";
  statusDiv.style.gridColumn = "1";
  statusDiv.style.padding = "8px";
  statusDiv.style.backgroundColor = "#f5f5f5";
  statusDiv.style.borderRadius = "6px";
  statusDiv.style.fontSize = "11px";
  statusDiv.style.borderLeft = "4px solid #ddd";
  statusDiv.style.minHeight = "45px";
  statusDiv.style.overflow = "hidden";
  statusDiv.style.wordWrap = "break-word";
  statusDiv.style.marginTop = "4px";
  statusDiv.style.marginBottom = "6px";
  statusDiv.innerHTML = `
    <div style="color: #666; font-style: italic; font-size: 11px;">
      Enable automation features
    </div>
  `;
  container.appendChild(statusDiv);

  // --- Break Controls (right column) ---
  let breakControls = document.createElement("div");
  breakControls.id = "breakControls";
  breakControls.style.gridColumn = "2";
  breakControls.style.padding = "6px";
  breakControls.style.backgroundColor = "#f8f9fa";
  breakControls.style.borderRadius = "6px";
  breakControls.style.borderLeft = "4px solid #4CAF50";
  breakControls.style.display = "none";
  breakControls.style.fontSize = "10px";
  breakControls.style.textAlign = "center";
  breakControls.style.minWidth = "0";
  breakControls.style.overflow = "hidden";
  breakControls.style.marginTop = "4px";
  breakControls.style.marginBottom = "6px";

  const breakTitle = document.createElement("div");
  breakTitle.style.fontWeight = "bold";
  breakTitle.style.color = "#2e7d32";
  breakTitle.style.marginBottom = "2px";
  breakTitle.style.fontSize = "10px";
  breakTitle.style.whiteSpace = "nowrap";
  breakTitle.style.overflow = "hidden";
  breakTitle.style.textOverflow = "ellipsis";
  breakTitle.textContent = "Break";

  const breakStatus = document.createElement("div");
  breakStatus.id = "breakStatus";
  breakStatus.style.minHeight = "20px";
  breakStatus.style.display = "flex";
  breakStatus.style.flexDirection = "column";
  breakStatus.style.justifyContent = "center";
  breakStatus.style.fontSize = "10px";
  breakStatus.style.lineHeight = "1.2";
  breakStatus.style.whiteSpace = "nowrap";
  breakStatus.style.overflow = "hidden";
  breakStatus.style.textOverflow = "ellipsis";
  breakStatus.innerHTML = "Ready";

  const forceEndBreakBtn = document.createElement("button");
  forceEndBreakBtn.id = "forceEndBreakBtn";
  forceEndBreakBtn.textContent = "End";
  forceEndBreakBtn.style.width = "100%";
  forceEndBreakBtn.style.padding = "3px 0";
  forceEndBreakBtn.style.marginTop = "4px";
  forceEndBreakBtn.style.backgroundColor = "#ff9800";
  forceEndBreakBtn.style.color = "white";
  forceEndBreakBtn.style.border = "none";
  forceEndBreakBtn.style.borderRadius = "4px";
  forceEndBreakBtn.style.cursor = "pointer";
  forceEndBreakBtn.style.fontSize = "10px";
  forceEndBreakBtn.style.fontWeight = "bold";
  forceEndBreakBtn.style.display = "none";
  forceEndBreakBtn.style.whiteSpace = "nowrap";
  forceEndBreakBtn.style.overflow = "hidden";
  forceEndBreakBtn.style.textOverflow = "ellipsis";

  breakControls.appendChild(breakTitle);
  breakControls.appendChild(breakStatus);
  breakControls.appendChild(forceEndBreakBtn);
  container.appendChild(breakControls);

  // Force End Break Button Handler
  forceEndBreakBtn.addEventListener('click', () => {
    console.log('🚀 Force End Break...');
    
    breakStatus.innerHTML = 'Ending...';
    breakStatus.style.color = '#ff9800';
    
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]?.id) {
        chrome.tabs.sendMessage(tabs[0].id, {
          type: 'forceEndBreak'
        }).then(response => {
          console.log('✅ Force End Break Response:', response);
          
          if (response?.success) {
            breakStatus.innerHTML = '✅ Ended';
            breakStatus.style.color = '#4CAF50';
            forceEndBreakBtn.style.display = 'none';
            
            setTimeout(() => {
              breakStatus.innerHTML = 'Ready';
              breakStatus.style.color = '#4CAF50';
            }, 2000);
            
            updateRaidStatusDisplay({
              type: 'breakStatusUpdate',
              isOnBreak: false,
              raidsSinceLastBreak: 0
            });
          } else {
            breakStatus.innerHTML = '❌ Failed';
            breakStatus.style.color = '#f44336';
          }
        }).catch(err => {
          console.log('❌ Force End Break Error:', err);
          breakStatus.innerHTML = '❌ Error';
          breakStatus.style.color = '#f44336';
          
          setTimeout(() => {
            breakStatus.innerHTML = 'Ready';
            breakStatus.style.color = '#4CAF50';
          }, 2000);
        });
      } else {
        breakStatus.innerHTML = '❌ No Tab';
        breakStatus.style.color = '#f44336';
      }
    });
  });

  // Update Break Controls State
  function updateBreakControls(breakData) {
      if (!breakData) return;
      
      console.log('🔧 Updating Break Controls With:', breakData);
      
      // Only show break controls if breaks are enabled
      const enableBreaks = elements.enableBreaks?.checked || false;
      
      if (enableBreaks) {
          breakControls.style.display = 'block';
          
          if (breakData.isOnBreak) {
              forceEndBreakBtn.style.display = 'block';
              breakControls.style.borderLeftColor = '#ff9800';
              breakTitle.style.color = '#ff9800';
              breakTitle.textContent = 'Break (active)';
              
              if (breakData.timeLeft && breakData.timeLeft > 0) {
                  const minutes = Math.floor(breakData.timeLeft / 60000);
                  const seconds = Math.floor((breakData.timeLeft % 60000) / 1000);
                  forceEndBreakBtn.textContent = `End`;
                  if (minutes > 0) {
                      breakStatus.innerHTML = `⏸️ ${minutes}m ${seconds}s`;
                  } else {
                      breakStatus.innerHTML = `⏸️ ${seconds}s`;
                  }
                  breakStatus.style.color = '#ff9800';
              } else {
                  forceEndBreakBtn.textContent = 'End';
                  breakStatus.innerHTML = '⏸️ Active';
                  breakStatus.style.color = '#ff9800';
              }
          } else {
              forceEndBreakBtn.style.display = 'none';
              breakControls.style.borderLeftColor = '#4CAF50';
              breakTitle.style.color = '#2e7d32';
              breakTitle.textContent = 'Break';
              
              if (breakData.raidsSinceLastBreak !== undefined) {
                  breakStatus.innerHTML = `✅ ${breakData.raidsSinceLastBreak} raids`;
                  breakStatus.style.color = '#4CAF50';
              } else {
                  breakStatus.innerHTML = '✅ Ready';
                  breakStatus.style.color = '#4CAF50';
              }
          }
      } else {
          // Hide break controls if breaks are not enabled
          breakControls.style.display = 'none';
      }
  }

  // Update Raid Status Display
  function updateRaidStatusDisplay(message = null) {
    if (!statusDiv) return;
    
    const autoRaidEnabled = elements.autoRaid?.checked || false;
    const autoCombatEnabled = elements.autoCombat?.checked || false;
    const enableBreaks = elements.enableBreaks?.checked || false;
    
    if (message && message.type === 'raidStatusUpdate') {
      if (message.active && isPlaying) {
        let features = [];
        if (autoRaidEnabled) features.push('Raid');
        if (autoCombatEnabled) features.push('Auto');

        statusDiv.innerHTML = `
          <div style="display: flex; align-items: center; margin-bottom: 2px; width: 100%;">
            <div style="width: 6px; height: 6px; background-color: #4CAF50; border-radius: 50%; margin-right: 4px; animation: pulse 1.5s infinite; flex-shrink: 0;"></div>
            <strong style="color: #2e7d32; font-size: 10px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">▶️ ${features.join('+')}</strong>
          </div>
          <div style="font-size: 9px; line-height: 1.2; color: #666; width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
            📝 ${message.lastAction || 'Running...'}
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
          <div style="display: flex; align-items: center; margin-bottom: 2px; width: 100%;">
            <div style="width: 6px; height: 6px; background-color: #9e9e9e; border-radius: 50%; margin-right: 4px; flex-shrink: 0;"></div>
            <strong style="color: #666; font-size: 10px;">⏸️ PAUSED</strong>
          </div>
          <div style="font-size: 9px; color: #777; width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
            ${message.lastAction || 'Click Start to begin'}
          </div>
        `;
        statusDiv.style.backgroundColor = "#f5f5f5";
        statusDiv.style.borderLeftColor = "#ddd";
      }
      return;
    }
      
    if (autoRaidEnabled || autoCombatEnabled) {
        let features = [];
        if (autoRaidEnabled) features.push('Raid');
        if (autoCombatEnabled) features.push('Auto');

        let statusMessage = 'Ready';
        if (autoRaidEnabled && !autoCombatEnabled) {
            statusMessage = 'Waiting for raid';
        } else if (!autoRaidEnabled && autoCombatEnabled) {
            statusMessage = 'Waiting for battle';
        }
        
        statusDiv.innerHTML = `
            <div style="display: flex; align-items: center; margin-bottom: 2px; width: 100%;">
                <div style="width: 6px; height: 6px; background-color: #4CAF50; border-radius: 50%; margin-right: 4px; animation: pulse 1.5s infinite; flex-shrink: 0;"></div>
                <strong style="color: #2e7d32; font-size: 10px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${features.join('+')}</strong>
            </div>
            <div style="font-size: 9px; color: #666; width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                ${statusMessage}
            </div>
        `;
        statusDiv.style.backgroundColor = "#e8f5e8";
        statusDiv.style.borderLeftColor = "#4CAF50";
    } else {
        statusDiv.innerHTML = `
            <div style="color: #666; font-style: italic; font-size: 10px; width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                Enable features
            </div>
        `;
        statusDiv.style.backgroundColor = "#f5f5f5";
        statusDiv.style.borderLeftColor = "#ddd";
    }
  }

  // Handle Popup Detected Message
  function handlePopupDetected(message) {
    if (!statusDiv) return;
    
    // If Automation is Playing, Pause it
    if (isPlaying) {
      isPlaying = false;
      chrome.storage.local.set({ isPlaying: false });
      updatePlayPauseButton();
      
      // Send Pause Command to Content Script
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]?.id) {
          chrome.tabs.sendMessage(tabs[0].id, {
            type: 'toggleAutomation',
            action: 'pause'
          }).catch(err => {
            console.log('Content Script Not Ready:', err);
          });
        }
      });
    }
    
    const popupText = message.popupInfo?.text || 'Unknown Popup';
    
    statusDiv.innerHTML = `
      <div style="display: flex; align-items: center; margin-bottom: 2px; width: 100%;">
        <div style="width: 6px; height: 6px; background-color: #FF5722; border-radius: 50%; margin-right: 4px; flex-shrink: 0;"></div>
        <strong style="color: #D32F2F; font-size: 10px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">⚠️ POPUP DETECTED</strong>
      </div>
      <div style="font-size: 9px; line-height: 1.2; color: #666; width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
        ${popupText}
      </div>
      <div style="font-size: 8px; color: #FF9800; margin-top: 2px; width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
        Automation Paused - Close Popup and Click Start
      </div>
    `;
    statusDiv.style.backgroundColor = "#FFEBEE";
    statusDiv.style.borderLeftColor = "#FF5722";
  }

  // Load Settings from Storage
  chrome.storage.sync.get(storageDefaults, (data) => {
    console.log('🔄 Loaded Settings from Storage:', data);

    for (let key of allKeys) {
      if (elements[key]) {
        elements[key].checked = !!data[key];
      }
    }
    updateRaidStatusDisplay();
    
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]?.id) {
        chrome.tabs.sendMessage(tabs[0].id, { 
          type: 'getStatus' 
        }, (response) => {
          if (chrome.runtime.lastError) {
            console.log('Content script not available:', chrome.runtime.lastError.message);
          } else if (response) {
            updateRaidStatusDisplay(response);
            updateBreakControls(response);
          }
        });
      }
    });
  });

  // Save Settings on Change
  for (let key in elements) {
    elements[key].onchange = e => {
      const isChecked = e.target.checked;
      console.log(`🔄 Saving Setting: ${key}=${isChecked}`);
      
      chrome.storage.sync.set({ [key]: isChecked }, () => {
        if (chrome.runtime.lastError) {
          console.error('Error saving to storage:', chrome.runtime.lastError);
        }
      });
      
      if (key === 'autoRaid' || key === 'autoCombat' || key === 'enableBreaks') {
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
      
      updateRaidStatusDisplay();
    };
  }

  // Listen for Storage Changes
  chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === 'sync') {
      for (let key in changes) {
        if (elements[key]) {
          elements[key].checked = !!changes[key].newValue;
        }
      }
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

  // Listen for Messages
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === "inventoryUpdated") {
      renderDrops(msg.inventory);
    }
    else if (msg.type === "raidStatusUpdate") {
      updateRaidStatusDisplay(msg);
    }
    else if (msg.type === "popupDetected") {
      handlePopupDetected(msg);
    }
    else if (msg.type === "breakStatusUpdate") {
      updateRaidStatusDisplay(msg);
      updateBreakControls(msg);
    }
  });

});