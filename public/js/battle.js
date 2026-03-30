// 戦闘ロジック

import { getDropWeapon } from "./drop.js";
import { rollBossGems } from "./data/gems.js";
import { normalEnemies, bossEnemies, floorTable, enemyTitles, bossTitles, bossFloorMap, legendaryTitles, getCurrentAreaKey } from "./data/index.js";
import { state } from "./state.js";
import { addLog, clearLogs } from "./log.js";
import { saveGame } from "./saveLoad.js";
import { registerEnemyDefeated, registerEnemySeen, updateBookUltimate, updateWeaponBookUltimate } from "./book.js";
import { isUltimateWeapon } from "./drop.js";
import { showUltimatePopup, showElitePopup, showLegendaryPopup, showLegendUltimatePopup, showHiddenBossPopup } from "./ui.js";
import { hiddenBossDefs } from "./hiddenBossData.js";
import { checkAchievements } from "./achievements.js";
import { registerWeaponDropped } from "./weaponBook.js";
import { tryCatch, hasDoubleAttack, hasTripleAttack, hasSurvivePassive, hasLegendSurvive, hasResurrection, hasLegendResurrection, getDropMultiplier, getDmgBoostMultiplier, getDmgReduceMultiplier, getReflectDamage, getLegendReflectDamage, getDrainHeal, getLegendDrainHeal, getCritMultiplier, getGiantKillerMultiplier, getBossSlayerMultiplier, tryEvade, getLastStandMultiplier, getLegendLastStandMultiplier, getRegenHeal } from "./pet.js";

let enemy;

// 外部から取得
export function getEnemy() {
  return enemy;
}

function applyDamage(attacker, target) {
  const min = Math.floor(attacker.totalPower * 0.6);
  const max = attacker.totalPower;
  const damage = Math.floor(Math.random() * (max - min + 1)) + min;

  target.hp -= damage;
  if (target.hp < 0) target.hp = 0;

  return damage;
}

export function playerAttack() {
  if (!state.enemy) return { type: "none" };

  // 各種倍率を計算
  const dmgMult = getDmgBoostMultiplier();
  const critMult = getCritMultiplier();
  const giantMult = getGiantKillerMultiplier();
  const bossMult = getBossSlayerMultiplier();
  const lastStandMult = Math.max(getLastStandMultiplier(), getLegendLastStandMultiplier());
  const totalMult = dmgMult * critMult * giantMult * bossMult * lastStandMult;

  let damage = applyDamage(state.player, state.enemy);
  damage = Math.floor(damage * totalMult);
  state.enemy.hp -= Math.floor(damage * (totalMult - 1));
  if (state.enemy.hp < 0) state.enemy.hp = 0;

  const critText = critMult > 1 ? " ⚡クリティカル！" : "";
  addLog("▶ " + damage + " ダメージ" + critText);

  // ドレイン（通常 + 吸血鬼）
  const heal = getDrainHeal(damage);
  if (heal > 0) {
    state.player.hp = Math.min(state.player.hp + heal, state.player.totalHp);
    addLog("💚 吸収で " + heal + " 回復！");
  }
  // 吸血鬼：オーバーヒール分をATKボーナスに変換（1ターンのみ）
  state.drainAtkBonus = 0; // 毎攻撃リセット
  const legendHeal = getLegendDrainHeal(damage);
  if (legendHeal > 0) {
    const before = state.player.hp;
    state.player.hp = Math.min(state.player.hp + legendHeal, state.player.totalHp);
    const actualHeal = state.player.hp - before;
    const overflow = legendHeal - actualHeal;
    if (overflow > 0) {
      state.drainAtkBonus = overflow;
      addLog("💚 吸血で " + actualHeal + " 回復！ATK +" + overflow + "（次の攻撃のみ）");
    } else {
      addLog("💚 吸血で " + legendHeal + " 回復！");
    }
  }

  // 2回攻撃 or 3回攻撃（連撃王）
  const attackCount = hasTripleAttack() ? 2 : (hasDoubleAttack() ? 1 : 0);
  for (let i = 0; i < attackCount && state.enemy.hp > 0; i++) {
    let dmg = applyDamage(state.player, state.enemy);
    dmg = Math.floor(dmg * totalMult);
    state.enemy.hp -= Math.floor(dmg * (totalMult - 1));
    if (state.enemy.hp < 0) state.enemy.hp = 0;
    addLog("▶ " + (i === 0 && attackCount === 1 ? "2回目" : `${i + 2}回目`) + " " + dmg + " ダメージ");
    const h = getDrainHeal(dmg);
    if (h > 0) {
      state.player.hp = Math.min(state.player.hp + h, state.player.totalHp);
      addLog("💚 " + h + " 回復！");
    }
    const lh = getLegendDrainHeal(dmg);
    if (lh > 0) {
      const before2 = state.player.hp;
      state.player.hp = Math.min(state.player.hp + lh, state.player.totalHp);
      const actualHeal2 = state.player.hp - before2;
      const overflow2 = lh - actualHeal2;
      if (overflow2 > 0) {
        state.drainAtkBonus = (state.drainAtkBonus ?? 0) + overflow2;
        addLog("💚 吸血で " + actualHeal2 + " 回復！ATK +" + overflow2 + "（次の攻撃のみ）");
      } else {
        addLog("💚 " + lh + " 回復！");
      }
    }
  }

  if (state.enemy.hp <= 0) {
    defeatEnemy();
    return { type: "victory" };
  }
  return { type: "enemyTurn" };
}

