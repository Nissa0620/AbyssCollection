import { state } from "./state.js";
import { addLog } from "./log.js";
import { addEnemyDexBuff, addHiddenBossDexBuff } from "./dexBuff.js";
import { hiddenBossDefs } from "./hiddenBossData.js";
import { isUltimatePet } from "./pet.js";
import { isUltimateWeapon } from "./drop.js";
import { normalEnemies, bossEnemies } from "./data/index.js";
import { checkWeaponV1Complete } from "./weaponBook.js";

// checkPetV1Complete で使うキャッシュ（モジュールロード時に1回だけ生成）
const _allPetEnemies = [
  ...normalEnemies.map(e => ({ ...e, _bookKey: `normal_${e.id}` })),
  ...bossEnemies.map(e => ({ ...e, _bookKey: `boss_${e.id}` })),
];

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
    checkWeaponV1Complete(state);
  }
}

/**
 * ペット図鑑v1のコンプチェック。
 * コンプしていればフラグと固定値を焼き付ける。
 * 既にコンプ済みの場合は何もしない。
 *
 * 注意: state.dexBuff には addHiddenBossDexBuff による隠しボス分が含まれる場合がある。
 * ロード時は recalcHiddenBossDexBuff より前に呼ぶことで純粋なペット図鑑バフ値を焼き付ける。
 */
export function checkPetV1Complete(state) {
  if (state.book.petV1Completed) return;

  const bookEnemies = state.book.enemies ?? {};

  for (const tpl of _allPetEnemies) {
    const entry = bookEnemies[tpl._bookKey];
    if (!entry) return;
    const titles = entry.titles ?? {};
    for (const tid of [1, 2, 3, 4, 5]) {
      if (!titles[tid]?.caught) return;
    }
  }

  // 隠しボスペット7体が全て入手済みか確認
  const hiddenBosses = state.book.hiddenBosses ?? {};
  for (const def of hiddenBossDefs) {
    if (!hiddenBosses[def.id]?.petObtained) return;
  }

  // コンプ達成：現在のdexBuff値を固定値として焼き付ける
  state.book.petV1Completed = true;
  state.book.petV1DexBuff = {
    hp:    state.dexBuff.hp,
    power: state.dexBuff.power,
  };
  state.book.petV1Count = 2507;
  console.log("[Step1] ペット図鑑v1コンプ達成 - 固定値焼き付け完了");
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