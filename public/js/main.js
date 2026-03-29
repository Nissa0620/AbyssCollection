// メイン制御

import { createEnemy } from "./battle.js";
import {
  updateDisplay,
  renderInventory,
  renderGemList,
  updateInventoryTab,
  renderLogs,
  updateButton,
  updateInventoryVisibility,
  updatePetVisibility,
  updateSynthesisUI,
  updateSynthesisInfo,
  updateSynthesisPreview,
  updatePetSynthesisUI,
  sortInventory,
  updateExpBar,
  updateFloorJumpOptions,
  renderBook,
  updatePetPanel,
  updateEquippedWeaponInfo,
  renderStatusScreen,
  updateInventoryFilterOptions,
  updatePetFilterOptions,
  updateSynthesisClasses,
  renderResearchScreen,
  setRefreshCallback,
  setCreateEnemyCallback,
} from "./ui.js";
import { state } from "./state.js";
import { addLog } from "./log.js";
import { handlePhase } from "./gameFlow.js";
import { equipWeapon } from "./inventory.js";
import { getWeaponDisplayName } from "./weapon.js";
import {
  executeSynthesis,
  handleSynthesisSelection,
  toggleSelectAllSameWeapons,
} from "./inventory.js";
import { saveGame, loadGame } from "./saveLoad.js";
import { renderAchievements } from "./achievements.js";
import { rerollMissions } from "./research.js";
import { sendRankingData, fetchRanking, isNameTaken } from "./ranking.js";
import { equipPet, unequipPet, handlePetSynthesisSelection, executePetSynthesis, toggleSelectAllSamePets, getHpBoostMultiplier, getPetPower, getPetHp, calcOverflowBonuses } from "./pet.js";

// =====================
// 初期化
// =====================

function init() {
  state.phase = "next";
  refreshUI();
}

function refreshUI() {
  updateDisplay(state.player, state.enemy);
  updateInventoryTab(state.ui.inventoryTab ?? "weapon");
  renderInventory(state.player, handleInventoryClick, handleEquip);
  renderGemList();
  renderLogs(state.logs);
  updateButton();
  updateInventoryVisibility();
  updatePetVisibility();
  updateSynthesisUI();
  updateSynthesisInfo();
  updateSynthesisPreview();
  updateExpBar();
  updatePetPanel(handlePetSynthesisClick, handlePetEquip);
  updateEquippedWeaponInfo(refreshUI);
  updateInventoryFilterOptions();
  updatePetFilterOptions();
  saveGame();
  updateFloorJumpOptions(state.floor);

  const sortSel = document.getElementById("weaponSortSelect");
  if (sortSel) sortSel.value = state.ui.sortMode ?? "passive";
  const petSortSel = document.getElementById("petSortSelect");
  if (petSortSel) petSortSel.value = state.ui.petSortMode ?? "passive";
  const invNameInp = document.getElementById("inventoryNameInput");
  if (invNameInp) invNameInp.value = state.ui.inventoryNameFilter ?? "";
  const petNameInp = document.getElementById("petNameInput");
  if (petNameInp) petNameInp.value = state.ui.petNameFilter ?? "";
  const wGroupSel = document.getElementById("weaponGroupSortSelect");
  if (wGroupSel) wGroupSel.value = state.ui.weaponGroupSort ?? "acquiredDesc";
  const pGroupSel = document.getElementById("petGroupSortSelect");
  if (pGroupSel) pGroupSel.value = state.ui.petGroupSort ?? "acquiredDesc";

  sortInventory(state.player);
  const petMode = state.ui.petSortMode ?? "passive";
  state.player.petList.sort((a, b) => {
    if (petMode === "hp") return getPetHp(b) - getPetHp(a);
    if (petMode === "passive") return (b.passiveValue ?? 0) - (a.passiveValue ?? 0);
    return getPetPower(b) - getPetPower(a);
  });
}

setRefreshCallback(refreshUI);
setCreateEnemyCallback(createEnemy);

function refreshHpBoost() {
  state.hpBoostMult = getHpBoostMultiplier();
  calcOverflowBonuses();
}

function refreshSynthesisOnly() {
  updateSynthesisUI();
  updateSynthesisInfo();
  updateSynthesisPreview();
  updatePetSynthesisUI();
  updateSynthesisClasses();
  saveGame();
}

function handleInventoryClick(uid) {
  handleSynthesisSelection(uid);
  refreshSynthesisOnly();
}