export function enemyAttack() {
  if (!state.enemy) return { type: "none" };

  // 再生
  const regenHeal = getRegenHeal();
  if (regenHeal > 0) {
    state.player.hp = Math.min(state.player.hp + regenHeal, state.player.totalHp);
    addLog("💚 再生で " + regenHeal + " 回復");
  }

  // 幻影：前ターンに完全無敵が発動中なら無効化
  if (state.legendEvadeActive) {
    state.legendEvadeActive = false;
    addLog("✨ 幻影の加護で攻撃を無効化！");
    return { type: "battle" };
  }

  // 回避判定（evade・legendEvade を合算、上限70%）
  if (tryEvade()) {
    const hasLegendEvade =
      state.player.equippedPet?.passive === "legendEvade" ||
      state.player.equippedWeapon?.passive === "legendEvade";
    addLog(hasLegendEvade ? "✨ 幻影で回避！次のターンも無敵！" : "✨ 回避！");
    return { type: "battle" };
  }

  // 鉄壁：3ターンに1回ダメージ無効化
  const _pet = state.player.equippedPet;
  const _weapon = state.player.equippedWeapon;
  const hasLegendDmgReduce = _pet?.passive === "legendDmgReduce" || _weapon?.passive === "legendDmgReduce";
  if (hasLegendDmgReduce) {
    state.legendDmgReduceTurn = (state.legendDmgReduceTurn ?? 0) + 1;
    if (state.legendDmgReduceTurn >= 3) {
      state.legendDmgReduceTurn = 0;
      addLog("🛡️ 鉄壁の加護でダメージを無効化！");
      return { type: "battle" };
    }
  }

  let damage = applyDamage(state.enemy, state.player);

  // 被ダメ減少
  const reduceMult = getDmgReduceMultiplier();
  if (reduceMult < 1) {
    const reduced = Math.floor(damage * reduceMult);
    const diff = damage - reduced;
    state.player.hp = Math.min(state.player.hp + diff, state.player.totalHp);
    damage = reduced;
  }

  addLog("◀ " + state.enemy.name + "の攻撃 " + damage + " ダメージ");

  // 反射（通常 + 鏡盾100%）
  const reflectDmg = getReflectDamage(damage);
  const legendReflectDmg = getLegendReflectDamage(damage);
  if (reflectDmg > 0) {
    state.enemy.hp = Math.max(0, state.enemy.hp - reflectDmg);
    addLog("🔄 " + reflectDmg + " ダメージを反射！");
    if (state.enemy.hp <= 0) {
      defeatEnemy();
      return { type: "victory" };
    }
  }
  if (legendReflectDmg > 0) {
    state.enemy.hp = Math.max(0, state.enemy.hp - legendReflectDmg);
    addLog("🔄 " + legendReflectDmg + " ダメージを鏡盾で反射！");
    if (state.enemy.hp <= 0) {
      defeatEnemy();
      return { type: "victory" };
    }
  }

  if (state.player.hp <= 0) {
    // 転生（複数回HP50%復活）
    if (hasLegendResurrection()) {
      state.player.hp = Math.floor(state.player.totalHp * 0.5);
      addLog("✨ 転生でHP50%で復活！");
      return { type: "battle" };
    }
    // 不屈（1戦1回HP50%復活）
    if (hasResurrection() && !state.resurrectionUsed) {
      state.player.hp = Math.floor(state.player.totalHp * 0.5);
      state.resurrectionUsed = true;
      addLog("💫 不屈でHP50%で復活！");
      return { type: "battle" };
    }
    // 不死身（確率で1HP耐え、回数制限なし・上限80%）
    if (hasLegendSurvive()) {
      state.player.hp = 1;
      addLog("💀 不死身で生き残った！");
      return { type: "battle" };
    }
    // 通常survive（1戦1回1HP）
    if (hasSurvivePassive() && !state.surviveUsed) {
      state.player.hp = 1;
      state.surviveUsed = true;
      addLog("🛡️ 根性で生き残った！");
      return { type: "battle" };
    }
    addLog("ゲームオーバー...");
    return { type: "gameover" };
  }
  return { type: "battle" };
}

