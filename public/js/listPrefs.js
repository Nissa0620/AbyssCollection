// listPrefs.js
// お気に入り・ロックの永続管理

const FAVORITE_KEY = "listFavorites";  // 種族単位：Set<string>
const LOCK_KEY     = "listLocks";      // アイテム個別：Set<string (uid)>

function loadSet(key) {
  try {
    return new Set(JSON.parse(localStorage.getItem(key) ?? "[]"));
  } catch {
    return new Set();
  }
}

function saveSet(key, set) {
  localStorage.setItem(key, JSON.stringify([...set]));
}

// ---- お気に入り（種族キー：ペット = `pet_${enemyId}_${isBoss}` / 武器 = `weapon_${templateId}`）----
export function isFavorite(groupKey) {
  return loadSet(FAVORITE_KEY).has(groupKey);
}

export function toggleFavorite(groupKey) {
  const set = loadSet(FAVORITE_KEY);
  set.has(groupKey) ? set.delete(groupKey) : set.add(groupKey);
  saveSet(FAVORITE_KEY, set);
}

// ---- ロック（uid 単位）----
export function isLocked(uid) {
  return loadSet(LOCK_KEY).has(String(uid));
}

export function toggleLock(uid) {
  const set = loadSet(LOCK_KEY);
  const key = String(uid);
  set.has(key) ? set.delete(key) : set.add(key);
  saveSet(LOCK_KEY, set);
}

// ロックされているUIDのSetを一括取得（ループ内でのキャッシュ用）
export function getLockedSet() {
  return loadSet(LOCK_KEY);
}
