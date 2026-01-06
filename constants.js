'use strict';

const allKeys = [
  "goBackOnAttack",
  "reloadAttack",
  "goBackOnSummon",
  "reloadSummon",
  "reloadSkill",
  "redirectFarm",
  "arcaMode",
  "autoRaid",
  "autoCombat"
];

const storageDefaults = {
  goBackOnAttack: false,
  reloadAttack: false,
  goBackOnSummon: false,
  reloadSummon: false,
  reloadSkill: false,
  redirectFarm: false,
  arcaMode: false,
  autoRaid: false,
  autoCombat: false
};

// Category Definitions
const categories = {
  "Attack Options": ["goBackOnAttack", "reloadAttack"],
  "Summon Options": ["goBackOnSummon", "reloadSummon"],
  "Skill Options": ["reloadSkill"],
  "Redirect Options": ["redirectFarm", "arcaMode"],
  "Auto Raid": ["autoRaid", "autoCombat"]
};
