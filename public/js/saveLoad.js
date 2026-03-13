import { state } from "./state.js";
import { recalcDexBuff, recalcWeaponDexBuff } from "./dexBuff.js";
import { getHpBoostMultiplier } from "./pet.js";

const SAVE_KEY = "abyssSave";

export function saveGame() {
  state.lastSaveTime = Date.now();
  localStorage.setItem(SAVE_KEY, JSON.stringify(state));
}

export function loadGame() {
  const data = localStorage.getItem(SAVE_KEY);
  if (!data) return false;

  const parsed = JSON.parse(data);
  Object.assign(state, parsed);
  state.player = {
    ...state.player,
    get totalPower() {
      const pet = state.player.equippedPet;
      const weapon = state.player.equippedWeapon;
      const petPower = pet?.power ?? 0;
      const petMult = (pet?.passive === "atkBoost") ? 1 + (pet.passiveValue / 100) : 1;
      const weaponMult = (weapon?.passive === "atkBoost") ? 1 + (weapon.passiveValue / 100) : 1;
      const gemBonus = (state.player.gems ?? []).reduce((sum, g) => sum + (g.atkBonus ?? 0), 0);
      return Math.floor(
        (this.basePower + (weapon ? weapon.totalAtk : 0) + petPower + gemBonus) *
        state.dexBuff.power *
        state.weaponDexBuff.power *
        petMult *
        weaponMult
      );
    },
    get totalHp() {
      const buff = state.dexBuff.hp * state.weaponDexBuff.hp * state.hpBoostMult;
      const petHp = Math.floor((state.player.equippedPet?.hp ?? 0) * buff);
      const weaponHp = Math.floor((state.player.equippedWeapon?.totalHp ?? 0) * buff);
      return Math.floor(this.baseHp * buff) + petHp + weaponHp;
    },
  };

  // 古いセーブデータ対応：gemsが無ければ初期化
  if (!state.player.gems) {
    state.player.gems = [];
  }

  // 古いセーブデータ対応：有効でないフィルター値をリセット
  const validPassives = new Set([
    "", "captureBoost", "expBoost", "atkBoost", "dropBoost",
    "dmgBoost", "dmgReduce", "hpBoost", "doubleAttack", "survive",
    "reflect", "drain", "critRate", "critDamage", "extraHit",
    "giantKiller", "bossSlayer", "evade", "lastStand", "regen", "resurrection",
    "legendCaptureBoost", "legendExpBoost", "legendAtkBoost", "legendDropBoost",
    "legendDmgBoost", "legendDmgReduce", "legendHpBoost", "tripleAttack",
    "legendSurvive", "legendReflect", "legendDrain", "legendCritRate",
    "legendCritDamage", "legendExtraHit", "legendGiantKiller", "legendBossSlayer",
    "legendEvade", "legendLastStand", "legendRegen", "legendResurrection",
  ]);
  if (!validPassives.has(state.ui?.inventoryFilter)) {
    if (state.ui) state.ui.inventoryFilter = "";
  }
  if (!validPassives.has(state.ui?.petFilter)) {
    if (state.ui) state.ui.petFilter = "";
  }

  // 古いセーブデータ対応：achievementsが無ければ初期化
  if (!state.achievements) {
    state.achievements = {
      unlocked: {},
      weaponSynthCount: 0,
      petSynthCount: 0,
      ultimatePetCount: 0,
      ultimateWeaponCount: 0,
    };
  }
  // 古いセーブデータ対応：バフを再計算して正しい値に上書き
  recalcDexBuff(state);
  recalcWeaponDexBuff(state);
  state.hpBoostMult = getHpBoostMultiplier();

  return true;
}