function defeatEnemy() {
  // 隠しボスは gameFlow.js 側で専用処理をするため、ここでは何もしない
  if (state.enemy?.isHiddenBoss) return;

  addLog(state.enemy.name + " を撃破");
  registerEnemyDefeated(state.enemy.enemyId, state.enemy.titleId, state.enemy.baseName, state.enemy.titleName, state.enemy.isBoss, state.enemy.name);

  // 捕獲判定
  tryCatch(state.enemy.enemyId, state.enemy.isBoss, state.enemy.titleId, state.enemy.isLegendary ?? false, state.enemy.isLegendUltimate ?? false, state.enemy.isElite ?? false);

  // ドロップ判定（ドロップ率上昇パッシブを反映）
  const isBoss = state.enemy.isBoss;
  const dropMult = getDropMultiplier();

  if (isBoss) {
    // ボス：宝玉をドロップ
    const gems = rollBossGems(state.floor);
    if (!state.player.gems) state.player.gems = [];
    gems.forEach((gem) => {
      state.player.gems.push(gem);
      addLog("💎 " + gem.icon + gem.name + " を手に入れた！(ATK +" + gem.atkBonus + ")");
    });
  } else {
    // 通常敵：武器をドロップ
    const dropped = getDropWeapon(dropMult, state.enemy.enemyId);
    if (dropped) {
      state.player.inventory.push(dropped);
      addLog("⚔️ " + dropped.name + " を手に入れた");
      registerWeaponDropped(dropped.templateId, false);
      updateWeaponBookUltimate();
      if (isUltimateWeapon(dropped)) {
        const alreadyHas = state.player.inventory
          .filter((w) => w.uid !== dropped.uid)
          .some((w) => w.templateId === dropped.templateId && !!w.isBossDrop === !!dropped.isBossDrop && isUltimateWeapon(w));
        if (!state.achievements) state.achievements = {};
        state.achievements.ultimateWeaponCount = (state.achievements.ultimateWeaponCount ?? 0) + 1;
        if (!alreadyHas) showUltimatePopup(dropped, "weapon");
      }
    } else {
      addLog("何も落ちなかった...");
    }
  }
  checkAchievements();
  saveGame();
}

function getCurrentArea(floor) {
  return Object.values(floorTable).find(
    (band) => band.min != null && floor >= band.min && floor <= band.max
  ) ?? null;
}

