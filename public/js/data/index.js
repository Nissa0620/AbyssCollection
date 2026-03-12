export { basePlayer } from "./player.js";
export { normalEnemies } from "./normalEnemies.js";
export { bossEnemies } from "./bossEnemies.js";
export { enemyTitles, bossTitles, getTitleName, legendaryTitles, normalPassiveOf, isLegendaryPassive } from "./titles.js";
export { floorTable, bossFloorMap, getCurrentArea, getCurrentAreaKey } from "./floors.js";

export { normalWeaponTemplates } from "./normalWeapons.js";
export { bossWeaponTemplates } from "./bossWeapons.js";
export { gemTemplates, rollBossGems } from "./gems.js";

// 後方互換：既存コードはこれまで通り weaponTemplates でそのまま動く
import { normalWeaponTemplates } from "./normalWeapons.js";
import { bossWeaponTemplates } from "./bossWeapons.js";
export const weaponTemplates = [...normalWeaponTemplates, ...bossWeaponTemplates];