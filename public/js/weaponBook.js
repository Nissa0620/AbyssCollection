import { state } from "./state.js";
import { weaponTemplates } from "./data/index.js";
import { addWeaponDexBuff } from "./dexBuff.js";
import { addLog } from "./log.js";

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
  }
}