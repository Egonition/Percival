'use strict';

const labels = {
  goBackOnAttack: "Go Back On Attack",
  reloadAttack: "Reload On Attack",
  goBackOnSummon: "Go Back On Summon",
  reloadSummon: "Reload On Summon",
  reloadSkill: "Reload On Skill",
  redirectFarm: "Redirect to Farm",
  arcaMode: "Arca Mode",
};

let container = document.getElementById("options");
let elements = {};

// Create Sections by Category
for (let [categoryName, keys] of Object.entries(categories)) {
  // Section Header
  let header = document.createElement("h3");
  header.textContent = categoryName;
  header.style.margin = "10px 0 4px";
  header.style.fontSize = "14px";
  header.style.borderBottom = "1px solid #ccc";
  container.appendChild(header);

  // Options in that Category
  keys.forEach(key => {
    let label = document.createElement("label");
    label.style.display = "block";
    label.style.margin = "4px 0";

    let checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.id = key;

    label.appendChild(checkbox);
    label.appendChild(document.createTextNode(" " + (labels[key] || key)));

    container.appendChild(label);
    elements[key] = checkbox;
  });
}

// Load Saved Settings
chrome.storage.sync.get(storageDefaults, function (data) {
  for (let key of allKeys) {
    if (elements[key]) {
      elements[key].checked = !!data[key];
    }
  }
});

// Save Settings on Toggle
for (let key in elements) {
  elements[key].onchange = e => {
    chrome.storage.sync.set({ [key]: e.target.checked });
  };
}
