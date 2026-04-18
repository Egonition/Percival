(() => {
  'use strict';

  // Load Drop Data
  const ITEM_IDS = DROP_DATA.flatMap(cat => cat.drops.map(d => d.id));

  // Track Processed Quest Drops to Avoid Duplicates
  let processedDrops = {};

  // Standard Inventory Selectors
  const STANDARD_SELECTORS = [
    '.prt-item-inner',
    '.lis-item.treasure',
    '.lis-item.btn-evolution-weapon',
    '.lis-item.weapon',
    '.lis-item.summon'
  ].join(',');

  // Extract Item ID from Image Src
  function extractItemIdFromSrc(src) {
    const match = src?.match(/\/(\d+)\.(png|jpg)/);
    return match ? Number(match[1]) : null;
  }

  // Process a Single Inventory Item
  function processStandardItem(item, inventory) {
    const img       = item.querySelector('img.prt-thumb, img');
    const countNode = item.querySelector('.prt-having-num');
    if (!img || !countNode) return;

    const id = extractItemIdFromSrc(img.src);
    if (!id || !ITEM_IDS.includes(id)) return;

    const count = parseInt(countNode.textContent.replace(/\D/g, ''), 10) || 0;
    inventory[id] = { id, count, src: img.src };
  }

  // Process a Single Quest Drop
  function processQuestDrop(item, inventory) {
    const img = item.querySelector('img.prt-thumb, img');
    if (!img) return;

    const id = extractItemIdFromSrc(img.src);
    if (!id || !ITEM_IDS.includes(id) || processedDrops[id]) return;

    const countNode  = item.querySelector('.prt-article-count');
    const dropCount  = parseInt(countNode?.textContent.replace(/\D/g, ''), 10) || 1;
    const prevCount  = inventory[id]?.count || 0;

    inventory[id]     = { id, count: prevCount + dropCount, src: img.src };
    processedDrops[id] = true;
  }

  // Scrape Inventory from DOM
  function scrapeInventoryFromDOM() {
    chrome.storage.local.get('gbfInventory', (data) => {
      const inventory = { ...data.gbfInventory || {} };

      // Standard Inventory
      document.querySelectorAll(STANDARD_SELECTORS).forEach(item => {
        processStandardItem(item, inventory);
      });

      // Quest Drops
      document.querySelectorAll('.cnt-treasure-contents .prt-item-list .lis-treasure').forEach(item => {
        processQuestDrop(item, inventory);
      });

      // Save Inventory and Timestamp
      chrome.storage.local.set({
        gbfInventory:        inventory,
        gbfInventoryUpdated: Date.now()
      });

      // Notify Popup
      chrome.runtime.sendMessage({ type: 'inventoryUpdated', inventory });
    });
  }

  // Observe DOM Changes
  const observer = new MutationObserver(() => scrapeInventoryFromDOM());
  observer.observe(document.body, { childList: true, subtree: true });

  // Initial Scrape
  scrapeInventoryFromDOM();

  // Clear Processed Drops on Page Unload
  window.addEventListener('beforeunload', () => { processedDrops = {}; });

})();