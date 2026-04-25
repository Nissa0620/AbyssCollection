import { state } from "./state.js";
import { recalcDexBuff, recalcWeaponDexBuff, recalcHiddenBossDexBuff } from "./dexBuff.js";
import { getHpBoostMultiplier, getPetPower, getPetHp, calcOverflowBonuses } from "./pet.js";
import { initMissions } from "./research.js";
import { hiddenBossDefs } from "./hiddenBossData.js";
import { checkPetV1Complete } from "./book.js";
import { checkWeaponV1Complete } from "./weaponBook.js";

const SAVE_KEY = "abyssSave";
const DB_NAME  = "abyssDB";
const DB_VERSION = 1;
const STORE_NAME = "saves";

let _importLock = false;

// =====================
// UID取得待機（最大10秒）
// =====================

function waitForUid(timeoutMs = 10000) {
  return new Promise((resolve, reject) => {
    if (window._uid) return resolve(window._uid);
    const start = Date.now();
    const timer = setInterval(() => {
      if (window._uid) {
        clearInterval(timer);
        resolve(window._uid);
      } else if (Date.now() - start > timeoutMs) {
        clearInterval(timer);
        reject(new Error("UID取得タイムアウト"));
      }
    }, 100);
  });
}

// =====================
// Cloud Storage セーブ・ロード
// =====================

async function firebaseSave(json) {
  if (!json) {
    console.error("firebaseSave: jsonが空です");
    return;
  }
  try {
    const uid = await waitForUid();
    const { ref, uploadString } = await import("https://www.gstatic.com/firebasejs/10.0.0/firebase-storage.js");
    const storageRef = ref(window._storage, `saves/${uid}/save.txt`);
    await uploadString(storageRef, json, "raw");
  } catch (e) {
    console.error("firebaseSave error:", e);
  }
}

async function firebaseLoad() {
  try {
    const uid = await waitForUid();
    const { ref, getDownloadURL } = await import("https://www.gstatic.com/firebasejs/10.0.0/firebase-storage.js");
    const storageRef = ref(window._storage, `saves/${uid}/save.txt`);
    const url = await getDownloadURL(storageRef);
    const token = await window._auth.currentUser.getIdToken();
    const res = await fetch(url, {
      headers: {
        Authorization: `Firebase ${token}`
      }
    });
    if (!res.ok) return null;
    return await res.text();
  } catch (e) {
    if (e.code === "storage/object-not-found") return null;
    console.error("firebaseLoad error:", e);
    return null;
  }
}

async function firebaseDelete() {
  try {
    const uid = await waitForUid();
    const { ref, deleteObject } = await import("https://www.gstatic.com/firebasejs/10.0.0/firebase-storage.js");
    const storageRef = ref(window._storage, `saves/${uid}/save.txt`);
    await deleteObject(storageRef);
  } catch (e) {
    if (e.code !== "storage/object-not-found") {
      console.error("firebaseDelete error:", e);
    }
  }
}

// =====================
// IndexedDB ヘルパー（移行処理用に残す）
// =====================

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "key" });
      }
    };
    req.onsuccess = (e) => resolve(e.target.result);
    req.onerror   = (e) => reject(e.target.error);
  });
}

function dbGet(db, key) {
  return new Promise((resolve, reject) => {
    const tx  = db.transaction(STORE_NAME, "readonly");
    const req = tx.objectStore(STORE_NAME).get(key);
    req.onsuccess = (e) => resolve(e.target.result?.data ?? null);
    req.onerror   = (e) => reject(e.target.error);
  });
}

function dbPut(db, key, data) {
  return new Promise((resolve, reject) => {
    const tx  = db.transaction(STORE_NAME, "readwrite");
    const req = tx.objectStore(STORE_NAME).put({ key, data });
    req.onsuccess = () => resolve();
    req.onerror   = (e) => reject(e.target.error);
  });
}

function dbDelete(db, key) {
  return new Promise((resolve, reject) => {
    const tx  = db.transaction(STORE_NAME, "readwrite");
    const req = tx.objectStore(STORE_NAME).delete(key);
    req.onsuccess = () => resolve();
    req.onerror   = (e) => reject(e.target.error);
  });
}

// =====================
// IndexedDB 自動保存
// =====================

let _idbSaving = false;
let _idbPendingSave = false;

export function saveGameLocal() {
  if (_importLock) return;
  if (_idbSaving) {
    _idbPendingSave = true;
    return;
  }
  _doLocalSave();
}

