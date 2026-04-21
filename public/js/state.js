import { basePlayer } from "./data/index.js";

// ペットATK/HP計算（pet.jsとの循環依存を避けるためインライン定義）
const _PET_K_ATK = 7.5 / Math.sqrt(15);
const _PET_K_HP  = 4.5 / Math.sqrt(15);
function _petPower(pet) {
  const lv = pet.level ?? 0;
  const mult = lv <= 15 ? (1 + lv * 0.5) : (1 + Math.sqrt(lv) * _PET_K_ATK);
  return Math.floor(pet.basePower * mult);
}
function _petHp(pet) {
  const lv = pet.level ?? 0;
  const mult = lv <= 15 ? (1 + lv * 0.3) : (1 + Math.sqrt(lv) * _PET_K_HP);
  return Math.floor((pet.baseHp ?? 0) * mult);
}

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
    gems: { copper: 0, silver: 0, gold: 0 },

    get totalPower() {
      const pet = state.player.equippedPet;
      const weapon = state.player.equippedWeapon;
      const petPower = pet ? _petPower(pet) : 0;
      let atkBoostTotal = 0;
      if (pet?.passive === "atkBoost" || pet?.passive === "legendAtkBoost") atkBoostTotal += (pet.passiveValue ?? 0);
      if (weapon?.passive === "atkBoost" || weapon?.passive === "legendAtkBoost") atkBoostTotal += (weapon.passiveValue ?? 0);
      const atkBoostMult = 1 + atkBoostTotal / 100;
      const gemBonus = state.gemAtkBonus ?? 0;
      const dexMultiplier = 1 + (state.dexBuff.power - 1) + (state.weaponDexBuff.power - 1);
      return Math.floor(
        (this.basePower + (weapon ? weapon.totalAtk : 0) + petPower + gemBonus) *
        dexMultiplier *
        atkBoostMult
      ) + (state.drainAtkBonus ?? 0)
        + (state.research?.atkBonus ?? 0);
    },

    get totalHp() {
      const buff = (1 + (state.dexBuff.hp - 1) + (state.weaponDexBuff.hp - 1)) * (state.hpBoostMult ?? 1);
      const overflowHpBoost = 1 + (state._triggerOverflowHpBoost ?? 0) / 100;
      const petHp = state.player.equippedPet
        ? Math.floor(_petHp(state.player.equippedPet) * buff)
        : 0;
      const weaponHp = Math.floor((state.player.equippedWeapon?.totalHp ?? 0) * buff);
      return Math.floor(this.baseHp * buff * overflowHpBoost) + petHp + weaponHp
        + (state.research?.hpBonus ?? 0);
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
    hiddenBosses: {},
  },
  ui: {
    inventoryOpen: false,
    petOpen: false,
    sortMode: "passive",
    petSortMode: "passive",
    inventoryFilter: "",
    petFilter: "",
    inventoryNameFilter: "",
    petNameFilter: "",
    bookNameFilter: "",
    inventoryTab: "weapon",
    stayOnFloor: false,
    petGroupSort: "acquiredDesc",
    weaponGroupSort: "acquiredDesc",
    petOpenGroups: {},
    weaponOpenGroups: {},
    showAppearModal: true,   // 出現モーダル表示設定
    showCaptureModal: true,  // 捕獲モーダル表示設定
    includeRareInSelectAll: false, // 一括選択にレア個体を含めるか
    showHiddenBossModal: true, // 隠しボス出現演出を表示するか
    skipNonRareDrop: false, // レア・極以外を拾わない
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
  autoSynth: {
    petUids: [],    // 自動合成対象の個体UID（最大4件）
  },
  research: {
    level: 0,
    totalPointsEarned: 0,
    currentPoints: 0,
    missions: [],
    buffPurchaseCount: 0,   // 旧共有カウンター（互換維持のため残す）
    atkPurchaseCount: 0,
    hpPurchaseCount: 0,
    expPurchaseCount: 0,
    atkBonus: 0,
    hpBonus: 0,
    expBonus: 0,
    dropBonus: 0,
    captureBonus: 0,
    dropPurchaseCount: 0,
    capturePurchaseCount: 0,
    hiddenBossUnlocked_greed:    false,
    hiddenBossUnlocked_wrath:    false,
    hiddenBossUnlocked_envy:     false,
    hiddenBossUnlocked_sloth:    false,
    hiddenBossUnlocked_gluttony: false,
    hiddenBossUnlocked_lust:     false,
    hiddenBossUnlocked_pride:    false,
  },
  _triggerOverflowDmgBoost: 0,
  _triggerOverflowHpBoost: 0,
  _expBurstOverflowExpBoost: 0,
  surviveUsed: false,
  resurrectionUsed: false,
  legendEvadeActive: false,
  legendSurviveCount: 0,
  legendReflectBonus: 0,
  legendDmgReduceTurn: 0,
  drainAtkBonus: 0,
  gemAtkBonus: 0,   // gems配列の合計ATKボーナスキャッシュ
  regenTurnCount: 0,
  isHolding: null, // main.jsから設定されるコールバック（長押し判定用）
  forceStopHold: false, // ui.jsから設定：捕獲モーダル等で長押し強制停止
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
    weaponEvolveCount: 0,
    bossCatchCount: 0,
    ultimatePetCount: 0,
    ultimateWeaponCount: 0,
    hiddenBossFirstKill: {},
    maxDamageDealt: 0,
  },
};