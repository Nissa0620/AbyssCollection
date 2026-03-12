import { state } from "./state.js";
import { createEnemy } from "./battle.js";
import { playerAttack, enemyAttack } from "./battle.js";
import { healPlayerFull, gainExp } from "./player.js";
import { saveGame } from "./saveLoad.js";
import { getExpMultiplier } from "./pet.js";
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
  if (result.type === "enemyTurn") {
    const enemyResult = enemyAttack();
    if (enemyResult.type === "gameover") {
      state.phase = "gameover";
    }
  }

  if (result.type === "victory") {
    const expMult = getExpMultiplier();
    gainExp(Math.floor(state.enemy.exp * expMult));
    healPlayerFull();
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
}

function gameOverPhase() {
  healPlayerFull();
  createEnemy();
  state.phase = "battle";
  state.surviveUsed = false;
  state.resurrectionUsed = false;
  state.legendEvadeActive = false;
}