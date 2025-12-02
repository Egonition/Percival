'use strict';
importScripts("constants.js");

const skills = {
  "6199": "Conjunction",
  "8001": "Tag team"
};

// Watch for storage changes (debugging)
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

// Toggle Arcarum Mode
function toggleArcaMode() {
  console.log("Toggle Arca");
  const params = ["reloadSkill", "redirectFarm", "arcaMode"];

  chrome.storage.sync.get(params, (result) => {
    for (const key of params) {
      result[key] = !result[key];
    }
    chrome.storage.sync.set(result, () => console.log("Arca toggled"));
  });
}

// Deactivate everything
function deactivateAll() {
  console.log("Deactivate All");
  let allVal = {};
  for (const val of allKeys) {
    allVal[val] = false;
  }
  chrome.storage.sync.set(allVal);
}

let keyboardShortcut = {
  "toggle-aracarum-mode": toggleArcaMode,
  "deactivate-all": deactivateAll,
};

chrome.commands.onCommand.addListener(function (command) {
  console.log('Command:', command);
  if (keyboardShortcut[command]) keyboardShortcut[command]();
});

// Summon & Attack Result
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
    ],
  },
  ["requestBody"]
);

// Redirect Farm (Normal Quests)
chrome.webRequest.onCompleted.addListener(
  function (details) {
    chrome.storage.sync.get(["redirectFarm", "arcaMode"], function (data) {
      if (data.redirectFarm) {
        console.log("Redirect active");
        let key = data.arcaMode ? "arca" : "farm";
        chrome.bookmarks.search({ title: key }, function (result) {
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
    chrome.storage.sync.get(["redirectFarm", "arcaMode"], function (data) {
      if (data.redirectFarm) {
        console.log("Redirect active (fragment)");
        let key = data.arcaMode ? "arca" : "farm";
        chrome.bookmarks.search({ title: key }, function (result) {
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

// Set defaults on install
chrome.runtime.onInstalled.addListener(function () {
  chrome.storage.sync.set(storageDefaults, () => {
    console.log("Storage defaults applied:", storageDefaults);
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
