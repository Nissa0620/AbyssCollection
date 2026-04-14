import { state } from "./state.js";
import { addLog } from "./log.js";
import { addEnemyDexBuff, addHiddenBossDexBuff } from "./dexBuff.js";
import { hiddenBossDefs } from "./hiddenBossData.js";
import { isUltimatePet } from "./pet.js";
import { isUltimateWeapon } from "./drop.js";

function bookKey(enemyId, isBoss) {
  return isBoss ? `boss_${enemyId}` : `normal_${enemyId}`;
}

// 出現時に敵の情報を登録・seenCountを加算
export function registerEnemySeen(enemyId, enemyName, isBoss = false) {
  const enemiesBook = state.book.enemies;
  const key = bookKey(enemyId, isBoss);

  if (!enemiesBook[key]) {
    enemiesBook[key] = {
      name: enemyName,
      appearFloor: null,
      seenCount: 0,
      defeatedCount: 0,
      titles: {},
    };
  }

  enemiesBook[key].seenCount++;
}

// 撃破時に敵の情報を登録・更新
export function registerEnemyDefeated(enemyId, titleId, enemyName, titleName, isBoss = false, fullDisplayName = null) {
  const enemiesBook = state.book.enemies;
  const key = bookKey(enemyId, isBoss);

  if (!enemiesBook[key]) {
    enemiesBook[key] = {
      name: enemyName,
      appearFloor: null,
      seenCount: 0,
      defeatedCount: 0,
      titles: {},
    };
  }

  const entry = enemiesBook[key];
  entry.defeatedCount++;

  const isNewTitle = !entry.titles[titleId];
  if (isNewTitle) {
    entry.titles[titleId] = { seen: true, defeated: false };
    addLog(`📘 ${fullDisplayName ?? (titleName + enemyName)}を図鑑に登録した`);
  }

  entry.titles[titleId].seen = true;
  entry.titles[titleId].defeated = true;

  // 撃破だけではdexBuffは変化しない（捕獲時に addEnemyDexBuff で加算）
}

// 捕獲済ペットの究極フラグを更新（捕獲・合成後に呼ぶ）
export function updateBookUltimate() {
  const enemiesBook = state.book.enemies;
  for (const key of Object.keys(enemiesBook)) {
    const entry = enemiesBook[key];
    // この敵の捕獲済ペットの中に究極個体があるか確認
    const isBoss = key.startsWith("boss_");
    const enemyId = parseInt(key.replace("boss_", "").replace("normal_", ""));
    const hasUltimate = state.player.petList.some(
      (p) => p.enemyId === enemyId && !!p.isBoss === isBoss && isUltimatePet(p)
    );
    entry.hasUltimate = hasUltimate;
  }
}

// 隠しボス撃破時に図鑑登録
export function registerHiddenBossDefeated(hiddenBossId, name) {
  if (!state.book.hiddenBosses) state.book.hiddenBosses = {};
  if (!state.book.hiddenBosses[hiddenBossId]) {
    state.book.hiddenBosses[hiddenBossId] = { name, defeated: false, weaponObtained: false };
  }
  if (!state.book.hiddenBosses[hiddenBossId].defeated) {
    state.book.hiddenBosses[hiddenBossId].defeated = true;
    addLog(`📘 ${name} を図鑑に登録した`);
    addHiddenBossDexBuff(state, "defeated");
  }
}

// 隠しボス武器入手時に図鑑登録
export function registerHiddenWeaponObtained(hiddenBossId, weaponName) {
  if (!state.book.hiddenBosses) state.book.hiddenBosses = {};
  if (!state.book.hiddenBosses[hiddenBossId]) {
    state.book.hiddenBosses[hiddenBossId] = { name: "", defeated: false, weaponObtained: false };
  }
  if (!state.book.hiddenBosses[hiddenBossId].weaponObtained) {
    state.book.hiddenBosses[hiddenBossId].weaponObtained = true;
    addLog(`📘 武器「${weaponName}」を図鑑に登録した`);
    addHiddenBossDexBuff(state, "weaponObtained");
  }
}

// 武器図鑑の究極フラグを更新
export function updateWeaponBookUltimate() {
  const weaponBook = state.book.weapons;
  for (const key of Object.keys(weaponBook)) {
    const isBossDrop = key.startsWith("boss_");
    const templateId = parseInt(key.replace("boss_", "").replace("normal_", ""));
    const hasUltimate = state.player.inventory.some(
      (w) => w.templateId === templateId && !!w.isBossDrop === isBossDrop && isUltimateWeapon(w)
    );
    if (weaponBook[key]) weaponBook[key].hasUltimate = hasUltimate;
  }
}