async function _doLocalSave() {
  _idbSaving = true;
  _idbPendingSave = false;
  state.lastSaveTime = Date.now();
  const json = JSON.stringify(state);
  try {
    const db = await openDB();
    await dbPut(db, SAVE_KEY, json);
  } catch (e) {
    console.error("saveGameLocal error:", e);
  } finally {
    _idbSaving = false;
    if (_idbPendingSave) {
      _doLocalSave();
    }
  }
}

// =====================
// saveGame（デバウンス方式）
// =====================

let _isSaving   = false;
let _pendingSave = false;

export function saveGame() {
  if (_importLock) return Promise.resolve();
  if (_isSaving) {
    _pendingSave = true;
    return Promise.resolve();
  }
  return _doSave();
}

async function _doSave() {
  _isSaving    = true;
  _pendingSave = false;
  state.lastSaveTime = Date.now();
  const json = JSON.stringify(state);
  try {
    await firebaseSave(json);
  } catch (e) {
    console.error("saveGame error:", e);
  } finally {
    _isSaving = false;
    if (_pendingSave) {
      _doSave();
    }
  }
}

// =====================
// deleteGame（リセット用）
// =====================

export async function deleteGame() {
  try {
    await firebaseDelete();
  } catch (e) {
    console.error("deleteGame error:", e);
  }
  try {
    const db = await openDB();
    await dbDelete(db, SAVE_KEY);
  } catch (e) {
    console.warn("deleteGame IndexedDB error:", e);
  }
}

// =====================
// ロード時ヘルパー
// =====================

function _tryParse(json) {
  if (!json) return null;
  try { return JSON.parse(json); } catch { return null; }
}

function _calcProgressScore(d) {
  if (!d) return -1;
  return (
    (d.maxFloor ?? 0)       * 10000 +
    (d.player?.level ?? 0)
  );
}

function _pickBetter(a, b) {
  if (!a && !b) return null;
  if (!a) return JSON.stringify(b);
  if (!b) return JSON.stringify(a);
  return _calcProgressScore(b) >= _calcProgressScore(a)
    ? JSON.stringify(b)
    : JSON.stringify(a);
}

// =====================
// loadGame（起動時1回だけ呼ぶ・async）
// =====================

