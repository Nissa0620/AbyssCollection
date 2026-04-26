import { state } from "./state.js";
import { getTitleName } from "./data/index.js";
import { addLog } from "./log.js";
import { getSynthesisPreview, toggleAutoWeaponSynthTarget, isAutoWeaponSynthTarget, tryAutoWeaponSynth } from "./inventory.js";
import { isFavorite, toggleFavorite, isLocked, toggleLock, getLockedSet } from "./listPrefs.js";
import { isUltimateWeapon } from "./drop.js";
import { isUltimatePet, getPetSynthesisPreview, getPetPower, getPetHp, toggleSelectAllSamePets, passiveLabels, calcOverflowBonuses, toggleAutoSynthTarget, isAutoSynthTarget } from "./pet.js";
import {
  checkMissionCompletion,
  donatePet,
  donatePets,
  exchangeReward,
  getAtkPurchaseCost,
  getHpPurchaseCost,
  getExpPurchaseCost,
  getDropPurchaseCost,
  getCapturePurchaseCost,
  getRerollCost,
  rerollMissions,
  initMissions,
} from "./research.js";
import { saveGameLocal } from "./saveLoad.js";
import { getWeaponDisplayName } from "./weapon.js";
import { hiddenBossDefs } from "./hiddenBossData.js";
import { registerHiddenWeaponObtained, checkPetV1Complete } from "./book.js";
import { checkAchievements } from "./achievements.js";
import {
  normalEnemies,
  bossEnemies,
  enemyTitles,
  bossTitles,
  legendaryTitles,
  floorTable,
  getCurrentArea,
  weaponTemplates,
  normalPassiveOf,
  isLegendaryPassive,
} from "./data/index.js";

// renderLogs 用：前回レンダリング済みのログ件数を記憶
let _lastLogCount = 0;

// updateDisplay 用：前回表示した値を記憶
const _displayCache = {
  playerHp: null,
  enemyHp: null,
  enemyName: null,
  floorDisplay: null,
  playerAttack: null,
};

// main.js からコールバックを受け取る（循環import回避）
let _refreshUICallback = null;
export function setRefreshCallback(fn) { _refreshUICallback = fn; }
let _createEnemyCallback = null;
export function setCreateEnemyCallback(fn) { _createEnemyCallback = fn; }

// 表示更新処理
export function updateDisplay(player, enemy) {
  const vals = {
    playerHp:     "HP : " + player.hp + " / " + player.totalHp,
    enemyHp:      enemy ? "HP : " + enemy.hp + " / " + enemy.totalHp : "",
    enemyName:    enemy ? enemy.name : "???",
    floorDisplay: "地下" + state.floor + "階層",
    playerAttack: "攻撃力 : " + player.totalPower,
  };

  for (const [id, val] of Object.entries(vals)) {
    if (_displayCache[id] !== val) {
      document.getElementById(id).textContent = val;
      _displayCache[id] = val;
    }
  }

  const nextExpEl = document.getElementById("nextExp");
  if (nextExpEl) nextExpEl.textContent = "";
}

// インベントリ表示処理
export function renderInventory(player, onItemClick, onEquip) {
  if (!state.ui.inventoryOpen) return;
  const list = document.getElementById("inventoryList");
  list.innerHTML = "";

  const filter     = state.ui.inventoryFilter ?? "";
  const nameFilter = (state.ui.inventoryNameFilter ?? "").toLowerCase();

  // スキルフィルターのみアイテム単位で適用（nameFilterはグループ化後に適用）
  const items = filter
    ? player.inventory.filter((item) => item.passive === filter)
    : player.inventory;

  if (items.length === 0) {
    const empty = document.createElement("li");
    empty.className = "pet-empty";
    empty.textContent = player.inventory.length === 0 ? "武器がありません" : "該当する武器がありません";
    list.appendChild(empty);
    return;
  }

  // templateId ごとにグループ化
  const groups = new Map();
  for (const item of items) {
    const key = item.templateId;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(item);
  }

  list.innerHTML = "";

  // state.ui.weaponOpenGroups のクリーンアップ
  if (state.ui.weaponOpenGroups) {
    const validKeys = new Set([...groups.keys()].map((k) => `weapon_${k}`));
    for (const key of Object.keys(state.ui.weaponOpenGroups)) {
      if (!validKeys.has(key)) delete state.ui.weaponOpenGroups[key];
    }
  }

  // お気に入り + グループソート
  const sortedGroups = [...groups.entries()].sort(([keyA, itemsA], [keyB, itemsB]) => {
    const favA = isFavorite(`weapon_${keyA}`) ? 0 : 1;
    const favB = isFavorite(`weapon_${keyB}`) ? 0 : 1;
    if (favA !== favB) return favA - favB;
    const mode = state.ui.weaponGroupSort ?? "acquiredDesc";
    const maxOrderA = Math.max(...itemsA.map((w) => w.acquiredOrder ?? 0));
    const maxOrderB = Math.max(...itemsB.map((w) => w.acquiredOrder ?? 0));
    if (mode === "acquiredDesc") return maxOrderB - maxOrderA;
    if (mode === "acquiredAsc")  return maxOrderA - maxOrderB;
    if (mode === "bookAsc")      return Number(keyA) - Number(keyB);
    if (mode === "bookDesc")     return Number(keyB) - Number(keyA);
    return 0;
  });

  const filteredGroups = nameFilter
    ? sortedGroups.filter(([templateId, groupItems]) => {
        const template = weaponTemplates.find((t) => t.id === templateId);
        // templateがない場合（隠しボス武器等）はアイテムの名前で判定
        if (!template) {
          const itemName = (groupItems[0]?.name ?? "").toLowerCase();
          return itemName.includes(nameFilter);
        }
        const baseName = template.name.toLowerCase();
        if (baseName.includes(nameFilter)) return true;
        return (template.evolutions ?? []).some(
          (evo) => evo.name.toLowerCase().includes(nameFilter)
        );
      })
    : sortedGroups;

  for (const [templateId, groupItems] of filteredGroups) {
    const template = weaponTemplates.find((t) => t.id === templateId);
    const baseName = template?.name ?? groupItems[0]?.name ?? "不明な武器";

    // 所持中の最高進化名を取得
    const maxLevel = Math.max(...groupItems.map((w) => w.level ?? 0));
    const evoName = template?.evolutions
      ? [...template.evolutions].reverse().find((e) => maxLevel >= e.level)?.name ?? null
      : null;
    const displayName = evoName ?? baseName;

    // 通常スキル名（隠しボス武器はtemplateがないためアイテムのpassiveを直接参照）
    // legend系キーは通常スキルキーに変換してからラベルを取得（ペットのgetNormalSkillLabelと同方式）
    const passiveKey = template?.passive ?? groupItems[0]?.passive ?? null;
    const normalPassiveKey = passiveKey && isLegendaryPassive(passiveKey)
      ? normalPassiveOf(passiveKey)
      : passiveKey;
    const skillLabel = normalPassiveKey ? weaponPassiveLabel(normalPassiveKey) : "";

    const groupKey = `weapon_${templateId}`;
    const fav = isFavorite(groupKey);

    const groupEl = document.createElement("div");
    groupEl.className = "pet-group";

    const headerEl = document.createElement("div");
    headerEl.className = "pet-group-header";
    const isHiddenBossWeaponGroup = groupItems.some((w) => w.isHiddenBossDrop);
    if (isHiddenBossWeaponGroup) headerEl.classList.add("hidden-boss-group");
    // 極武器ランプ判定（isUltimateWeapon = 全ステ最大値、ペットの極個体に相当）
    const hasEliteWeapon = groupItems.some((w) => isUltimateWeapon(w));
    const weaponLampsHtml = hasEliteWeapon
      ? '<span class="rare-lamps"><span class="rare-lamp lamp-elite"></span></span>'
      : '';

    headerEl.innerHTML = `
      <button class="group-fav-btn ${fav ? "fav-on" : ""}" data-group-key="${groupKey}">${fav ? "♥" : "♡"}</button>
      <span class="pet-group-name">⚔️ ${displayName}</span>
      <span class="pet-group-skill">${skillLabel}</span>
      ${weaponLampsHtml}
      <span class="pet-group-count">× ${groupItems.length}</span>
      <span class="pet-group-toggle">▶</span>
      <button class="group-close-btn hidden">✕</button>
    `;

    headerEl.querySelector(".group-fav-btn").addEventListener("click", (e) => {
      e.stopPropagation();
      toggleFavorite(groupKey);
      const isNowFav = isFavorite(groupKey);
      e.currentTarget.classList.toggle("fav-on", isNowFav);
      e.currentTarget.textContent = isNowFav ? "♥" : "♡";

      const parentList = list;
      const allGroups = [...parentList.querySelectorAll(".pet-group")];
      allGroups.sort((a, b) => {
        const btnA = a.querySelector(".group-fav-btn");
        const btnB = b.querySelector(".group-fav-btn");
        const favA = btnA?.classList.contains("fav-on") ? 0 : 1;
        const favB = btnB?.classList.contains("fav-on") ? 0 : 1;
        if (favA !== favB) return favA - favB;
        const keyA = btnA?.dataset.groupKey ?? "";
        const keyB = btnB?.dataset.groupKey ?? "";
        const idA = parseInt(keyA.replace(/^weapon_/, "")) || 0;
        const idB = parseInt(keyB.replace(/^weapon_/, "")) || 0;
        return idA - idB;
      });
      allGroups.forEach((g) => parentList.appendChild(g));
    });

    const bodyEl = document.createElement("ul");
    bodyEl.className = "pet-group-body hidden";

    // 開閉状態の復元
    const isStoredOpen = state.ui.weaponOpenGroups?.[groupKey] === true;
    if (isStoredOpen) {
      bodyEl.innerHTML = "";
      renderWeaponGroupBody(bodyEl, groupItems, onItemClick, onEquip);
      bodyEl.classList.remove("hidden");
    }

    const closeBtn = headerEl.querySelector(".group-close-btn");
    if (isStoredOpen) {
      headerEl.querySelector(".pet-group-toggle").textContent = "▼";
      closeBtn.classList.remove("hidden");
    }

    headerEl.addEventListener("click", () => {
      const isOpen = !bodyEl.classList.contains("hidden");
      if (isOpen) return;

      bodyEl.innerHTML = "";
      renderWeaponGroupBody(bodyEl, groupItems, onItemClick, onEquip);
      bodyEl.classList.remove("hidden");
      headerEl.querySelector(".pet-group-toggle").textContent = "▼";
      closeBtn.classList.remove("hidden");
      state.ui.weaponOpenGroups[groupKey] = true;
      updateSynthesisClasses();
      updateWeaponSortBtnState();
    });

    closeBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      state.synthesis.baseUid = null;
      state.synthesis.materialUids = [];
      bodyEl.classList.add("hidden");
      headerEl.querySelector(".pet-group-toggle").textContent = "▶";
      closeBtn.classList.add("hidden");
      delete state.ui.weaponOpenGroups[groupKey];
      updateSynthesisUI();
      updateSynthesisPreview();
      updateSynthesisClasses();
      updateWeaponSortBtnState();
    });

    groupEl.appendChild(headerEl);
    groupEl.appendChild(bodyEl);
    list.appendChild(groupEl);
  }
}

function renderWeaponGroupBody(bodyEl, groupItems, onItemClick, onEquip) {
  const lockedSet = getLockedSet();
  groupItems.forEach((item) => {
    const isEquipped = state.player.equippedWeapon === item;
    const displayName = getWeaponDisplayName(item);

    const li = document.createElement("li");
    const isUltW = isUltimateWeapon(item);
    li.className = "pet-item" + (isEquipped ? " equipped" : "") + (isUltW ? " ultimate" : "");

    // 合成選択クラス（常時）
    li.classList.remove("synth-base", "synth-material", "synth-candidate", "synth-disabled");

    const baseUid = state.synthesis.baseUid;
    const isBase = item.uid === baseUid;
    const isMaterial = state.synthesis.materialUids.includes(item.uid);
    if (isBase) {
      li.classList.add("synth-base");
    } else if (isMaterial) {
      li.classList.add("synth-material");
    } else if (baseUid !== null) {
      const base = state.player.inventory.find((w) => w.uid === baseUid);
      const isCandidate = base && item.templateId === base.templateId;
      if (isCandidate) {
        li.classList.add("synth-candidate");
      } else {
        li.classList.add("synth-disabled");
      }
    }

    const weaponPassiveText = item.passive
      ? `${weaponPassiveLabel(item.passive)}${item.passiveValue != null ? `(${item.passiveValue}%)` : ""}`
      : "";
    const locked = lockedSet.has(String(item.uid));
    const isAutoWeapon = isAutoWeaponSynthTarget(item.uid);
    const isWeaponAutoFull = (state.autoSynth?.weaponUids?.length ?? 0) >= 4;
    li.innerHTML = `
      <div class="pet-item-bar"></div>
      <div class="pet-item-body">
        <div class="item-row-1">
          <span class="pet-name">⚔️ ${displayName}${item.level > 0 ? ` <span class="weapon-level">+${item.level}</span>` : ""}</span>
          <div class="pet-actions">
            ${isBase ? '<span class="synth-badge synth-badge-base">BASE</span>' : ""}
            ${isMaterial ? '<span class="synth-badge synth-badge-material">素材</span>' : ""}
            ${isEquipped
              ? `<button class="weapon-unequip-btn" data-uid="${item.uid}">外す</button>`
              : `<button class="weapon-equip-btn" data-uid="${item.uid}">装備</button>`
            }
            <button class="pet-lock-btn ${locked ? "lock-on" : ""}" data-uid="${item.uid}">${locked ? "🔒" : "🔓"}</button>
            <button class="pet-auto-synth-btn${isAutoWeapon ? " active" : ""}" data-uid="${item.uid}" title="${isAutoWeapon ? "自動合成から解除" : "自動合成に登録"}"${!isAutoWeapon && isWeaponAutoFull ? " disabled" : ""}>🔄</button>
          </div>
        </div>
        <div class="item-row-2">
          <span class="pet-atk">ATK ${item.totalAtk}(${item.baseAtk})</span>
          <span class="pet-atk">HP +${item.totalHp ?? 0}(${item.baseHp ?? 0})</span>
          ${weaponPassiveText ? `<span class="pet-passive">${weaponPassiveText}</span>` : ""}
        </div>
      </div>
    `;

    // カード全体クリックで合成選択（ボタン部分は除外、ロック中は素材選択不可）
    li.onclick = (e) => {
      e.stopPropagation();
      if (e.target.closest("button")) return;
      const isBase = item.uid === state.synthesis.baseUid;
      if (lockedSet.has(String(item.uid)) && state.synthesis.baseUid !== null && !isBase) return;
      onItemClick(item.uid);
    };

    // 装備ボタン（合成選択とは独立）
    li.querySelector(".weapon-equip-btn, .weapon-unequip-btn")
      ?.addEventListener("click", (e) => {
        e.stopPropagation();
        onEquip(item.uid);
      });

    // ロックボタン
    li.querySelector(".pet-lock-btn")?.addEventListener("click", (e) => {
      e.stopPropagation();
      toggleLock(item.uid);
      const btn = e.currentTarget;
      const nowLocked = isLocked(item.uid);
      btn.classList.toggle("lock-on", nowLocked);
      btn.textContent = nowLocked ? "🔒" : "🔓";
    });

    // 自動合成ボタン（武器）
    li.querySelector(".pet-auto-synth-btn")?.addEventListener("click", (e) => {
      e.stopPropagation();
      toggleAutoWeaponSynthTarget(item.uid);
      saveGameLocal();
      if (_refreshUICallback) _refreshUICallback();
    });

    bodyEl.appendChild(li);
  });
}

