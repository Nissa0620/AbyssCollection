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
  openDonateModal,
} from "./ui.js";
import { state } from "./state.js";
import { addLog } from "./log.js";
import { handlePhase } from "./gameFlow.js";
import {
  equipWeapon,
  executeSynthesis,
  handleSynthesisSelection,
  toggleSelectAllSameWeapons,
  discardWeapons,
  bulkSynthesizeUltimateWeapons,
} from "./inventory.js";
import { getWeaponDisplayName } from "./weapon.js";
import { saveGame, saveGameLocal, loadGame, deleteGame, exportSaveCode, importSaveCode, setupBeforeUnloadSave } from "./saveLoad.js";
import { renderAchievements } from "./achievements.js";
import { rerollMissions, initMissions } from "./research.js";
import { sendRankingData, fetchRanking, isNameTaken } from "./ranking.js";
import { equipPet, unequipPet, handlePetSynthesisSelection, executePetSynthesis, toggleSelectAllSamePets, getHpBoostMultiplier, getPetPower, getPetHp, calcOverflowBonuses, discardPets, bulkSynthesizeUltimatePets } from "./pet.js";
import { isLocked } from "./listPrefs.js";
import { isUltimateWeapon } from "./drop.js";

// =====================
// 初期化
// =====================

let _lastPetSortMode = null;

function init() {
  state.phase = "next";
  refreshUI();
}

