import { basePlayer } from "./data/index.js";

export const state = {
  floor: 1,
  maxFloor: 1,
  phase: "start",
  enemy: null,
  logs: [],
  player: {
    ...basePlayer,
    level: 1,
    exp: 0,
    nextExp: 100,
    hp: basePlayer.baseHp,
    inventory: [],
    equippedWeapon: null,
    petList: [],
    equippedPet: null,
    gems: [],

    get totalPower() {
      const pet = state.player.equippedPet;
      const weapon = state.player.equippedWeapon;
      const petPower = pet?.power ?? 0;
      const petMult = (pet?.passive === "atkBoost" || pet?.passive === "legendAtkBoost")
        ? 1 + (pet.passiveValue / 100) : 1;
      const weaponMult = (weapon?.passive === "atkBoost" || weapon?.passive === "legendAtkBoost")
        ? 1 + (weapon.passiveValue / 100) : 1;
      const gemBonus = (state.player.gems ?? []).reduce((sum, g) => sum + (g.atkBonus ?? 0), 0);
      const dexMultiplier = 1 + (state.dexBuff.power - 1) + (state.weaponDexBuff.power - 1);
      return Math.floor(
        (this.basePower + (weapon ? weapon.totalAtk : 0) + petPower + gemBonus) *
        dexMultiplier *
        petMult *
        weaponMult
      );
    },

    get totalHp() {
      const buff = (1 + (state.dexBuff.hp - 1) + (state.weaponDexBuff.hp - 1)) * (state.hpBoostMult ?? 1);
      const petHp = Math.floor((state.player.equippedPet?.hp ?? 0) * buff);
      const weaponHp = Math.floor((state.player.equippedWeapon?.totalHp ?? 0) * buff);
      return Math.floor(this.baseHp * buff) + petHp + weaponHp;
    },
  },
  dexBuff: {
    hp: 1,
    power: 1,
  },
  weaponDexBuff: {
    hp: 1,
    power: 1,
  },
  book: {
    enemies: {},
    weapons: {},
  },
  ui: {
    inventoryOpen: false,
    petOpen: false,
    sortMode: "passive",
    petSortMode: "passive",
    inventoryFilter: "",
    petFilter: "",
    inventoryTab: "weapon",
    stayOnFloor: false,
    petGroupSort: "acquiredDesc",
    weaponGroupSort: "acquiredDesc",
    petOpenGroups: {},
    weaponOpenGroups: {},
  },
  synthesisMode: false,
  synthesis: {
    baseUid: null,
    materialUids: [],
  },
  petSynthesis: {
    baseUid: null,
    materialUids: [],
  },
  surviveUsed: false,
  resurrectionUsed: false,
  legendEvadeActive: false,
  legendSurviveCount: 0,
  isHolding: null, // main.jsから設定されるコールバック（長押し判定用）
  lastSelectedFloor: 1,
  acquiredCounter: 0,
  migrated: {},
  hpBoostMult: 1,
  playerName: null,
  lastRankingSentAt: 0,
  lastRankingData: null,
  achievements: {
    unlocked: {},
    weaponSynthCount: 0,
    petSynthCount: 0,
    ultimatePetCount: 0,
    ultimateWeaponCount: 0,
  },
};