export function sortInventory(player) {
  const mode = state.ui.sortMode;
  player.inventory.sort((a, b) => {
    if (mode === "hp")      return (b.totalHp ?? 0) - (a.totalHp ?? 0);
    if (mode === "passive") return (b.passiveValue ?? 0) - (a.passiveValue ?? 0);
    return b.totalAtk - a.totalAtk; // atk
  });
}

export function updateSortBtn() {
  const btn = document.getElementById("sortBtn");
  if (!btn) return;
  const labels = { atk: "攻撃力", hp: "HP", passive: "スキル値" };
  btn.textContent = labels[state.ui.sortMode] ?? "攻撃力";
}

export function updateInventoryVisibility() {
  const invOverlay  = document.getElementById("inventoryOverlay");
  const itemOverlay = document.getElementById("itemOverlay");

  if (state.ui.inventoryOpen) {
    invOverlay.classList.remove("hidden");
  } else {
    invOverlay.classList.add("hidden");
  }

  if (state.ui.itemOpen) {
    itemOverlay.classList.remove("hidden");
  } else {
    itemOverlay.classList.add("hidden");
  }
}

export function updatePetVisibility() {
  const overlay = document.getElementById("petOverlay");
  if (state.ui.petOpen) {
    overlay.classList.remove("hidden");
  } else {
    overlay.classList.add("hidden");
  }
}

export function updateSynthesisInfo() {
  if (!state.ui.inventoryOpen) return;
  const info = document.getElementById("synthesisInfo");
  if (!info) return;
  const { baseUid, materialUids } = state.synthesis;
  if (!baseUid) {
    info.classList.remove("hidden");
    info.innerHTML = `<span class="synth-hint-text">⚔️ 武器をタップしてベースを選択</span>`;
  } else if (materialUids.length === 0) {
    const base = state.player.inventory.find((w) => w.uid === baseUid);
    const candidateCount = base
      ? state.player.inventory.filter(
          (w) => w.uid !== baseUid && w.templateId === base.templateId
        ).length
      : 0;
    info.classList.remove("hidden");
    if (candidateCount === 0) {
      info.innerHTML = `<span class="synth-hint-text">⚠️ 合成できる素材がありません</span>`;
    } else {
      info.innerHTML = `<span class="synth-hint-text hint-base">🔵 ベース選択中 — 同じ種類の武器をタップして素材に追加</span>`;
    }
  } else {
    info.classList.remove("hidden");
    info.innerHTML = `<span class="synth-hint-text hint-material">🔴 素材 ${materialUids.length}個選択中 — 合成するを押して強化！</span>`;
  }
}

// =====================
// 宝玉タブ表示
// =====================
export function renderGemList() {
  if (!state.ui.itemOpen) return;
  const section  = document.getElementById("itemGemSection");
  const listEl   = document.getElementById("gemList");
  // gemBonusSummaryエリアを非表示にする
  const summaryEl = document.getElementById("gemBonusSummary");
  if (summaryEl) summaryEl.style.display = "none";
  if (!section || !listEl) return;

  const gemsRaw = state.player.gems;
  const copperCount = Array.isArray(gemsRaw)
    ? gemsRaw.filter((g) => g.id === 1).length
    : (gemsRaw?.copper ?? 0);
  const silverCount = Array.isArray(gemsRaw)
    ? gemsRaw.filter((g) => g.id === 2).length
    : (gemsRaw?.silver ?? 0);
  const goldCount = Array.isArray(gemsRaw)
    ? gemsRaw.filter((g) => g.id === 3).length
    : (gemsRaw?.gold ?? 0);

  listEl.innerHTML = "";

  if (copperCount + silverCount + goldCount === 0) {
    const li = document.createElement("li");
    li.className = "pet-empty";
    li.textContent = "宝玉がありません（ボスを倒すと入手できます）";
    listEl.appendChild(li);
    return;
  }

  const grouped = [
    { rarity: "gold",   name: "金の宝玉",  atkBonus: 10, count: goldCount },
    { rarity: "silver", name: "銀の宝玉",  atkBonus: 5,  count: silverCount },
    { rarity: "copper", name: "銅の宝玉",  atkBonus: 3,  count: copperCount },
  ];

  grouped.filter((g) => g.count > 0).forEach((g) => {
    const li = document.createElement("li");
    li.className = "abyss-item-card";
    li.innerHTML = `
      <div class="abyss-item-row1">
        <span class="abyss-item-name">${g.name}</span>
        <span class="abyss-item-count">${g.count.toLocaleString()}</span>
      </div>
      <div class="abyss-item-row2">
        <span class="abyss-item-effect">ATKが${g.atkBonus}ずつ増加</span>
      </div>
    `;
    listEl.appendChild(li);
  });
}

// =====================
// 証タブ表示
// =====================
export function renderBadgeList() {
  if (!state.ui.itemOpen) return;
  const section = document.getElementById("itemBadgeSection");
  if (!section) return;

  const owned = hiddenBossDefs.filter(def => state.research[def.unlockKey]);

  if (owned.length === 0) {
    section.innerHTML = `<p class="item-empty-msg">証はまだありません</p>`;
    return;
  }

  // badgeEnabled 未初期化の場合は初期化
  if (!state.ui.badgeEnabled) state.ui.badgeEnabled = {};

  const ul = document.createElement("ul");
  ul.className = "abyss-item-list";

  owned.forEach(def => {
    // 未設定はデフォルトでオン
    if (state.ui.badgeEnabled[def.unlockKey] === undefined) {
      state.ui.badgeEnabled[def.unlockKey] = true;
    }
    const isOn = state.ui.badgeEnabled[def.unlockKey];

    const li = document.createElement("li");
    li.className = "abyss-item-card";
    li.innerHTML = `
      <div class="abyss-item-row1">
        <span class="abyss-item-name">${def.itemName}</span>
        <button class="badge-toggle-btn ${isOn ? "badge-on" : "badge-off"}"
                data-key="${def.unlockKey}">
          ${isOn ? "ON" : "OFF"}
        </button>
      </div>
      <div class="abyss-item-row2">
        <span class="abyss-item-effect">${def.name}に挑む証</span>
      </div>
    `;
    ul.appendChild(li);
  });

  section.innerHTML = "";
  section.appendChild(ul);
}

// =====================
// その他タブ表示
// =====================
export function renderOtherItemList() {
  if (!state.ui.itemOpen) return;
  const section = document.getElementById("itemOtherSection");
  if (!section) return;

  const r = state.research;

  const buffs = [
    {
      count: r.atkPurchaseCount ?? 0,
      label: "ATKバフ",
      effect: "ATKが10ずつ増加",
    },
    {
      count: r.hpPurchaseCount ?? 0,
      label: "HPバフ",
      effect: "HPが30ずつ増加",
    },
    {
      count: r.expPurchaseCount ?? 0,
      label: "経験値バフ",
      effect: "経験値が10%ずつ増加",
    },
    {
      count: r.dropPurchaseCount ?? 0,
      label: "ドロップバフ",
      effect: "ドロップ率が1%ずつ増加",
    },
    {
      count: r.capturePurchaseCount ?? 0,
      label: "捕獲バフ",
      effect: "捕獲率が1%ずつ増加",
    },
  ].filter(b => b.count > 0);

  if (buffs.length === 0) {
    section.innerHTML = `<p class="item-empty-msg">交換済みのバフはありません</p>`;
    return;
  }

  const ul = document.createElement("ul");
  ul.className = "abyss-item-list";

  buffs.forEach(b => {
    const li = document.createElement("li");
    li.className = "abyss-item-card";
    li.innerHTML = `
      <div class="abyss-item-row1">
        <span class="abyss-item-name">${b.label}</span>
        <span class="abyss-item-count">${b.count.toLocaleString()}</span>
      </div>
      <div class="abyss-item-row2">
        <span class="abyss-item-effect">${b.effect}</span>
      </div>
    `;
    ul.appendChild(li);
  });

  section.innerHTML = "";
  section.appendChild(ul);
}

// =====================
// スキルフィルタ選択肢を所持品に合わせて動的更新
// =====================
export function updateInventoryFilterOptions() {
  if (!state.ui.inventoryOpen) return;
  const select = document.getElementById("inventoryFilterSelect");
  if (!select) return;
  const currentValue = select.value;
  const passives = [...new Set(
    state.player.inventory.filter((item) => item.passive).map((item) => item.passive)
  )].sort();
  select.innerHTML = '<option value="">すべて</option>';
  passives.forEach((passive) => {
    const opt = document.createElement("option");
    opt.value = passive;
    opt.textContent = weaponPassiveLabel(passive);
    select.appendChild(opt);
  });
  const stateFilter = state.ui.inventoryFilter ?? "";
  if (passives.includes(stateFilter)) {
    select.value = stateFilter;
  } else {
    select.value = "";
    state.ui.inventoryFilter = "";
  }
}

export function updatePetFilterOptions() {
  if (!state.ui.petOpen) return;
  const select = document.getElementById("petFilterSelect");
  if (!select) return;
  const passives = [...new Set(
    state.player.petList.filter((p) => p.passive).map((p) => p.passive)
  )].sort();
  select.innerHTML = '<option value="">すべて</option>';
  passives.forEach((passive) => {
    const opt = document.createElement("option");
    opt.value = passive;
    opt.textContent = passiveLabelText({ passive });
    select.appendChild(opt);
  });
  const stateFilter = state.ui.petFilter ?? "";
  if (passives.includes(stateFilter)) {
    select.value = stateFilter;
  } else {
    select.value = "";
    state.ui.petFilter = "";
  }
}

// ログ表示処理
export function renderLogs(logs) {
  const logArea = document.getElementById("log");

  // ログが減った場合（clearLogs後など）は全クリアしてリセット
  if (logs.length < _lastLogCount) {
    logArea.innerHTML = "";
    _lastLogCount = 0;
  }

  // 前回以降に追加された分だけ追記する
  for (let i = _lastLogCount; i < logs.length; i++) {
    const p = document.createElement("p");
    p.textContent = logs[i];
    logArea.appendChild(p);
  }
  _lastLogCount = logs.length;

  logArea.scrollTop = logArea.scrollHeight;
}

// ボタン表示処理
export function updateButton() {
  const attackBtn = document.getElementById("attackBtn");
  switch (state.phase) {
    case "battle":
      attackBtn.textContent = "攻撃";
      break;
    case "next":
      attackBtn.textContent = "進む";
      break;
    case "gameover":
      attackBtn.textContent = "リベンジ";
      break;
  }
}

export function updateSynthesisUI() {
  if (!state.ui.inventoryOpen) return;
  const synthBtn = document.getElementById("synthesizeBtn");
  if (synthBtn) {
    const { baseUid, materialUids } = state.synthesis;
    synthBtn.disabled = !(baseUid !== null && materialUids.length > 0);
  }
  const selectAllBtn = document.getElementById("selectAllBtn");
  if (selectAllBtn) {
    const { baseUid } = state.synthesis;
    selectAllBtn.classList.toggle("hidden", baseUid === null);
  }
  const infoEl = document.getElementById("synthesisInfo");
  if (infoEl) {
    const { baseUid, materialUids } = state.synthesis;
    const hintEl = infoEl.querySelector(".synth-hint-text");
    if (hintEl) {
      if (!baseUid) {
        hintEl.className = "synth-hint-text";
        hintEl.textContent = "⚔️ 武器をタップしてベースを選択";
      } else if (materialUids.length === 0) {
        hintEl.className = "synth-hint-text hint-base";
        hintEl.textContent = "🔵 ベース選択中 — 同じ種類をタップして素材に追加";
      } else {
        hintEl.className = "synth-hint-text hint-material";
        hintEl.textContent = `🔴 素材 ${materialUids.length}個選択中`;
      }
    }
  }
}

export function updatePetSynthesisUI() {
  if (!state.ui.petOpen) return;
  const synthBtn = document.getElementById("petSynthesizeBtn");
  if (synthBtn) {
    const { baseUid, materialUids } = state.petSynthesis;
    synthBtn.disabled = !(baseUid !== null && materialUids.length > 0);
  }
  const petSelectAllBtn = document.getElementById("petSelectAllBtn");
  if (petSelectAllBtn) {
    const { baseUid } = state.petSynthesis;
    petSelectAllBtn.classList.toggle("hidden", baseUid === null);
  }
  const hintEl = document.getElementById("petSynthesisHint");
  if (hintEl) {
    const { baseUid, materialUids } = state.petSynthesis;
    if (!baseUid) {
      hintEl.className = "synth-hint-text";
      hintEl.textContent = "🐾 ペットをタップしてベースを選択";
    } else if (materialUids.length === 0) {
      hintEl.className = "synth-hint-text hint-base";
      hintEl.textContent = "🔵 ベース選択中 — 同じ種族をタップして素材に追加";
    } else {
      hintEl.className = "synth-hint-text hint-material";
      hintEl.textContent = `🔴 素材 ${materialUids.length}個選択中 — 合成するを押して強化！`;
    }
  }
  const previewEl = document.getElementById("petSynthesisPreview");
  if (previewEl) {
    const preview = getPetSynthesisPreview();
    if (preview) {
      previewEl.style.display = "";
      previewEl.innerHTML = `強化値 +${preview.oldLevel} → +${preview.newLevel}<br>ATK ${preview.oldPower} → <strong>${preview.newPower}</strong> / HP ${preview.oldHp} → <strong>${preview.newHp}</strong>`;
    } else {
      previewEl.style.display = "none";
      previewEl.textContent = "";
    }
  }
}

