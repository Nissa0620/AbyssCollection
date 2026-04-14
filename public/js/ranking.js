import { state } from "./state.js";
import { normalEnemies, bossEnemies, weaponTemplates, legendaryTitles } from "./data/index.js";

const RANKING_COOLDOWN_MS = 30 * 60 * 1000; // 30分

// ペット図鑑登録数を計算して返す（称号ごとの捕獲済み数を合算）
export function calcPetBookCount() {
  const allEnemyDefs = [...normalEnemies, ...bossEnemies];
  return allEnemyDefs.reduce((sum, e) => {
    const key = e.isBoss ? `boss_${e.id}` : `normal_${e.id}`;
    const entry = state.book.enemies[key];
    if (!entry) return sum;
    const hasLegend = !!(e.passive && legendaryTitles[e.passive]);
    const titleIds = hasLegend ? [1, 2, 3, 4, 5] : [1, 2, 3, 4];
    return sum + titleIds.filter((id) => entry.titles?.[id]?.caught).length;
  }, 0);
}

// 武器図鑑登録数を計算して返す（ベース入手 + 各進化段階取得を個別カウント）
export function calcWeaponBookCount() {
  return weaponTemplates.reduce((sum, t) => {
    const key = t.isBossDrop ? `boss_${t.id}` : `normal_${t.id}`;
    const entry = state.book.weapons[key];
    if (!entry) return sum;
    let count = 1;
    for (const evo of t.evolutions ?? []) {
      if (entry.evolutions?.[evo.name]?.obtained) count++;
    }
    return sum + count;
  }, 0);
}

// ランキングデータを送信する
export async function sendRankingData({ force = false } = {}) {
  const db = window._db;
  if (!db || !state.playerName) return;

  const now = Date.now();
  if (!force && now - (state.lastRankingSentAt ?? 0) < RANKING_COOLDOWN_MS) return;

  const currentData = {
    maxFloor: state.maxFloor,
    level: state.player.level,
    petCount: calcPetBookCount(),
    weaponCount: calcWeaponBookCount(),
    achievementCount: Object.keys(state.achievements?.unlocked ?? {}).length,
    maxDamage: state.achievements?.maxDamageDealt ?? 0,
  };

  // 前回送信時と変化がなければスキップ
  const last = state.lastRankingData ?? {};
  const hasChanged =
    currentData.maxFloor !== last.maxFloor ||
    currentData.level !== last.level ||
    currentData.petCount !== last.petCount ||
    currentData.weaponCount !== last.weaponCount ||
    currentData.achievementCount !== last.achievementCount ||
    currentData.maxDamage !== last.maxDamage;

  if (!force && !hasChanged) return;

  try {
    const { doc, setDoc } = await import("https://www.gstatic.com/firebasejs/10.0.0/firebase-firestore.js");
    await setDoc(doc(db, "rankings", window._uid), {
      uid: window._uid,
      name: state.playerName,
      maxFloor: currentData.maxFloor,
      level: currentData.level,
      petCount: currentData.petCount,
      weaponCount: currentData.weaponCount,
      achievementCount: currentData.achievementCount,
      maxDamage: currentData.maxDamage,
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
    const { collection, query, where, limit, getDocs } = await import("https://www.gstatic.com/firebasejs/10.0.0/firebase-firestore.js");
    const q = query(
      collection(db, "rankings"),
      where("name", "==", name),
      limit(1)
    );
    const snapshot = await getDocs(q);
    // 自分自身のドキュメントは除外（名前変更時に自分の現在名と同じ名前を入力した場合）
    if (snapshot.empty) return false;
    const foundDoc = snapshot.docs[0];
    return foundDoc.id !== window._uid;
  } catch (e) {
    return false;
  }
}
