'use strict';

// Setting Keys and Defaults
const allKeys = [
  "goBackOnAttack",
  "reloadAttack",
  "goBackOnSummon",
  "reloadSummon",
  "reloadSkill",
  "redirectFarm",
  "autoRaid",
  "autoCombat",
  "quickAttack",
  "enableBreaks"
];

// Default Values
const storageDefaults = {
  goBackOnAttack: false,
  reloadAttack:   false,
  goBackOnSummon: false,
  reloadSummon:   false,
  reloadSkill:    false,
  redirectFarm:   false,
  autoRaid:       false,
  autoCombat:     false,
  quickAttack:    false,
  enableBreaks:   false
};

// Categories for UI Grouping
const categories = {
  'Automation':       ['enableBreaks', 'autoRaid', 'autoCombat', 'quickAttack'],
  'Navigation':       ['redirectFarm'],
  'Attack Settings':  ['goBackOnAttack', 'reloadAttack'],
  'Skill Settings':   ['reloadSkill'],
  'Summon Settings':  ['goBackOnSummon', 'reloadSummon']
};