// 重み付きで1つ選ぶ
function pickWeighted(items, getWeight) {
  const total = items.reduce((sum, it) => sum + getWeight(it), 0);
  if (total <= 0) return null;

  let r = Math.random() * total;
  for (const it of items) {
    r -= getWeight(it);
    if (r < 0) return it;
  }
  return items[items.length - 1] ?? null;
}

export function getRandomTitleForEnemy(titleGroup) {
  const fallbackGroup = Object.values(enemyTitles)[0] ?? [];
  const group = enemyTitles[titleGroup] ?? fallbackGroup;
  if (group.length === 0) return fallbackGroup[0];
  return pickWeighted(group, (t) => t.weight ?? 1);
}

export function createEnemy() {
  // ボスフロア判定
  const bossEnemyId = bossFloorMap[state.floor];
  if (bossEnemyId) {
    return createBossEnemy(bossEnemyId);
  }

  // 解禁済み隠しボスを収集し、0.1% で出現させる
  const unlockedHiddenBosses = hiddenBossDefs.filter(
    def => state.research?.[def.unlockKey]
  );
  if (unlockedHiddenBosses.length > 0 && Math.random() < 0.001) {
    const def = unlockedHiddenBosses[
      Math.floor(Math.random() * unlockedHiddenBosses.length)
    ];
    return createHiddenBossEnemy(def);
  }

  const area = getCurrentArea(state.floor);
  if (!area) {
    console.error("対応するフロアテーブルがありません");
    return null;
  }

  const floorBandKey = getCurrentAreaKey(state.floor);
  const possibleEnemies = normalEnemies.filter((e) => e.floorBand === floorBandKey);
  const base = possibleEnemies[Math.floor(Math.random() * possibleEnemies.length)];

  // レジェンダリー出現判定（0.5%）、究極個体（0.5%）、極個体（2%）※各種別は独立して抽選
  const isLegendary      = !!(base.passive && legendaryTitles[base.passive] && Math.random() < 0.005);
  const isLegendUltimate = !isLegendary && !!(base.passive && legendaryTitles[base.passive] && Math.random() < 0.005);
  const isElite          = !isLegendary && !isLegendUltimate && Math.random() < 0.02;

  // フロア帯基準値 × 敵比率
  const band = floorTable[base.floorBand] ?? floorTable["1-99"];
  const titleGroup = base.titleGroup ?? band.titleGroup;

  // 次のボスフロアを特定（フロア帯の max + 1 がボスフロア）
  const nextBossFloor = band.max + 1;
  const nextBossBandKey = `boss-${nextBossFloor}`;
  const nextBossBand = floorTable[nextBossBandKey];

  let totalHp, totalPower;

  let title, titleId, titleName;
  if (isLegendary || isLegendUltimate) {
    const legend = legendaryTitles[base.passive];
    title = legend;
    titleId = 5;
    titleName = legend.name;
  } else if (isElite) {
    // 極個体は称号4（最高ランク）を強制
    const group = enemyTitles[titleGroup] ?? Object.values(enemyTitles)[0];
    title = group.find((t) => t.id === 4) ?? group[group.length - 1];
    titleId = title.id;
    titleName = title.name;
  } else {
    title = getRandomTitleForEnemy(titleGroup);
    titleId = title.id;
    titleName = title.name;
  }

  if (nextBossBand) {
    // 次のボスHP・ATKを計算
    const bossHp  = Math.floor(nextBossBand.baseHp    * (1 + nextBossFloor * 0.5));
    const bossAtk = Math.floor(nextBossBand.basePower * (1 + nextBossFloor * 0.6));

    // フロア帯内での位置（0.0〜1.0）に応じて比率を線形補間
    const bandStart = band.min;
    const bandEnd   = band.max;
    const t = (state.floor - bandStart) / Math.max(1, bandEnd - bandStart);

    // 1-99F帯のみ低い比率でスタート（チュートリアル帯）
    const isFirstBand = bandStart === 1;
    const ratioStart = isFirstBand ? 0.005 : 1.80;
    const ratioEnd   = isFirstBand ? 0.05  : 3.00;
    const statRatio  = ratioStart + t * (ratioEnd - ratioStart);

    totalHp    = Math.floor(bossHp  * statRatio * (base.hpRate    ?? 1.0) * title.hpRate);
    totalPower = Math.floor(bossAtk * statRatio * (base.powerRate ?? 1.0) * title.atkRate);
  } else {
    // ボス情報が取得できない場合のフォールバック（既存ロジック）
    const bossBonus = Math.floor(state.floor / 10) * 3;
    const hpScale = 1 + state.floor * 0.3 + bossBonus;
    const atkScale = 1 + state.floor * 0.4 + bossBonus;
    const baseHp = Math.floor(band.baseHp * (base.hpRate ?? 1.0));
    const basePower = Math.floor(band.basePower * (base.powerRate ?? 1.0));
    totalHp = Math.floor(baseHp * hpScale * title.hpRate);
    totalPower = Math.floor(basePower * atkScale * title.atkRate);
  }

  const enemyExp =
    Math.floor((5 + state.floor * 5) * 1.5 * title.expRate) +
    Math.floor(state.floor / 50) * 200;

  state.enemy = {
    enemyId: base.id,
    titleId,
    name: `${titleName}・深淵の${base.name}`,
    baseName: base.name,
    titleName,
    totalHp,
    hp: totalHp,
    totalPower,
    exp: enemyExp,
    isBoss: false,
    isLegendary,
    isLegendUltimate,
    isElite,
  };

  if (!isLegendary && !isLegendUltimate) {
    state.enemy.name = `${titleName}${base.name}`;
  }

  clearLogs();
  registerEnemySeen(base.id, base.name, false);
  if (isLegendUltimate) {
    addLog("🔴【究極個体】" + state.enemy.name + " が出現した！");
    showLegendUltimatePopup({ name: state.enemy.name, passive: base.passive, isBoss: false }, "appear");
  } else if (isLegendary) {
    addLog("✨【伝説】" + state.enemy.name + " が出現した！");
    showLegendaryPopup({ name: state.enemy.name, passive: base.passive, isBoss: false }, "appear");
  } else if (isElite) {
    addLog("⭐【極個体】" + state.enemy.name + " が出現した！");
    showElitePopup({ name: state.enemy.name }, "appear");
  } else {
    addLog(state.enemy.name + " が出現した！");
  }
  return state.enemy;
}

