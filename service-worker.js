'use strict';
importScripts("constants.js");

const skills = {
  "6199": "Conjunction",
  "8000": "Tag team"
};

// Listen for Keyboard Commands
chrome.commands.onCommand.addListener((command) => {
  if (command === 'toggle-play-pause') {
    console.log('🎮 Toggle Play/Pause Hotkey Pressed');
    
    // Get the current active tab
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]?.id) {
        // Get current play state
        chrome.storage.local.get(['isPlaying'], (data) => {
          const newState = !data.isPlaying;
          
          // Send Toggle Command to Content Script
          chrome.tabs.sendMessage(tabs[0].id, {
            type: 'toggleAutomation',
            action: newState ? 'play' : 'pause'
          }).then(response => {
            console.log('✅ Toggle Response:', response);
            
            // Update Stored State
            chrome.storage.local.set({ isPlaying: newState });
            
            // Notify Popup of State Change
            chrome.runtime.sendMessage({
              type: 'playStateChanged',
              isPlaying: newState
            }).catch(() => {
              // Popup Might Not Be Open, That's Fine
            });
          }).catch(err => {
            console.log('Content script not ready:', err);
          });
        });
      }
    });
  }
});

// Listen for Storage Changes
chrome.storage.onChanged.addListener(function (changes, namespace) {
  for (let key in changes) {
    let storageChange = changes[key];
    console.log(
      'Storage key "%s" in namespace "%s" changed. Old value was "%s", new value is "%s".',
      key,
      namespace,
      storageChange.oldValue,
      storageChange.newValue
    );
  }
});

// Deactivate All
function deactivateAll() {
  console.log("Deactivate All");
  let allVal = {};
  for (const val of allKeys) {
    allVal[val] = false;
  }
  chrome.storage.sync.set(allVal);
}

let keyboardShortcut = {
  "deactivate-all": deactivateAll,
};

chrome.commands.onCommand.addListener(function (command) {
  console.log('Command:', command);
  if (keyboardShortcut[command]) keyboardShortcut[command]();
});

// Attack and Summon Reload
chrome.webRequest.onCompleted.addListener(
  function (details) {
    chrome.storage.sync.get(
      ["reloadSummon", "goBackOnSummon", "reloadAttack", "goBackOnAttack"],
      function (data) {
        const isSummon = details.url.includes("summon_result.json");
        const isAttack = details.url.includes("normal_attack_result.json");

        if (isSummon) {
          if (data.reloadSummon) {
            setTimeout(() => chrome.tabs.reload(details.tabId), Math.random() * 500 + 500);
          } else if (data.goBackOnSummon) {
            setTimeout(() => {
              chrome.scripting.executeScript({
                target: { tabId: details.tabId },
                func: () => history.back(),
              });
            }, Math.random() * 500 + 500);
          }
        }

        if (isAttack) {
          if (data.reloadAttack) {
            setTimeout(() => chrome.tabs.reload(details.tabId), Math.random() * 500 + 500);
          } else if (data.goBackOnAttack) {
            setTimeout(() => {
              chrome.scripting.executeScript({
                target: { tabId: details.tabId },
                func: () => history.back(),
              });
            }, Math.random() * 500 + 500);
          }
        }
      }
    );
  },
  {
    urls: [
      "*://game.granbluefantasy.jp/rest/*/summon_result.json*",
      "*://game.granbluefantasy.jp/rest/*/normal_attack_result.json*",
    ],
  }
);

// Skill Reload
chrome.webRequest.onBeforeRequest.addListener(
  function (details) {
    const postedString = JSON.parse(
      decodeURIComponent(
        String.fromCharCode.apply(null, new Uint8Array(details.requestBody.raw[0].bytes))
      )
    );

    chrome.storage.sync.get("reloadSkill", function (data) {
      if (data.reloadSkill && Object.keys(skills).includes(postedString["ability_id"])) {
        chrome.tabs.reload(details.tabId);
      }
    });
  },
  {
    urls: [
      "*://game.granbluefantasy.jp/rest/*/ability_result.json*",
      "*://game.granbluefantasy.jp/rest/*/*/ability_result.json*"
    ],
  },
  ["requestBody"]
);

// Redirect Farm (Normal Raid)
chrome.webRequest.onCompleted.addListener(
  function (details) {
    chrome.storage.sync.get(["redirectFarm"], function (data) {
      if (data.redirectFarm) {
        console.log("Redirect Active");
        chrome.bookmarks.search({ title: "farm" }, function (result) {
          if (result[0] && result[0].url) {
            console.log("Found", result[0].url);
            setTimeout(() => {
              chrome.tabs.update(details.tabId, { url: result[0].url });
            }, Math.random() * 500 + 500);
          }
        });
      }
    });
  },
  {
    urls: [
      "*://game.granbluefantasy.jp/resultmulti/data/*",
      "*://game.granbluefantasy.jp/*result/*",
    ],
  }
);

// Redirect Farm (Guild War)
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === "complete" && tab.url?.includes("#result_multi/")) {
    chrome.storage.sync.get(["redirectFarm"], function (data) {
      if (data.redirectFarm) {
        console.log("Redirect Active");
        chrome.bookmarks.search({ title: "farm" }, function (result) {
          if (result[0] && result[0].url) {
            console.log("Found", result[0].url);
            setTimeout(() => {
              chrome.tabs.update(tabId, { url: result[0].url });
            }, Math.random() * 500 + 500);
          }
        });
      }
    });
  }
});

// Set Storage Defaults on Install
chrome.runtime.onInstalled.addListener(function () {
  chrome.storage.sync.set(storageDefaults, () => {
    console.log("Storage Defaults Applied:", storageDefaults);
  });

  chrome.declarativeContent.onPageChanged.removeRules(undefined, function () {
    chrome.declarativeContent.onPageChanged.addRules([
      {
        conditions: [
          new chrome.declarativeContent.PageStateMatcher({
            pageUrl: { hostEquals: "game.granbluefantasy.jp" },
          }),
        ],
        actions: [new chrome.declarativeContent.ShowPageAction()],
      },
    ]);
  });
});