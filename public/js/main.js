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
  updateSortBtn,
  updateExpBar,
  updateFloorJumpOptions,
  renderBook,
  updatePetPanel,
  updateEquippedWeaponInfo,
  renderStatusScreen,
  updateInventoryFilterOptions,
  updatePetFilterOptions,
  updateSynthesisClasses,
  updatePetSortBtnState,
  updateWeaponSortBtnState,
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
import { equipPet, unequipPet, handlePetSynthesisSelection, executePetSynthesis, toggleSelectAllSamePets, getHpBoostMultiplier } from "./pet.js";

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
  updateSortBtn();
  updatePetPanel(handlePetSynthesisClick, handlePetEquip);
  updateEquippedWeaponInfo(refreshUI);
  updateInventoryFilterOptions();
  updatePetFilterOptions();
  saveGame();
  updateFloorJumpOptions(state.floor);
  updatePetSortBtnState();
  updateWeaponSortBtnState();
}

function refreshHpBoost() {
  state.hpBoostMult = getHpBoostMultiplier();
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
    const name = getWeaponDisplayName(state.player.equippedWeapon, { showSeries: true });
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
  refreshUI();
}

function closePetModal() {
  state.ui.petOpen = false;
  state.petSynthesis.baseUid = null;
  state.petSynthesis.materialUids = [];
  refreshUI();
}

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

function isAppearanceModalOpen() {
  return ["eliteOverlay", "legendaryOverlay", "legendUltimateOverlay"].some((id) => {
    const el = document.getElementById(id);
    return el && !el.classList.contains("hidden") && el.dataset.mode === "appear";
  });
}

function doAttack() {
  if (isAppearanceModalOpen()) return;
  handlePhase();
  refreshUI();
}

function startHold() {
  if (attackInterval) return;
  doAttack(); // 最初の1回は即時実行
  attackInterval = setInterval(() => {
    // ゲームオーバーや次フェーズ以外のときだけ連続実行
    if (state.phase === "gameover") {
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
  startHold();
}, { passive: false });
document.addEventListener("touchend", stopHold);

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

// ペットソートボタン
document.getElementById("petSortBtn").addEventListener("click", () => {
  const cycle = { passive: "atk", atk: "book", book: "hp", hp: "passive" };
  state.ui.petSortMode = cycle[state.ui.petSortMode ?? "atk"] ?? "atk";
  const mode = state.ui.petSortMode;
  state.player.petList.sort((a, b) => {
    if (mode === "book") {
      const titleA = a.titleId ?? 1;
      const titleB = b.titleId ?? 1;
      if (titleA !== titleB) return titleA - titleB;
      return a.enemyId - b.enemyId;
    }
    if (mode === "hp") return (b.hp ?? 0) - (a.hp ?? 0);
    if (mode === "passive") return (b.passiveValue ?? 0) - (a.passiveValue ?? 0);
    return b.power - a.power;
  });
  const labels = { atk: "ソート：攻撃力", book: "ソート：図鑑順", hp: "ソート：HP", passive: "ソート：スキル値" };
  document.getElementById("petSortBtn").textContent = labels[mode] ?? "ソート";

  document.querySelectorAll("#petList .pet-group").forEach((groupEl) => {
    const bodyEl = groupEl.querySelector(".pet-group-body");
    if (!bodyEl || bodyEl.classList.contains("hidden")) return;
    const items = [...bodyEl.querySelectorAll("li.pet-item")];
    const uidOrder = state.player.petList.map((p) => String(p.uid));
    items.sort((a, b) => {
      const uidA = a.querySelector("[data-uid]")?.dataset.uid ?? "";
      const uidB = b.querySelector("[data-uid]")?.dataset.uid ?? "";
      return uidOrder.indexOf(uidA) - uidOrder.indexOf(uidB);
    });
    items.forEach((item) => bodyEl.appendChild(item));
  });

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
    state.ui.petFilter = "";
    const sel = document.getElementById("petFilterSelect");
    if (sel) sel.value = "";
    saveGame();
  }
  refreshUI();
});

// =====================
// インベントリ_ソートボタン
// =====================
const inventorySortBtn = document.getElementById("sortBtn");

inventorySortBtn.addEventListener("click", () => {
  const cycle = { passive: "atk", atk: "book", book: "hp", hp: "passive" };
  state.ui.sortMode = cycle[state.ui.sortMode] ?? "atk";
  sortInventory(state.player);
  updateSortBtn();

  document.querySelectorAll("#inventoryList .pet-group").forEach((groupEl) => {
    const bodyEl = groupEl.querySelector(".pet-group-body");
    if (!bodyEl || bodyEl.classList.contains("hidden")) return;
    const items = [...bodyEl.querySelectorAll("li.pet-item")];
    const uidOrder = state.player.inventory.map((w) => String(w.uid));
    items.sort((a, b) => {
      const uidA = a.querySelector("[data-uid]")?.dataset.uid ?? "";
      const uidB = b.querySelector("[data-uid]")?.dataset.uid ?? "";
      return uidOrder.indexOf(uidA) - uidOrder.indexOf(uidB);
    });
    items.forEach((item) => bodyEl.appendChild(item));
  });

  updateSynthesisClasses();
  saveGame();
});

document.getElementById("inventoryFilterSelect").addEventListener("change", (e) => {
  state.ui.inventoryFilter = e.target.value;
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
    state.ui.inventoryFilter = "";
    const sel = document.getElementById("inventoryFilterSelect");
    if (sel) sel.value = "";
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
  renderAchievements();
  document.getElementById("achievementOverlay").classList.remove("hidden");
});
document.getElementById("achievementCloseBtn").addEventListener("click", () => {
  document.getElementById("achievementOverlay").classList.add("hidden");
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
stayChk.checked = state.ui.stayOnFloor ?? false;
stayChk.addEventListener("change", () => {
  state.ui.stayOnFloor = stayChk.checked;
});

// =====================
// 説明ボタン
// =====================
document.getElementById("helpBtn").addEventListener("click", () => {
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
// ゲーム開始
// =====================
if (!loadGame()) {
  init();
} else {
  state.phase = "next";
  state.enemy = null;
  refreshUI();
}

// 10秒ごとに保存
setInterval(() => {
  saveGame();
}, 10000);