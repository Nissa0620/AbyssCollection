import { weaponTemplates, floorTable, bossFloorMap, getCurrentArea } from "./data/index.js";
import { state } from "./state.js";

export function getDropWeapon(dropMult = 1) {
  const area = getCurrentArea(state.floor);
  if (!area) return null;

  const possibleWeapons = weaponTemplates.filter(
    (w) => !w.isBossDrop && w.id >= area.weaponIdRange[0] && w.id <= area.weaponIdRange[1],
  );
  if (possibleWeapons.length === 0) return null;

  const totalRate = possibleWeapons.reduce((sum, t) => sum + t.dropRate, 0) * dropMult;
  if (totalRate <= 0) return null;

  const rand = Math.random();
  // dropMultを反映：合計ドロップ率が1を超えることもあるので判定を分ける
  const scaledRate = Math.min(totalRate, 1);
  if (rand > scaledRate) return null;

  // どの武器が落ちるか抽選
  const r2 = Math.random() * possibleWeapons.reduce((sum, t) => sum + t.dropRate, 0);
  let cumulative = 0;
  for (const template of possibleWeapons) {
    cumulative += template.dropRate;
    if (r2 < cumulative) {
      return createWeapon(template);
    }
  }

  return null;
}

// ボスドロップ（ボスのenemyIdに対応する専用武器を返す）
export function getBossDropWeapon(bossEnemyId) {
  // bossEnemiesとbossWeaponsは同じid体系（1→1など）
  const template = weaponTemplates.find(
    (w) => w.isBossDrop && w.id === bossEnemyId,
  );
  if (!template) return null;
  return createWeapon(template);
}

function createWeapon(template) {
  const baseAtk =
    Math.floor(Math.random() * (template.maxAtk - template.minAtk + 1)) +
    template.minAtk;
  const baseHp = template.minHp != null
    ? Math.floor(Math.random() * (template.maxHp - template.minHp + 1)) + template.minHp
    : 0;
  const passiveValue = template.passiveValue
    ? Math.floor(Math.random() * (template.passiveValue.max - template.passiveValue.min + 1)) + template.passiveValue.min
    : null;

  return {
    uid: Date.now() + Math.random(),
    templateId: template.id,
    isBossDrop: template.isBossDrop ?? false,
    name: template.name,
    baseAtk,
    totalAtk: baseAtk,
    baseHp,
    totalHp: baseHp,
    level: 0,
    passive: template.passive ?? null,
    basePassiveValue: passiveValue,
    passiveValue,
  };
}
// =====================
// 武器究極個体判定
// =====================
export function isUltimateWeapon(weapon) {
  if (!weapon) return false;
  const isBossDrop = weapon.isBossDrop ?? false;
  const template = weaponTemplates.find(
    (t) => t.id === weapon.templateId && !!t.isBossDrop === isBossDrop
  );
  if (!template) return false;

  if ((weapon.baseAtk) < template.maxAtk) return false;
  if ((weapon.baseHp ?? 0) < (template.maxHp ?? 0)) return false;
  if (template.passiveValue) {
    if ((weapon.basePassiveValue ?? weapon.passiveValue ?? 0) < template.passiveValue.max) return false;
  }
  return true;
}