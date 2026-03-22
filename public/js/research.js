import { normalEnemies, bossEnemies } from "./data/index.js";
import { state } from "./state.js";

// =====================
// ミッションパターン定義
// =====================
const MISSION_PATTERNS = [
  { isRare: false, requiredLevel: 5,  rewardPoints: 1  },
  { isRare: false, requiredLevel: 10, rewardPoints: 2  },
  { isRare: false, requiredLevel: 20, rewardPoints: 3  },
  { isRare: true,  requiredLevel: 5,  rewardPoints: 10 },
  { isRare: true,  requiredLevel: 10, rewardPoints: 15 },
  { isRare: true,  requiredLevel: 20, rewardPoints: 20 },
];

// =====================
// 捕獲済み種族の取得
// =====================
export function getCaughtSpecies() {
  const allEnemies = [
    ...normalEnemies.map(e => ({ ...e, isBoss: false })),
    ...bossEnemies.map(e => ({ ...e, isBoss: true })),
  ];
  return allEnemies.filter(e => {
    const key = e.isBoss ? `boss_${e.id}` : `normal_${e.id}`;
    const entry = state.book.enemies[key];
    if (!entry) return false;
    return Object.values(entry.titles ?? {}).some(t => t.caught);
  });
}

// =====================
// ミッション生成
// =====================
export function generateMission() {
  const species = getCaughtSpecies();
  if (species.length === 0) return null;

  const enemy = species[Math.floor(Math.random() * species.length)];
  const pattern = MISSION_PATTERNS[Math.floor(Math.random() * MISSION_PATTERNS.length)];

  return {
    id: `${Date.now()}_${Math.random()}`,
    enemyId: enemy.id,
    isBoss: enemy.isBoss ?? false,
    enemyName: enemy.name,
    isRare: pattern.isRare,
    requiredLevel: pattern.requiredLevel,
    rewardPoints: pattern.rewardPoints,
    completed: false,
  };
}

export function initMissions() {
  const missions = [];
  for (let i = 0; i < 3; i++) {
    const m = generateMission();
    if (m) missions.push(m);
  }
  state.research.missions = missions;
}

// =====================
// ミッション達成判定
// =====================
export function checkMissionCompletion(mission, pet) {
  if (pet.enemyId !== mission.enemyId) return false;
  if (!!pet.isBoss !== mission.isBoss) return false;
  if ((pet.level ?? 0) < mission.requiredLevel) return false;
  if (mission.isRare) {
    if (!pet.isElite && !pet.isLegendary && !pet.isLegendUltimate) return false;
  } else {
    if (pet.isElite || pet.isLegendary || pet.isLegendUltimate) return false;
  }
  return true;
}

// =====================
// 研究所レベル更新
// =====================
function updateResearchLevel() {
  const total = state.research.totalPointsEarned;
  const thresholds = [0, 20, 60, 100, 140, 200];
  let newLevel = 0;
  for (let i = thresholds.length - 1; i >= 0; i--) {
    if (total >= thresholds[i]) { newLevel = i; break; }
  }
  state.research.level = Math.min(newLevel, 5);
}

// =====================
// ミッション寄贈処理
// =====================
export function donatePet(missionId, petUid) {
  const mission = state.research.missions.find(m => m.id === missionId);
  const petIndex = state.player.petList.findIndex(p => p.uid === petUid);
  if (!mission || petIndex === -1) return false;

  const pet = state.player.petList[petIndex];

  if (state.player.equippedPet?.uid === petUid) return false;
  if (!checkMissionCompletion(mission, pet)) return false;

  state.player.petList.splice(petIndex, 1);

  state.research.currentPoints += mission.rewardPoints;
  state.research.totalPointsEarned += mission.rewardPoints;

  updateResearchLevel();

  state.research.missions = state.research.missions.filter(m => m.id !== missionId);
  const newMission = generateMission();
  if (newMission) state.research.missions.push(newMission);

  return true;
}

// =====================
// リロール処理
// =====================
export function canReroll() {
  const now = Date.now();
  const last = state.research.lastRerollTime ?? 0;
  return now - last >= 24 * 60 * 60 * 1000;
}

export function rerollMissions() {
  if (!canReroll()) return false;
  state.research.lastRerollTime = Date.now();
  initMissions();
  return true;
}

export function getRerollRemainingMs() {
  const now = Date.now();
  const next = (state.research.lastRerollTime ?? 0) + 24 * 60 * 60 * 1000;
  return Math.max(0, next - now);
}

// =====================
// 貢献P交換処理
// =====================
export function getBuffPurchaseCost() {
  return 5 + (state.research.buffPurchaseCount ?? 0);
}

export function getDropPurchaseCost() {
  return 1 + (state.research.dropPurchaseCount ?? 0);
}

export function getCapturePurchaseCost() {
  return 1 + (state.research.capturePurchaseCount ?? 0);
}

export function exchangeReward(type) {
  const r = state.research;

  if (type === "atk") {
    const cost = getBuffPurchaseCost();
    if (r.currentPoints < cost) return false;
    r.currentPoints -= cost;
    r.atkBonus += 10;
    r.buffPurchaseCount += 1;
    return true;
  }
  if (type === "hp") {
    const cost = getBuffPurchaseCost();
    if (r.currentPoints < cost) return false;
    r.currentPoints -= cost;
    r.hpBonus += 30;
    r.buffPurchaseCount += 1;
    return true;
  }
  if (type === "exp") {
    const cost = getBuffPurchaseCost();
    if (r.currentPoints < cost) return false;
    r.currentPoints -= cost;
    r.expBonus += 10;
    r.buffPurchaseCount += 1;
    return true;
  }
  if (type === "drop") {
    if (r.dropPurchaseCount >= 100) return false;
    const cost = getDropPurchaseCost();
    if (r.currentPoints < cost) return false;
    r.currentPoints -= cost;
    r.dropBonus += 1;
    r.dropPurchaseCount += 1;
    return true;
  }
  if (type === "capture") {
    if (r.capturePurchaseCount >= 100) return false;
    const cost = getCapturePurchaseCost();
    if (r.currentPoints < cost) return false;
    r.currentPoints -= cost;
    r.captureBonus += 1;
    r.capturePurchaseCount += 1;
    return true;
  }
  if (type === "hiddenBoss") {
    if (r.level < 5) return false;
    if (r.hiddenBossUnlocked) return false;
    if (r.currentPoints < 800) return false;
    r.currentPoints -= 800;
    r.hiddenBossUnlocked = true;
    return true;
  }
  return false;
}