function handleEquip(uid) {
  if (state.player.equippedWeapon?.uid === uid) {
    const name = getWeaponDisplayName(state.player.equippedWeapon);
    addLog(`⚔️ ${name} を外した`);
    state.player.equippedWeapon = null;
    saveGame();
  } else {
    equipWeapon(uid);
    saveGame();
  }
  refreshHpBoost();
  refreshUI();
}

function handlePetSynthesisClick(uid) {
  handlePetSynthesisSelection(uid);
  refreshSynthesisOnly();
}

function handlePetEquip(uid) {
  const pet = state.player.petList.find((p) => p.uid === uid);
  if (!pet) return;
  if (state.player.equippedPet?.uid === uid) {
    unequipPet();
  } else {
    equipPet(uid);
  }
  refreshHpBoost();
  refreshUI();
}

function closeInventoryModal() {
  state.ui.inventoryOpen = false;
  state.synthesis.baseUid = null;
  state.synthesis.materialUids = [];
  state.ui.weaponOpenGroups = {};
  state.ui.inventoryNameFilter = "";
  const inp = document.getElementById("inventoryNameInput");
  if (inp) inp.value = "";
  refreshUI();
}

function closePetModal() {
  state.ui.petOpen = false;
  state.petSynthesis.baseUid = null;
  state.petSynthesis.materialUids = [];
  state.ui.petOpenGroups = {};
  state.ui.petNameFilter = "";
  const inp = document.getElementById("petNameInput");
  if (inp) inp.value = "";
  refreshUI();
}

// =====================
// その他モーダル
// =====================
document.getElementById("moreBtn").addEventListener("click", () => {
  document.getElementById("moreOverlay").classList.remove("hidden");
});

document.getElementById("moreCloseBtn").addEventListener("click", () => {
  document.getElementById("moreOverlay").classList.add("hidden");
});

document.getElementById("moreOverlay").addEventListener("click", (e) => {
  if (e.target === e.currentTarget) {
    e.currentTarget.classList.add("hidden");
  }
});

// =====================
// ステータスボタン
// =====================
document.getElementById("statusBtn").addEventListener("click", () => {
  renderStatusScreen();
  document.getElementById("statusOverlay").classList.remove("hidden");
});
document.getElementById("statusCloseBtn").addEventListener("click", () => {
  document.getElementById("statusOverlay").classList.add("hidden");
});

// =====================
// 攻撃ボタン
// =====================
const attackBtn = document.getElementById("attackBtn");

let attackInterval = null;
let isTouching = false;

function isHolding() {
  return isTouching && attackInterval !== null;
}

function isAppearanceModalOpen() {
  const modeOverlay = ["eliteOverlay", "legendaryOverlay", "legendUltimateOverlay"].some((id) => {
    const el = document.getElementById(id);
    return el && !el.classList.contains("hidden");
  });
  if (modeOverlay) return true;
  const hiddenBossEl = document.getElementById("hiddenBossOverlay");
  return hiddenBossEl ? !hiddenBossEl.classList.contains("hidden") : false;
}

function doAttack() {
  if (isAppearanceModalOpen()) return;
  handlePhase();
  refreshUI();
}

function startHold() {
  if (attackInterval) return;
  state.isHolding = isHolding;
  doAttack(); // 最初の1回は即時実行
  attackInterval = setInterval(() => {
    // ゲームオーバーや次フェーズ以外のときだけ連続実行
    if (state.phase === "gameover" || state.forceStopHold) {
      state.forceStopHold = false;
      stopHold();
      return;
    }
    doAttack();
  }, 200);
}

function stopHold() {
  if (attackInterval) {
    clearInterval(attackInterval);
    attackInterval = null;
  }
}

// クリック（マウス）
attackBtn.addEventListener("mousedown", startHold);
document.addEventListener("mouseup", stopHold);

// タッチ
attackBtn.addEventListener("touchstart", (e) => {
  e.preventDefault();
  isTouching = true;
  startHold();
}, { passive: false });
document.addEventListener("touchend", () => {
  isTouching = false;
  stopHold();
});

// =====================
// インベントリボタン
// =====================
const inventoryBtn = document.getElementById("inventoryToggleBtn");

inventoryBtn.addEventListener("click", () => {
  state.ui.inventoryOpen = !state.ui.inventoryOpen;
  if (state.ui.inventoryOpen) state.ui.petOpen = false;
  refreshUI();
});

