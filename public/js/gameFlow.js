import { state } from "./state.js";
import { createEnemy } from "./battle.js";
import { playerAttack, enemyAttack } from "./battle.js";
import { healPlayerFull, gainExp } from "./player.js";
import { saveGame } from "./saveLoad.js";
import { getExpMultiplier, getExpBurstMultiplier, getLegendExpBurstMultiplier } from "./pet.js";
import { addLog } from "./log.js";
import { checkAchievements } from "./achievements.js";

export function handlePhase() {
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
  saveGame();
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
    const expMult = getExpMultiplier();
    const burstMult = getExpBurstMultiplier();
    const legendBurstMult = getLegendExpBurstMultiplier();
    // expBurstとlegendExpBurstは重複しない（legendExpBurstが優先）
    const finalBurstMult = legendBurstMult > 1 ? legendBurstMult : burstMult;
    const finalExp = Math.floor(state.enemy.exp * expMult * finalBurstMult);
    if (legendBurstMult > 1) addLog("✨✨ 経験値大爆発！取得経験値が5倍！");
    else if (burstMult > 1) addLog("✨ 経験値爆発！取得経験値が2倍！");
    gainExp(finalExp);
    healPlayerFull();
    state.enemy = null;
    state.phase = "next";
  }
}

function nextPhase() {
  if (!state.ui.stayOnFloor) state.floor++;
  createEnemy();
  state.maxFloor = Math.max(state.maxFloor, state.floor);
  state.phase = "battle";
  checkAchievements();
  // 新しい戦闘開始時にsurviveUsedをリセット
  state.surviveUsed = false;
  state.resurrectionUsed = false;
  state.legendEvadeActive = false;
  state.legendSurviveCount = 0;
  state.legendReflectBonus = 0;
  state.legendDmgReduceTurn = 0;
  state.drainAtkBonus = 0;
  state.regenTurnCount = 0;
}

function gameOverPhase() {
  healPlayerFull();
  createEnemy();
  state.phase = "battle";
  state.surviveUsed = false;
  state.resurrectionUsed = false;
  state.legendEvadeActive = false;
  state.legendSurviveCount = 0;
  state.legendReflectBonus = 0;
  state.legendDmgReduceTurn = 0;
  state.drainAtkBonus = 0;
  state.regenTurnCount = 0;
}