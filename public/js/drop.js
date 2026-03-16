import { weaponTemplates } from "./data/index.js";
import { state } from "./state.js";

export function getDropWeapon(dropMult = 1, enemyId = null) {
  // 敵IDが渡された場合は1:1対応の武器を返す
  const template = enemyId != null
    ? weaponTemplates.find((w) => !w.isBossDrop && w.id === enemyId)
    : null;

  if (!template) return null;

  // ドロップ判定（dropRateにdropMultを掛けた確率）
  const dropChance = Math.min(template.dropRate * dropMult, 1);
  if (Math.random() > dropChance) return null;

  return createWeapon(template);
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
    acquiredOrder: state.acquiredCounter++,
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