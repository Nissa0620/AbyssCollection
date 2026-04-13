import { weaponTemplates } from "./data/index.js";
import { state } from "./state.js";

export function getDropWeapon(dropMult = 1, enemyId = null) {
  // 敵IDが渡された場合は1:1対応の武器を返す
  const template = enemyId != null
    ? weaponTemplates.find((w) => !w.isBossDrop && w.id === enemyId)
    : null;

  if (!template) return null;

  // ドロップ判定（dropRateにdropMultを掛けた確率）
  const researchDropBonus = (state.research?.dropBonus ?? 0) * 0.001;
  const dropChance = Math.min(template.dropRate * dropMult + researchDropBonus, 1);
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
  // 1%の確率で極武器（全ステ最大値）を生成
  const isElite = Math.random() < 0.01;

  const baseAtk = isElite
    ? template.maxAtk
    : Math.floor(Math.random() * (template.maxAtk - template.minAtk + 1)) + template.minAtk;

  const baseHp = template.minHp != null
    ? (isElite
        ? template.maxHp
        : Math.floor(Math.random() * (template.maxHp - template.minHp + 1)) + template.minHp)
    : 0;

  const passiveValue = template.passiveValue
    ? (isElite
        ? template.passiveValue.max
        : Math.floor(Math.random() * (template.passiveValue.max - template.passiveValue.min + 1)) + template.passiveValue.min)
    : null;

  return {
    uid: `${Date.now()}_${Math.random()}`,
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