// =====================
// 宝玉 / 武器 タブ切替
// =====================
document.getElementById("invTabWeapon")?.addEventListener("click", () => {
  state.ui.inventoryTab = "weapon";
  updateInventoryTab("weapon");
});
document.getElementById("invTabGem")?.addEventListener("click", () => {
  state.ui.inventoryTab = "gem";
  updateInventoryTab("gem");
  renderGemList();
});

// =====================
// ペットボタン
// =====================
const petToggleBtn = document.getElementById("petToggleBtn");

petToggleBtn.addEventListener("click", () => {
  state.ui.petOpen = !state.ui.petOpen;
  if (state.ui.petOpen) state.ui.inventoryOpen = false;
  refreshUI();
});

// ペットリストのイベント委譲（装備・解除・逃がす）
document.getElementById("petOverlay").addEventListener("click", (e) => {
  // オーバーレイ背景クリックで閉じる
  if (e.target === document.getElementById("petOverlay")) {
    closePetModal();
    return;
  }
  const equipBtn = e.target.closest(".pet-equip-btn");
  const unequipBtn = e.target.closest(".pet-unequip-btn");

  if (equipBtn) {
    equipPet(parseFloat(equipBtn.dataset.uid));
    refreshHpBoost();
    refreshUI();
  } else if (unequipBtn) {
    unequipPet();
    refreshHpBoost();
    refreshUI();
  }
});

// inventoryモーダルを閉じる
document.getElementById("inventoryCloseBtn").addEventListener("click", closeInventoryModal);

// petモーダルを閉じる
document.getElementById("petCloseBtn").addEventListener("click", closePetModal);

// inventoryOverlay 背景クリックで閉じる
document.getElementById("inventoryOverlay").addEventListener("click", (e) => {
  if (e.target === document.getElementById("inventoryOverlay")) closeInventoryModal();
});

// ペットソートセレクト
document.getElementById("petSortSelect").addEventListener("change", (e) => {
  state.ui.petSortMode = e.target.value;
  const mode = state.ui.petSortMode;
  state.player.petList.sort((a, b) => {
    if (mode === "hp") return getPetHp(b) - getPetHp(a);
    if (mode === "passive") return (b.passiveValue ?? 0) - (a.passiveValue ?? 0);
    return getPetPower(b) - getPetPower(a);
  });
  updatePetPanel(handlePetSynthesisClick, handlePetEquip);
  updateSynthesisClasses();
  saveGame();
});

document.getElementById("petFilterSelect").addEventListener("change", (e) => {
  state.ui.petFilter = e.target.value;
  refreshUI();
});

// ペット一括選択ボタン
document.getElementById("petSelectAllBtn").addEventListener("click", () => {
  toggleSelectAllSamePets();
  refreshSynthesisOnly();
});

// ペット合成ボタン
document.getElementById("petSynthesizeBtn").addEventListener("click", () => {
  const success = executePetSynthesis();
  if (!success) {
    state.petSynthesis.baseUid = null;
    state.petSynthesis.materialUids = [];
  }
  if (success) {
    saveGame();
  }
  refreshUI();
});

// =====================
// インベントリ_ソートセレクト
// =====================
document.getElementById("weaponSortSelect").addEventListener("change", (e) => {
  state.ui.sortMode = e.target.value;
  sortInventory(state.player);
  renderInventory(state.player, handleInventoryClick, handleEquip);
  updateSynthesisClasses();
  saveGame();
});

document.getElementById("weaponGroupSortSelect").addEventListener("change", (e) => {
  state.ui.weaponGroupSort = e.target.value;
  renderInventory(state.player, handleInventoryClick, handleEquip);
});

document.getElementById("petGroupSortSelect").addEventListener("change", (e) => {
  state.ui.petGroupSort = e.target.value;
  updatePetPanel(handlePetSynthesisClick, handlePetEquip);
});

document.getElementById("inventoryFilterSelect").addEventListener("change", (e) => {
  state.ui.inventoryFilter = e.target.value;
  refreshUI();
});

// 武器一覧 名前検索
document.getElementById("inventorySearchBtn").addEventListener("click", () => {
  state.ui.inventoryNameFilter = document.getElementById("inventoryNameInput").value.trim();
  refreshUI();
});

// ペット一覧 名前検索
document.getElementById("petSearchBtn").addEventListener("click", () => {
  state.ui.petNameFilter = document.getElementById("petNameInput").value.trim();
  refreshUI();
});

// =====================
// 合成ボタン
// =====================
const synthBtn = document.getElementById("synthesizeBtn");