export async function loadGame() {
  let json = null;

  // ── ① Cloud Storage と IndexedDB を並列取得 ──
  const [cloudJson, idbJson] = await Promise.all([
    firebaseLoad().catch(() => null),
    openDB().then(db => dbGet(db, SAVE_KEY)).catch(() => null),
  ]);

  // ── ② 進行度スコアで比較し、優れている方を採用 ──
  const cloudData = _tryParse(cloudJson);
  const idbData   = _tryParse(idbJson);
  json = _pickBetter(cloudData, idbData);

  if (cloudData && idbData) {
    const scoreCloud = _calcProgressScore(cloudData);
    const scoreIdb   = _calcProgressScore(idbData);
    console.log(`saveLoad: Cloud=${scoreCloud} / IDB=${scoreIdb} → ${scoreIdb >= scoreCloud ? "IDB" : "Cloud"}を採用`);
  } else if (cloudData) {
    console.log("saveLoad: CloudStorageからロード完了");
  } else if (idbData) {
    console.log("saveLoad: IndexedDBからロード完了");
  }

  // ── ③ 両方ともなければ、Firestoreから読み込む（旧ユーザー向けフォールバック）──
  if (!json) {
    try {
      const uid = await waitForUid();
      const { doc, getDoc } = await import(
        "https://www.gstatic.com/firebasejs/10.0.0/firebase-firestore.js"
      );
      const snap = await getDoc(
        doc(window._db, "saves", uid, "data", "save")
      );
      if (snap.exists()) {
        json = snap.data().json ?? null;
        if (json) console.log("saveLoad: Firestoreからロード完了");
      }
    } catch (e) {
      console.warn("saveLoad: Firestoreフォールバックスキップ:", e);
    }
  }

  // ── ④ 読み込んだデータをIndexedDBにも保存する ──
  if (json) {
    try {
      const idb = await openDB();
      await dbPut(idb, SAVE_KEY, json);
    } catch (e) {
      console.warn("saveLoad: IndexedDB保存スキップ:", e);
    }
  }

  if (!json) return false;

  let parsed;
  try {
    parsed = JSON.parse(json);
  } catch (e) {
    console.error("loadGame: JSON.parse failed", e);
    return false;
  }

  // ── 以下は既存のマイグレーション処理をそのまま維持 ──
  Object.assign(state, parsed);

  // 10000階上限キャップ（既存セーブデータの超過分を補正）
  const FLOOR_CAP = 10000;
  if (state.floor > FLOOR_CAP) state.floor = FLOOR_CAP;
  if (state.maxFloor > FLOOR_CAP) state.maxFloor = FLOOR_CAP;

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
        ? Math.floor(getPetHp(state.player.equippedPet) * buff)
        : 0;
      const weaponHp = Math.floor((state.player.equippedWeapon?.totalHp ?? 0) * buff);
      return Math.floor(this.baseHp * buff * overflowHpBoost) + petHp + weaponHp
        + (state.research?.hpBonus ?? 0);
    },
  };

  // ── gems マイグレーション ──
  // 旧形式（配列）を新形式（個数オブジェクト）に変換する
  if (!state.player.gems) {
    state.player.gems = { copper: 0, silver: 0, gold: 0 };
  } else if (Array.isArray(state.player.gems)) {
    const arr = state.player.gems;
    state.player.gems = {
      copper: arr.filter((g) => g.id === 1 || g.rarity === "copper").length,
      silver: arr.filter((g) => g.id === 2 || g.rarity === "silver").length,
      gold:   arr.filter((g) => g.id === 3 || g.rarity === "gold").length,
    };
  }
  // 不足キーの補完（念のため）
  state.player.gems.copper = state.player.gems.copper ?? 0;
  state.player.gems.silver = state.player.gems.silver ?? 0;
  state.player.gems.gold   = state.player.gems.gold   ?? 0;

  // ロード時にキャッシュを再計算
  state.gemAtkBonus =
    state.player.gems.copper * 3 +
    state.player.gems.silver * 5 +
    state.player.gems.gold   * 10;

  for (const pet of state.player.petList ?? []) {
    if (pet.level == null) pet.level = 0;
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

  // Step1: 図鑑v1フィールドのデフォルト補完
  if (state.book.petV1Completed    == null) state.book.petV1Completed    = false;
  if (state.book.petV1DexBuff      == null) state.book.petV1DexBuff      = null;
  if (state.book.petV1Count        == null) state.book.petV1Count        = 0;
  if (state.book.weaponV1Completed == null) state.book.weaponV1Completed = false;
  if (state.book.weaponV1DexBuff   == null) state.book.weaponV1DexBuff   = null;
  if (state.book.weaponV1Count     == null) state.book.weaponV1Count     = 0;

  // Step1追加：hiddenBossesのpetObtainedをpetListから補完（既存ユーザー対応）
  if (!state.book.hiddenBosses) state.book.hiddenBosses = {};
  for (const def of hiddenBossDefs) {
    if (!state.book.hiddenBosses[def.id]) {
      state.book.hiddenBosses[def.id] = { name: def.name, defeated: false, weaponObtained: false };
    }
    if (!state.book.hiddenBosses[def.id].petObtained) {
      const hasPet = (state.player.petList ?? []).some(p => p.isHiddenBoss && p.enemyId === def.id);
      if (hasPet) state.book.hiddenBosses[def.id].petObtained = true;
    }
  }

  recalcDexBuff(state);
  recalcWeaponDexBuff(state);
  // Step1: 既存ユーザー向けコンプ判定
  // recalcHiddenBossDexBuff より前に配置することで、隠しボス分の二重加算を防ぐ
  checkPetV1Complete(state);
  checkWeaponV1Complete(state);
  recalcHiddenBossDexBuff(state);
  state.hpBoostMult = getHpBoostMultiplier();

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

  calcOverflowBonuses();

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

  if (state.ui) {
    state.ui.petOpenGroups = {};
    state.ui.weaponOpenGroups = {};
  }

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
  if (state.research.atkPurchaseCount == null) state.research.atkPurchaseCount = 0;
  if (state.research.hpPurchaseCount  == null) state.research.hpPurchaseCount  = 0;
  if (state.research.expPurchaseCount == null) state.research.expPurchaseCount = 0;

  if (state.research.missions.length === 0 && state.maxFloor >= 500) {
    initMissions();
  }

  if (state.research.hiddenBossUnlocked === true) {
    for (const def of hiddenBossDefs) {
      state.research[def.unlockKey] = true;
    }
    delete state.research.hiddenBossUnlocked;
  }

  for (const def of hiddenBossDefs) {
    if (state.research[def.unlockKey] === undefined) {
      state.research[def.unlockKey] = false;
    }
  }

  if (!state.achievements.hiddenBossFirstKill) {
    state.achievements.hiddenBossFirstKill = {};
  }

  if (state.achievements.maxDamageDealt == null) {
    state.achievements.maxDamageDealt = 0;
  }

  if (!state.book.hiddenBosses) {
    state.book.hiddenBosses = {};
  }

  // 自動合成フィールドのデフォルト補完
  if (!state.autoSynth) {
    state.autoSynth = { petUids: [], weaponUids: [] };
  }
  if (!state.autoSynth.weaponUids) {
    state.autoSynth.weaponUids = [];
  }
  // 自動合成対象に登録されているUIDが実際に存在するか検証（参照切れ除去）
  if (Array.isArray(state.autoSynth.petUids)) {
    const validPetUids = new Set(state.player.petList.map(p => p.uid));
    state.autoSynth.petUids = state.autoSynth.petUids.filter(uid => validPetUids.has(uid));
  }
  if (Array.isArray(state.autoSynth.weaponUids)) {
    const validWeaponUids = new Set(state.player.inventory.map(w => w.uid));
    state.autoSynth.weaponUids = state.autoSynth.weaponUids.filter(uid => validWeaponUids.has(uid));
  }

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

// =====================
// エクスポート（引き継ぎコード生成）
// =====================

export async function exportSaveCode() {
  try {
    const uid = await waitForUid();
    const code = uidToCode(uid);

    // Firestoreにuid・有効期限を保存
    const { doc, setDoc } = await import("https://www.gstatic.com/firebasejs/10.0.0/firebase-firestore.js");
    await setDoc(doc(window._db, "transferCodes", code), {
      uid,
      createdAt: Date.now(),
      expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000,
    });

    return code;
  } catch (e) {
    console.error("exportSaveCode error:", e);
    return null;
  }
}

// =====================
// インポート（引き継ぎコード読み込み）
// =====================

export async function importSaveCode(code) {
  try {
    const normalized = code.replace(/-/g, "").toUpperCase();
    const formattedCode = normalized.slice(0, 4) + "-" + normalized.slice(4, 8);

    // Firestoreで有効期限とuidを確認
    const { doc, getDoc } = await import("https://www.gstatic.com/firebasejs/10.0.0/firebase-firestore.js");
    const snap = await getDoc(doc(window._db, "transferCodes", formattedCode));
    if (!snap.exists()) return { success: false, error: "コードが見つかりません" };
    const data = snap.data();
    if (Date.now() > data.expiresAt) return { success: false, error: "コードの有効期限が切れています" };

    // コード所有者のsave.txtを読み込む
    const { ref, getDownloadURL } = await import("https://www.gstatic.com/firebasejs/10.0.0/firebase-storage.js");
    const storageRef = ref(window._storage, `saves/${data.uid}/save.txt`);
    const url = await getDownloadURL(storageRef);
    const token = await window._auth.currentUser.getIdToken();
    const res = await fetch(url, {
      headers: {
        Authorization: `Firebase ${token}`
      }
    });
    if (!res.ok) return { success: false, error: "データの取得に失敗しました" };
    const json = await res.text();
    if (!json) return { success: false, error: "データが空です" };

    // 自分のCloud Storageに保存して再ロード
    _importLock = true;
    await firebaseSave(json);

    // IndexedDBも更新して古いデータが読まれないようにする
    try {
      const idb = await openDB();
      await dbPut(idb, SAVE_KEY, json);
    } catch (e) {
      console.warn("importSaveCode: IndexedDB保存スキップ:", e);
    }

    // 旧UID（引き継ぎ元）のランキングエントリを削除する
    // 新端末では次回 sendRankingData 呼び出し時に rankings/{新UID} として再登録される
    try {
      const { deleteDoc } = await import("https://www.gstatic.com/firebasejs/10.0.0/firebase-firestore.js");
      await deleteDoc(doc(window._db, "rankings", data.uid));
    } catch (e) {
      console.warn("importSaveCode: 旧ランキング削除スキップ:", e);
    }

    return { success: true, json };
  } catch (e) {
    console.error("importSaveCode error:", e);
    return { success: false, error: "読み込みに失敗しました" };
  }
}

// =====================
// ページを閉じる前にCloud Storageに保存を試みる
// =====================

export function setupBeforeUnloadSave() {
  window.addEventListener("beforeunload", () => {
    if (_importLock) return;
    const json = JSON.stringify(state);
    firebaseSave(json).catch(() => {});
  });
}

// =====================
// コード生成ヘルパー
// =====================

function uidToCode(uid) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 8; i++) {
    const charCode = uid.charCodeAt(i % uid.length);
    code += chars[charCode % chars.length];
  }
  return code.slice(0, 4) + "-" + code.slice(4, 8);
}
