import { normalEnemies, bossEnemies, weaponTemplates, floorTable } from "./data/index.js";
import { hiddenBossDefs } from "./hiddenBossData.js";

const BASE_WEAPON_DEX_BUFF   = { hp: 0.20, power: 0.20 };
const HIDDEN_BOSS_DEX_BUFF   = { hp: 1.0, power: 1.0 };
const HIDDEN_WEAPON_DEX_BUFF = { hp: 1.0, power: 1.0 };

const allEnemies = [
  ...normalEnemies.map((e) => ({ ...e, _bookKey: `normal_${e.id}` })),
  ...bossEnemies.map((e) => ({ ...e, _bookKey: `boss_${e.id}` })),
];

export function recalcDexBuff(state) {
  const oldMax = state.player.totalHp;

  if (state.book.petV1Completed && state.book.petV1DexBuff) {
    state.dexBuff.hp    = state.book.petV1DexBuff.hp;
    state.dexBuff.power = state.book.petV1DexBuff.power;
    const newMax = state.player.totalHp;
    const diff = newMax - oldMax;
    if (diff > 0) state.player.hp += diff;
    if (state.player.hp > newMax) state.player.hp = newMax;
    return;
  }

  const bookEnemies = state.book?.enemies ?? {};

  let hp = 1;
  let power = 1;

  for (const tpl of allEnemies) {
    const entry = bookEnemies[tpl._bookKey];
    if (!entry) continue;

    const bandData = floorTable[tpl.floorBand];
    if (!bandData) continue;

    const titles = entry.titles ?? {};
    const anyCaught = Object.values(titles).some((t) => t.caught);

    // いずれかの称号で捕獲済みなら基本dexBuffを加算（1敵につき1回）
    if (anyCaught) {
      hp += bandData.dexBuff?.hp ?? 0;
      power += bandData.dexBuff?.power ?? 0;
    }

    // 称号ごとに捕獲済みのものだけtitleDexBuffを加算（称号5=伝説も含む）
    for (const titleId of Object.keys(titles)) {
      if (!titles[titleId].caught) continue;
      // 称号5（伝説）は固定値0.5を加算
      if (Number(titleId) === 5) {
        hp += 0.5;
        power += 0.5;
        continue;
      }
      const titleBuff = bandData.titleDexBuff?.[titleId];
      if (!titleBuff) continue;
      hp += titleBuff.hp ?? 0;
      power += titleBuff.power ?? 0;
    }
  }

  state.dexBuff.hp = hp;
  state.dexBuff.power = power;

  const newMax = state.player.totalHp;
  const diff = newMax - oldMax;

  if (diff > 0) state.player.hp += diff;
  if (state.player.hp > newMax) state.player.hp = newMax;
}

export function recalcWeaponDexBuff(state) {
  const oldMax = state.player.totalHp;

  if (state.book.weaponV1Completed && state.book.weaponV1DexBuff) {
    state.weaponDexBuff.hp    = state.book.weaponV1DexBuff.hp;
    state.weaponDexBuff.power = state.book.weaponV1DexBuff.power;
    const newMax = state.player.totalHp;
    const diff = newMax - oldMax;
    if (diff > 0) state.player.hp += diff;
    if (state.player.hp > newMax) state.player.hp = newMax;
    return;
  }

  const weaponsBook = state.book.weapons ?? {};

  let hp = 1;
  let power = 1;

  for (const bookKey of Object.keys(weaponsBook)) {
    const isBossDrop = bookKey.startsWith("boss_");
    const templateId = Number(bookKey.replace(/^(boss|normal)_/, ""));
    const template = weaponTemplates.find((t) => t.id === templateId && !!t.isBossDrop === isBossDrop);
    if (!template) continue;

    const entry = weaponsBook[bookKey];

    // ベース入手済み（図鑑に登録されているだけで加算）
    hp += BASE_WEAPON_DEX_BUFF.hp;
    power += BASE_WEAPON_DEX_BUFF.power;

    // 進化ごとのdexBuff
    for (const evo of template.evolutions) {
      if (entry.evolutions[evo.name]?.obtained) {
        hp += evo.dexBuff?.hp ?? 0;
        power += evo.dexBuff?.power ?? 0;
      }
    }
  }

  state.weaponDexBuff.hp = hp;
  state.weaponDexBuff.power = power;

  const newMax = state.player.totalHp;
  const diff = newMax - oldMax;
  if (diff > 0) state.player.hp += diff;
  if (state.player.hp > newMax) state.player.hp = newMax;
}

