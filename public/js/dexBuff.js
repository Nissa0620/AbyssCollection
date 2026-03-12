import { normalEnemies, bossEnemies, weaponTemplates, floorTable } from "./data/index.js";

const allEnemies = [
  ...normalEnemies.map((e) => ({ ...e, _bookKey: `normal_${e.id}` })),
  ...bossEnemies.map((e) => ({ ...e, _bookKey: `boss_${e.id}` })),
];

export function recalcDexBuff(state) {
  const oldMax = state.player.totalHp;
  const bookEnemies = state.book?.enemies ?? {};

  let hp = 1;
  let power = 1;

  for (const tpl of allEnemies) {
    const entry = bookEnemies[tpl._bookKey];
    if (!entry) continue;

    const bandData = floorTable[tpl.floorBand];
    if (!bandData) continue;

    const titles = entry.titles ?? {};
    const anyDefeated = Object.values(titles).some((t) => t.defeated);

    // いずれかの称号で撃破済みなら基本dexBuffを加算（1敵につき1回）
    if (anyDefeated) {
      hp += bandData.dexBuff?.hp ?? 0;
      power += bandData.dexBuff?.power ?? 0;
    }

    // 称号ごとに撃破済みのものだけtitleDexBuffを加算
    for (const titleId of Object.keys(titles)) {
      if (!titles[titleId].defeated) continue;
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
  const weaponsBook = state.book.weapons ?? {};

  let hp = 1;
  let power = 1;

  for (const bookKey of Object.keys(weaponsBook)) {
    const isBossDrop = bookKey.startsWith("boss_");
    const templateId = Number(bookKey.replace(/^(boss|normal)_/, ""));
    const template = weaponTemplates.find((t) => t.id === templateId && !!t.isBossDrop === isBossDrop);
    if (!template) continue;

    const entry = weaponsBook[bookKey];

    for (const evo of template.evolutions) {
      if (entry.evolutions[evo.name]?.obtained) {
        hp += evo.dexBuff?.hp ?? 0;
        power += evo.dexBuff?.power ?? 0;
      }
    }
  }

  state.weaponDexBuff.hp = hp;
  state.weaponDexBuff.power = power;
}