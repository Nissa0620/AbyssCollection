import { normalEnemies, bossEnemies } from "./data/index.js";
import { state } from "./state.js";
import { hiddenBossDefs } from "./hiddenBossData.js";

// =====================
// ミッションパターン定義
// =====================
const MISSION_PATTERNS = [
  { isRare: false, requiredLevel: 5,  rewardPoints: 1,  weight: 30 },
  { isRare: false, requiredLevel: 10, rewardPoints: 2,  weight: 30 },
  { isRare: false, requiredLevel: 20, rewardPoints: 3,  weight: 30 },
  { isRare: true,  requiredLevel: 5,  rewardPoints: 10, weight: 3  },
  { isRare: true,  requiredLevel: 10, rewardPoints: 15, weight: 3  },
  { isRare: true,  requiredLevel: 20, rewardPoints: 20, weight: 4  },
];
// 合計weight=100、レア合計=10/100=10%

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
  const totalWeight = MISSION_PATTERNS.reduce((sum, p) => sum + p.weight, 0);
  let rand = Math.random() * totalWeight;
  let pattern = MISSION_PATTERNS[MISSION_PATTERNS.length - 1];
  for (const p of MISSION_PATTERNS) {
    rand -= p.weight;
    if (rand <= 0) { pattern = p; break; }
  }

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
  if (pet.isHiddenBoss) return false;   // 隠しボスペットは寄贈不可
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

// リロールコストを返す（将来的に研究所レベルで変動させる場合はここを修正）
export function getRerollCost() {
  return 1;
}

export function rerollMissions() {
  const cost = getRerollCost();
  if (state.research.currentPoints < cost) return false;
  state.research.currentPoints -= cost;
  initMissions();
  return true;
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
  for (const def of hiddenBossDefs) {
    const sinKey = def.id.replace("hidden_", "");
    if (type === `hiddenBoss_${sinKey}`) {
      const key = def.unlockKey;
      if (r.level < 5) return false;
      if (r[key]) return false;
      if (r.currentPoints < 300) return false;
      r.currentPoints -= 300;
      r[key] = true;
      return true;
    }
  }
  return false;
}