function createHiddenBossEnemy(def) {
  // maxFloor 以下で最大のボスフロアを特定
  const bossFloors = Object.keys(bossFloorMap).map(Number).sort((a, b) => a - b);
  const targetFloor = bossFloors.filter(f => f <= state.maxFloor).at(-1) ?? bossFloors[0];
  const bossBandKey = `boss-${targetFloor}`;
  const bossBand = floorTable[bossBandKey];

  // 強度：対応ボスの5倍
  const hpScale    = 1 + targetFloor * 0.5;
  const atkScale   = 1 + targetFloor * 0.6;
  const totalHp    = Math.floor(bossBand.baseHp    * hpScale * 5);
  const totalPower = Math.floor(bossBand.basePower * atkScale * 5);

  // ペットのbasePower/baseHp
  const petBasePower = Math.floor(bossBand.petPower.max * 3.0);
  const petBaseHp    = Math.floor(bossBand.petHp.max   * 3.0);

  // 武器のbaseAtk/baseHp
  const weaponBaseAtk = Math.floor((bossBand.petPower.min + bossBand.petPower.max) / 2 * 0.10);
  const weaponBaseHp  = Math.floor(bossBand.petHp.max * 1.4);

  // passiveValue
  const dynamicPassiveValue = Math.floor(bossBand.passiveValue.buff.max * 2.0);

  // 経験値
  const hiddenBossExp = Math.floor((5 + targetFloor * 10) * 2.0 * 3);

  state.enemy = {
    enemyId:       def.id,
    name:          def.name,
    baseName:      def.name,
    titleId:       null,
    titleName:     "",
    totalHp,
    hp:            totalHp,
    totalPower,
    exp:           hiddenBossExp,
    isBoss:        true,
    isHiddenBoss:  true,
    hiddenBossId:  def.id,
    hiddenBossDef: def,
    _petBasePower:        petBasePower,
    _petBaseHp:           petBaseHp,
    _weaponBaseAtk:       weaponBaseAtk,
    _weaponBaseHp:        weaponBaseHp,
    _dynamicPassiveValue: dynamicPassiveValue,
  };

  clearLogs();
  addLog(`💀【隠しボス】${def.name}が現れた！`);
  showHiddenBossPopup(def);
  return state.enemy;
}

