import { state } from "./state.js";
import { addLog } from "./log.js";
import { isLocked } from "./listPrefs.js";
import { getWeaponDisplayName } from "./weapon.js";
import { saveGame } from "./saveLoad.js";
import { registerWeaponEvolved } from "./weaponBook.js";
import { weaponTemplates } from "./data/index.js";
import { checkAchievements } from "./achievements.js";

export function equipWeapon(uid) {
  const inv = state.player.inventory;
  const weapon = inv.find((item) => item.uid === uid);
  if (!weapon) return;

  state.player.equippedWeapon = weapon;
  const name = getWeaponDisplayName(weapon);
  addLog(`⚔️ ${name} を装備した`);
  saveGame();
}

// 合成対象を選択する
export function handleSynthesisSelection(uid) {
  const synth = state.synthesis;
  const inv = state.player.inventory;
  const clickedItem = inv.find((item) => item.uid === uid);
  if (!clickedItem) return;

  // ベース未選択 → ベースにセット
  if (synth.baseUid === null) {
    synth.baseUid = clickedItem.uid;
    return;
  }

  // ベースを再タップ → 解除
  if (clickedItem.uid === synth.baseUid) {
    synth.baseUid = null;
    synth.materialUids = [];
    return;
  }

  const base = inv.find((item) => item.uid === synth.baseUid);
  if (base.templateId !== clickedItem.templateId) return;

  // 素材トグル（手動追加・解除）
  const i = synth.materialUids.indexOf(uid);
  if (i === -1) {
    synth.materialUids.push(uid);
  } else {
    synth.materialUids.splice(i, 1);
  }
}

// 一括選択
export function toggleSelectAllSameWeapons() {
  const synth = state.synthesis;
  const inv = state.player.inventory;
  if (!synth.baseUid) return;

  const base = inv.find((item) => item.uid === synth.baseUid);
  if (!base) return;

  // ロック済みを除外
  const sameWeaponUids = inv
    .filter((item) =>
      item.uid !== base.uid &&
      item.templateId === base.templateId &&
      !isLocked(item.uid)
    )
    .map((item) => item.uid);

  const isAllSelected =
    sameWeaponUids.length > 0 &&
    sameWeaponUids.every((uid) => synth.materialUids.includes(uid));

  synth.materialUids = isAllSelected ? [] : sameWeaponUids;
}

// 合成処理
export function synthesize(base, material) {
  if (base.templateId !== material.templateId) {
    return null;
  }

  if (state.player.equippedWeapon) {
    if (material.uid === state.player.equippedWeapon.uid) {
      addLog(`⚔️ 素材として使用された ${getWeaponDisplayName(material)} を外した`);
      state.player.equippedWeapon = null;
    }
  }

  const newLevel = base.level + material.level + 1;
  const K_ATK = 7.5 / Math.sqrt(15);
  const K_HP  = 4.5 / Math.sqrt(15);
  const atkMult = newLevel <= 15
    ? (1 + newLevel * 0.5)
    : (1 + Math.sqrt(newLevel) * K_ATK);
  const hpMult = newLevel <= 15
    ? (1 + newLevel * 0.3)
    : (1 + Math.sqrt(newLevel) * K_HP);
  const newTotalAtk = Math.floor(base.baseAtk * atkMult);
  const newTotalHp  = Math.floor((base.baseHp ?? 0) * hpMult);

  // パッシブ：進化通過時のみpassiveMultを適用
  const basePassiveValue = base.basePassiveValue ?? base.passiveValue ?? null;
  let newPassiveValue = base.passiveValue ?? null;
  if (basePassiveValue != null) {
    const isBossDrop = base.isBossDrop ?? false;
    const template = weaponTemplates.find((t) => t.id === base.templateId && !!t.isBossDrop === isBossDrop);
    if (template) {
      // base.levelからnewLevelの間に通過した進化のうち最大のpassiveMultを取得
      const passedEvo = template.evolutions
        .filter((evo) => evo.level > base.level && evo.level <= newLevel && evo.passiveMult)
        .sort((a, b) => b.level - a.level)[0];
      if (passedEvo) {
        newPassiveValue = Math.min(Math.floor(basePassiveValue * passedEvo.passiveMult), 100);
      }
    }
  }

  return {
    uid: base.uid,
    templateId: base.templateId,
    isBossDrop: base.isBossDrop ?? false,
    name: base.name,
    baseAtk: base.baseAtk,
    totalAtk: newTotalAtk,
    baseHp: base.baseHp ?? 0,
    totalHp: newTotalHp,
    level: newLevel,
    passive: base.passive ?? null,
    basePassiveValue,
    passiveValue: newPassiveValue,
  };
}