synthBtn.addEventListener("click", () => {
  const success = executeSynthesis();
  if (!success) {
    state.synthesis.baseUid = null;
    state.synthesis.materialUids = [];
  }
  if (success) {
    saveGame();
  }
  refreshUI();
});

// =====================
// 一括選択ボタン
// =====================
document.getElementById("selectAllBtn").addEventListener("click", () => {
  toggleSelectAllSameWeapons();
  refreshSynthesisOnly();
});

// =====================
// 階層移動ボタン
// =====================
const floorJumpBtn = document.getElementById("floorJumpBtn");
const floorJumpSelect = document.getElementById("floorJumpSelect");
floorJumpBtn.addEventListener("click", () => {
  const target = Number(floorJumpSelect.value);
  if (!target) return;
  state.lastSelectedFloor = target;
  state.floor = target;
  state.phase = "battle";
  createEnemy();

  saveGame();
  refreshUI();
});

// =====================
// 図鑑ボタン
// =====================
document.getElementById("bookBtn").addEventListener("click", () => {
  renderBook("enemies");
  document.getElementById("bookOverlay").classList.remove("hidden");
});

document.getElementById("bookCloseBtn").addEventListener("click", () => {
  document.getElementById("bookOverlay").classList.add("hidden");
  state.ui.bookNameFilter = "";
  const inp = document.getElementById("bookNameInput");
  if (inp) inp.value = "";
});

document.querySelectorAll(".book-tab").forEach((btn) => {
  btn.addEventListener("click", () => {
    renderBook(btn.dataset.tab);
  });
});

// =====================
// 実績ボタン
// =====================
document.getElementById("achievementBtn").addEventListener("click", () => {
  document.getElementById("moreOverlay").classList.add("hidden");
  renderAchievements();
  document.getElementById("achievementOverlay").classList.remove("hidden");
});
document.getElementById("achievementCloseBtn").addEventListener("click", () => {
  document.getElementById("achievementOverlay").classList.add("hidden");
});

// =====================
// 研究所ボタン
// =====================
document.getElementById("researchBtn").addEventListener("click", () => {
  document.getElementById("moreOverlay").classList.add("hidden");
  renderResearchScreen();
  document.getElementById("researchOverlay").classList.remove("hidden");
});

document.getElementById("researchCloseBtn").addEventListener("click", () => {
  document.getElementById("researchOverlay").classList.add("hidden");
});

document.getElementById("donateCloseBtn").addEventListener("click", () => {
  document.getElementById("donateOverlay").classList.add("hidden");
});

document.getElementById("hiddenBossRewardCloseBtn")?.addEventListener("click", () => {
  document.getElementById("hiddenBossRewardOverlay").classList.add("hidden");
  state.phase = "next";
  saveGame();
  refreshUI();
});

document.getElementById("researchRerollBtn").addEventListener("click", () => {
  const success = rerollMissions();
  if (success) {
    renderResearchScreen();
    saveGame();
  }
});

document.querySelectorAll(".research-tab").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".research-tab").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    const tab = btn.dataset.tab;
    document.getElementById("researchMissions").classList.toggle("hidden", tab !== "missions");
    document.getElementById("researchExchange").classList.toggle("hidden", tab !== "exchange");
  });
});

// =====================
// リセットボタン（確認モーダル経由）
// =====================
document.getElementById("resetBtn").addEventListener("click", () => {
  document.getElementById("statusOverlay").classList.add("hidden");
  document.getElementById("resetConfirmOverlay").classList.remove("hidden");
});

document.getElementById("resetCancelBtn").addEventListener("click", () => {
  document.getElementById("resetConfirmOverlay").classList.add("hidden");
  document.getElementById("statusOverlay").classList.remove("hidden");
});

document.getElementById("resetConfirmBtn").addEventListener("click", () => {
  localStorage.removeItem("abyssSave");
  location.reload();
});

// =====================
// このフロアにとどまる
// =====================
const stayChk = document.getElementById("stayOnFloorChk");
stayChk.addEventListener("change", () => {
  state.ui.stayOnFloor = stayChk.checked;
  saveGame();
});

// =====================
// 説明ボタン
// =====================
document.getElementById("helpBtn").addEventListener("click", () => {
  document.getElementById("moreOverlay").classList.add("hidden");
  document.getElementById("helpOverlay").classList.remove("hidden");
});
document.getElementById("helpCloseBtn").addEventListener("click", () => {
  document.getElementById("helpOverlay").classList.add("hidden");
});
document.getElementById("helpOverlay").addEventListener("click", (e) => {
  if (e.target === document.getElementById("helpOverlay")) {
    document.getElementById("helpOverlay").classList.add("hidden");
  }
});
document.querySelectorAll(".accordion-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    const body = document.getElementById(btn.dataset.target);
    const arrow = btn.querySelector(".accordion-arrow");
    const isHidden = body.classList.toggle("hidden");
    if (arrow) arrow.textContent = isHidden ? "▼" : "▲";
  });
});

