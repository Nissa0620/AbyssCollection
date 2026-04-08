import { state } from "./state.js";
import { createEnemy } from "./battle.js";
import { showHiddenBossRewardModal } from "./ui.js";
import { playerAttack, enemyAttack } from "./battle.js";
import { healPlayerFull, gainExp } from "./player.js";
import { saveGame } from "./saveLoad.js";
import { getExpMultiplier, getExpBurstMultiplier, getLegendExpBurstMultiplier, calcOverflowBonuses } from "./pet.js";
import { addLog } from "./log.js";
import { checkAchievements } from "./achievements.js";
import { registerHiddenBossDefeated } from "./book.js";

export function handlePhase() {
  const prevPhase = state.phase;
  switch (state.phase) {
    case "battle":
      battlePhase();
      break;
    case "next":
      nextPhase();
      break;
    case "gameover":
      gameOverPhase();
      break;
  }
  if (prevPhase === "next" || prevPhase === "gameover" || state._floorJustChanged) {
    state._floorJustChanged = false;
    return "floorChanged";
  }
  return "battle";
}

function battlePhase() {
  const result = playerAttack();
  // 敵がいない状態でbattlePhaseに入った場合はnextPhaseへ移行
  if (result.type === "none") {
    nextPhase();
    return;
  }
  if (result.type === "enemyTurn") {
    const enemyResult = enemyAttack();
    if (enemyResult.type === "gameover") {
      state.phase = "gameover";
    }
  }

  if (result.type === "victory") {
    if (state.enemy?.isHiddenBoss) {
      // 経験値付与（通常フローと同様）
      const expMult        = getExpMultiplier();
      const burstMult      = getExpBurstMultiplier();
      const legendBurstMult = getLegendExpBurstMultiplier();
      const finalBurstMult = legendBurstMult > 1 ? legendBurstMult : burstMult;
      const researchExpBonus = state.research?.expBonus ?? 0;
      const finalExp = Math.floor(state.enemy.exp * expMult * finalBurstMult) + researchExpBonus;
      if (legendBurstMult > 1) addLog("✨✨ 経験値大爆発！取得経験値が5倍！");
      else if (burstMult > 1) addLog("✨ 経験値爆発！取得経験値が2倍！");
      gainExp(finalExp);
      healPlayerFull();

      const def  = state.enemy.hiddenBossDef;
      const pPow = state.enemy._petBasePower;
      const pHp  = state.enemy._petBaseHp;
      const wAtk = state.enemy._weaponBaseAtk;
      const wHp  = state.enemy._weaponBaseHp;
      const pval = state.enemy._dynamicPassiveValue;
      state.enemy = null;
      registerHiddenBossDefeated(def.id, def.name);
      showHiddenBossRewardModal(def, pPow, pHp, wAtk, wHp, pval);
      return;
    }

    const expMult = getExpMultiplier();
    const burstMult = getExpBurstMultiplier();
    const legendBurstMult = getLegendExpBurstMultiplier();
    // expBurstとlegendExpBurstは重複しない（legendExpBurstが優先）
    const finalBurstMult = legendBurstMult > 1 ? legendBurstMult : burstMult;
    const researchExpBonus = state.research?.expBonus ?? 0;
    const finalExp = Math.floor(state.enemy.exp * expMult * finalBurstMult) + researchExpBonus;
    if (legendBurstMult > 1) addLog("✨✨ 経験値大爆発！取得経験値が5倍！");
    else if (burstMult > 1) addLog("✨ 経験値爆発！取得経験値が2倍！");
    gainExp(finalExp);
    healPlayerFull();
    state.enemy = null;
    state.phase = "next";
  }
}

function nextPhase() {
  state._floorJustChanged = true; // ← フロア移動フラグ
  if (!state.ui.stayOnFloor) state.floor++;
  createEnemy();
  state.maxFloor = Math.max(state.maxFloor, state.floor);
  state.phase = "battle";
  checkAchievements();
  // 新しい戦闘開始時にsurviveUsedをリセット
  state.surviveUsed = false;
  state.resurrectionUsed = false;
  state.legendEvadeActive = false;
  state.legendReflectBonus = 0;
  state.legendDmgReduceTurn = 0;
  state.drainAtkBonus = 0;
  state.regenTurnCount = 0;
  state._triggerOverflowDmgBoost = 0;
  state._triggerOverflowHpBoost = 0;
  state._expBurstOverflowExpBoost = 0;
  calcOverflowBonuses(); // 超過分を装備スキル値から計算してstateに設定
  saveGame(); // フロア移動完了時のみ保存
}

function gameOverPhase() {
  healPlayerFull();
  createEnemy();
  state.phase = "battle";
  state.surviveUsed = false;
  state.resurrectionUsed = false;
  state.legendEvadeActive = false;
  state.legendReflectBonus = 0;
  state.legendDmgReduceTurn = 0;
  state.drainAtkBonus = 0;
  state.regenTurnCount = 0;
  state._triggerOverflowDmgBoost = 0;
  state._triggerOverflowHpBoost = 0;
  state._expBurstOverflowExpBoost = 0;
  calcOverflowBonuses(); // 超過分を装備スキル値から計算してstateに設定
  saveGame(); // ゲームオーバー時も保存（HP全快のタイミングで記録）
}