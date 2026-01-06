(() => {
  'use strict';

  // Flatten all item IDs from DROP_DATA
  const ITEM_IDS = DROP_DATA.flatMap(cat => cat.drops.map(d => d.id));

  // Track which quest drops have already been processed
  let processedDrops = {}; // key: item id

  // Extract numeric ID from image src
  function extractItemIdFromSrc(src) {
    const match = src && src.match(/\/(\d+)\.(png|jpg)/);
    return match ? Number(match[1]) : null;
  }

  function scrapeInventoryFromDOM() {
    chrome.storage.local.get("gbfInventory", (data) => {
      const oldInventory = data.gbfInventory || {};
      const newInventory = { ...oldInventory };

      // --- Standard inventory ---
      const standardSelectors = [
        ".prt-item-inner",
        ".lis-item.treasure",
        ".lis-item.btn-evolution-weapon",
        ".lis-item.weapon",
        ".lis-item.summon"
      ];

      document.querySelectorAll(standardSelectors.join(",")).forEach(item => {
        const img = item.querySelector("img.prt-thumb, img");
        const countNode = item.querySelector(".prt-having-num");
        if (!img || !countNode) return;

        const id = extractItemIdFromSrc(img.src);
        if (!id || !ITEM_IDS.includes(id)) return;

        const count = parseInt(countNode.textContent.replace(/\D/g, ""), 10) || 0;

        newInventory[id] = {
          id,
          count,
          src: img.src
        };
      });

      // --- Quest drops ---
      document.querySelectorAll(".cnt-treasure-contents .prt-item-list .lis-treasure").forEach(item => {
        const img = item.querySelector("img.prt-thumb, img");
        if (!img) return;

        const id = extractItemIdFromSrc(img.src);
        if (!id || !ITEM_IDS.includes(id)) return;

        // Skip if already processed
        if (processedDrops[id]) return;

        // Parse count from .prt-article-count
        let count = 1;
        const countNode = item.querySelector(".prt-article-count");
        if (countNode) {
          const value = parseInt(countNode.textContent.replace(/\D/g, ""), 10);
          if (!isNaN(value)) count = value;
        }

        const prevCount = newInventory[id]?.count || 0;
        newInventory[id] = {
          id,
          count: prevCount + count,
          src: img.src
        };

        // Mark as processed
        processedDrops[id] = true;
      });

      // Save inventory and timestamp
      chrome.storage.local.set({
        gbfInventory: newInventory,
        gbfInventoryUpdated: Date.now()
      });

      // Notify popup
      chrome.runtime.sendMessage({ type: "inventoryUpdated", inventory: newInventory });
      console.log("[Percival] Inventory updated:", newInventory);
    });
  }

  // --- Observe page for lazy-loaded items ---
  const observer = new MutationObserver(() => scrapeInventoryFromDOM());
  observer.observe(document.body, { childList: true, subtree: true });

  // --- Initial scrape ---
  scrapeInventoryFromDOM();

  // --- Reset processedDrops on page unload (new quest) ---
  window.addEventListener('beforeunload', () => {
    processedDrops = {};
  });

})();
