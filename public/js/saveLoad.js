import { state } from "./state.js";
import { recalcDexBuff, recalcWeaponDexBuff, recalcHiddenBossDexBuff } from "./dexBuff.js";
import { getHpBoostMultiplier, getPetPower, getPetHp, calcOverflowBonuses } from "./pet.js";
import { initMissions } from "./research.js";
import { hiddenBossDefs } from "./hiddenBossData.js";

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
    const res = await fetch(url);
    if (!res.ok) return null;
    return await res.text();
  } catch (e) {
    // ファイルが存在しない場合は null を返す（エラーではない）
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
// saveGame（デバウンス方式）
// =====================

let _isSaving   = false;
let _pendingSave = false;

export function saveGame() {
  if (_importLock) return;
  if (_isSaving) {
    _pendingSave = true;
    return;
  }
  _doSave();
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
}

// =====================
// loadGame（起動時1回だけ呼ぶ・async）
// =====================

export async function loadGame() {
  let json = null;

  try {
    // ── ① localStorageからの移行処理（1回限り）──
    const legacy = localStorage.getItem(SAVE_KEY);
    if (legacy) {
      if (legacy.startsWith("{")) {
        json = legacy;
      } else {
        json = LZString.decompressFromUTF16(legacy);
        if (!json) json = LZString.decompress(legacy);
      }
      if (json) {
        localStorage.removeItem(SAVE_KEY);
        console.log("saveLoad: localStorage → Firebase 移行完了");
      } else {
        console.error("loadGame: legacy decompress failed");
        localStorage.removeItem(SAVE_KEY);
      }
    }

    // ── ② IndexedDBからの移行処理（1回限り）──
    if (!json) {
      try {
        const idb = await openDB();
        const idbJson = await dbGet(idb, SAVE_KEY);
        if (idbJson) {
          json = idbJson;
          // IndexedDBのデータを削除（移行済みフラグ代わり）
          await dbDelete(idb, SAVE_KEY);
          console.log("saveLoad: IndexedDB → Firebase 移行完了");
        }
      } catch (e) {
        console.warn("IndexedDB移行スキップ:", e);
      }
    }

    // ── ② Cloud Storageへの移行処理（Firestoreから）──
    if (!json) {
      try {
        const uid = await waitForUid();
        const { doc, getDoc } = await import("https://www.gstatic.com/firebasejs/10.0.0/firebase-firestore.js");
        const snap = await getDoc(doc(window._db, "saves", uid, "data", "save"));
        if (snap.exists()) {
          json = snap.data().json ?? null;
          if (json) {
            console.log("saveLoad: Firestore → Cloud Storage 移行完了");
          }
        }
      } catch (e) {
        console.warn("Firestore移行スキップ:", e);
      }
    }

    // ── ③ Firebaseから読み込み ──
    if (!json) {
      json = await firebaseLoad();
    }

    // ── ④ 移行データをFirebaseに保存 ──
    if (json) {
      await firebaseSave(json);
    }

  } catch (e) {
    console.error("loadGame: storage error", e);
    return false;
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

  if (!state.player.gems) state.player.gems = [];

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

  recalcDexBuff(state);
  recalcWeaponDexBuff(state);
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

  if (!state.book.hiddenBosses) {
    state.book.hiddenBosses = {};
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
    const json = JSON.stringify(state);
    const compressed = LZString.compressToUTF16(json);

    // Cloud Storageにデータを保存
    const { ref, uploadString } = await import("https://www.gstatic.com/firebasejs/10.0.0/firebase-storage.js");
    const storageRef = ref(window._storage, `transferCodes/${code}.txt`);
    await uploadString(storageRef, compressed, "raw");

    // Firestoreに有効期限のみ保存
    const { doc, setDoc } = await import("https://www.gstatic.com/firebasejs/10.0.0/firebase-firestore.js");
    await setDoc(doc(window._db, "transferCodes", code), {
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

    // Firestoreで有効期限を確認
    const { doc, getDoc } = await import("https://www.gstatic.com/firebasejs/10.0.0/firebase-firestore.js");
    const snap = await getDoc(doc(window._db, "transferCodes", formattedCode));
    if (!snap.exists()) return { success: false, error: "コードが見つかりません" };
    const data = snap.data();
    if (Date.now() > data.expiresAt) return { success: false, error: "コードの有効期限が切れています" };

    // Cloud Storageからデータを取得
    const { ref, getDownloadURL } = await import("https://www.gstatic.com/firebasejs/10.0.0/firebase-storage.js");
    const storageRef = ref(window._storage, `transferCodes/${formattedCode}.txt`);
    const url = await getDownloadURL(storageRef);
    const res = await fetch(url);
    if (!res.ok) return { success: false, error: "データの取得に失敗しました" };
    const compressed = await res.text();

    const json = LZString.decompressFromUTF16(compressed);
    if (!json) return { success: false, error: "データの解凍に失敗しました" };

    // Firebaseに保存して再ロード
    _importLock = true;
    await firebaseSave(json);
    return { success: true, json };
  } catch (e) {
    console.error("importSaveCode error:", e);
    return { success: false, error: "読み込みに失敗しました" };
  }
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
