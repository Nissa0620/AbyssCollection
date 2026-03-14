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
      return Math.floor(
        (this.basePower + (weapon ? weapon.totalAtk : 0) + petPower + gemBonus) *
        state.dexBuff.power *
        state.weaponDexBuff.power *
        petMult *
        weaponMult
      );
    },

    get totalHp() {
      const buff = state.dexBuff.hp * state.weaponDexBuff.hp * (state.hpBoostMult ?? 1);
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
  hpBoostMult: 1,
  achievements: {
    unlocked: {},
    weaponSynthCount: 0,
    petSynthCount: 0,
    ultimatePetCount: 0,
    ultimateWeaponCount: 0,
  },
};