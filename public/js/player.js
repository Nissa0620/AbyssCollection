import { state } from "./state.js";

export function gainExp(amount) {
  const player = state.player;

  player.exp += amount;
  state.logs.push(`経験値を${amount}手に入れた`);
  while (player.exp >= player.nextExp) {
    player.exp -= player.nextExp;
    levelUp();
  }
}

function levelUp() {
  const player = state.player;

  player.level += 1;
  player.nextExp = Math.floor(player.nextExp * 1.01);

  player.baseHp += Math.floor(player.level * 0.6);
  player.basePower += Math.floor(player.level * 0.4);

  state.logs.push(`Lv.${player.level}にレベルアップした `);
}

export function healPlayerFull() {
  state.player.hp = state.player.totalHp;
}