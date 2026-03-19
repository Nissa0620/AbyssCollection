import { state } from "./state.js";
import { recalcDexBuff, recalcWeaponDexBuff } from "./dexBuff.js";
import { getHpBoostMultiplier, getPetPower, getPetHp } from "./pet.js";

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
      const petPower = pet ? getPetPower(pet) : 0;
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
      const buff = (1 + (state.dexBuff.hp - 1) + (state.weaponDexBuff.hp - 1)) * state.hpBoostMult;
      const petHp = state.player.equippedPet
        ? Math.floor(getPetHp(state.player.equippedPet) * buff)
        : 0;
      const weaponHp = Math.floor((state.player.equippedWeapon?.totalHp ?? 0) * buff);
      return Math.floor(this.baseHp * buff) + petHp + weaponHp;
    },
  };

  // 古いセーブデータ対応：gemsが無ければ初期化
  if (!state.player.gems) {
    state.player.gems = [];
  }

  // マイグレーション：ペットのlevelフィールド追加（旧データはlevel=0に初期化）
  for (const pet of state.player.petList ?? []) {
    if (pet.level == null) {
      pet.level = 0;
    }
    delete pet.power;
    delete pet.bonusPower;
    delete pet.hp;
    delete pet.bonusHp;
  }
  if (state.player.equippedPet && state.player.equippedPet.level == null) {
    state.player.equippedPet.level = 0;
    delete state.player.equippedPet.power;
    delete state.player.equippedPet.bonusPower;
    delete state.player.equippedPet.hp;
    delete state.player.equippedPet.bonusHp;
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

  // マイグレーション：捕獲済フラグの補完
  // petList に存在するペットは必ず caught = true にする
  if (state.player?.petList && state.book?.enemies) {
    for (const pet of state.player.petList) {
      const bookKey = pet.isBoss ? `boss_${pet.enemyId}` : `normal_${pet.enemyId}`;
      const bookEntry = state.book.enemies[bookKey];
      if (!bookEntry) continue;
      const tid = pet.isLegendary ? 5 : pet.titleId;
      if (!bookEntry.titles[tid]) {
        bookEntry.titles[tid] = { seen: true, defeated: false };
      }
      bookEntry.titles[tid].caught = true;
    }
  }

  // マイグレーション：acquiredOrderが存在しない場合は一括付与
  if (!state.migrated?.acquiredOrder) {
    let counter = 0;
    for (const pet of state.player.petList ?? []) {
      if (pet.acquiredOrder == null) pet.acquiredOrder = counter++;
    }
    for (const weapon of state.player.inventory ?? []) {
      if (weapon.acquiredOrder == null) weapon.acquiredOrder = counter++;
    }
    if (!state.migrated) state.migrated = {};
    state.migrated.acquiredOrder = true;
    if (!state.acquiredCounter) state.acquiredCounter = counter;
  }

  // ロード時にアコーディオン開閉状態をリセット
  if (state.ui) {
    state.ui.petOpenGroups = {};
    state.ui.weaponOpenGroups = {};
  }

  return true;
}