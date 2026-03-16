import { state } from "./state.js";

const RANKING_COOLDOWN_MS = 30 * 60 * 1000; // 30分

// ペット図鑑登録数を計算して返す（敵の称号ごとに1体カウント）
export function calcPetBookCount() {
  let count = 0;
  for (const entry of Object.values(state.book.enemies ?? {})) {
    for (const title of Object.values(entry.titles ?? {})) {
      if (title.caught) count++;
    }
  }
  return count;
}

// 武器図鑑登録数を計算して返す（初期形＋進化形態それぞれ1つカウント）
export function calcWeaponBookCount() {
  let count = 0;
  for (const entry of Object.values(state.book.weapons ?? {})) {
    count++; // 初期形
    count += Object.keys(entry.evolutions ?? {}).length; // 進化形態
  }
  return count;
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