function createBossEnemy(bossEnemyId) {
  const base = bossEnemies.find((e) => e.id === bossEnemyId);
  if (!base) return null;

  // レジェンダリー出現判定（0.25%）、究極個体（0.25%）、極個体（1%）※各種別は独立して抽選
  const isLegendary      = !!(base.passive && legendaryTitles[base.passive] && Math.random() < 0.0025);
  const isLegendUltimate = !isLegendary && !!(base.passive && legendaryTitles[base.passive] && Math.random() < 0.0025);
  const isElite          = !isLegendary && !isLegendUltimate && Math.random() < 0.01;

  // フロア帯基準値 × 敵比率（titleGroupの参照より先に宣言）
  const band = floorTable[base.floorBand];
  const titleGroup = base.titleGroup ?? band.titleGroup;

  let title, titleId, titleName;
  if (isLegendary || isLegendUltimate) {
    const legend = legendaryTitles[base.passive];
    title = legend;
    titleId = 5;
    titleName = legend.name;
  } else if (isElite) {
    // 極個体は称号4（最高ランク）を強制
    const titlePool = bossTitles[titleGroup] ?? [];
    title = titlePool.find((t) => t.id === 4) ?? titlePool[titlePool.length - 1];
    titleId = title.id;
    titleName = title.name;
  } else {
    const titlePool = bossTitles[titleGroup] ?? [];
    title = pickWeighted(titlePool, (t) => t.weight ?? 1) ?? titlePool[0];
    titleId = title.id;
    titleName = title.name;
  }

  const hpScale = 1 + state.floor * 0.5;
  const atkScale = 1 + state.floor * 0.6;
  const baseHp = Math.floor(band.baseHp * (base.hpRate ?? 1.0));
  const basePower = Math.floor(band.basePower * (base.powerRate ?? 1.0));

  const totalHp = Math.floor(baseHp * hpScale * title.hpRate);
  const totalPower = Math.floor(basePower * atkScale * title.atkRate);
  const enemyExp = Math.floor((5 + state.floor * 10) * 2.0 * title.expRate);

  const displayName = (isLegendary || isLegendUltimate)
    ? `${titleName}・支配者の${base.name}`
    : `${titleName}${base.name}`;

  state.enemy = {
    enemyId: base.id,
    titleId,
    name: displayName,
    baseName: base.name,
    titleName,
    totalHp,
    hp: totalHp,
    totalPower,
    exp: enemyExp,
    isBoss: true,
    isLegendary,
    isLegendUltimate,
    isElite,
  };
  clearLogs();
  registerEnemySeen(base.id, base.name, true);
  if (isLegendUltimate) {
    addLog("🔴【究極個体ボス】" + state.enemy.name + " が出現した！");
    showLegendUltimatePopup({ name: state.enemy.name, passive: base.passive, isBoss: true }, "appear");
  } else if (isLegendary) {
    addLog("✨⚠️【伝説ボス】" + state.enemy.name + " が出現した！");
    showLegendaryPopup({ name: state.enemy.name, passive: base.passive, isBoss: true }, "appear");
  } else if (isElite) {
    addLog("⭐⚠️【極個体ボス】" + state.enemy.name + " が出現した！");
    showElitePopup({ name: state.enemy.name, isBoss: true }, "appear");
  } else {
    addLog("⚠️ ボス " + state.enemy.name + " が出現した！");
  }
  return state.enemy;
}