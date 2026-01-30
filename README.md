# Percival
Granblue Fantasy (GBF) Script

## Performance Optimization Tips

### Ublock Origin Filters

For additional performance improvements, you can add these filters to uBlock Origin:

- game.granbluefantasy.jp##[data-menubar-container="MenuBarContainer"]
- game.granbluefantasy.jp###cnt-submenu-navi-vertical
- prd-game-a-granbluefantasy.akamaized.net/assets_en/img/sp/cjs/raid_appear_$image
- prd-game-a-granbluefantasy.akamaized.net/assets_en/img/sp/cjs/npc_$image
- prd-game-a-granbluefantasy.akamaized.net/assets_en/img/sp/cjs/phit_$image
- prd-game-a-granbluefantasy.akamaized.net/assets_en/img/sp/cjs/summon_$image
- prd-game-a-granbluefantasy.akamaized.net/assets_en/img/sp/cjs/ab_$image
- prd-game-a-granbluefantasy.akamaized.net/assets_en/img/sp/cjs/nsp_$image
- prd-game-a-granbluefantasy.akamaized.net/assets_en/img/sp/cjs/sp_$image
- prd-game-a-granbluefantasy.akamaized.net/assets_en/img/sp/cjs/burst_$image

**How to Add:**
1. Open uBlock Origin Settings
2. Go to "My Filters" Tab
3. Paste the Filters Above
4. Click "Apply Changes"

**What These Do:**
- Block UI Sidebar Elements
- Block Raid Entry Portrait

**Note:** These filters work alongside the extension's built-in animation blocking for maximum performance.