export function updateSynthesisPreview() {
  if (!state.ui.inventoryOpen) return;
  const previewDiv = document.getElementById("synthesisPreview");
  const preview = getSynthesisPreview();

  if (!preview) {
    previewDiv.style.display = "none";
    previewDiv.textContent = "";
    return;
  }

  previewDiv.style.display = "";
  previewDiv.innerHTML = `強化値 +${preview.oldLevel} → +${preview.newLevel}<br>ATK ${preview.oldTotalAtk} → <strong>${preview.newTotalAtk}</strong> / HP ${preview.oldTotalHp} → <strong>${preview.newTotalHp}</strong>`;
}

// 経験値
export function updateExpBar() {
  const player = state.player;
  const levelEl = document.getElementById("playerLevel");
  levelEl.textContent = `Lv.${player.level}`;

  const expBar = document.getElementById("expBar");
  const percent = Math.floor((player.exp / player.nextExp) * 100);
  expBar.style.width = `${percent}%`;
}

// 最後に生成した maxMultiple を記憶する
let _lastFloorJumpMax = -1;

// 階層移動
export function updateFloorJumpOptions() {
  const select = document.getElementById("floorJumpSelect");
  if (!select) return;

  const FLOOR_CAP = 10000;
  const max = Math.min(state.maxFloor, FLOOR_CAP);
  const maxMultiple = Math.floor(max / 50) * 50;

  // maxFloor が前回と変わっていなければ再生成しない
  if (maxMultiple === _lastFloorJumpMax) {
    select.value = String(state.lastSelectedFloor ?? 1);
    return;
  }
  _lastFloorJumpMax = maxMultiple;

  select.innerHTML = "";

  const first = document.createElement("option");
  first.value = "1";
  first.textContent = "1階";
  select.appendChild(first);

  if (max >= 50) {
    for (let f = 50; f <= maxMultiple; f += 50) {
      const opt = document.createElement("option");
      opt.value = String(f);
      opt.textContent = `${f}階`;
      select.appendChild(opt);
    }
  }

  // 最後に選択したフロアを復元
  select.value = String(state.lastSelectedFloor ?? 1);
}

// 図鑑ポップアップ
export function renderBook(tab = "enemies") {
  const buffEl = document.getElementById("bookBuffSummary");
  const contentEl = document.getElementById("bookContent");

  document.querySelectorAll(".book-tab").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.tab === tab);
  });

  contentEl.innerHTML = "";

  // 検索ボタンのイベント登録（毎回上書き）
  const searchBtn = document.getElementById("bookSearchBtn");
  const searchInput = document.getElementById("bookNameInput");
  if (searchBtn && searchInput) {
    searchInput.value = state.ui.bookNameFilter ?? "";
    searchBtn.onclick = () => {
      state.ui.bookNameFilter = searchInput.value.trim();
      renderBook(tab);
    };
  }

  if (tab === "enemies") {
    renderEnemyBook(buffEl, contentEl);
  } else {
    renderWeaponBook(buffEl, contentEl);
  }
}

function renderEnemyBook(buffEl, contentEl) {
  const hpPercent = Math.round((state.dexBuff.hp - 1) * 100);
  const atkPercent = Math.round((state.dexBuff.power - 1) * 100);

  const allEnemyDefs = [...normalEnemies, ...bossEnemies];

  // 総数：各敵の有効称号数を合算
  const hiddenBossTotal    = hiddenBossDefs.length;
  const hiddenBossObtained = hiddenBossDefs.filter(def =>
    state.book.hiddenBosses?.[def.id]?.defeated
  ).length;
  const totalEnemies = allEnemyDefs.reduce((sum, e) => {
    const hasLegend = !!(e.passive && legendaryTitles[e.passive]);
    return sum + (hasLegend ? 5 : 4);
  }, 0) + hiddenBossTotal;

  // 捕獲済み：caught=true の称号数を合算
  const obtainedEnemies = allEnemyDefs.reduce((sum, e) => {
    const key = e.isBoss ? `boss_${e.id}` : `normal_${e.id}`;
    const entry = state.book.enemies[key];
    if (!entry) return sum;
    const titleIds = [1, 2, 3, 4];
    const hasLegend = !!(e.passive && legendaryTitles[e.passive]);
    if (hasLegend) titleIds.push(5);
    return sum + titleIds.filter((id) => entry.titles?.[id]?.caught).length;
  }, 0) + hiddenBossObtained;

  buffEl.innerHTML = `<div>捕獲済み：${obtainedEnemies} / ${totalEnemies}</div><div>図鑑バフ：HP +${hpPercent}% / ATK +${atkPercent}%</div>`;

  const bookEnemies = state.book.enemies;

  // セクションヘッダを追加するヘルパー
  function addSectionHeader(label) {
    const h = document.createElement("div");
    h.className = "book-section-header";
    h.textContent = label;
    contentEl.appendChild(h);
  }

  // 敵1件分のDOMを生成するヘルパー
  function renderEnemyEntry(enemyDef, titlePool) {
    const key = enemyDef.isBoss ? `boss_${enemyDef.id}` : `normal_${enemyDef.id}`;
    const entry = bookEnemies[key];
    const area = Object.entries(floorTable).find(
      ([bandKey]) => bandKey === enemyDef.floorBand
    )?.[1];
    const legendDef = enemyDef.passive ? legendaryTitles[enemyDef.passive] : null;
    const hasDefeatedAny = entry && (
      titlePool.some((title) => entry.titles?.[title.id]?.defeated) ||
      !!entry.titles?.[5]?.defeated
    );
    // コンプリート判定：全称号が caught === true であるか
    const allTitleIds = titlePool.map((t) => t.id);
    if (legendDef) allTitleIds.push(5);
    const isComplete = entry != null && allTitleIds.every(
      (id) => !!entry.titles?.[id]?.caught
    );
    const floorText = hasDefeatedAny
      ? (enemyDef.isBoss ? `${enemyDef.bossFloors?.[0]}階` : (area ? `${area.min}〜${area.max}階` : "不明"))
      : "不明";

    const section = document.createElement("div");
    section.className = "book-enemy";

    const header = document.createElement("div");
    header.className = "book-enemy-header";
    const name = entry ? entry.name : "？？？";

    if (enemyDef.isBoss) header.classList.add("boss");

    const completeIcon = isComplete ? `<span class="book-complete-star">★</span>` : "";
    header.innerHTML = `<span>${name}</span>${completeIcon}<span class="book-toggle">▶</span>`;

    const detail = document.createElement("div");
    detail.className = "book-enemy-detail hidden";

    if (!entry) {
      detail.innerHTML = `
        <div class="book-enemy-meta">出現：${floorText}　遭遇：0 / 撃破：0</div>
        ${titlePool.map(() => `<div class="book-title-unknown"><span>？？？</span></div>`).join("")}
        ${legendDef ? `<div class="book-title-unknown"><span>？？？</span></div>` : ""}
      `;
    } else {
      const titlesHtml = titlePool
        .map((title) => {
          const titleEntry = entry.titles?.[title.id];
          const titleBuff = enemyDef.titleDexBuff?.[title.id];
          const buffText = titleBuff
            ? `HP+${titleBuff.hp * 100}% ATK+${titleBuff.power * 100}%`
            : "";
          const isCaught = !!entry.titles?.[title.id]?.caught;
          const caughtBadge = isCaught ? ` <span class="book-caught">捕獲済</span>` : "";
          if (!titleEntry || !titleEntry.seen) {
            return `<div class="book-title-unknown"><span>？？？</span></div>`;
          } else if (titleEntry.defeated) {
            return `<div class="book-title-row defeated"><span>${title.name}${entry.name}</span><span class="book-title-buff">${buffText}</span><span>撃破済${caughtBadge}</span></div>`;
          } else {
            return `<div class="book-title-row seen"><span>${title.name}${entry.name}</span><span class="book-title-buff">${buffText}</span><span>遭遇済${caughtBadge}</span></div>`;
          }
        })
        .join("");

      const legendEntry = entry.titles?.[5];
      const legendHtml = legendDef ? (() => {
        if (!legendEntry?.seen) {
          // 未遭遇：???で表示
          return `<div class="book-title-unknown"><span>？？？</span></div>`;
        }
        // 遭遇済み以降は既存ロジック
        const displayName = enemyDef.isBoss
          ? `✨ ${legendDef.name}・支配者の${entry.name}`
          : `✨ ${legendDef.name}・深淵の${entry.name}`;
        const isCaught = !!entry.titles?.[5]?.caught;
        const caughtBadge = isCaught ? ` <span class="book-caught">捕獲済</span>` : "";
        if (legendEntry.defeated) {
          return `<div class="book-title-row defeated legendary-row"><span>${displayName}</span><span class="book-title-buff"></span><span>撃破済${caughtBadge}</span></div>`;
        } else {
          return `<div class="book-title-row seen legendary-row"><span>${displayName}</span><span class="book-title-buff"></span><span>遭遇済${caughtBadge}</span></div>`;
        }
      })() : "";

      detail.innerHTML = `
        <div class="book-enemy-meta">出現：${floorText}　遭遇：${entry.seenCount} / 撃破：${entry.defeatedCount}</div>
        ${titlesHtml}${legendHtml}
      `;
    }

    header.addEventListener("click", () => {
      const isOpen = !detail.classList.contains("hidden");
      detail.classList.toggle("hidden");
      header.querySelector(".book-toggle").textContent = isOpen ? "▶" : "▼";
    });

    section.appendChild(header);
    section.appendChild(detail);
    contentEl.appendChild(section);
  }

  // 通常/ボス サブタブ
  const subTab = state.ui.bookEnemySubTab ?? "normal";
  const tabBar = document.createElement("div");
  tabBar.className = "book-enemy-subtabs";
  const tabNormal = document.createElement("button");
  tabNormal.className = "book-enemy-subtab" + (subTab === "normal" ? " active" : "");
  tabNormal.textContent = "通常の敵";
  const tabBoss = document.createElement("button");
  tabBoss.className = "book-enemy-subtab" + (subTab === "boss" ? " active" : "");
  tabBoss.textContent = "ボス";
  tabNormal.addEventListener("click", () => { state.ui.bookEnemySubTab = "normal"; renderBook("enemies"); });
  tabBoss.addEventListener("click",   () => { state.ui.bookEnemySubTab = "boss";   renderBook("enemies"); });
  const tabHidden = document.createElement("button");
  tabHidden.className = "book-enemy-subtab" + (subTab === "hidden" ? " active" : "");
  tabHidden.textContent = "隠しボス";
  tabHidden.addEventListener("click", () => { state.ui.bookEnemySubTab = "hidden"; renderBook("enemies"); });
  tabBar.appendChild(tabNormal);
  tabBar.appendChild(tabBoss);
  tabBar.appendChild(tabHidden);
  contentEl.appendChild(tabBar);

  const bookNameFilter = (state.ui.bookNameFilter ?? "").toLowerCase();

  if (subTab === "normal") {
    normalEnemies.forEach((enemyDef) => {
      if (bookNameFilter) {
        const key   = `normal_${enemyDef.id}`;
        const entry = state.book.enemies[key];
        if (!entry) return;
        if (!entry.name.toLowerCase().includes(bookNameFilter)) return;
      }
      const titlePool = enemyTitles[enemyDef.titleGroup] ?? Object.values(enemyTitles)[0] ?? [];
      renderEnemyEntry(enemyDef, titlePool);
    });
  } else if (subTab === "boss") {
    bossEnemies.forEach((enemyDef) => {
      if (bookNameFilter) {
        const key   = `boss_${enemyDef.id}`;
        const entry = state.book.enemies[key];
        if (!entry) return;
        if (!entry.name.toLowerCase().includes(bookNameFilter)) return;
      }
      const titlePool = bossTitles[enemyDef.titleGroup] ?? [];
      renderEnemyEntry(enemyDef, titlePool);
    });
  } else if (subTab === "hidden") {
    renderHiddenBossBook(contentEl, bookNameFilter);
  }
}

function renderHiddenBossBook(contentEl, nameFilter = "") {
  const hiddenBosses = state.book.hiddenBosses ?? {};

  hiddenBossDefs.forEach((def) => {
    if (nameFilter) {
      const entry = hiddenBosses[def.id];
      if (!entry?.defeated) return;
      if (!def.name.toLowerCase().includes(nameFilter)) return;
    }
    const entry = hiddenBosses[def.id];
    const defeated       = entry?.defeated       ?? false;
    const weaponObtained = entry?.weaponObtained ?? false;

    const section = document.createElement("div");
    section.className = "book-enemy";

    const header = document.createElement("div");
    header.className = "book-enemy-header boss";

    const isComplete  = defeated;
    const completeIcon = isComplete ? `<span class="book-complete-star">★</span>` : "";
    const name = defeated ? def.name : "？？？";
    header.innerHTML = `<span>💀 ${name}</span>${completeIcon}<span class="book-toggle">▶</span>`;

    const detail = document.createElement("div");
    detail.className = "book-enemy-detail hidden";

    if (!defeated) {
      detail.innerHTML = `<div class="book-enemy-meta">隠しボス。出現には研究所での解禁が必要。</div>`;
    } else {
      detail.innerHTML = `
        <div class="book-enemy-meta">七大罪：${def.sin}</div>
        <div class="book-title-row defeated">
          <span>${def.name}</span>
          <span>捕獲済</span>
        </div>
      `;
    }

    header.addEventListener("click", () => {
      const isOpen = !detail.classList.contains("hidden");
      detail.classList.toggle("hidden");
      header.querySelector(".book-toggle").textContent = isOpen ? "▶" : "▼";
    });

    section.appendChild(header);
    section.appendChild(detail);
    contentEl.appendChild(section);
  });
}

