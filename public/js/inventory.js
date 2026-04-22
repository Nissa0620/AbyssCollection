import { state } from "./state.js";
import { addLog } from "./log.js";
import { isLocked, getLockedSet } from "./listPrefs.js";
import { isUltimateWeapon } from "./drop.js";
import { getWeaponDisplayName } from "./weapon.js";
import { saveGameLocal } from "./saveLoad.js";
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
  saveGameLocal();
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

  // ロックSetを1回だけ取得してキャッシュ
  const lockedSet = getLockedSet();

  const sameWeaponUids = inv
    .filter((item) =>
      item.uid !== base.uid &&
      item.templateId === base.templateId &&
      !lockedSet.has(String(item.uid))
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
        newPassiveValue = Math.floor(basePassiveValue * passedEvo.passiveMult);
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

// =====================
// 武器一括廃棄
// =====================
// condition: "nonUltimate" | "all"
// - nonUltimate: isUltimateWeapon()=false のもの（ロック・装備中除外）
// - all: ロック・装備中以外すべて
export function discardWeapons(condition) {
  const inv = state.player.inventory;
  const equippedUid = state.player.equippedWeapon?.uid ?? null;

  // ロックSetを1回だけ取得してキャッシュ（Bug #1修正）
  const lockedSet = getLockedSet();

  const targets = inv.filter((w) => {
    if (lockedSet.has(String(w.uid))) return false;
    if (w.uid === equippedUid) return false;
    if (condition === "nonUltimate") return !isUltimateWeapon(w);
    if (condition === "all") return true;
    return false;
  });

  if (targets.length === 0) return 0;

  const uidsToRemove = new Set(targets.map((w) => w.uid));
  state.player.inventory = inv.filter((w) => !uidsToRemove.has(w.uid));
  addLog(`⚔️ ${targets.length}個の武器を廃棄した`);

  // 廃棄後は合成選択をリセット（Bug #3修正）
  state.synthesis.baseUid = null;
  state.synthesis.materialUids = [];

  return targets.length;
}

// =====================
// 武器一括合成（究極個体をベースとして各グループを自動合成）
// =====================
export function bulkSynthesizeUltimateWeapons() {
  const equippedUid = state.player.equippedWeapon?.uid ?? null;
  let totalSynthed = 0;

  // ロックSetを1回だけ取得してキャッシュ（Bug #1修正）
  const lockedSet = getLockedSet();

  // グループキー → { baseUid, materialUids } をUID文字列のみで構築
  // ※ executeSynthesis() が state.player.inventory を差し替えるため
  //   オブジェクト参照は持たず、UID文字列だけを保持する（Bug #2修正）

  // 1パス目：グループごとにベースを選択
  // 優先順位：① 極武器 → ② なければ passiveValue 最大の通常武器
  const groupMap = new Map();
  for (const w of state.player.inventory) {
    const key = `${w.templateId}_${w.isBossDrop ? "1" : "0"}`;
    if (!groupMap.has(key)) groupMap.set(key, { baseUid: null, hasUltimate: false, materialUids: [] });
    const entry = groupMap.get(key);

    if (lockedSet.has(String(w.uid))) continue;
    if (w.uid === equippedUid) continue;

    if (isUltimateWeapon(w)) {
      if (!entry.hasUltimate) {
        entry.baseUid = w.uid;
        entry.hasUltimate = true;
      }
    } else if (!entry.hasUltimate) {
      // 極武器がまだない場合、passiveValue が最大のものをベース候補にする
      const current = state.player.inventory.find(i => i.uid === entry.baseUid);
      if (!entry.baseUid || (w.passiveValue ?? 0) > (current?.passiveValue ?? 0)) {
        entry.baseUid = w.uid;
      }
    }
  }

  // 2パス目：素材UIDを記録（極武器の余剰個体も素材に含める）
  for (const w of state.player.inventory) {
    const key = `${w.templateId}_${w.isBossDrop ? "1" : "0"}`;
    const entry = groupMap.get(key);
    if (!entry || !entry.baseUid) continue;
    if (w.uid === entry.baseUid) continue;
    if (lockedSet.has(String(w.uid))) continue;
    if (w.uid === equippedUid) continue;
    entry.materialUids.push(w.uid);
  }

  // グループごとに合成実行
  for (const [, entry] of groupMap) {
    if (!entry.baseUid || entry.materialUids.length === 0) continue;

    state.synthesis.baseUid = entry.baseUid;
    state.synthesis.materialUids = [...entry.materialUids];

    const success = executeSynthesis();
    if (success) {
      totalSynthed += entry.materialUids.length; // Bug #4修正：success確認後に加算
    }
  }

  return totalSynthed;
}

// =====================
// 武器自動合成ターゲット管理
// =====================
export function toggleAutoWeaponSynthTarget(uid) {
  const list = state.autoSynth.weaponUids;
  const idx = list.indexOf(uid);
  if (idx !== -1) {
    state.autoSynth.weaponUids = list.filter(u => u !== uid);
    return false; // 解除
  }
  if (list.length >= 4) return null; // 上限（4件）
  state.autoSynth.weaponUids.push(uid);
  return true; // 登録
}

export function isAutoWeaponSynthTarget(uid) {
  return (state.autoSynth?.weaponUids ?? []).includes(uid);
}

// =====================
// 武器自動合成（武器入手時に即呼び出す）
// =====================
export function tryAutoWeaponSynth(newWeapon) {
  const targets = state.autoSynth?.weaponUids ?? [];
  if (targets.length === 0) return;

  const lockedSet = getLockedSet();
  const equippedUid = state.player.equippedWeapon?.uid ?? null;

  // 入手した武器と同じグループに登録済み武器があるか確認
  const matchedBaseUid = targets.find((uid) => {
    const base = state.player.inventory.find(w => w.uid === uid);
    if (!base) return false;
    return base.templateId === newWeapon.templateId
      && !!base.isBossDrop === !!newWeapon.isBossDrop;
  });

  if (!matchedBaseUid) return;
  if (matchedBaseUid === newWeapon.uid) return;
  if (lockedSet.has(String(newWeapon.uid))) return;
  if (newWeapon.uid === equippedUid) return;

  state.synthesis.baseUid = matchedBaseUid;
  state.synthesis.materialUids = [newWeapon.uid];

  // executeSynthesis() 前にベース名を取得（呼び出し後はinventoryが差し替わるため）
  const baseName = state.player.inventory.find(w => w.uid === matchedBaseUid)?.name ?? "武器";
  const success = executeSynthesis();
  if (success) {
    addLog(`🔄 ${baseName} と自動合成した`);
  }
}