// 合成処理を実行
export function executeSynthesis() {
  const { baseUid, materialUids } = state.synthesis;

  if (!baseUid || materialUids.length === 0) {
    return false;
  }

  const inv = state.player.inventory;

  const base = inv.find((item) => item.uid === baseUid);
  if (!base) return false;

  const oldName = getWeaponDisplayName(base);

  let newWeapon = base;

  for (const uid of materialUids) {
    const material = inv.find((item) => item.uid === uid);
    if (!material) continue;

    const result = synthesize(newWeapon, material);
    if (!result) return false;

    newWeapon = result;
  }

  if (!newWeapon) return false;

  const newName = getWeaponDisplayName(newWeapon);

  if (oldName !== newName) {
    // 旧レベルから新レベルの間に通過したすべての進化段階を登録
      const isBossDrop = newWeapon.isBossDrop ?? false;
      const template = weaponTemplates.find((t) => t.id === newWeapon.templateId && !!t.isBossDrop === isBossDrop);
      if (template) {
        const passedEvos = template.evolutions.filter(
          (evo) => evo.level > base.level && evo.level <= newWeapon.level
        );
        for (let i = 0; i < passedEvos.length; i++) {
          const evo = passedEvos[i];
          const prevName = i === 0 ? oldName : passedEvos[i - 1].name;
          addLog(`✨ ${prevName} が ${evo.name} に進化した！`);
          registerWeaponEvolved(newWeapon.templateId, evo.name, isBossDrop);
        }
        if (!state.achievements) state.achievements = {};
        state.achievements.weaponEvolveCount =
          (state.achievements.weaponEvolveCount ?? 0) + passedEvos.length;
      }
  }

  state.player.inventory = inv.filter(
    (item) => item.uid !== baseUid && !materialUids.includes(item.uid),
  );

  state.player.inventory.push(newWeapon);

  if (
    state.player.equippedWeapon &&
    state.player.equippedWeapon.uid === newWeapon.uid
  ) {
    state.player.equippedWeapon = newWeapon;
  }

  newWeapon.acquiredOrder = state.acquiredCounter++;
  const baseName = getWeaponDisplayName(newWeapon);
  addLog(`⚔️ ${baseName} を合成！ATK +${base.totalAtk} → ${newWeapon.totalAtk}`);

  state.synthesis.baseUid = null;
  state.synthesis.materialUids = [];
  if (!state.achievements) state.achievements = {};
  state.achievements.weaponSynthCount = (state.achievements.weaponSynthCount ?? 0) + materialUids.length;
  checkAchievements();
  return true;
}

// 合成プレビュー
export function getSynthesisPreview() {
  const { baseUid, materialUids } = state.synthesis;

  if (baseUid === null || materialUids.length === 0) {
    return null;
  }

  const inv = state.player.inventory;
  const base = inv.find((item) => item.uid === baseUid);

  let totalLevelGain = 0;
  materialUids.forEach((i) => {
    let material = inv.find((item) => item.uid === i);
    if (material) {
      totalLevelGain += material.level + 1;
    }
  });

  const oldLevel = base.level;
  const newLevel = base.level + totalLevelGain;
  const oldTotalAtk = base.totalAtk;
  const K_ATK = 7.5 / Math.sqrt(15);
  const K_HP  = 4.5 / Math.sqrt(15);
  const atkMult = newLevel <= 15
    ? (1 + newLevel * 0.5)
    : (1 + Math.sqrt(newLevel) * K_ATK);
  const hpMult = newLevel <= 15
    ? (1 + newLevel * 0.3)
    : (1 + Math.sqrt(newLevel) * K_HP);
  const oldTotalHp = base.totalHp ?? 0;
  const newTotalAtk = Math.floor(base.baseAtk * atkMult);
  const newTotalHp  = Math.floor((base.baseHp ?? 0) * hpMult);

  return {
    levelGain: totalLevelGain,
    oldLevel,
    newLevel,
    oldTotalAtk,
    newTotalAtk,
    oldTotalHp,
    newTotalHp,
  };
}