function renderWeaponBook(buffEl, contentEl) {
  const hpBuff = Math.round((state.weaponDexBuff.hp - 1) * 100);
  const atkBuff = Math.round((state.weaponDexBuff.power - 1) * 100);

  // 総数：ベース + 全進化段階数を合算
  const hiddenWeaponTotal    = hiddenBossDefs.length;
  const hiddenWeaponObtained = hiddenBossDefs.filter(def =>
    state.book.hiddenBosses?.[def.id]?.weaponObtained
  ).length;
  const totalWeapons = weaponTemplates.reduce((sum, t) => {
    return sum + 1 + (t.evolutions?.length ?? 0);
  }, 0) + hiddenWeaponTotal;

  // 入手済み：ベース入手数 + 進化段階取得数を合算
  const obtainedWeapons = weaponTemplates.reduce((sum, t) => {
    const key = t.isBossDrop ? `boss_${t.id}` : `normal_${t.id}`;
    const entry = state.book.weapons[key];
    if (!entry) return sum;
    let count = 1; // ベース入手
    for (const evo of t.evolutions ?? []) {
      if (entry.evolutions?.[evo.name]?.obtained) count++;
    }
    return sum + count;
  }, 0) + hiddenWeaponObtained;

  buffEl.innerHTML = `<div>入手済み：${obtainedWeapons} / ${totalWeapons}</div><div>図鑑バフ：HP +${hpBuff}% / ATK +${atkBuff}%</div>`;

  const bookWeapons = state.book.weapons;
  const bookNameFilter = (state.ui.bookNameFilter ?? "").toLowerCase();

  weaponTemplates.forEach((template) => {
    if (bookNameFilter) {
      const bookKey = template.isBossDrop ? `boss_${template.id}` : `normal_${template.id}`;
      const entry   = bookWeapons[bookKey];
      if (!entry) return;
      if (!template.name.toLowerCase().includes(bookNameFilter)) return;
    }
    const bookKey = template.isBossDrop ? `boss_${template.id}` : `normal_${template.id}`;
    const entry = bookWeapons[bookKey];
    const area = Object.values(floorTable).find(
      (a) => a.weaponIdRange && a.weaponIdRange[0] <= template.id && template.id <= a.weaponIdRange[1],
    );
    const hasObtainedAny = !!entry;
    // コンプリート判定：ベース入手済み かつ 全進化段階が obtained === true
    const isComplete = !!entry && (template.evolutions ?? []).every(
      (evo) => !!entry.evolutions?.[evo.name]?.obtained
    );
    const floorText = hasObtainedAny && area ? `${area.min}〜${area.max}階` : "不明";

    const section = document.createElement("div");
    section.className = "book-enemy";

    const header = document.createElement("div");
    header.className = "book-enemy-header";

    const name = entry ? template.name : "？？？";
    const completeIcon = isComplete ? `<span class="book-complete-star">★</span>` : "";
    header.innerHTML = `<span>${name}</span>${completeIcon}<span class="book-toggle">▶</span>`;

    const detail = document.createElement("div");
    detail.className = "book-enemy-detail hidden";

    const atkRange = `ATK ${template.minAtk}〜${template.maxAtk} / HP ${template.minHp}〜${template.maxHp}`;

    if (!entry) {
      detail.innerHTML = `<div class="book-enemy-meta">出現：${floorText}　${atkRange}</div>`;
    } else {
      const evosHtml = template.evolutions
        .map((evo) => {
          const obtained = entry.evolutions[evo.name]?.obtained;
          const buffText = evo.dexBuff
            ? `HP+${Math.round(evo.dexBuff.hp * 100)}% ATK+${Math.round(evo.dexBuff.power * 100)}%`
            : "";
          if (obtained) {
            return `<div class="book-title-row defeated"><span>${evo.name}</span><span class="book-title-buff">${buffText}</span><span>取得済</span></div>`;
          } else {
            return `<div class="book-title-unknown"><span>？？？</span></div>`;
          }
        })
        .join("");

      detail.innerHTML = `
        <div class="book-enemy-meta">出現：${floorText}　${atkRange}</div>
        ${evosHtml}
      `;
    }

    header.addEventListener("click", () => {
      const isOpen = !detail.classList.contains("hidden");
      detail.classList.toggle("hidden");
      header.querySelector(".book-toggle").textContent = isOpen ? "▶" : "▼";
    });

    section.appendChild(header);
    section.appendChild(detail);
    contentEl.appendChild(section);
  });

  // 隠しボス武器セクション
  const hiddenBookWeapons = state.book.hiddenBosses ?? {};
  hiddenBossDefs.forEach((def) => {
    if (bookNameFilter) {
      const entry = hiddenBookWeapons[def.id];
      if (!entry?.weaponObtained) return;
      if (!def.weaponDrop.name.toLowerCase().includes(bookNameFilter)) return;
    }
    const entry    = hiddenBookWeapons[def.id];
    const obtained = entry?.weaponObtained ?? false;

    const section = document.createElement("div");
    section.className = "book-enemy";

    const header = document.createElement("div");
    header.className = "book-enemy-header";
    const wName        = obtained ? def.weaponDrop.name : "？？？";
    const completeIcon = obtained ? `<span class="book-complete-star">★</span>` : "";
    header.innerHTML = `<span>💀 ${wName}</span>${completeIcon}<span class="book-toggle">▶</span>`;

    const detail = document.createElement("div");
    detail.className = "book-enemy-detail hidden";

    if (!obtained) {
      detail.innerHTML = `<div class="book-enemy-meta">隠しボスからの専用武器。</div>`;
    } else {
      detail.innerHTML = `
        <div class="book-enemy-meta">入手元：${def.name}（${def.sin}の罪）</div>
        <div class="book-title-row defeated">
          <span>${def.weaponDrop.name}</span>
          <span class="book-title-buff">HP +1.0% / ATK +1.0%</span>
          <span>取得済</span>
        </div>
      `;
    }

    header.addEventListener("click", () => {
      const isOpen = !detail.classList.contains("hidden");
      detail.classList.toggle("hidden");
      header.querySelector(".book-toggle").textContent = isOpen ? "▶" : "▼";
    });

    section.appendChild(header);
    section.appendChild(detail);
    contentEl.appendChild(section);
  });
}

// =====================
// ペットパネル
// =====================
export function updateEquippedWeaponInfo(onUnequip) {
  const el = document.getElementById("equippedWeaponInfo");
  if (!el) return;
  const w = state.player.equippedWeapon;
  if (w) {
    const name = getWeaponDisplayName(w);
    const ultClassW = isUltimateWeapon(w) ? " ultimate" : "";
    el.innerHTML = `
      <div class="equipped-pet${ultClassW}">
        <div class="equipped-pet-name">⚔️ 装備中：${name}${w.level > 0 ? ` <span class="weapon-level">+${w.level}</span>` : ""}</div>
        <div class="equipped-pet-stats-row">
          <div class="equipped-pet-stats">
            <span>ATK ${w.totalAtk}(${w.baseAtk})</span>
            <span>HP ${w.totalHp ?? 0}(${w.baseHp ?? 0})</span>
            ${w.passive ? `<span class="pet-passive">${weaponPassiveLabel(w.passive)}${w.passiveValue != null ? `(${w.passiveValue}%)` : ""}</span>` : ""}
          </div>
          <button class="weapon-unequip-btn" id="unequipWeaponBtn">外す</button>
        </div>
      </div>
    `;
    // onclick で上書きすることでリスナーの多重登録を防ぐ
    document.getElementById("unequipWeaponBtn").onclick = () => {
      addLog(`⚔️ ${getWeaponDisplayName(w)} を外した`);
      state.player.equippedWeapon = null;
      onUnequip?.();
    };
  } else {
    el.innerHTML = `<div class="equipped-pet-empty">武器未装備</div>`;
  }
}

// 通常スキルとレジェンダリースキルを同一グループとして判定する
function isSamePassiveGroup(petPassive, filterPassive) {
  if (!petPassive || !filterPassive) return false;
  if (petPassive === filterPassive) return true;

  // filterPassive の「通常スキル版」を取得
  const normalOfFilter = isLegendaryPassive(filterPassive)
    ? normalPassiveOf(filterPassive)
    : filterPassive;

  // petPassive の「通常スキル版」を取得
  const normalOfPet = isLegendaryPassive(petPassive)
    ? normalPassiveOf(petPassive)
    : petPassive;

  // 両者の通常スキル版が一致すれば同一グループ
  return normalOfFilter !== null && normalOfFilter === normalOfPet;
}

