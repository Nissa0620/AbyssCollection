import { weaponTemplates } from "./data/index.js";

export function getWeaponDisplayName(weapon) {
  const isBossDrop = weapon.isBossDrop ?? false;
  const template = weaponTemplates.find(
    (t) => t.id === weapon.templateId && !!t.isBossDrop === isBossDrop
  );
  if (!template) return weapon.name ?? "Unknown";

  let evolvedName = template.name;
  template.evolutions.forEach((evo) => {
    if (weapon.level >= evo.level) evolvedName = evo.name;
  });

  return evolvedName;
}
