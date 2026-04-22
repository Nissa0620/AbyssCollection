import { state } from "./state.js";
import { weaponTemplates } from "./data/index.js";
import { addWeaponDexBuff } from "./dexBuff.js";
import { addLog } from "./log.js";
import { hiddenBossDefs } from "./hiddenBossData.js";

// ドロップ時に初期形を記録
export function registerWeaponDropped(templateId, isBossDrop = false) {
  const weaponsBook = state.book.weapons;
  const bookKey = isBossDrop ? `boss_${templateId}` : `normal_${templateId}`;
  if (!weaponsBook[bookKey]) {
    const template = weaponTemplates.find((t) => t.id === templateId && !!t.isBossDrop === isBossDrop);
    if (!template) return;
    weaponsBook[bookKey] = {
      name: template.name,
      evolutions: {},
    };
    addLog(`📘 ${template.name}を図鑑に登録した`);
    addWeaponDexBuff(state, "base");
    checkWeaponV1Complete(state);
  }
}

// 進化時に記録
export function registerWeaponEvolved(templateId, evoName, isBossDrop = false) {
  const weaponsBook = state.book.weapons;
  const bookKey = isBossDrop ? `boss_${templateId}` : `normal_${templateId}`;
  if (!weaponsBook[bookKey]) return;

  const entry = weaponsBook[bookKey];
  if (!entry.evolutions[evoName]) {
    entry.evolutions[evoName] = { obtained: true };
    addLog(`📘 ${evoName}を図鑑に登録した`);
    const template = weaponTemplates.find((t) => t.id === templateId && !!t.isBossDrop === isBossDrop);
    const evo = template?.evolutions.find((e) => e.name === evoName);
    addWeaponDexBuff(state, "evo", evo?.dexBuff ?? null);
    checkWeaponV1Complete(state);
  }
}

/**
 * 武器図鑑v1のコンプチェック。
 * コンプしていればフラグと固定値を焼き付ける。
 * 既にコンプ済みの場合は何もしない。
 *
 * 注意: state.weaponDexBuff には addHiddenBossDexBuff による隠しボス分が含まれる場合がある。
 * ロード時は recalcHiddenBossDexBuff より前に呼ぶことで純粋な武器図鑑バフ値を焼き付ける。
 */
export function checkWeaponV1Complete(state) {
  if (state.book.weaponV1Completed) return;

  const weaponsBook = state.book.weapons ?? {};

  // 通常武器：全400種のベース + 全進化形態が入手済みか確認
  for (const tpl of weaponTemplates) {
    const bookKey = `normal_${tpl.id}`;
    const entry = weaponsBook[bookKey];
    if (!entry) return;
    for (const evo of tpl.evolutions) {
      if (!entry.evolutions[evo.name]?.obtained) return;
    }
  }

  // 隠しボス武器：全7種が入手済みか確認
  const hiddenBosses = state.book.hiddenBosses ?? {};
  for (const def of hiddenBossDefs) {
    if (!hiddenBosses[def.id]?.weaponObtained) return;
  }

  // コンプ達成：現在のweaponDexBuff値を固定値として焼き付ける
  state.book.weaponV1Completed = true;
  state.book.weaponV1DexBuff = {
    hp:    state.weaponDexBuff.hp,
    power: state.weaponDexBuff.power,
  };
  state.book.weaponV1Count = 1607;
  console.log("[Step1] 武器図鑑v1コンプ達成 - 固定値焼き付け完了");
}