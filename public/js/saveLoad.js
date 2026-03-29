import { state } from "./state.js";
import { recalcDexBuff, recalcWeaponDexBuff, recalcHiddenBossDexBuff } from "./dexBuff.js";
import { getHpBoostMultiplier, getPetPower, getPetHp, calcOverflowBonuses } from "./pet.js";
import { initMissions } from "./research.js";
import { hiddenBossDefs } from "./hiddenBossData.js";

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
      let atkBoostTotal = 0;
      if (pet?.passive === "atkBoost" || pet?.passive === "legendAtkBoost") atkBoostTotal += (pet.passiveValue ?? 0);
      if (weapon?.passive === "atkBoost" || weapon?.passive === "legendAtkBoost") atkBoostTotal += (weapon.passiveValue ?? 0);
      const atkBoostMult = 1 + atkBoostTotal / 100;
      const gemBonus = (state.player.gems ?? []).reduce((sum, g) => sum + (g.atkBonus ?? 0), 0);
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
        ? Math.floor(getPetHp(state.player.equippedPet) * buff)
        : 0;
      const weaponHp = Math.floor((state.player.equippedWeapon?.totalHp ?? 0) * buff);
      return Math.floor(this.baseHp * buff * overflowHpBoost) + petHp + weaponHp
        + (state.research?.hpBonus ?? 0);
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
    "reflect", "drain", "critRate", "critDamage", "expBurst",
    "giantKiller", "bossSlayer", "evade", "lastStand", "regen", "resurrection",
    "legendCaptureBoost", "legendExpBoost", "legendAtkBoost", "legendDropBoost",
    "legendDmgBoost", "legendDmgReduce", "legendHpBoost", "tripleAttack",
    "legendSurvive", "legendReflect", "legendDrain", "legendCritRate",
    "legendCritDamage", "legendExpBurst", "legendGiantKiller", "legendBossSlayer",
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
      weaponEvolveCount: 0,
      bossCatchCount: 0,
      ultimatePetCount: 0,
      ultimateWeaponCount: 0,
    };
  }
  // 古いセーブデータ対応：バフを再計算して正しい値に上書き
  recalcDexBuff(state);
  recalcWeaponDexBuff(state);
  recalcHiddenBossDexBuff(state);
  state.hpBoostMult = getHpBoostMultiplier();

  // マイグレーション：extraHit → expBurst、legendExtraHit → legendExpBurst
  const passiveMigrateMap = { extraHit: "expBurst", legendExtraHit: "legendExpBurst" };
  for (const pet of state.player?.petList ?? []) {
    if (passiveMigrateMap[pet.passive]) pet.passive = passiveMigrateMap[pet.passive];
  }
  if (passiveMigrateMap[state.player?.equippedPet?.passive]) {
    state.player.equippedPet.passive = passiveMigrateMap[state.player.equippedPet.passive];
  }
  for (const weapon of state.player?.inventory ?? []) {
    if (passiveMigrateMap[weapon.passive]) weapon.passive = passiveMigrateMap[weapon.passive];
  }
  if (passiveMigrateMap[state.player?.equippedWeapon?.passive]) {
    state.player.equippedWeapon.passive = passiveMigrateMap[state.player.equippedWeapon.passive];
  }

  // ロード後に超過分ボーナスを計算
  calcOverflowBonuses();

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

  // 研究所データの初期化（旧セーブデータ対応）
  if (!state.research) {
    state.research = {
      level: 0,
      totalPointsEarned: 0,
      currentPoints: 0,
      missions: [],
      buffPurchaseCount: 0,
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
    };
  }
  // 旧セーブ対応：個別購入カウンターが未定義なら 0 で初期化
  if (state.research.atkPurchaseCount == null) state.research.atkPurchaseCount = 0;
  if (state.research.hpPurchaseCount  == null) state.research.hpPurchaseCount  = 0;
  if (state.research.expPurchaseCount == null) state.research.expPurchaseCount = 0;

  // ミッションが空なら初期生成
  if (state.research.missions.length === 0 && state.maxFloor >= 500) {
    initMissions();
  }

  // 旧フラグ（hiddenBossUnlocked: true）→ 7体全解禁として引き継ぐ
  if (state.research.hiddenBossUnlocked === true) {
    for (const def of hiddenBossDefs) {
      state.research[def.unlockKey] = true;
    }
    delete state.research.hiddenBossUnlocked;
  }

  // 各フラグが未定義なら false で初期化
  for (const def of hiddenBossDefs) {
    if (state.research[def.unlockKey] === undefined) {
      state.research[def.unlockKey] = false;
    }
  }

  // 初撃破フラグが未定義なら初期化
  if (!state.achievements.hiddenBossFirstKill) {
    state.achievements.hiddenBossFirstKill = {};
  }

  // book.hiddenBossesが未定義なら初期化
  if (!state.book.hiddenBosses) {
    state.book.hiddenBosses = {};
  }

  // マイグレーション：数値型UIDを文字列型に変換
  for (const pet of state.player.petList ?? []) {
    if (typeof pet.uid === "number") pet.uid = String(pet.uid);
  }
  if (state.player.equippedPet && typeof state.player.equippedPet.uid === "number") {
    state.player.equippedPet.uid = String(state.player.equippedPet.uid);
  }
  for (const weapon of state.player.inventory ?? []) {
    if (typeof weapon.uid === "number") weapon.uid = String(weapon.uid);
  }
  if (state.player.equippedWeapon && typeof state.player.equippedWeapon.uid === "number") {
    state.player.equippedWeapon.uid = String(state.player.equippedWeapon.uid);
  }
  if (typeof state.synthesis?.baseUid === "number") state.synthesis.baseUid = String(state.synthesis.baseUid);
  state.synthesis.materialUids = (state.synthesis?.materialUids ?? []).map(u => typeof u === "number" ? String(u) : u);
  if (typeof state.petSynthesis?.baseUid === "number") state.petSynthesis.baseUid = String(state.petSynthesis.baseUid);
  state.petSynthesis.materialUids = (state.petSynthesis?.materialUids ?? []).map(u => typeof u === "number" ? String(u) : u);

  return true;
}