export function recalcHiddenBossDexBuff(state) {
  const oldMax = state.player.totalHp;

  const hiddenBosses = state.book.hiddenBosses ?? {};

  let enemyHpBonus    = 0;  // dexBuff（敵図鑑）用
  let enemyPowerBonus = 0;
  let weaponHpBonus    = 0; // weaponDexBuff（武器図鑑）用
  let weaponPowerBonus = 0;

  for (const def of hiddenBossDefs) {
    const entry = hiddenBosses[def.id];
    if (!entry) continue;
    if (entry.defeated) {
      enemyHpBonus    += HIDDEN_BOSS_DEX_BUFF.hp;
      enemyPowerBonus += HIDDEN_BOSS_DEX_BUFF.power;
    }
    if (entry.weaponObtained) {
      weaponHpBonus    += HIDDEN_WEAPON_DEX_BUFF.hp;
      weaponPowerBonus += HIDDEN_WEAPON_DEX_BUFF.power;
    }
  }

  // recalcDexBuff / recalcWeaponDexBuff の後に呼ぶこと
  state.dexBuff.hp          += enemyHpBonus    / 100;
  state.dexBuff.power       += enemyPowerBonus / 100;
  state.weaponDexBuff.hp    += weaponHpBonus   / 100;
  state.weaponDexBuff.power += weaponPowerBonus / 100;

  const newMax = state.player.totalHp;
  const diff = newMax - oldMax;
  if (diff > 0) state.player.hp += diff;
  if (state.player.hp > newMax) state.player.hp = newMax;
}

// =====================
// 差分加算ヘルパー（戦闘中の新規図鑑登録時に呼ぶ）
// =====================

export function addEnemyDexBuff(state, bandData, titleId, isFirstCatchForEnemy) {
  const oldMax = state.player.totalHp;

  // この敵で初めて捕獲した称号の場合、基本dexBuffを加算（1敵につき1回）
  if (isFirstCatchForEnemy) {
    state.dexBuff.hp    += bandData.dexBuff?.hp    ?? 0;
    state.dexBuff.power += bandData.dexBuff?.power ?? 0;
  }

  // 称号ごとのtitleDexBuffを加算
  if (Number(titleId) === 5) {
    // 称号5（伝説）は固定値
    state.dexBuff.hp    += 0.5;
    state.dexBuff.power += 0.5;
  } else {
    const titleBuff = bandData.titleDexBuff?.[titleId];
    if (titleBuff) {
      state.dexBuff.hp    += titleBuff.hp    ?? 0;
      state.dexBuff.power += titleBuff.power ?? 0;
    }
  }

  const newMax = state.player.totalHp;
  const diff = newMax - oldMax;
  if (diff > 0) state.player.hp += diff;
  if (state.player.hp > newMax) state.player.hp = newMax;
}

export function addWeaponDexBuff(state, type, evoDexBuff = null) {
  const oldMax = state.player.totalHp;

  if (type === "base") {
    state.weaponDexBuff.hp    += BASE_WEAPON_DEX_BUFF.hp;
    state.weaponDexBuff.power += BASE_WEAPON_DEX_BUFF.power;
  } else if (type === "evo" && evoDexBuff) {
    state.weaponDexBuff.hp    += evoDexBuff.hp    ?? 0;
    state.weaponDexBuff.power += evoDexBuff.power ?? 0;
  }

  const newMax = state.player.totalHp;
  const diff = newMax - oldMax;
  if (diff > 0) state.player.hp += diff;
  if (state.player.hp > newMax) state.player.hp = newMax;
}

export function addHiddenBossDexBuff(state, type) {
  const oldMax = state.player.totalHp;

  if (type === "defeated") {
    state.dexBuff.hp    += HIDDEN_BOSS_DEX_BUFF.hp    / 100;
    state.dexBuff.power += HIDDEN_BOSS_DEX_BUFF.power / 100;
  } else if (type === "weaponObtained") {
    state.weaponDexBuff.hp    += HIDDEN_WEAPON_DEX_BUFF.hp    / 100;
    state.weaponDexBuff.power += HIDDEN_WEAPON_DEX_BUFF.power / 100;
  }

  const newMax = state.player.totalHp;
  const diff = newMax - oldMax;
  if (diff > 0) state.player.hp += diff;
  if (state.player.hp > newMax) state.player.hp = newMax;
}