// =====================
// 攻撃時専用の軽量UI更新
// 攻撃ボタン押下時はこちらを呼ぶ（refreshUI の代わり）
// 攻撃のたびに変化する情報のみを更新する
// =====================
function refreshBattle() {
  updateDisplay(state.player, state.enemy);
  renderLogs(state.logs);
  updateButton();
  updateExpBar();
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
  updateEquippedWeaponInfo(refreshUI);
  updateInventoryFilterOptions();
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

  // モーダルが開いているときだけソートを実行
  if (state.ui.inventoryOpen) {
    sortInventory(state.player);
  }
  // ペットパネルが開いているときだけ更新する
  if (state.ui.petOpen) {
    updatePetFilterOptions();
    const petMode = state.ui.petSortMode ?? "passive";
    if (petMode !== _lastPetSortMode) {
      _lastPetSortMode = petMode;
      state.player.petList.sort((a, b) => {
        if (petMode === "hp") return getPetHp(b) - getPetHp(a);
        if (petMode === "passive") return (b.passiveValue ?? 0) - (a.passiveValue ?? 0);
        return getPetPower(b) - getPetPower(a);
      });
    }
    updatePetPanel(handlePetSynthesisClick, handlePetEquip);
  }
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
  saveGameLocal();
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
    saveGameLocal();
  } else {
    equipWeapon(uid);
    saveGameLocal();
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
  _lastPetSortMode = null;
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
// 設定モーダル
// =====================
document.getElementById("settingBtn").addEventListener("click", () => {
  document.getElementById("moreOverlay").classList.add("hidden");
  // チェックボックスの状態を現在の設定に合わせる
  document.getElementById("showAppearModalChk").checked = state.ui.showAppearModal ?? true;
  document.getElementById("showCaptureModalChk").checked = state.ui.showCaptureModal ?? true;
  document.getElementById("includeRareInSelectAllChk").checked = state.ui.includeRareInSelectAll ?? false;
  document.getElementById("showHiddenBossModalChk").checked = state.ui.showHiddenBossModal ?? true;
  document.getElementById("skipNonRareDropChk").checked = state.ui.skipNonRareDrop ?? false;
  document.getElementById("currentNameDisplay").textContent = state.playerName ?? "";
  document.getElementById("settingOverlay").classList.remove("hidden");
});

document.getElementById("settingCloseBtn").addEventListener("click", () => {
  document.getElementById("settingOverlay").classList.add("hidden");
});

document.getElementById("settingOverlay").addEventListener("click", (e) => {
  if (e.target === e.currentTarget) {
    e.currentTarget.classList.add("hidden");
  }
});

document.getElementById("showAppearModalChk").addEventListener("change", (e) => {
  state.ui.showAppearModal = e.target.checked;
  saveGameLocal();
});

document.getElementById("showCaptureModalChk").addEventListener("change", (e) => {
  state.ui.showCaptureModal = e.target.checked;
  saveGameLocal();
});

document.getElementById("includeRareInSelectAllChk").addEventListener("change", (e) => {
  state.ui.includeRareInSelectAll = e.target.checked;
  saveGameLocal();
});

document.getElementById("showHiddenBossModalChk").addEventListener("change", (e) => {
  state.ui.showHiddenBossModal = e.target.checked;
  saveGameLocal();
});

document.getElementById("skipNonRareDropChk").addEventListener("change", (e) => {
  state.ui.skipNonRareDrop = e.target.checked;
  saveGameLocal();
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
let isProcessing = false;

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
  if (hiddenBossEl && !hiddenBossEl.classList.contains("hidden")) return true;
  const rewardEl = document.getElementById("hiddenBossRewardOverlay");
  return rewardEl ? !rewardEl.classList.contains("hidden") : false;
}

function doAttack() {
  if (isAppearanceModalOpen()) return;
  if (isProcessing) return;
  isProcessing = true;
  try {
    const result = handlePhase();
    if (result === "floorChanged") {
      refreshUI();      // フロア移動・ゲームオーバー回復時はフル更新
    } else {
      refreshBattle();  // 通常攻撃時は軽量更新
    }
  } finally {
    isProcessing = false;
  }
}

function startHold() {
  if (attackInterval) return;
  state.isHolding = isHolding;
  doAttack(); // 最初の1回は即時実行
  attackInterval = setInterval(() => {
    if (state.forceStopHold) {
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
    equipPet(equipBtn.dataset.uid);
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
  _lastPetSortMode = null;  // 強制的に次のrefreshUIでソートさせる
  const mode = state.ui.petSortMode;
  state.player.petList.sort((a, b) => {
    if (mode === "hp") return getPetHp(b) - getPetHp(a);
    if (mode === "passive") return (b.passiveValue ?? 0) - (a.passiveValue ?? 0);
    return getPetPower(b) - getPetPower(a);
  });
  updatePetPanel(handlePetSynthesisClick, handlePetEquip);
  updateSynthesisClasses();
  saveGameLocal();
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
    saveGameLocal();
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
  saveGameLocal();
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
    saveGameLocal();
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
  calcOverflowBonuses();

  saveGameLocal();
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

// =====================
// 引き継ぎコード
// =====================
document.getElementById("exportCodeBtn").addEventListener("click", async () => {
  const btn = document.getElementById("exportCodeBtn");
  btn.disabled = true;
  btn.textContent = "発行中...";
  const code = await exportSaveCode();
  btn.disabled = false;
  btn.textContent = "引き継ぎコードを発行";
  if (code) {
    document.getElementById("exportCodeDisplay").textContent = code;
    document.getElementById("exportCodeResult").classList.remove("hidden");
  } else {
    alert("コードの発行に失敗しました。通信環境を確認してください。");
  }
});

const copySVG = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>`;
const checkSVG = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#4ade80" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 16 4 11"></polyline></svg>`;

document.getElementById("copyCodeBtn").addEventListener("click", () => {
  const code = document.getElementById("exportCodeDisplay").textContent;
  navigator.clipboard.writeText(code).then(() => {
    document.getElementById("copyCodeBtn").innerHTML = checkSVG;
    setTimeout(() => {
      document.getElementById("copyCodeBtn").innerHTML = copySVG;
    }, 2000);
  });
});

document.getElementById("importCodeBtn").addEventListener("click", async () => {
  const code = document.getElementById("importCodeInput").value.trim();
  if (!code) return;
  const msg = document.getElementById("importCodeMsg");
  msg.textContent = "読み込み中...";
  const result = await importSaveCode(code);
  if (result.success) {
    msg.textContent = "引き継ぎ成功！ページを再読み込みします...";
    setTimeout(() => location.reload(), 1500);
  } else {
    msg.textContent = "失敗：" + result.error;
  }
});


document.getElementById("hiddenBossRewardCloseBtn")?.addEventListener("click", () => {
  document.getElementById("hiddenBossRewardOverlay").classList.add("hidden");
  state.phase = "next";
  saveGameLocal();
  refreshUI();
});

document.getElementById("researchRerollBtn").addEventListener("click", () => {
  const success = rerollMissions();
  if (success) {
    renderResearchScreen();
    saveGameLocal();
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
  deleteGame().finally(() => {
    location.reload();
  });
});

// =====================
// このフロアにとどまる
// =====================
const stayChk = document.getElementById("stayOnFloorChk");
stayChk.addEventListener("change", () => {
  state.ui.stayOnFloor = stayChk.checked;
  saveGameLocal();
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
  saveGameLocal();
  document.getElementById("nameInputOverlay").classList.add("hidden");
  sendRankingData({ force: true }); // 登録直後に初回送信
});

// =====================
// 名前変更（設定モーダル）
// =====================
document.getElementById("changeNameBtn").addEventListener("click", async () => {
  const input = document.getElementById("changeNameInput").value.trim();
  const errorEl = document.getElementById("changeNameError");
  const successEl = document.getElementById("changeNameSuccess");

  errorEl.classList.add("hidden");
  successEl.classList.add("hidden");

  if (!input) {
    errorEl.textContent = "名前を入力してください";
    errorEl.classList.remove("hidden");
    return;
  }

  if (input === state.playerName) {
    errorEl.textContent = "現在と同じ名前です";
    errorEl.classList.remove("hidden");
    return;
  }

  const btn = document.getElementById("changeNameBtn");
  btn.disabled = true;
  errorEl.classList.add("hidden");

  const taken = await isNameTaken(input);
  if (taken) {
    errorEl.textContent = "この名前はすでに使われています";
    errorEl.classList.remove("hidden");
    btn.disabled = false;
    return;
  }

  state.playerName = input;
  saveGameLocal();
  await sendRankingData({ force: true });

  document.getElementById("changeNameInput").value = "";
  successEl.textContent = `「${input}」に変更しました`;
  successEl.classList.remove("hidden");
  document.getElementById("currentNameDisplay").textContent = input;
  btn.disabled = false;
});

document.getElementById("changeNameInput").addEventListener("input", () => {
  document.getElementById("changeNameError").classList.add("hidden");
  document.getElementById("changeNameSuccess").classList.add("hidden");
});

document.getElementById("nameScreenImportBtn").addEventListener("click", async () => {
  const code = document.getElementById("nameScreenImportInput").value.trim();
  if (!code) return;
  const msg = document.getElementById("nameScreenImportMsg");
  const btn = document.getElementById("nameScreenImportBtn");
  msg.textContent = "復元中...";
  btn.disabled = true;
  const result = await importSaveCode(code);
  if (result.success) {
    msg.textContent = "復元成功！読み込んでいます...";
    setTimeout(() => location.reload(), 1500);
  } else {
    msg.textContent = "失敗：" + result.error;
    btn.disabled = false;
  }
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
    maxFloor:         (v) => `${v}階`,
    level:            (v) => `Lv.${v}`,
    petCount:         (v) => `${v}体`,
    weaponCount:      (v) => `${v}個`,
    achievementCount: (v) => `${v ?? 0}個`,
    maxDamage:        (v) => `${(v ?? 0).toLocaleString()}`,
  };

  const ul = document.createElement("ul");
  ul.className = "ranking-list";

  data.forEach((entry, i) => {
    const li = document.createElement("li");
    li.className = "ranking-item" + (entry.uid === window._uid ? " my-record" : "");

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
  maxFloor:         "最深階層数",
  level:            "プレイヤーレベル",
  petCount:         "捕獲した種族数",
  weaponCount:      "取得した武器種数",
  achievementCount: "解放した実績数",
  maxDamage:        "1回の攻撃で与えた最大ダメージ",
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
// 廃棄・一括合成 共通状態
// =====================
let _discardMode = null;    // "weapon" | "pet"
let _discardCondition = null; // "nonUltimate" | "nonRare" | "all"
let _bulkSynthMode = null;  // "weapon" | "pet"

// =====================
// 武器一括廃棄ボタン → 条件選択メニューを表示
// =====================
document.getElementById("weaponDiscardBtn").addEventListener("click", () => {
  _discardMode = "weapon";
  document.getElementById("discardMenuTitle").textContent = "武器の廃棄条件を選択";
  document.getElementById("discardMenuBtn1").textContent = "極個体以外を廃棄（極・ロック・装備中除外）";
  document.getElementById("discardMenuBtn1").dataset.condition = "nonUltimate";
  document.getElementById("discardMenuBtn2").textContent = "全て廃棄（ロック・装備中除外）";
  document.getElementById("discardMenuBtn2").dataset.condition = "all";
  document.getElementById("discardMenuOverlay").classList.remove("hidden");
});

// =====================
// ペット一括廃棄ボタン → 条件選択メニューを表示
// =====================
document.getElementById("petDiscardBtn").addEventListener("click", () => {
  _discardMode = "pet";
  document.getElementById("discardMenuTitle").textContent = "ペットの廃棄条件を選択";
  document.getElementById("discardMenuBtn1").textContent = "レア個体以外を廃棄（極・伝説・究極・ロック・装備中除外）";
  document.getElementById("discardMenuBtn1").dataset.condition = "nonRare";
  document.getElementById("discardMenuBtn2").textContent = "全て廃棄（ロック・装備中除外）";
  document.getElementById("discardMenuBtn2").dataset.condition = "all";
  document.getElementById("discardMenuOverlay").classList.remove("hidden");
});

// =====================
// 廃棄条件選択メニュー：条件ボタン
// =====================
["discardMenuBtn1", "discardMenuBtn2"].forEach((id) => {
  document.getElementById(id).addEventListener("click", (e) => {
    _discardCondition = e.currentTarget.dataset.condition;
    document.getElementById("discardMenuOverlay").classList.add("hidden");

    // 廃棄対象が0件かどうかプレビューチェック
    let count = 0;
    if (_discardMode === "weapon") {
      const inv = state.player.inventory;
      const equippedUid = state.player.equippedWeapon?.uid ?? null;
      count = inv.filter((w) => {
        if (isLocked(w.uid)) return false;
        if (w.uid === equippedUid) return false;
        if (_discardCondition === "nonUltimate") return !isUltimateWeapon(w);
        return true;
      }).length;
    } else {
      const petList = state.player.petList;
      const equippedUid = state.player.equippedPet?.uid ?? null;
      count = petList.filter((p) => {
        if (isLocked(p.uid)) return false;
        if (p.uid === equippedUid) return false;
        if (_discardCondition === "nonRare") return !p.isElite && !p.isLegendary && !p.isLegendUltimate;
        return true;
      }).length;
    }

    if (count === 0) {
      addLog("廃棄対象がありません");
      return;
    }

    document.getElementById("discardConfirmMsg").textContent =
      `選択した条件で廃棄しますか？`;
    document.getElementById("discardConfirmOverlay").classList.remove("hidden");
  });
});

// 廃棄条件メニュー：キャンセル
document.getElementById("discardMenuCancelBtn").addEventListener("click", () => {
  document.getElementById("discardMenuOverlay").classList.add("hidden");
  _discardMode = null;
  _discardCondition = null;
});

// 廃棄確認：キャンセル
document.getElementById("discardCancelBtn").addEventListener("click", () => {
  document.getElementById("discardConfirmOverlay").classList.add("hidden");
  _discardMode = null;
  _discardCondition = null;
});

// 廃棄確認：実行
document.getElementById("discardConfirmBtn").addEventListener("click", () => {
  document.getElementById("discardConfirmOverlay").classList.add("hidden");
  let count = 0;
  if (_discardMode === "weapon") {
    count = discardWeapons(_discardCondition);
  } else if (_discardMode === "pet") {
    count = discardPets(_discardCondition);
  }
  _discardMode = null;
  _discardCondition = null;
  if (count > 0) saveGameLocal();
  refreshUI();
});

// =====================
// 武器一括合成ボタン → 確認ダイアログ表示
// =====================
document.getElementById("weaponBulkSynthBtn").addEventListener("click", () => {
  _bulkSynthMode = "weapon";
  document.getElementById("bulkSynthConfirmMsg").textContent =
    "極武器もしくはスキル効果量が最も大きい個体をベースに、武器を一括合成しますか？";
  document.getElementById("bulkSynthConfirmOverlay").classList.remove("hidden");
});

// =====================
// ペット一括合成ボタン → 確認ダイアログ表示
// =====================
document.getElementById("petBulkSynthBtn").addEventListener("click", () => {
  _bulkSynthMode = "pet";
  document.getElementById("bulkSynthConfirmMsg").textContent =
    "最もレアな個体をベースに、ペットを一括合成しますか？";
  document.getElementById("bulkSynthConfirmOverlay").classList.remove("hidden");
});

// 一括合成確認：キャンセル
document.getElementById("bulkSynthCancelBtn").addEventListener("click", () => {
  document.getElementById("bulkSynthConfirmOverlay").classList.add("hidden");
  _bulkSynthMode = null;
});

// 一括合成確認：実行（武器・ペット共用）
document.getElementById("bulkSynthConfirmBtn").addEventListener("click", () => {
  document.getElementById("bulkSynthConfirmOverlay").classList.add("hidden");
  let count = 0;
  if (_bulkSynthMode === "weapon") {
    count = bulkSynthesizeUltimateWeapons();
  } else if (_bulkSynthMode === "pet") {
    count = bulkSynthesizeUltimatePets();
  }
  _bulkSynthMode = null;
  if (count > 0) saveGameLocal();
  refreshUI();
});

// =====================
// ゲーム開始
// =====================
loadGame().then((loaded) => {
  // ローディング画面を非表示にする
  document.getElementById("loadingOverlay").classList.add("hidden");

  if (!loaded) {
    init();
  } else {
    state.phase = "battle";
    state.enemy = null;
    createEnemy(); // 現在のフロアで敵を生成（floor++しない）

    // 旧形式（requiredLevelあり）のミッションが残っていれば強制リセット
    const hasLegacyMission = state.research.missions.some(m => m.requiredLevel != null);
    if (hasLegacyMission) {
      initMissions();
      saveGameLocal();
    }

    refreshUI();
  }
  stayChk.checked = state.ui.stayOnFloor ?? false;
  checkPlayerName();
});

// ページを閉じる前にCloud Storageへの保存を試みる
setupBeforeUnloadSave();

// 手動セーブボタン
const saveSVG = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg>`;
const saveCheckSVG = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#4ade80" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 16 4 11"></polyline></svg>`;

document.getElementById("manualSaveBtn").addEventListener("click", async () => {
  const btn = document.getElementById("manualSaveBtn");
  const savingOverlay = document.getElementById("savingOverlay");

  btn.disabled = true;
  savingOverlay.classList.remove("hidden");   // セーブ中モーダルを表示

  await saveGame();

  savingOverlay.classList.add("hidden");      // セーブ完了後に非表示
  btn.innerHTML = saveCheckSVG;
  setTimeout(() => {
    btn.disabled = false;
    btn.innerHTML = saveSVG;
  }, 2000);
});


// 30分ごとにランキング送信
setInterval(() => {
  sendRankingData();
}, 30 * 60 * 1000);