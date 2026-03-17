import { state } from "./state.js";
import { normalEnemies, bossEnemies, weaponTemplates } from "./data/index.js";

const RANKING_COOLDOWN_MS = 30 * 60 * 1000; // 30分

// ペット図鑑登録数を計算して返す（種族単位で称号1〜4すべて捕獲済みなら1カウント）
export function calcPetBookCount() {
  const allEnemyDefs = [...normalEnemies, ...bossEnemies];
  return allEnemyDefs.filter((e) => {
    const key = e.isBoss ? `boss_${e.id}` : `normal_${e.id}`;
    const entry = state.book.enemies[key];
    return entry && [1, 2, 3, 4].every((id) => entry.titles?.[id]?.caught);
  }).length;
}

// 武器図鑑登録数を計算して返す（種族単位で最終進化まで到達済みなら1カウント）
export function calcWeaponBookCount() {
  return weaponTemplates.filter((t) => {
    const key = t.isBossDrop ? `boss_${t.id}` : `normal_${t.id}`;
    const entry = state.book.weapons[key];
    if (!entry) return false;
    const lastEvo = t.evolutions?.[t.evolutions.length - 1];
    if (!lastEvo) return false;
    return !!entry.evolutions?.[lastEvo.name]?.obtained;
  }).length;
}

// ランキングデータを送信する
export async function sendRankingData() {
  const db = window._db;
  if (!db || !state.playerName) return;

  const now = Date.now();
  if (now - (state.lastRankingSentAt ?? 0) < RANKING_COOLDOWN_MS) return;

  const currentData = {
    maxFloor: state.maxFloor,
    level: state.player.level,
    petCount: calcPetBookCount(),
    weaponCount: calcWeaponBookCount(),
  };

  // 前回送信時と変化がなければスキップ
  const last = state.lastRankingData ?? {};
  const hasChanged =
    currentData.maxFloor !== last.maxFloor ||
    currentData.level !== last.level ||
    currentData.petCount !== last.petCount ||
    currentData.weaponCount !== last.weaponCount;

  if (!hasChanged) return;

  try {
    const { doc, setDoc } = await import("https://www.gstatic.com/firebasejs/10.0.0/firebase-firestore.js");
    await setDoc(doc(db, "rankings", state.playerName), {
      name: state.playerName,
      maxFloor: currentData.maxFloor,
      level: currentData.level,
      petCount: currentData.petCount,
      weaponCount: currentData.weaponCount,
      updatedAt: Date.now(),
    });
    state.lastRankingSentAt = now;
    state.lastRankingData = currentData;
  } catch (e) {
    console.error("ランキング送信失敗:", e);
  }
}

// ランキングデータを取得する
export async function fetchRanking(field) {
  const db = window._db;
  if (!db) return [];
  try {
    const { collection, query, orderBy, limit, getDocs } = await import("https://www.gstatic.com/firebasejs/10.0.0/firebase-firestore.js");
    const q = query(
      collection(db, "rankings"),
      orderBy(field, "desc"),
      limit(100)
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map((d) => d.data());
  } catch (e) {
    console.error("ランキング取得失敗:", e);
    return [];
  }
}

// 名前の重複チェック
export async function isNameTaken(name) {
  const db = window._db;
  if (!db) return false;
  try {
    const { doc, getDoc } = await import("https://www.gstatic.com/firebasejs/10.0.0/firebase-firestore.js");
    const snap = await getDoc(doc(db, "rankings", name));
    return snap.exists();
  } catch (e) {
    return false;
  }
}