export function updatePetPanel(onPetClick, onPetEquip) {
  if (!state.ui.petOpen) return;
  const equippedEl = document.getElementById("equippedPetInfo");
  const listEl = document.getElementById("petList");
  if (!equippedEl || !listEl) return;

  const equipped = state.player.equippedPet;
  if (equipped) {
    const valueText = equipped.passiveValue != null ? `(${equipped.passiveValue}%)` : "";
    const ultClassP = isUltimatePet(equipped) ? " ultimate" : "";
    equippedEl.innerHTML = `
      <div class="equipped-pet${ultClassP}">
        <div class="equipped-pet-name">🐾 装備中：${getTitleName(equipped)}${equipped.name}${(equipped.level ?? 0) > 0 ? ` <span class="weapon-level">+${equipped.level}</span>` : ""}</div>
        <div class="equipped-pet-stats-row">
          <div class="equipped-pet-stats">
            <span>ATK ${getPetPower(equipped)}(${equipped.basePower})</span>
            <span>HP ${getPetHp(equipped)}(${equipped.baseHp ?? 0})</span>
            <span class="pet-passive">${passiveLabelText(equipped)}${valueText}</span>
          </div>
          <button class="pet-unequip-btn" data-uid="${equipped.uid}">外す</button>
        </div>
      </div>
    `;
  } else {
    equippedEl.innerHTML = `<div class="equipped-pet-empty">ペット未装備</div>`;
  }

  updatePetSynthesisUI();

  listEl.innerHTML = "";
  const filter     = state.ui.petFilter ?? "";
  const nameFilter = (state.ui.petNameFilter ?? "").toLowerCase();

  const pets = state.player.petList.filter((p) => {
    if (filter && !isSamePassiveGroup(p.passive, filter)) return false;
    if (nameFilter && !p.name.toLowerCase().includes(nameFilter)) return false;
    return true;
  });
  if (pets.length === 0) {
    listEl.innerHTML = `<li class="pet-empty">捕獲したペットがいません</li>`;
    return;
  }

  // 種族ごとにグループ化（enemyId + isBoss の組み合わせ）
  const groups = new Map();
  for (const pet of pets) {
    const key = `${pet.enemyId}_${!!pet.isBoss}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(pet);
  }

  // state.ui.petOpenGroups のクリーンアップ
  if (state.ui.petOpenGroups) {
    const validKeys = new Set([...groups.keys()].map((k) => `pet_${k}`));
    for (const key of Object.keys(state.ui.petOpenGroups)) {
      if (!validKeys.has(key)) delete state.ui.petOpenGroups[key];
    }
  }

  // お気に入り + グループソート
  const sortedGroups = [...groups.entries()].sort(([, petsA], [, petsB]) => {
    const repA = petsA[0];
    const repB = petsB[0];
    const favA = isFavorite(`pet_${repA.enemyId}_${!!repA.isBoss}`) ? 0 : 1;
    const favB = isFavorite(`pet_${repB.enemyId}_${!!repB.isBoss}`) ? 0 : 1;
    if (favA !== favB) return favA - favB;
    const mode = state.ui.petGroupSort ?? "acquiredDesc";
    const maxOrderA = Math.max(...petsA.map((p) => p.acquiredOrder ?? 0));
    const maxOrderB = Math.max(...petsB.map((p) => p.acquiredOrder ?? 0));
    if (mode === "acquiredDesc") return maxOrderB - maxOrderA;
    if (mode === "acquiredAsc")  return maxOrderA - maxOrderB;
    if (mode === "bookAsc")      return repA.enemyId - repB.enemyId;
    if (mode === "bookDesc")     return repB.enemyId - repA.enemyId;
    return 0;
  });

  for (const [key, groupPets] of sortedGroups) {
    const rep = groupPets[0];
    const speciesName = rep.name;
    const skillLabel = getNormalSkillLabel(rep.passive);
    const groupKey = `pet_${rep.enemyId}_${!!rep.isBoss}`;
    const fav = isFavorite(groupKey);

    const groupEl = document.createElement("div");
    groupEl.className = "pet-group";

    const headerEl = document.createElement("div");
    headerEl.className = "pet-group-header";
    const isHiddenBossGroup = groupPets.some((p) => p.isHiddenBoss);
    if (isHiddenBossGroup) headerEl.classList.add("hidden-boss-group");
    // レアランプ判定
    const hasElite    = groupPets.some((p) => p.isElite);
    const hasLegend   = groupPets.some((p) => p.isLegendary && !p.isLegendUltimate);
    const hasUltimate = groupPets.some((p) => p.isLegendUltimate);
    const lampsHtml = (hasElite || hasLegend || hasUltimate) ? `
      <span class="rare-lamps">
        ${hasElite    ? '<span class="rare-lamp lamp-elite"></span>'    : ''}
        ${hasLegend   ? '<span class="rare-lamp lamp-legendary"></span>' : ''}
        ${hasUltimate ? '<span class="rare-lamp lamp-ultimate"></span>' : ''}
      </span>` : '';

    headerEl.innerHTML = `
      <button class="group-fav-btn ${fav ? "fav-on" : ""}" data-group-key="${groupKey}">${fav ? "♥" : "♡"}</button>
      <span class="pet-group-name">🐾 ${speciesName}</span>
      <span class="pet-group-skill">${skillLabel}</span>
      ${lampsHtml}
      <span class="pet-group-count">× ${groupPets.length}</span>
      <span class="pet-group-toggle">▶</span>
      <button class="group-close-btn hidden">✕</button>
    `;

    headerEl.querySelector(".group-fav-btn").addEventListener("click", (e) => {
      e.stopPropagation();
      toggleFavorite(groupKey);
      const isNowFav = isFavorite(groupKey);
      e.currentTarget.classList.toggle("fav-on", isNowFav);
      e.currentTarget.textContent = isNowFav ? "♥" : "♡";

      const allGroups = [...listEl.querySelectorAll(".pet-group")];
      allGroups.sort((a, b) => {
        const btnA = a.querySelector(".group-fav-btn");
        const btnB = b.querySelector(".group-fav-btn");
        const favA = btnA?.classList.contains("fav-on") ? 0 : 1;
        const favB = btnB?.classList.contains("fav-on") ? 0 : 1;
        if (favA !== favB) return favA - favB;
        const keyA = btnA?.dataset.groupKey ?? "";
        const keyB = btnB?.dataset.groupKey ?? "";
        const idA = parseInt(keyA.replace(/^pet_/, "").split("_")[0]) || 0;
        const idB = parseInt(keyB.replace(/^pet_/, "").split("_")[0]) || 0;
        return idA - idB;
      });
      allGroups.forEach((g) => listEl.appendChild(g));
    });

    const bodyEl = document.createElement("ul");
    bodyEl.className = "pet-group-body hidden";

    // 開閉状態の復元
    const isStoredOpen = state.ui.petOpenGroups?.[groupKey] === true;
    if (isStoredOpen) {
      bodyEl.innerHTML = "";
      renderPetGroupBody(bodyEl, groupPets, onPetClick, onPetEquip);
      bodyEl.classList.remove("hidden");
    }

    const closeBtn = headerEl.querySelector(".group-close-btn");
    if (isStoredOpen) {
      headerEl.querySelector(".pet-group-toggle").textContent = "▼";
      closeBtn.classList.remove("hidden");
    }

    headerEl.addEventListener("click", () => {
      const isOpen = !bodyEl.classList.contains("hidden");
      if (isOpen) return;

      bodyEl.innerHTML = "";
      renderPetGroupBody(bodyEl, groupPets, onPetClick, onPetEquip);
      bodyEl.classList.remove("hidden");
      headerEl.querySelector(".pet-group-toggle").textContent = "▼";
      closeBtn.classList.remove("hidden");
      state.ui.petOpenGroups[groupKey] = true;
      updateSynthesisClasses();
      updatePetSortBtnState();
    });

    closeBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      state.petSynthesis.baseUid = null;
      state.petSynthesis.materialUids = [];
      bodyEl.classList.add("hidden");
      headerEl.querySelector(".pet-group-toggle").textContent = "▶";
      closeBtn.classList.add("hidden");
      delete state.ui.petOpenGroups[groupKey];
      updatePetSynthesisUI();
      updateSynthesisClasses();
      updatePetSortBtnState();
    });

    groupEl.appendChild(headerEl);
    groupEl.appendChild(bodyEl);
    listEl.appendChild(groupEl);
  }
}

// ボックスヘッダー用：通常スキル名を返すヘルパー
function getNormalSkillLabel(passive) {
  if (!passive) return "";
  const normalKey = isLegendaryPassive(passive) ? normalPassiveOf(passive) : passive;
  return passiveLabels[normalKey] ?? passive;
}

function renderPetGroupBody(bodyEl, groupPets, onPetClick, onPetEquip) {
  const lockedSet = getLockedSet();
  groupPets.forEach((pet) => {
    const { baseUid, materialUids } = state.petSynthesis;
    const isEquipped = state.player.equippedPet?.uid === pet.uid;
    const isBase = pet.uid === baseUid;
    const isMaterial = materialUids.includes(pet.uid);
    const valueText = pet.passiveValue != null ? `(${pet.passiveValue}%)` : "";
    const bonusText = (pet.level ?? 0) > 0 ? ` <span class="weapon-level">+${pet.level}</span>` : "";

    const li = document.createElement("li");
    const isUltP = isUltimatePet(pet);
    li.className = "pet-item" + (isEquipped ? " equipped" : "");
    if (pet.isLegendUltimate)   li.classList.add("pet-legend-ultimate");
    else if (pet.isLegendary)   li.classList.add("pet-legendary");
    else if (pet.isElite)       li.classList.add("pet-elite");
    else if (isUltP)            li.classList.add("ultimate");
    if (isBase) {
      li.classList.add("synth-base");
    } else if (isMaterial) {
      li.classList.add("synth-material");
    } else if (baseUid !== null) {
      const base = state.player.petList.find((p) => p.uid === baseUid);
      const isCandidate = base
        && pet.enemyId === base.enemyId
        && pet.isBoss === base.isBoss;
      if (isCandidate) {
        li.classList.add("synth-candidate");
      } else {
        li.classList.add("synth-disabled");
      }
    }

    const locked = lockedSet.has(String(pet.uid));
    const isAutoSynth = isAutoSynthTarget(pet.uid);
    const isPetAutoFull = (state.autoSynth?.petUids?.length ?? 0) >= 4;
    li.innerHTML = `
      <div class="pet-item-bar"></div>
      <div class="pet-item-body">
        <div class="item-row-1">
          <span class="pet-name">🐾 ${getTitleName(pet)}${pet.name}${bonusText}</span>
          <div class="pet-actions">
            ${isBase ? '<span class="synth-badge synth-badge-base">BASE</span>' : ""}
            ${isMaterial ? '<span class="synth-badge synth-badge-material">素材</span>' : ""}
            ${isEquipped
              ? `<button class="pet-unequip-btn" data-uid="${pet.uid}">外す</button>`
              : `<button class="pet-equip-btn" data-uid="${pet.uid}">装備</button>`
            }
            <button class="pet-lock-btn ${locked ? "lock-on" : ""}" data-uid="${pet.uid}">${locked ? "🔒" : "🔓"}</button>
            <button class="pet-auto-synth-btn${isAutoSynth ? " active" : ""}" data-uid="${pet.uid}" title="${isAutoSynth ? "自動合成から解除" : "自動合成に登録"}"${!isAutoSynth && isPetAutoFull ? " disabled" : ""}>🔄</button>
          </div>
        </div>
        <div class="item-row-2">
          <span class="pet-atk">ATK ${getPetPower(pet)}(${pet.basePower})</span>
          <span class="pet-atk">HP ${getPetHp(pet)}(${pet.baseHp ?? 0})</span>
          <span class="pet-passive">${passiveLabelText(pet)}${valueText}</span>
        </div>
      </div>
    `;

    // カードタップで合成選択（ボタン部分は除外、ロック中は素材選択不可）
    li.onclick = (e) => {
      e.stopPropagation();
      if (e.target.closest("button")) return;
      const isBase = pet.uid === state.petSynthesis.baseUid;
      if (lockedSet.has(String(pet.uid)) && state.petSynthesis.baseUid !== null && !isBase) return;
      if (onPetClick) onPetClick(pet.uid);
    };

    // 装備・外すボタン（直接バインド）
    li.querySelector(".pet-equip-btn, .pet-unequip-btn")
      ?.addEventListener("click", (e) => {
        e.stopPropagation();
        if (onPetEquip) onPetEquip(pet.uid);
      });

    // ロックボタン
    li.querySelector(".pet-lock-btn")?.addEventListener("click", (e) => {
      e.stopPropagation();
      toggleLock(pet.uid);
      const btn = e.currentTarget;
      const nowLocked = isLocked(pet.uid);
      btn.classList.toggle("lock-on", nowLocked);
      btn.textContent = nowLocked ? "🔒" : "🔓";
    });

    // 自動合成ボタン（ペット）
    li.querySelector(".pet-auto-synth-btn")?.addEventListener("click", (e) => {
      e.stopPropagation();
      toggleAutoSynthTarget(pet.uid);
      saveGameLocal();
      if (_refreshUICallback) _refreshUICallback();
    });

    bodyEl.appendChild(li);
  });
}

function passiveLabelText(pet) {
  const labels = {
    captureBoost: "捕獲率増加",    expBoost:     "経験値増加",
    atkBoost:     "攻撃力増加",    dropBoost:    "ドロップ率上昇",
    dmgBoost:     "与ダメ増加",    dmgReduce:    "被ダメ減少",
    hpBoost:      "HP増加",        doubleAttack: "2回攻撃",
    survive:      "根性",          reflect:      "ダメージ反射",
    drain:        "与ダメ吸収",    critRate:     "クリティカル率",
    critDamage:   "クリティカルダメージ増加", expBurst:   "経験値爆発",
    giantKiller:  "巨人殺し",      bossSlayer:   "ボス特効",
    evade:        "回避",          lastStand:    "背水の陣",
    regen:        "再生",
    resurrection: "復活",
    // レジェンダリー
    legendCaptureBoost: "✨捕縛者",  legendExpBoost:   "✨賢者",
    legendAtkBoost:     "✨破壊神",  legendDropBoost:  "✨財宝王",
    legendDmgBoost:     "✨剛力",    legendDmgReduce:  "✨鉄壁",
    legendHpBoost:      "✨巨人",    tripleAttack:     "✨連撃王",
    legendSurvive:      "✨不死身",  legendReflect:    "✨鏡盾",
    legendDrain:        "✨吸血鬼",  legendCritRate:   "✨致命眼",
    legendCritDamage:   "✨覇者",    legendExpBurst:   "✨幸運の女神",
    legendGiantKiller:  "✨下剋上",  legendBossSlayer: "✨覇王討伐",
    legendEvade:        "✨幻影",    legendLastStand:  "✨挑戦者",
    legendRegen:        "✨不滅",
    legendResurrection: "✨輪廻転生",
  };
  return labels[pet.passive] ?? pet.passive;
}
function weaponPassiveLabel(passive) {
  const labels = {
    captureBoost: "捕獲率増加",    expBoost:     "経験値増加",
    atkBoost:     "攻撃力増加",    dropBoost:    "ドロップ率増加",
    dmgBoost:     "与ダメ上昇",    dmgReduce:    "被ダメ減少",
    hpBoost:      "HP増加",        doubleAttack: "2回攻撃",
    survive:      "根性",          reflect:      "ダメージ反射",
    drain:        "与ダメ吸収",    critRate:     "クリティカル率",
    critDamage:   "クリティカルダメージ増加",
    giantKiller:  "巨人殺し",      bossSlayer:   "ボス特効",
    evade:        "回避",          lastStand:    "背水の陣",
    regen:        "再生",
    resurrection: "復活",
    expBurst: "経験値爆発",
    legendCaptureBoost: "✨捕縛者",  legendExpBoost:   "✨賢者",
    legendAtkBoost:     "✨破壊神",  legendDropBoost:  "✨財宝王",
    legendDmgBoost:     "✨剛力",    legendDmgReduce:  "✨鉄壁",
    legendHpBoost:      "✨巨人",    tripleAttack:     "✨連撃王",
    legendSurvive:      "✨不死身",  legendReflect:    "✨鏡盾",
    legendDrain:        "✨吸血鬼",  legendCritRate:   "✨致命眼",
    legendCritDamage:   "✨覇者",    legendExpBurst:   "✨幸運の女神",
    legendGiantKiller:  "✨下剋上",  legendBossSlayer: "✨覇王討伐",
    legendEvade:        "✨幻影",    legendLastStand:  "✨挑戦者",
    legendRegen:        "✨不滅",
    legendResurrection: "✨輪廻転生",
    legendExpBurst: "✨幸運の女神",
  };
  return labels[passive] ?? passive;
}

// =====================
// ソートボタン有効/無効制御
// =====================
export function updatePetSortBtnState() {
  const btn = document.getElementById("petSortBtn");
  if (!btn) return;
  const anyOpen = !!document.querySelector("#petList .pet-group-body:not(.hidden)");
  btn.disabled = !anyOpen;
}

export function updateWeaponSortBtnState() {
  const btn = document.getElementById("sortBtn");
  if (!btn) return;
  const anyOpen = !!document.querySelector("#inventoryList .pet-group-body:not(.hidden)");
  btn.disabled = !anyOpen;
}

// =====================
// 合成クラス更新（アコーディオン再描画なし）
// =====================
export function updateSynthesisClasses() {
  // 武器
  const weaponBase = state.synthesis.baseUid;
  const weaponMaterials = new Set(state.synthesis.materialUids);
  const baseWeapon = weaponBase
    ? state.player.inventory.find((w) => w.uid === weaponBase)
    : null;

  document.querySelectorAll("#inventoryList .pet-item, .pet-group-body .pet-item").forEach((li) => {
    const uidAttr = li.querySelector("[data-uid]")?.dataset.uid;
    if (!uidAttr) return;
    const uid = uidAttr;
    const item = state.player.inventory.find((w) => w.uid === uid);
    if (!item) return;

    li.classList.remove("synth-base", "synth-material", "synth-candidate", "synth-disabled");

    if (uid === weaponBase) {
      li.classList.add("synth-base");
      updateSynthBadge(li, "base");
    } else if (weaponMaterials.has(uid)) {
      li.classList.add("synth-material");
      updateSynthBadge(li, "material");
    } else if (weaponBase !== null) {
      const isCandidate = baseWeapon && item.templateId === baseWeapon.templateId;
      li.classList.add(isCandidate ? "synth-candidate" : "synth-disabled");
      updateSynthBadge(li, null);
    } else {
      updateSynthBadge(li, null);
    }
  });

  // ペット
  const petBase = state.petSynthesis.baseUid;
  const petMaterials = new Set(state.petSynthesis.materialUids);
  const basePet = petBase
    ? state.player.petList.find((p) => p.uid === petBase)
    : null;

  document.querySelectorAll("#petList .pet-item, .pet-group-body .pet-item").forEach((li) => {
    const uidAttr = li.querySelector("[data-uid]")?.dataset.uid;
    if (!uidAttr) return;
    const uid = uidAttr;
    const pet = state.player.petList.find((p) => p.uid === uid);
    if (!pet) return;

    li.classList.remove("synth-base", "synth-material", "synth-candidate", "synth-disabled");

    if (uid === petBase) {
      li.classList.add("synth-base");
      updateSynthBadge(li, "base");
    } else if (petMaterials.has(uid)) {
      li.classList.add("synth-material");
      updateSynthBadge(li, "material");
    } else if (petBase !== null) {
      const isCandidate = basePet
        && pet.enemyId === basePet.enemyId
        && pet.isBoss === basePet.isBoss;
      li.classList.add(isCandidate ? "synth-candidate" : "synth-disabled");
      updateSynthBadge(li, null);
    } else {
      updateSynthBadge(li, null);
    }
  });
}

function updateSynthBadge(li, type) {
  li.querySelectorAll(".synth-badge").forEach((b) => b.remove());
  const actions = li.querySelector(".pet-actions");
  if (!actions) return;

  if (type === "base") {
    const badge = document.createElement("span");
    badge.className = "synth-badge synth-badge-base";
    badge.textContent = "BASE";
    actions.prepend(badge);
  } else if (type === "material") {
    const badge = document.createElement("span");
    badge.className = "synth-badge synth-badge-material";
    badge.textContent = "素材";
    actions.prepend(badge);
  }
}

// =====================
// ステータス画面
// =====================
export function renderStatusScreen() {
  const el = document.getElementById("statusContent");
  if (!el) return;

  const player = state.player;
  const pet = player.equippedPet;
  const weapon = player.equippedWeapon;

  // 攻撃力
  const totalAtk = player.totalPower;

  // HP
  const totalHp = player.totalHp;

  // 経験値増加（ペット＋武器、レジェンダリー含む）
  let expBoost = 0;
  if (pet?.passive === "expBoost") expBoost += pet.passiveValue ?? 0;
  if (weapon?.passive === "expBoost") expBoost += weapon.passiveValue ?? 0;
  if (pet?.passive === "legendExpBoost") expBoost += pet.passiveValue ?? 0;
  if (weapon?.passive === "legendExpBoost") expBoost += weapon.passiveValue ?? 0;
  expBoost += Math.floor(state._expBurstOverflowExpBoost ?? 0); // 超過分加算

  // 捕獲率増加（ペット＋武器、レジェンダリー含む）
  let captureBoost = 0;
  if (pet?.passive === "captureBoost") captureBoost += pet.passiveValue ?? 0;
  if (weapon?.passive === "captureBoost") captureBoost += weapon.passiveValue ?? 0;
  if (pet?.passive === "legendCaptureBoost") captureBoost += pet.passiveValue ?? 0;
  if (weapon?.passive === "legendCaptureBoost") captureBoost += weapon.passiveValue ?? 0;

  // 2回攻撃確率（ペット・武器どちらかが持つ確率。両方あれば高い方を表示）
  let doubleRate = 0;
  if (pet?.passive === "doubleAttack") doubleRate += pet.passiveValue ?? 0;
  if (weapon?.passive === "doubleAttack") doubleRate += weapon.passiveValue ?? 0;

  // 不屈発生確率
  let surviveRate = 0;
  if (pet?.passive === "survive") surviveRate += pet.passiveValue ?? 0;
  if (weapon?.passive === "survive") surviveRate += weapon.passiveValue ?? 0;

  // 与ダメ上昇（超過分含む）
  let dmgBoost = 0;
  if (pet?.passive === "dmgBoost") dmgBoost += pet.passiveValue ?? 0;
  if (weapon?.passive === "dmgBoost") dmgBoost += weapon.passiveValue ?? 0;
  if (pet?.passive === "legendDmgBoost") dmgBoost += pet.passiveValue ?? 0;
  if (weapon?.passive === "legendDmgBoost") dmgBoost += weapon.passiveValue ?? 0;
  dmgBoost += Math.floor(state._triggerOverflowDmgBoost ?? 0); // 超過分加算

  // 被ダメ減少
  let dmgReduce = 0;
  if (pet?.passive === "dmgReduce") dmgReduce += pet.passiveValue ?? 0;
  if (weapon?.passive === "dmgReduce") dmgReduce += weapon.passiveValue ?? 0;
  if (pet?.passive === "legendDmgReduce") dmgReduce += pet.passiveValue ?? 0;
  if (weapon?.passive === "legendDmgReduce") dmgReduce += weapon.passiveValue ?? 0;

  // HP増加（hpBoostスキル分＋超過変換分を含む）
  let hpBoost = 0;
  if (pet?.passive === "hpBoost") hpBoost += pet.passiveValue ?? 0;
  if (weapon?.passive === "hpBoost") hpBoost += weapon.passiveValue ?? 0;
  if (pet?.passive === "legendHpBoost") hpBoost += pet.passiveValue ?? 0;
  if (weapon?.passive === "legendHpBoost") hpBoost += weapon.passiveValue ?? 0;
  hpBoost += Math.floor(state._triggerOverflowHpBoost ?? 0); // 根性・被ダメ減少・不死身・復活・輪廻転生・再生・不滅の超過分加算

  // 反射率（通常）
  let reflectRate = 0;
  if (pet?.passive === "reflect") reflectRate += pet.passiveValue ?? 0;
  if (weapon?.passive === "reflect") reflectRate += weapon.passiveValue ?? 0;

  // 鏡盾反射率
  let legendReflectRate = 0;
  if (pet?.passive === "legendReflect") legendReflectRate += pet.passiveValue ?? 0;
  if (weapon?.passive === "legendReflect") legendReflectRate += weapon.passiveValue ?? 0;

  // 与ダメ吸収率（通常）
  let drainRate = 0;
  if (pet?.passive === "drain") drainRate += pet.passiveValue ?? 0;
  if (weapon?.passive === "drain") drainRate += weapon.passiveValue ?? 0;

  // 与ダメ吸収率（吸血鬼）
  let legendDrainRate = 0;
  if (pet?.passive === "legendDrain") legendDrainRate += pet.passiveValue ?? 0;
  if (weapon?.passive === "legendDrain") legendDrainRate += weapon.passiveValue ?? 0;

  // クリティカル率
  let critRate = 0;
  if (pet?.passive === "critRate") critRate += pet.passiveValue ?? 0;
  if (weapon?.passive === "critRate") critRate += weapon.passiveValue ?? 0;
  if (pet?.passive === "legendCritRate") critRate += pet.passiveValue ?? 0;
  if (weapon?.passive === "legendCritRate") critRate += weapon.passiveValue ?? 0;

  // クリティカル強化
  let critDmg = 0;
  if (pet?.passive === "critDamage") critDmg += pet.passiveValue ?? 0;
  if (weapon?.passive === "critDamage") critDmg += weapon.passiveValue ?? 0;
  if (pet?.passive === "legendCritDamage") critDmg += pet.passiveValue ?? 0;
  if (weapon?.passive === "legendCritDamage") critDmg += weapon.passiveValue ?? 0;

  // 経験値爆発
  let expBurstRate = 0;
  if (pet?.passive === "expBurst") expBurstRate += pet.passiveValue ?? 0;
  if (weapon?.passive === "expBurst") expBurstRate += weapon.passiveValue ?? 0;

  // 経験値大爆発
  let legendExpBurstRate = 0;
  if (pet?.passive === "legendExpBurst") legendExpBurstRate += pet.passiveValue ?? 0;
  if (weapon?.passive === "legendExpBurst") legendExpBurstRate += weapon.passiveValue ?? 0;

  // 復活率
  let resurrectionRate = 0;
  if (pet?.passive === "resurrection") resurrectionRate += pet.passiveValue ?? 0;
  if (weapon?.passive === "resurrection") resurrectionRate += weapon.passiveValue ?? 0;

  // 巨人殺し
  let giantKiller = 0;
  if (pet?.passive === "giantKiller") giantKiller += pet.passiveValue ?? 0;
  if (weapon?.passive === "giantKiller") giantKiller += weapon.passiveValue ?? 0;
  if (pet?.passive === "legendGiantKiller") giantKiller += pet.passiveValue ?? 0;
  if (weapon?.passive === "legendGiantKiller") giantKiller += weapon.passiveValue ?? 0;

  // ボス特効
  let bossSlayer = 0;
  if (pet?.passive === "bossSlayer") bossSlayer += pet.passiveValue ?? 0;
  if (weapon?.passive === "bossSlayer") bossSlayer += weapon.passiveValue ?? 0;
  if (pet?.passive === "legendBossSlayer") bossSlayer += pet.passiveValue ?? 0;
  if (weapon?.passive === "legendBossSlayer") bossSlayer += weapon.passiveValue ?? 0;

  // 回避
  let evadeRate = 0;
  if (pet?.passive === "evade") evadeRate += pet.passiveValue ?? 0;
  if (weapon?.passive === "evade") evadeRate += weapon.passiveValue ?? 0;
  if (pet?.passive === "legendEvade") evadeRate += pet.passiveValue ?? 0;
  if (weapon?.passive === "legendEvade") evadeRate += weapon.passiveValue ?? 0;

  // 背水
  let lastStand = 0;
  if (pet?.passive === "lastStand") lastStand += pet.passiveValue ?? 0;
  if (weapon?.passive === "lastStand") lastStand += weapon.passiveValue ?? 0;
  if (pet?.passive === "legendLastStand") lastStand += pet.passiveValue ?? 0;
  if (weapon?.passive === "legendLastStand") lastStand += weapon.passiveValue ?? 0;

  // 再生
  let regenRate = 0;
  if (pet?.passive === "regen") regenRate += pet.passiveValue ?? 0;
  if (weapon?.passive === "regen") regenRate += weapon.passiveValue ?? 0;
  if (pet?.passive === "legendRegen") regenRate += pet.passiveValue ?? 0;
  if (weapon?.passive === "legendRegen") regenRate += weapon.passiveValue ?? 0;

  // 攻撃力増加（通常＋レジェンダリー）
  let atkBoost = 0;
  if (pet?.passive === "atkBoost") atkBoost += pet.passiveValue ?? 0;
  if (weapon?.passive === "atkBoost") atkBoost += weapon.passiveValue ?? 0;
  if (pet?.passive === "legendAtkBoost") atkBoost += pet.passiveValue ?? 0;
  if (weapon?.passive === "legendAtkBoost") atkBoost += weapon.passiveValue ?? 0;

  // ドロップ率増加（通常＋レジェンダリー）
  let dropBoost = 0;
  if (pet?.passive === "dropBoost") dropBoost += pet.passiveValue ?? 0;
  if (weapon?.passive === "dropBoost") dropBoost += weapon.passiveValue ?? 0;
  if (pet?.passive === "legendDropBoost") dropBoost += pet.passiveValue ?? 0;
  if (weapon?.passive === "legendDropBoost") dropBoost += weapon.passiveValue ?? 0;

  // レジェンダリー専用スキル（装備中のみ表示）
  const hasTripleAttack = pet?.passive === "tripleAttack" || weapon?.passive === "tripleAttack";
  // tripleAttack合算値
  let tripleAttackRate = 0;
  if (pet?.passive === "tripleAttack") tripleAttackRate += pet.passiveValue ?? 0;
  if (weapon?.passive === "tripleAttack") tripleAttackRate += weapon.passiveValue ?? 0;
  let legendSurviveRate = 0;
  if (pet?.passive === "legendSurvive") legendSurviveRate += pet.passiveValue ?? 0;
  if (weapon?.passive === "legendSurvive") legendSurviveRate += weapon.passiveValue ?? 0;
  let legendResurrectionRate = 0;
  if (pet?.passive === "legendResurrection") legendResurrectionRate += pet.passiveValue ?? 0;
  if (weapon?.passive === "legendResurrection") legendResurrectionRate += weapon.passiveValue ?? 0;
  // 後方互換（旧変数名は不使用になるが念のため保持）
  const legendAtkBoostVal = 0;
  const legendDropBoostVal = 0;

  // 図鑑バフ
  const dexHp = Math.round((state.dexBuff.hp - 1) * 100);
  const dexAtk = Math.round((state.dexBuff.power - 1) * 100);
  const wDexHp = Math.round((state.weaponDexBuff.hp - 1) * 100);
  const wDexAtk = Math.round((state.weaponDexBuff.power - 1) * 100);
  const totalDexHp = dexHp + wDexHp;
  const totalDexAtk = dexAtk + wDexAtk;

  const row = (label, value, sub = "") => `
    <div class="status-detail-row">
      <span class="status-detail-label">${label}</span>
      <span class="status-detail-value">${value}${sub ? ` <span class="status-detail-sub">${sub}</span>` : ""}</span>
    </div>`;

  const cappedRow = (label, rawValue, cap, unit = "") => {
    const isAtCap = rawValue >= cap;
    const displayValue = isAtCap ? cap : rawValue;
    const valStr = unit ? `${displayValue}${unit}` : `${displayValue}%`;
    const style = isAtCap ? ` style="color: yellow"` : "";
    return `
    <div class="status-detail-row">
      <span class="status-detail-label">${label}</span>
      <span class="status-detail-value"${style}>${valStr}</span>
    </div>`;
  };

  const gemsRaw = player.gems;
  const gemBonus = Array.isArray(gemsRaw)
    ? gemsRaw.reduce((sum, g) => sum + (g.atkBonus ?? 0), 0)
    : ((gemsRaw?.copper ?? 0) * 3 + (gemsRaw?.silver ?? 0) * 5 + (gemsRaw?.gold ?? 0) * 10);

  el.innerHTML = `
    <div class="status-detail-section">
      <div class="status-detail-heading">⚔️ 戦闘ステータス</div>
      ${row("HP", `${player.hp} / ${totalHp}`)}
      ${row("攻撃力", totalAtk)}
      ${gemBonus > 0 ? row("宝玉ATKボーナス", `+${gemBonus}`) : ""}
    </div>
    <div class="status-detail-section">
      <div class="status-detail-heading">✨ スキル効果 <span style="font-size:10px;color:#aaa;font-weight:normal;">※黄色文字は上限値に達している効果です</span></div>
      ${expBoost > 0 ? row("経験値増加率", `+${expBoost}%`) : ""}
      ${captureBoost > 0 ? row("捕獲率", `+${captureBoost}%`) : ""}
      ${atkBoost > 0 ? row("攻撃力増加率", `+${atkBoost}%`) : ""}
      ${dropBoost > 0 ? row("ドロップ率", `+${dropBoost}%`) : ""}
      ${dmgBoost > 0 ? row("与ダメ増加率", `+${dmgBoost}%`) : ""}
      ${dmgReduce > 0 ? cappedRow("被ダメ減少率", dmgReduce, 80) : ""}
      ${hpBoost > 0 ? row("HP増加率", `+${hpBoost}%`) : ""}
      ${doubleRate > 0 ? cappedRow("2回攻撃 発生率", doubleRate, 100) : ""}
      ${hasTripleAttack ? row("✨連撃王", "3回攻撃") : ""}
      ${surviveRate > 0 ? cappedRow("根性 発生率", surviveRate, 80) : ""}
      ${legendSurviveRate > 0 ? cappedRow("✨不死身 発生率", legendSurviveRate, 80) : ""}
      ${reflectRate > 0 ? row("ダメージ反射 反射率", `${reflectRate}%`) : ""}
      ${legendReflectRate > 0 ? row("✨鏡盾 反射率", `${legendReflectRate}%（現在${legendReflectRate + (state.legendReflectBonus ?? 0)}%）`) : ""}
      ${drainRate > 0 ? row("与ダメ吸収 回復率", `${drainRate}%`) : ""}
      ${legendDrainRate > 0 ? row("✨吸血鬼 回復率", `${legendDrainRate}%`) : ""}
      ${critRate > 0 ? cappedRow("クリティカル率", critRate, 100) : ""}
      ${critDmg > 0 ? row("クリティカルダメージ増加率", `+${critDmg}%`) : ""}
      ${expBurstRate > 0 ? cappedRow("経験値爆発 発生率", expBurstRate, 100) : ""}
      ${legendExpBurstRate > 0 ? cappedRow("経験値大爆発 発生率", legendExpBurstRate, 100) : ""}
      ${giantKiller > 0 ? row("巨人殺し 効果率", `+${giantKiller}%`) : ""}
      ${bossSlayer > 0 ? row("ボス特効 効果率", `+${bossSlayer}%`) : ""}
      ${evadeRate > 0 ? cappedRow("回避 発生率", evadeRate, 70) : ""}
      ${lastStand > 0 ? row("背水の陣 効果率", `+${lastStand}%`) : ""}
      ${regenRate > 0 ? cappedRow("再生率", regenRate, 50, "%/ターン") : ""}
      ${resurrectionRate > 0 ? cappedRow("復活 発生率", resurrectionRate, 100) : ""}
      ${legendResurrectionRate > 0 ? cappedRow("✨輪廻転生 発生率", legendResurrectionRate, 80) : ""}
      ${dmgReduce > 0 && (pet?.passive === "legendDmgReduce" || weapon?.passive === "legendDmgReduce") ? row("ダメージ無効", "3ターンごと") : ""}
    </div>
    <div class="status-detail-section">
      <div class="status-detail-heading">📘 図鑑バフ合計</div>
      ${row("HP", `+${totalDexHp}%`, `(敵図鑑+${dexHp}% / 武器図鑑+${wDexHp}%)`)}
      ${row("攻撃力", `+${totalDexAtk}%`, `(敵図鑑+${dexAtk}% / 武器図鑑+${wDexAtk}%)`)}
    </div>
  `;
}

// =====================
// 極個体ポップアップ
// =====================
export function showUltimatePopup(entity, type, isHolding = null) {
  // 設定によりモーダルをスキップ（ultimatePopupは捕獲時のみ）
  if (!(state.ui.showCaptureModal ?? true)) return;

  const overlay = document.getElementById("ultimateOverlay");
  const subEl  = document.getElementById("ultimateSub");
  const nameEl = document.getElementById("ultimateName");
  const statsEl = document.getElementById("ultimateStats");
  if (!overlay || !nameEl || !statsEl) return;

  if (type === "legendPet") {
    subEl.textContent = "究極個体を捕獲した！";
    nameEl.textContent = `${getTitleName(entity)}${entity.name}`;
    const passive = passiveLabelText(entity);
    const pval = entity.passiveValue != null ? `(${entity.passiveValue}%)` : "";
    statsEl.innerHTML = `ATK ${getPetPower(entity)} ／ HP ${getPetHp(entity)} ／ ${passive}${pval}`;
    overlay.classList.remove("hidden");
    overlay.onclick = () => overlay.classList.add("hidden");
    return;
  } else if (type === "pet") {
    subEl.textContent = "極個体を捕獲した！";
    nameEl.textContent = `${getTitleName(entity)}${entity.name}`;
    const passive = passiveLabelText(entity);
    const pval = entity.passiveValue != null ? `(${entity.passiveValue}%)` : "";
    statsEl.innerHTML = `ATK ${getPetPower(entity)} ／ HP ${getPetHp(entity)} ／ ${passive}${pval}`;
  } else {
    subEl.textContent = "極個体の武器を入手した！";
    nameEl.textContent = entity.name;
    const passive = weaponPassiveLabel(entity.passive);
    const pval = entity.passiveValue != null ? `(${entity.passiveValue}%)` : "";
    statsEl.innerHTML = `ATK ${entity.totalAtk} ／ HP ${entity.totalHp ?? 0} ／ ${passive}${pval}`;
  }

  overlay.classList.remove("hidden");
  overlay.onclick = () => overlay.classList.add("hidden");
}
export function showLegendaryPopup(enemy, mode = "appear", pet = null, isHolding = null) {
  // 設定によりモーダルをスキップ
  if (mode === "appear"   && !(state.ui.showAppearModal  ?? true)) return;
  if (mode === "captured" && !(state.ui.showCaptureModal ?? true)) return;

  const overlay  = document.getElementById("legendaryOverlay");
  const subEl    = document.getElementById("legendarySub");
  const nameEl   = document.getElementById("legendaryName");
  const skillEl  = document.getElementById("legendarySkill");
  const statsEl  = document.getElementById("legendaryCaptureStats");
  if (!overlay || !nameEl || !skillEl) return;

  const legendTitleName = legendaryTitles[enemy.passive]?.name ?? "";
  overlay.dataset.mode = mode;

  if (mode === "captured") {
    subEl.textContent = enemy.isBoss ? "🎉 伝説のボスを捕獲した！" : "🎉 伝説の個体を捕獲した！";
    nameEl.textContent = enemy.name;
    skillEl.textContent = legendTitleName ? `【${legendTitleName}】の加護を持つ` : "";
    if (statsEl && pet) {
      const passive = passiveLabelText(pet);
      const pval = pet.passiveValue != null ? `(${pet.passiveValue}%)` : "";
      statsEl.textContent = `ATK ${getPetPower(pet)} ／ HP ${getPetHp(pet)} ／ ${passive}${pval}`;
      statsEl.classList.remove("hidden");
    }
  } else {
    subEl.textContent = enemy.isBoss ? "伝説のボスが現れた！" : "伝説の個体が現れた！";
    nameEl.textContent = enemy.name;
    skillEl.textContent = legendTitleName ? `【${legendTitleName}】の加護を持つ` : "";
    if (statsEl) statsEl.classList.add("hidden");
  }

  overlay.classList.remove("hidden");
  overlay.onclick = () => overlay.classList.add("hidden");
  const _isHolding = isHolding ?? state.isHolding;
  if (_isHolding && _isHolding()) setTimeout(() => overlay.classList.add("hidden"), 2000);
}

export function showLegendUltimatePopup(enemy, mode = "appear", pet = null, isHolding = null) {
  // 設定によりモーダルをスキップ
  if (mode === "appear"   && !(state.ui.showAppearModal  ?? true)) return;
  if (mode === "captured" && !(state.ui.showCaptureModal ?? true)) return;

  const overlay  = document.getElementById("legendUltimateOverlay");
  const subEl    = document.getElementById("legendUltimateSub");
  const nameEl   = document.getElementById("legendUltimateName");
  const skillEl  = document.getElementById("legendUltimateSkill");
  const statsEl  = document.getElementById("legendUltimateCaptureStats");
  if (!overlay || !nameEl || !skillEl) return;

  const legendTitleName = legendaryTitles[enemy.passive]?.name ?? "";
  overlay.dataset.mode = mode;

  if (mode === "captured") {
    subEl.textContent = enemy.isBoss ? "🎉 究極のボスを捕獲した！" : "🎉 究極個体を捕獲した！";
    nameEl.textContent = enemy.name;
    skillEl.textContent = legendTitleName ? `【${legendTitleName}】の加護を持つ` : "";
    if (statsEl && pet) {
      const passive = passiveLabelText(pet);
      const pval = pet.passiveValue != null ? `(${pet.passiveValue}%)` : "";
      statsEl.textContent = `ATK ${getPetPower(pet)} ／ HP ${getPetHp(pet)} ／ ${passive}${pval}`;
      statsEl.classList.remove("hidden");
    }
  } else {
    subEl.textContent = enemy.isBoss ? "究極のボスが現れた！" : "究極個体が現れた！";
    nameEl.textContent = enemy.name;
    skillEl.textContent = legendTitleName ? `【${legendTitleName}】の加護を持つ` : "";
    if (statsEl) statsEl.classList.add("hidden");
  }

  overlay.classList.remove("hidden");
  overlay.onclick = () => overlay.classList.add("hidden");
  const _isHolding = isHolding ?? state.isHolding;
  if (_isHolding && _isHolding()) setTimeout(() => overlay.classList.add("hidden"), 2000);
}

export function showElitePopup(enemy, mode = "appear", pet = null, isHolding = null) {
  // 設定によりモーダルをスキップ
  if (mode === "appear"   && !(state.ui.showAppearModal  ?? true)) return;
  if (mode === "captured" && !(state.ui.showCaptureModal ?? true)) return;

  const overlay = document.getElementById("eliteOverlay");
  const subEl   = document.getElementById("eliteSub");
  const nameEl  = document.getElementById("eliteName");
  const statsEl = document.getElementById("eliteStats");
  if (!overlay || !nameEl) return;

  overlay.dataset.mode = mode;

  if (mode === "captured") {
    subEl.textContent = enemy.isBoss ? "🎉 極個体のボスを捕獲した！" : "🎉 極個体を捕獲した！";
    nameEl.textContent = enemy.name;
    if (statsEl && pet) {
      const passive = passiveLabelText(pet);
      const pval = pet.passiveValue != null ? `(${pet.passiveValue}%)` : "";
      statsEl.textContent = `ATK ${getPetPower(pet)} ／ HP ${getPetHp(pet)} ／ ${passive}${pval}`;
      statsEl.classList.remove("hidden");
    }
  } else {
    subEl.textContent = enemy.isBoss ? "極個体のボスが現れた！" : "極個体が現れた！";
    nameEl.textContent = enemy.name;
    if (statsEl) statsEl.classList.add("hidden");
  }

  overlay.classList.remove("hidden");
  overlay.onclick = () => overlay.classList.add("hidden");
  const _isHolding = isHolding ?? state.isHolding;
  if (_isHolding && _isHolding()) setTimeout(() => overlay.classList.add("hidden"), 2000);
}

// =====================
// 隠しボスモーダル
// =====================

export function showHiddenBossPopup(def) {
  // 設定によりモーダルをスキップ
  if (!(state.ui.showHiddenBossModal ?? true)) return;
  const overlay = document.getElementById("hiddenBossOverlay");
  const nameEl  = document.getElementById("hiddenBossName");
  const sinEl   = document.getElementById("hiddenBossSin");
  if (!overlay || !nameEl || !sinEl) return;

  sinEl.textContent  = `【七大罪：${def.sin}】`;
  nameEl.textContent = def.name;

  const descEl = document.getElementById("hiddenBossDesc");
  if (descEl) {
    descEl.textContent = "撃破すると専用ペット・専用武器が確定入手できます";
  }
  overlay.classList.remove("hidden");
  overlay.onclick = () => overlay.classList.add("hidden");

  const _isHolding = state.isHolding;
  if (_isHolding && _isHolding()) setTimeout(() => overlay.classList.add("hidden"), 2000);
}

export function showHiddenBossRewardModal(def, basePower, baseHp, weaponBaseAtk, weaponBaseHp, passiveValue) {
  // 貢献P付与
  state.research.currentPoints = (state.research.currentPoints ?? 0) + 50;

  // 専用ペット生成・付与
  const pet = {
    uid:              `${Date.now()}_${Math.random()}`,
    enemyId:          def.id,
    isBoss:           true,
    isHiddenBoss:     true,
    titleId:          null,
    name:             def.petDrop.name,
    basePower,
    totalPower:       basePower,
    baseHp,
    totalHp:          baseHp,
    passive:          def.petDrop.passive,
    passiveValue,
    level:            20,
    acquiredOrder:    state.acquiredCounter++,
    isLegendary:      false,
    isLegendUltimate: false,
    isElite:          false,
  };
  state.player.petList.push(pet);

  // 隠しボスペット入手フラグを図鑑に記録
  if (!state.book.hiddenBosses) state.book.hiddenBosses = {};
  if (!state.book.hiddenBosses[def.id]) {
    state.book.hiddenBosses[def.id] = { name: def.name, defeated: false, weaponObtained: false };
  }
  state.book.hiddenBosses[def.id].petObtained = true;
  checkPetV1Complete(state);

  // 専用武器生成・付与
  const weapon = {
    uid:              `${Date.now()}_${Math.random()}_w`,
    templateId:       def.weaponDrop.templateId,
    name:             def.weaponDrop.name,
    baseAtk:          weaponBaseAtk,
    totalAtk:         weaponBaseAtk,
    baseHp:           weaponBaseHp,
    totalHp:          weaponBaseHp,
    level:            0,
    passive:          def.weaponDrop.passive,
    passiveValue,
    isHiddenBossDrop: true,
    acquiredOrder:    state.acquiredCounter++,
  };
  state.player.inventory.push(weapon);
  registerHiddenWeaponObtained(def.id, def.weaponDrop.name);
  tryAutoWeaponSynth(weapon);

  // 初撃破フラグ記録
  if (!state.achievements.hiddenBossFirstKill) {
    state.achievements.hiddenBossFirstKill = {};
  }
  if (!state.achievements.hiddenBossFirstKill[def.id]) {
    state.achievements.hiddenBossFirstKill[def.id] = true;
  }

  addLog(`💀 ${def.name} を撃破した！`);
  addLog(`🎁 貢献P +50・経験値・専用ペット・専用武器を入手！`);

  // 実績チェック
  checkAchievements();

  // モーダル表示（設定によりスキップ）
  if (!(state.ui.showHiddenBossModal ?? true)) {
    saveGameLocal();
    return;
  }
  const overlay = document.getElementById("hiddenBossRewardOverlay");
  if (overlay) {
    document.getElementById("hiddenBossRewardSin").textContent    = `【七大罪：${def.sin}】`;
    document.getElementById("hiddenBossRewardName").textContent   = `${def.name} を撃破！`;
    document.getElementById("hiddenBossRewardPoints").textContent = "貢献P +50";
    document.getElementById("hiddenBossRewardPet").textContent    = `専用ペット「${def.petDrop.name}」を入手！`;
    document.getElementById("hiddenBossRewardWeapon").textContent = `専用武器「${def.weaponDrop.name}」を入手！`;
    const noteEl = document.getElementById("hiddenBossRewardNote");
    if (noteEl) noteEl.textContent = "※ 隠しボスのペット・武器にはレア個体はありません";
    overlay.classList.remove("hidden");
  }

  saveGameLocal();
}

// =====================
// 研究所UI
// =====================

// ペットアイテムHTML生成（寄贈モーダル流用）
export function renderPetItemHTML(pet) {
  const valueText = pet.passiveValue != null ? `(${pet.passiveValue}%)` : "";
  const bonusText = (pet.level ?? 0) > 0 ? ` <span class="weapon-level">+${pet.level}</span>` : "";
  const titleName = getTitleName(pet);
  return `
    <div class="pet-item-bar"></div>
    <div class="pet-item-body">
      <div class="item-row-1">
        <span class="pet-name">🐾 ${titleName}${pet.name}${bonusText}</span>
      </div>
      <div class="item-row-2">
        <span class="pet-atk">ATK ${getPetPower(pet)}(${pet.basePower})</span>
        <span class="pet-atk">HP ${getPetHp(pet)}(${pet.baseHp ?? 0})</span>
        <span class="pet-passive">${passiveLabelText(pet)}${valueText}</span>
      </div>
    </div>
  `;
}

function getEligiblePets(mission) {
  return state.player.petList.filter(pet => {
    if (state.player.equippedPet?.uid === pet.uid) return false;
    return checkMissionCompletion(mission, pet);
  });
}

function getTargetFloor(mission) {
  if (mission.isBoss) {
    const enemy = bossEnemies.find(e => e.id === mission.enemyId);
    if (!enemy) return null;
    return parseInt(enemy.floorBand.replace("boss-", ""), 10);
  } else {
    const enemy = normalEnemies.find(e => e.id === mission.enemyId);
    if (!enemy) return null;
    const parts = enemy.floorBand.split("-").map(Number);
    const mid = Math.round((parts[0] + parts[1]) / 2);
    return Math.max(50, Math.floor(mid / 50) * 50);
  }
}

function renderMissions() {
  const ul = document.getElementById("missionList");
  ul.innerHTML = "";
  for (const mission of state.research.missions) {
    const rareLabel = mission.isRare ? "レア" : "通常";
    const li = document.createElement("li");
    li.className = "mission-item";
    li.innerHTML = `
      <div class="mission-desc">
        ${mission.enemyName}の${rareLabel}個体を${mission.requiredCount}体寄贈する
      </div>
      <div class="mission-reward">獲得: ${mission.rewardPoints}P</div>
      <div class="mission-btn-row">
        <button class="donate-btn" data-mission-id="${mission.id}">寄贈する</button>
        <button class="go-catch-btn" data-enemy-id="${mission.enemyId}" data-is-boss="${mission.isBoss}">捕まえに行く</button>
      </div>
    `;
    ul.appendChild(li);
  }

  ul.querySelectorAll(".donate-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      openDonateModal(btn.dataset.missionId);
    });
  });

  ul.querySelectorAll(".go-catch-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const enemyId = Number(btn.dataset.enemyId);
      const isBoss  = btn.dataset.isBoss === "true";

      const targetFloor = getTargetFloor({ enemyId, isBoss });
      if (!targetFloor) return;

      if (targetFloor > state.maxFloor) {
        alert(`まだ到達していないフロアです（${targetFloor}階）`);
        return;
      }

      document.getElementById("researchOverlay").classList.add("hidden");

      state.lastSelectedFloor = targetFloor;
      state.floor = targetFloor;
      state.phase = "battle";
      if (_createEnemyCallback) _createEnemyCallback();
      calcOverflowBonuses();

      state.ui.stayOnFloor = true;
      const stayChk = document.getElementById("stayOnFloorChk");
      if (stayChk) stayChk.checked = true;

      saveGameLocal();
      if (_refreshUICallback) _refreshUICallback();
    });
  });
}

function renderLevelProgress() {
  const thresholds = [0, 20, 60, 100, 140, 200];
  const r = state.research;
  const level = r.level;
  const el = document.getElementById("researchLevelProgress");
  if (!el) return;
  if (level >= 5) {
    el.textContent = "最大レベル達成";
    return;
  }
  const next = thresholds[level + 1] ?? thresholds[thresholds.length - 1];
  el.textContent = `次のレベルまで: ${r.totalPointsEarned}/${next}P`;
}

function renderExchangeList() {
  const r = state.research;
  const ul = document.getElementById("exchangeList");
  const atkCost = getAtkPurchaseCost();
  const hpCost  = getHpPurchaseCost();
  const expCost = getExpPurchaseCost();

  ul.innerHTML = `
    <li class="exchange-item">
      <span>ATK +10</span>
      <span>${atkCost}P</span>
      <button data-type="atk" ${r.currentPoints < atkCost ? "disabled" : ""}>交換</button>
    </li>
    <li class="exchange-item">
      <span>HP +30</span>
      <span>${hpCost}P</span>
      <button data-type="hp" ${r.currentPoints < hpCost ? "disabled" : ""}>交換</button>
    </li>
    <li class="exchange-item">
      <span>経験値 +10</span>
      <span>${expCost}P</span>
      <button data-type="exp" ${r.currentPoints < expCost ? "disabled" : ""}>交換</button>
    </li>
    <li class="exchange-item">
      <span>ドロップ率 +0.1%（${r.dropBonus}/100回）</span>
      <span>${getDropPurchaseCost()}P</span>
      <button data-type="drop"
        ${r.currentPoints < getDropPurchaseCost() || r.dropPurchaseCount >= 100 ? "disabled" : ""}>交換</button>
    </li>
    <li class="exchange-item">
      <span>捕獲率 +0.1%（${r.captureBonus}/100回）</span>
      <span>${getCapturePurchaseCost()}P</span>
      <button data-type="capture"
        ${r.currentPoints < getCapturePurchaseCost() || r.capturePurchaseCount >= 100 ? "disabled" : ""}>交換</button>
    </li>
    ${hiddenBossDefs.map(def => {
        const sinKey   = def.id.replace("hidden_", "");
        const unlocked = r[def.unlockKey];
        if (r.level >= 5) {
          return `
            <li class="exchange-item">
              <span>💀 ${def.itemName}${unlocked ? "（解禁済み）" : ""}</span>
              <span>300P</span>
              <button data-type="hiddenBoss_${sinKey}"
                ${unlocked || r.currentPoints < 300 ? "disabled" : ""}>交換</button>
            </li>`;
        } else {
          return `
            <li class="exchange-item exchange-locked">
              <span>💀 ???</span>
              <span>???P</span>
              <button disabled>交換</button>
              <span class="exchange-hint">研究所Lv.5で解禁</span>
            </li>`;
        }
      }).join("")
    }
  `;

  ul.querySelectorAll("button[data-type]").forEach(btn => {
    btn.addEventListener("click", () => {
      const success = exchangeReward(btn.dataset.type);
      if (success) {
        renderResearchScreen();
        saveGameLocal();
      }
    });
  });
}

function updateRerollBtn() {
  const btn = document.getElementById("researchRerollBtn");
  const cost = getRerollCost();
  const canAfford = state.research.currentPoints >= cost;
  btn.disabled = !canAfford;
}

export function openDonateModal(missionId) {
  const mission = state.research.missions.find(m => m.id === missionId);
  if (!mission) return;

  const rareLabel = mission.isRare ? "レア" : "通常";
  document.getElementById("donateCondition").textContent =
    `${mission.enemyName}の${rareLabel}個体を${mission.requiredCount}体寄贈する`;

  const ul = document.getElementById("donatePetList");
  ul.innerHTML = "";

  // 条件を満たすペット（装備中・ロック除外）を取得
  const lockedSet = getLockedSet();
  const eligiblePets = state.player.petList.filter(pet =>
    !lockedSet.has(String(pet.uid)) &&
    state.player.equippedPet?.uid !== pet.uid &&
    checkMissionCompletion(mission, pet)
  );

  // 条件を満たさないペット（同種族）を取得
  const ineligiblePets = state.player.petList.filter(pet =>
    pet.enemyId === mission.enemyId &&
    !!pet.isBoss === mission.isBoss &&
    !eligiblePets.some(e => e.uid === pet.uid)
  );

  // 選択中のUID管理
  let selectedUids = [];

  // 選択状態の更新とボタン制御
  function updateDonateConfirmBtn() {
    const confirmBtn = document.getElementById("donateConfirmBtn");
    const count = selectedUids.length;
    const required = mission.requiredCount;
    if (count === 0) {
      confirmBtn.disabled = true;
      confirmBtn.textContent = `寄贈する（0 / ${required}体）`;
    } else if (count < required) {
      confirmBtn.disabled = true;
      confirmBtn.textContent = `寄贈する（${count} / ${required}体）`;
    } else {
      confirmBtn.disabled = false;
      confirmBtn.textContent = `寄贈する（${count} / ${required}体）`;
    }
  }

  // ペットアイテムのクリック処理（選択トグル）
  function handlePetClick(pet, li) {
    const idx = selectedUids.indexOf(pet.uid);
    if (idx === -1) {
      selectedUids.push(pet.uid);
      li.classList.add("selected");
    } else {
      selectedUids.splice(idx, 1);
      li.classList.remove("selected");
    }
    updateDonateConfirmBtn();
  }

  // 条件を満たすペットを表示
  const allPets = [
    ...eligiblePets.sort((a, b) => (b.level ?? 0) - (a.level ?? 0)),
    ...ineligiblePets.sort((a, b) => (b.level ?? 0) - (a.level ?? 0)),
  ];

  if (allPets.length === 0) {
    const msg = document.createElement("li");
    msg.className = "donate-no-pet-msg";
    msg.textContent = "対象ペットを未捕獲です";
    ul.appendChild(msg);
    document.getElementById("donateConfirmBtn").disabled = true;
    document.getElementById("donateConfirmBtn").textContent = `寄贈する（0 / ${mission.requiredCount}体）`;
    document.getElementById("donateOverlay").dataset.missionId = missionId;
    document.getElementById("donateOverlay").classList.remove("hidden");
    return;
  }

  for (const pet of allPets) {
    const isEquipped = state.player.equippedPet?.uid === pet.uid;
    const locked = lockedSet.has(String(pet.uid));
    const isEligible = eligiblePets.some(e => e.uid === pet.uid);

    let disabledReason = "";
    if (isEquipped) {
      disabledReason = "装備中";
    } else if (locked) {
      disabledReason = "ロック中";
    } else if (!isEligible) {
      if (mission.isRare && !pet.isElite && !pet.isLegendary && !pet.isLegendUltimate) {
        disabledReason = "レア個体が必要";
      } else if (!mission.isRare && (pet.isElite || pet.isLegendary || pet.isLegendUltimate)) {
        disabledReason = "通常個体が必要";
      } else {
        disabledReason = "条件不足";
      }
    }

    const li = document.createElement("li");
    li.className = `pet-item ${!isEligible ? "pet-locked-donate" : ""}`;
    li.dataset.uid = pet.uid;
    li.innerHTML = renderPetItemHTML(pet) +
      (disabledReason ? `<div class="donate-disabled-reason">⚠️ ${disabledReason}</div>` : "");

    if (isEligible) {
      li.addEventListener("click", () => handlePetClick(pet, li));
    }

    ul.appendChild(li);
  }

  // 一括選択ボタンのクリック処理
  const selectAllBtn = document.getElementById("donateSelectAllBtn");
  selectAllBtn.onclick = () => {
    // 選択中をリセット
    selectedUids = [];
    ul.querySelectorAll("li").forEach(li => li.classList.remove("selected"));

    // 条件を満たすペットをrequiredCount体まで自動選択
    const autoSelect = eligiblePets
      .sort((a, b) => (b.level ?? 0) - (a.level ?? 0))
      .slice(0, mission.requiredCount);

    for (const pet of autoSelect) {
      selectedUids.push(pet.uid);
      const li = ul.querySelector(`li[data-uid="${pet.uid}"]`);
      if (li) li.classList.add("selected");
    }

    updateDonateConfirmBtn();
  };

  // 寄贈ボタンのクリック処理
  document.getElementById("donateConfirmBtn").onclick = () => {
    if (selectedUids.length < mission.requiredCount) return;
    const success = donatePets(missionId, selectedUids);
    if (success) {
      document.getElementById("donateOverlay").classList.add("hidden");
      renderResearchScreen();
      saveGameLocal();
    }
  };

  updateDonateConfirmBtn();
  document.getElementById("donateOverlay").dataset.missionId = missionId;
  document.getElementById("donateOverlay").classList.remove("hidden");
}

export function renderResearchScreen() {
  const isUnlocked = state.maxFloor >= 500;
  document.getElementById("researchLocked").classList.toggle("hidden", isUnlocked);
  document.getElementById("researchContent").classList.toggle("hidden", !isUnlocked);
  if (!isUnlocked) return;

  // ミッションが空なら初期生成
  if (state.research.missions.length === 0) {
    initMissions();
  }

  document.getElementById("researchLevel").textContent = `研究所 Lv.${state.research.level}`;
  document.getElementById("researchPoints").textContent = `貢献P: ${state.research.currentPoints}`;

  renderLevelProgress();
  renderMissions();
  renderExchangeList();
  updateRerollBtn();
}

// =====================
// 自動合成対象設定モーダル
// =====================

// 現在どちらのモーダルを開いているか（"pet" | "weapon"）
let _autoSynthModalType = null;

export function openAutoSynthModal(type) {
  _autoSynthModalType = type;
  renderAutoSynthModal();
  document.getElementById("autoSynthOverlay").classList.remove("hidden");
}

function renderAutoSynthModal() {
  const type = _autoSynthModalType;
  const uids = type === "pet"
    ? (state.autoSynth?.petUids ?? [])
    : (state.autoSynth?.weaponUids ?? []);

  const titleEl = document.getElementById("autoSynthModalTitle");
  if (titleEl) titleEl.textContent = type === "pet"
    ? `自動合成対象（ペット）${uids.length}/4`
    : `自動合成対象（武器）${uids.length}/4`;

  const listEl = document.getElementById("autoSynthTargetList");
  if (!listEl) return;
  listEl.innerHTML = "";

  if (uids.length === 0) {
    const empty = document.createElement("li");
    empty.className = "auto-synth-target-empty";
    empty.textContent = "登録なし";
    listEl.appendChild(empty);
    return;
  }

  uids.forEach((uid, slotIdx) => {
    const li = document.createElement("li");
    li.className = "auto-synth-target-item";

    if (type === "pet") {
      const pet = state.player.petList.find(p => p.uid === uid);
      if (!pet) {
        li.innerHTML = `
          <div class="auto-synth-target-info">
            <span class="auto-synth-target-name">（不明）</span>
          </div>
          <button class="auto-synth-remove-btn" data-slot="${slotIdx}">解除</button>
        `;
      } else {
        if (pet.isLegendUltimate)    li.classList.add("pet-legend-ultimate");
        else if (pet.isLegendary)    li.classList.add("pet-legendary");
        else if (pet.isElite)        li.classList.add("pet-elite");
        else if (isUltimatePet(pet)) li.classList.add("ultimate");

        const valueText = pet.passiveValue != null ? `(${pet.passiveValue}%)` : "";
        const bonusText = (pet.level ?? 0) > 0 ? ` +${pet.level}` : "";
        li.innerHTML = `
          <div class="auto-synth-target-info">
            <span class="auto-synth-target-name">🐾 ${getTitleName(pet)}${pet.name}${bonusText}</span>
            <span class="auto-synth-target-stats">ATK ${getPetPower(pet)} / HP ${getPetHp(pet)}</span>
            <span class="auto-synth-target-skill">${passiveLabelText(pet)}${valueText}</span>
          </div>
          <button class="auto-synth-remove-btn" data-slot="${slotIdx}">解除</button>
        `;
      }
    } else {
      const weapon = state.player.inventory.find(w => w.uid === uid);
      if (!weapon) {
        li.innerHTML = `
          <div class="auto-synth-target-info">
            <span class="auto-synth-target-name">（不明）</span>
          </div>
          <button class="auto-synth-remove-btn" data-slot="${slotIdx}">解除</button>
        `;
      } else {
        if (isUltimateWeapon(weapon)) li.classList.add("ultimate");

        const passiveText = weapon.passive
          ? `${weaponPassiveLabel(weapon.passive)}${weapon.passiveValue != null ? `(${weapon.passiveValue}%)` : ""}`
          : "";
        const levelText = weapon.level > 0 ? ` +${weapon.level}` : "";
        li.innerHTML = `
          <div class="auto-synth-target-info">
            <span class="auto-synth-target-name">⚔️ ${getWeaponDisplayName(weapon)}${levelText}</span>
            <span class="auto-synth-target-stats">ATK ${weapon.totalAtk} / HP ${weapon.totalHp ?? 0}</span>
            ${passiveText ? `<span class="auto-synth-target-skill">${passiveText}</span>` : ""}
          </div>
          <button class="auto-synth-remove-btn" data-slot="${slotIdx}">解除</button>
        `;
      }
    }

    listEl.appendChild(li);
  });

  // 解除ボタンのイベントバインド
  listEl.querySelectorAll(".auto-synth-remove-btn").forEach(btn => {
    btn.addEventListener("click", (e) => {
      const slot = Number(e.currentTarget.dataset.slot);
      const src = _autoSynthModalType === "pet"
        ? state.autoSynth.petUids
        : state.autoSynth.weaponUids;
      const slots = [null, null, null, null];
      src.forEach((u, i) => { if (i < 4) slots[i] = u; });
      slots[slot] = null;
      const newList = slots.filter(u => u !== null);
      if (_autoSynthModalType === "pet") {
        state.autoSynth.petUids = newList;
      } else {
        state.autoSynth.weaponUids = newList;
      }
      saveGameLocal();
      renderAutoSynthModal();
    });
  });
}