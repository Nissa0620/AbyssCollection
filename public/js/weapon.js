import { weaponTemplates } from "./data/index.js";
export function getWeaponDisplayName(weapon, options = {}) {
  const { showSeries = true } = options;
  const isBossDrop = weapon.isBossDrop ?? false;
  const template = weaponTemplates.find((t) => t.id === weapon.templateId && !!t.isBossDrop === isBossDrop);

  if (!template) return "Unknown";

  let evolvedName = template.name;

  template.evolutions.forEach((evo) => {
    if (weapon.level >= evo.level) {
      evolvedName = evo.name;
    }
  });

  if (evolvedName !== template.name) {
    return showSeries ? `${evolvedName}[${template.name}]` : evolvedName;
  }

  return template.name;
}