// =====================
// ランキング
// =====================
function checkPlayerName() {
  if (!state.playerName) {
    document.getElementById("nameInputOverlay").classList.remove("hidden");
  }
}

document.getElementById("playerNameSubmitBtn").addEventListener("click", async () => {
  const input = document.getElementById("playerNameInput").value.trim();
  const errorEl = document.getElementById("nameInputError");

  if (!input) {
    errorEl.textContent = "名前を入力してください";
    errorEl.classList.remove("hidden");
    return;
  }

  const taken = await isNameTaken(input);
  if (taken) {
    errorEl.textContent = "この名前はすでに使われています";
    errorEl.classList.remove("hidden");
    return;
  }

  state.playerName = input;
  saveGame();
  document.getElementById("nameInputOverlay").classList.add("hidden");
  sendRankingData(); // 登録直後に初回送信
});

async function renderRanking(field) {
  const contentEl = document.getElementById("rankingContent");
  contentEl.innerHTML = "<p style='text-align:center;color:#888;padding:16px'>読み込み中...</p>";

  const data = await fetchRanking(field);
  if (data.length === 0) {
    contentEl.innerHTML = "<p style='text-align:center;color:#888;padding:16px'>データがありません</p>";
    return;
  }

  const fieldLabels = {
    maxFloor: (v) => `${v}階`,
    level: (v) => `Lv.${v}`,
    petCount: (v) => `${v}体`,
    weaponCount: (v) => `${v}個`,
    achievementCount: (v) => `${v ?? 0}個`,
  };

  const ul = document.createElement("ul");
  ul.className = "ranking-list";

  data.forEach((entry, i) => {
    const li = document.createElement("li");
    li.className = "ranking-item" + (entry.name === state.playerName ? " my-record" : "");

    const rank = i + 1;
    const rankClass = rank === 1 ? "gold" : rank === 2 ? "silver" : rank === 3 ? "bronze" : "";
    li.innerHTML = `
      <span class="ranking-rank ${rankClass}">${rank}</span>
      <span class="ranking-name">${entry.name}</span>
      <span class="ranking-value">${fieldLabels[field](entry[field])}</span>
    `;
    ul.appendChild(li);
  });

  contentEl.innerHTML = "";
  contentEl.appendChild(ul);
}

const rankingTabNotes = {
  maxFloor: "最深階層数",
  level: "プレイヤーレベル",
  petCount: "捕獲した種族数",
  weaponCount: "取得した武器種数",
  achievementCount: "解放した実績数",
};

document.getElementById("rankingBtn").addEventListener("click", () => {
  document.getElementById("moreOverlay").classList.add("hidden");
  sendRankingData(); // ランキング表示時にも送信チェック
  // タブを最深階層にリセット
  document.querySelectorAll(".ranking-tab").forEach((b) => b.classList.remove("active"));
  document.querySelector(".ranking-tab[data-field='maxFloor']").classList.add("active");
  const noteEl = document.getElementById("rankingTabNote");
  if (noteEl) noteEl.textContent = rankingTabNotes.maxFloor;
  document.getElementById("rankingOverlay").classList.remove("hidden");
  renderRanking("maxFloor");
});

document.getElementById("rankingCloseBtn").addEventListener("click", () => {
  document.getElementById("rankingOverlay").classList.add("hidden");
});

document.querySelectorAll(".ranking-tab").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".ranking-tab").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    const noteEl = document.getElementById("rankingTabNote");
    if (noteEl) noteEl.textContent = rankingTabNotes[btn.dataset.field] ?? "";
    renderRanking(btn.dataset.field);
  });
});

// =====================
// ゲーム開始
// =====================
if (!loadGame()) {
  init();
} else {
  state.phase = "battle";
  state.enemy = null;
  createEnemy(); // 現在のフロアで敵を生成（floor++しない）
  refreshUI();
}
stayChk.checked = state.ui.stayOnFloor ?? false;
checkPlayerName();

// 10秒ごとに保存
setInterval(() => {
  saveGame();
}, 10000);

// 30分ごとにランキング送信
setInterval(() => {
  sendRankingData();
}, 30 * 60 * 1000);