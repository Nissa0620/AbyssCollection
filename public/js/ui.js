import { state } from "./state.js";
import { getTitleName } from "./data/index.js";
import { addLog } from "./log.js";
import { getSynthesisPreview } from "./inventory.js";
import { isFavorite, toggleFavorite, isLocked, toggleLock } from "./listPrefs.js";
import { isUltimateWeapon } from "./drop.js";
import { isUltimatePet } from "./pet.js";
import { getPetSynthesisPreview } from "./pet.js";
import { toggleSelectAllSamePets } from "./pet.js";
import { passiveLabels } from "./pet.js";
import { getWeaponDisplayName } from "./weapon.js";
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

// 表示更新処理
export function updateDisplay(player, enemy) {
  document.getElementById("playerHp").textContent =
    "HP : " + player.hp + " / " + player.totalHp;

  document.getElementById("enemyHp").textContent =
    enemy ? "HP : " + enemy.hp + " / " + enemy.totalHp : "";

  document.getElementById("enemyName").textContent =
    enemy ? enemy.name : "???";

  document.getElementById("floorDisplay").textContent =
    "地下" + state.floor + "階層";

  document.getElementById("playerAttack").textContent =
    "攻撃力 : " + player.totalPower;

  const nextExpEl = document.getElementById("nextExp");
  if (nextExpEl) nextExpEl.textContent = "";
}

// インベントリ表示処理
export function renderInventory(player, onItemClick, onEquip) {
  const list = document.getElementById("inventoryList");
  list.innerHTML = "";

  const filter = state.ui.inventoryFilter ?? "";
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

  // お気に入り優先でソート
  const sortedGroups = [...groups.entries()].sort(([keyA], [keyB]) => {
    const favA = isFavorite(`weapon_${keyA}`) ? 0 : 1;
    const favB = isFavorite(`weapon_${keyB}`) ? 0 : 1;
    if (favA !== favB) return favA - favB;
    return Number(keyA) - Number(keyB);
  });

  for (const [templateId, groupItems] of sortedGroups) {
    const template = weaponTemplates.find((t) => t.id === templateId);
    const baseName = template?.name ?? "不明な武器";

    // 所持中の最高進化名を取得
    const maxLevel = Math.max(...groupItems.map((w) => w.level ?? 0));
    const evoName = template?.evolutions
      ? [...template.evolutions].reverse().find((e) => maxLevel >= e.level)?.name ?? null
      : null;
    const displayName = evoName ?? baseName;

    // 通常スキル名
    const skillLabel = template?.passive ? weaponPassiveLabel(template.passive) : "";

    const groupKey = `weapon_${templateId}`;
    const fav = isFavorite(groupKey);

    const groupEl = document.createElement("div");
    groupEl.className = "pet-group";

    const headerEl = document.createElement("div");
    headerEl.className = "pet-group-header";
    headerEl.innerHTML = `
      <button class="group-fav-btn ${fav ? "fav-on" : ""}" data-group-key="${groupKey}">${fav ? "♥" : "♡"}</button>
      <span class="pet-group-name">⚔️ ${displayName}</span>
      <span class="pet-group-skill">${skillLabel}</span>
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
    let rendered = false;

    const closeBtn = headerEl.querySelector(".group-close-btn");

    headerEl.addEventListener("click", () => {
      const isOpen = !bodyEl.classList.contains("hidden");
      if (isOpen) return;

      if (!rendered) {
        renderWeaponGroupBody(bodyEl, groupItems, onItemClick, onEquip);
        rendered = true;
      }
      bodyEl.classList.remove("hidden");
      headerEl.querySelector(".pet-group-toggle").textContent = "▼";
      closeBtn.classList.remove("hidden");
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
  groupItems.forEach((item) => {
    const isEquipped = state.player.equippedWeapon === item;
    const displayName = getWeaponDisplayName(item, { showSeries: true });

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
    const locked = isLocked(item.uid);
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
      if (isLocked(item.uid) && state.synthesis.baseUid !== null && !isBase) return;
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

    bodyEl.appendChild(li);
  });
}

export function sortInventory(player) {
  const mode = state.ui.sortMode;
  player.inventory.sort((a, b) => {
    if (mode === "book")    return a.templateId - b.templateId;
    if (mode === "hp")      return (b.totalHp ?? 0) - (a.totalHp ?? 0);
    if (mode === "passive") return (b.passiveValue ?? 0) - (a.passiveValue ?? 0);
    return b.totalAtk - a.totalAtk; // atk
  });
}

export function updateSortBtn() {
  const btn = document.getElementById("sortBtn");
  if (!btn) return;
  const labels = { atk: "ソート：攻撃力", book: "ソート：図鑑順", hp: "ソート：HP", passive: "ソート：スキル値" };
  btn.textContent = labels[state.ui.sortMode] ?? "ソート：攻撃力";
}

export function updateInventoryVisibility() {
  const overlay = document.getElementById("inventoryOverlay");
  if (state.ui.inventoryOpen) {
    overlay.classList.remove("hidden");
  } else {
    overlay.classList.add("hidden");
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
  const gemSection  = document.getElementById("invGemSection");
  const summaryEl   = document.getElementById("gemBonusSummary");
  const listEl      = document.getElementById("gemList");
  if (!gemSection || !summaryEl || !listEl) return;

  const gems = state.player.gems ?? [];

  // 合計ボーナス
  const totalBonus = gems.reduce((sum, g) => sum + (g.atkBonus ?? 0), 0);
  const copperCount = gems.filter((g) => g.id === 1).length;
  const silverCount = gems.filter((g) => g.id === 2).length;
  const goldCount   = gems.filter((g) => g.id === 3).length;
  summaryEl.innerHTML = `
    <span class="gem-total-atk">ATK +${totalBonus}</span>
    <span class="gem-counts">
      🟤銅×${copperCount}　⚪銀×${silverCount}　🟡金×${goldCount}
    </span>
  `;

  listEl.innerHTML = "";

  if (gems.length === 0) {
    const li = document.createElement("li");
    li.className = "pet-empty";
    li.textContent = "宝玉がありません（ボスを倒すと入手できます）";
    listEl.appendChild(li);
    return;
  }

  // 種類ごとにまとめて表示（金→銀→銅）
  const grouped = [
    { id: 3, rarity: "gold",   icon: "🟡", name: "金の宝玉",  atkBonus: 10, count: goldCount },
    { id: 2, rarity: "silver", icon: "⚪", name: "銀の宝玉",  atkBonus: 5,  count: silverCount },
    { id: 1, rarity: "copper", icon: "🟤", name: "銅の宝玉",  atkBonus: 3,  count: copperCount },
  ];
  grouped.filter((g) => g.count > 0).forEach((g) => {
    const li = document.createElement("li");
    li.className = `pet-item gem-item gem-${g.rarity}`;
    li.innerHTML = `
      <span class="pet-name">${g.icon} ${g.name} ×${g.count}</span>
      <span class="pet-atk">ATK +${g.atkBonus} × ${g.count} = +${g.atkBonus * g.count}</span>
    `;
    listEl.appendChild(li);
  });
}

export function updateInventoryTab(tab) {
  const weaponSection = document.getElementById("invWeaponSection");
  const gemSection    = document.getElementById("invGemSection");
  const weaponTabBtn  = document.getElementById("invTabWeapon");
  const gemTabBtn     = document.getElementById("invTabGem");
  if (!weaponSection || !gemSection) return;

  if (tab === "gem") {
    weaponSection.classList.add("hidden");
    gemSection.classList.remove("hidden");
    weaponTabBtn?.classList.remove("active");
    gemTabBtn?.classList.add("active");
  } else {
    weaponSection.classList.remove("hidden");
    gemSection.classList.add("hidden");
    weaponTabBtn?.classList.add("active");
    gemTabBtn?.classList.remove("active");
  }
}

// =====================
// スキルフィルタ選択肢を所持品に合わせて動的更新
// =====================
export function updateInventoryFilterOptions() {
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
  if (passives.includes(currentValue)) {
    select.value = currentValue;
  } else if (currentValue !== "") {
    select.value = "";
    state.ui.inventoryFilter = "";
  }
}

export function updatePetFilterOptions() {
  const select = document.getElementById("petFilterSelect");
  if (!select) return;
  const currentValue = select.value;
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
  if (passives.includes(currentValue)) {
    select.value = currentValue;
  } else if (currentValue !== "") {
    select.value = "";
    state.ui.petFilter = "";
  }
}

// ログ表示処理
export function renderLogs(logs) {
  const logArea = document.getElementById("log");
  logArea.innerHTML = "";

  logs.forEach((log) => {
    const p = document.createElement("p");
    p.textContent = log;
    logArea.appendChild(p);
  });
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
  const synthBtn = document.getElementById("synthesizeBtn");
  if (synthBtn) {
    const { baseUid, materialUids } = state.synthesis;
    synthBtn.disabled = !(baseUid !== null && materialUids.length > 0);
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
  const synthBtn = document.getElementById("petSynthesizeBtn");
  if (synthBtn) {
    const { baseUid, materialUids } = state.petSynthesis;
    synthBtn.disabled = !(baseUid !== null && materialUids.length > 0);
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
      previewEl.innerHTML = `ATK ${preview.oldPower} → <strong>${preview.newPower}</strong> / HP ${preview.oldHp} → <strong>${preview.newHp}</strong>`;
    } else {
      previewEl.style.display = "none";
      previewEl.textContent = "";
    }
  }
}

export function updateSynthesisPreview() {
  const previewDiv = document.getElementById("synthesisPreview");
  const preview = getSynthesisPreview();

  if (!preview) {
    previewDiv.textContent = "";
    return;
  }

  previewDiv.innerHTML = `
    強化値 +${preview.oldLevel} → +${preview.newLevel}<br>
    ATK ${preview.oldTotalAtk} → ${preview.newTotalAtk}<br>
    HP +${preview.oldTotalHp} → +${preview.newTotalHp}
  `;
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

// 階層移動
export function updateFloorJumpOptions() {
  const select = document.getElementById("floorJumpSelect");
  if (!select) return;

  select.innerHTML = "";

  const first = document.createElement("option");
  first.value = "1";
  first.textContent = "1階";
  select.appendChild(first);

  const max = state.maxFloor;
  if (max < 50) return;

  const maxMultiple = Math.floor(max / 50) * 50;
  for (let f = 50; f <= maxMultiple; f += 50) {
    const opt = document.createElement("option");
    opt.value = String(f);
    opt.textContent = `${f}階`;
    select.appendChild(opt);
  }
}

// 図鑑ポップアップ
export function renderBook(tab = "enemies") {
  const buffEl = document.getElementById("bookBuffSummary");
  const contentEl = document.getElementById("bookContent");

  document.querySelectorAll(".book-tab").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.tab === tab);
  });

  contentEl.innerHTML = "";

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
  const totalEnemies = allEnemyDefs.length;
  const obtainedEnemies = allEnemyDefs.filter((e) => {
    const key = e.isBoss ? `boss_${e.id}` : `normal_${e.id}`;
    const entry = state.book.enemies[key];
    return entry && Object.values(entry.titles ?? {}).some((t) => t.defeated);
  }).length;

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
    const floorText = hasDefeatedAny
      ? (enemyDef.isBoss ? `${enemyDef.bossFloors?.[0]}階` : (area ? `${area.min}〜${area.max}階` : "不明"))
      : "不明";

    const section = document.createElement("div");
    section.className = "book-enemy";

    const header = document.createElement("div");
    header.className = "book-enemy-header";
    const name = entry ? entry.name : "？？？";

    const isCompleted = entry && titlePool.every((title) => entry.titles?.[title.id]?.defeated);
    if (isCompleted) header.classList.add("completed");
    if (enemyDef.isBoss) header.classList.add("boss");

    const ultiBadge = entry?.hasUltimate ? ` <span class="book-ultimate">【極】</span>` : "";
    header.innerHTML = `<span>${name}${ultiBadge}</span><span class="book-toggle">▶</span>`;

    const detail = document.createElement("div");
    detail.className = "book-enemy-detail hidden";

    if (!entry) {
      detail.innerHTML = `<div class="book-enemy-meta">出現：${floorText}　遭遇：0 / 撃破：0</div>`;
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
      const legendHtml = legendDef && legendEntry?.seen ? (() => {
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
  tabBar.appendChild(tabNormal);
  tabBar.appendChild(tabBoss);
  contentEl.appendChild(tabBar);

  if (subTab === "normal") {
    normalEnemies.forEach((enemyDef) => {
      const titlePool = enemyTitles[enemyDef.titleGroup] ?? Object.values(enemyTitles)[0] ?? [];
      renderEnemyEntry(enemyDef, titlePool);
    });
  } else {
    bossEnemies.forEach((enemyDef) => {
      const titlePool = bossTitles[enemyDef.titleGroup] ?? [];
      renderEnemyEntry(enemyDef, titlePool);
    });
  }
}

function renderWeaponBook(buffEl, contentEl) {
  const hpBuff = Math.round((state.weaponDexBuff.hp - 1) * 100);
  const atkBuff = Math.round((state.weaponDexBuff.power - 1) * 100);

  const totalWeapons = weaponTemplates.length;
  const obtainedWeapons = weaponTemplates.filter((t) => {
    const key = t.isBossDrop ? `boss_${t.id}` : `normal_${t.id}`;
    return !!state.book.weapons[key];
  }).length;

  buffEl.innerHTML = `<div>入手済み：${obtainedWeapons} / ${totalWeapons}</div><div>図鑑バフ：HP +${hpBuff}% / ATK +${atkBuff}%</div>`;

  const bookWeapons = state.book.weapons;

  weaponTemplates.forEach((template) => {
    const bookKey = template.isBossDrop ? `boss_${template.id}` : `normal_${template.id}`;
    const entry = bookWeapons[bookKey];
    const area = Object.values(floorTable).find(
      (a) => a.weaponIdRange && a.weaponIdRange[0] <= template.id && template.id <= a.weaponIdRange[1],
    );
    const hasObtainedAny = !!entry;
    const floorText = hasObtainedAny && area ? `${area.min}〜${area.max}階` : "不明";

    const section = document.createElement("div");
    section.className = "book-enemy";

    const header = document.createElement("div");
    header.className = "book-enemy-header";

    const isCompleted =
      entry &&
      template.evolutions.every((evo) => entry.evolutions[evo.name]?.obtained);
    if (isCompleted) header.classList.add("completed");

    const name = entry ? template.name : "？？？";
    const wUltiBadge = entry?.hasUltimate ? ` <span class="book-ultimate">【極】</span>` : "";
    header.innerHTML = `<span>${name}${wUltiBadge}</span><span class="book-toggle">▶</span>`;

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
}

// =====================
// ペットパネル
// =====================
export function updateEquippedWeaponInfo(onUnequip) {
  const el = document.getElementById("equippedWeaponInfo");
  if (!el) return;
  const w = state.player.equippedWeapon;
  if (w) {
    const name = getWeaponDisplayName(w, { showSeries: true });
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
    document.getElementById("unequipWeaponBtn")?.addEventListener("click", () => {
      addLog(`⚔️ ${getWeaponDisplayName(w, { showSeries: true })} を外した`);
      state.player.equippedWeapon = null;
      onUnequip?.();
    });
  } else {
    el.innerHTML = `<div class="equipped-pet-empty">武器未装備</div>`;
  }
}

export function updatePetPanel(onPetClick, onPetEquip) {
  const equippedEl = document.getElementById("equippedPetInfo");
  const listEl = document.getElementById("petList");
  if (!equippedEl || !listEl) return;

  const equipped = state.player.equippedPet;
  if (equipped) {
    const valueText = equipped.passiveValue != null ? `(${equipped.passiveValue}%)` : "";
    const ultClassP = isUltimatePet(equipped) ? " ultimate" : "";
    equippedEl.innerHTML = `
      <div class="equipped-pet${ultClassP}">
        <div class="equipped-pet-name">🐾 装備中：${getTitleName(equipped)}${equipped.name}${(equipped.bonusPower ?? 0) > 0 ? ` <span class="weapon-level">+${equipped.bonusPower}</span>` : ""}</div>
        <div class="equipped-pet-stats-row">
          <div class="equipped-pet-stats">
            <span>ATK ${equipped.power}(${equipped.basePower ?? equipped.power})</span>
            <span>HP ${equipped.hp ?? 0}(${equipped.baseHp ?? 0})</span>
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
  const filter = state.ui.petFilter ?? "";
  const pets = filter
    ? state.player.petList.filter((p) => p.passive === filter)
    : state.player.petList;
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

  // お気に入り優先でソート
  const sortedGroups = [...groups.entries()].sort(([, petsA], [, petsB]) => {
    const repA = petsA[0];
    const repB = petsB[0];
    const favA = isFavorite(`pet_${repA.enemyId}_${!!repA.isBoss}`) ? 0 : 1;
    const favB = isFavorite(`pet_${repB.enemyId}_${!!repB.isBoss}`) ? 0 : 1;
    if (favA !== favB) return favA - favB;
    return repA.enemyId - repB.enemyId;
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
    headerEl.innerHTML = `
      <button class="group-fav-btn ${fav ? "fav-on" : ""}" data-group-key="${groupKey}">${fav ? "♥" : "♡"}</button>
      <span class="pet-group-name">🐾 ${speciesName}</span>
      <span class="pet-group-skill">${skillLabel}</span>
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
    let rendered = false;

    const closeBtn = headerEl.querySelector(".group-close-btn");

    headerEl.addEventListener("click", () => {
      const isOpen = !bodyEl.classList.contains("hidden");
      if (isOpen) return;

      if (!rendered) {
        renderPetGroupBody(bodyEl, groupPets, onPetClick, onPetEquip);
        rendered = true;
      }
      bodyEl.classList.remove("hidden");
      headerEl.querySelector(".pet-group-toggle").textContent = "▼";
      closeBtn.classList.remove("hidden");
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
  groupPets.forEach((pet) => {
    const { baseUid, materialUids } = state.petSynthesis;
    const isEquipped = state.player.equippedPet?.uid === pet.uid;
    const isBase = pet.uid === baseUid;
    const isMaterial = materialUids.includes(pet.uid);
    const valueText = pet.passiveValue != null ? `(${pet.passiveValue}%)` : "";
    const bonusText = (pet.bonusPower ?? 0) > 0 ? ` <span class="weapon-level">+${pet.bonusPower}</span>` : "";

    const li = document.createElement("li");
    const isUltP = isUltimatePet(pet);
    li.className = "pet-item" + (isEquipped ? " equipped" : "");
    if (pet.isLegendUltimate) li.classList.add("pet-legend-ultimate");
    else if (pet.isLegendary)  li.classList.add("pet-legendary");
    else if (pet.isElite)      li.classList.add("pet-elite");
    else if (isUltP)           li.classList.add("ultimate");
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

    const locked = isLocked(pet.uid);
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
          </div>
        </div>
        <div class="item-row-2">
          <span class="pet-atk">ATK ${pet.power}(${pet.basePower ?? pet.power})</span>
          <span class="pet-atk">HP ${pet.hp ?? 0}(${pet.baseHp ?? 0})</span>
          <span class="pet-passive">${passiveLabelText(pet)}${valueText}</span>
        </div>
      </div>
    `;

    // カードタップで合成選択（ボタン部分は除外、ロック中は素材選択不可）
    li.onclick = (e) => {
      e.stopPropagation();
      if (e.target.closest("button")) return;
      const isBase = pet.uid === state.petSynthesis.baseUid;
      if (isLocked(pet.uid) && state.petSynthesis.baseUid !== null && !isBase) return;
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

    bodyEl.appendChild(li);
  });
}

function passiveLabelText(pet) {
  const labels = {
    captureBoost: "捕獲率増加",    expBoost:     "経験値増加",
    atkBoost:     "攻撃力増加",    dropBoost:    "ドロップ率増加",
    dmgBoost:     "与ダメ上昇",    dmgReduce:    "被ダメ減少",
    hpBoost:      "HP増加",        doubleAttack: "2回攻撃",
    survive:      "根性",          reflect:      "ダメージ反射",
    drain:        "与ダメ吸収",    critRate:     "クリティカル率",
    critDamage:   "クリティカル強化", extraHit:   "追撃",
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
    legendCritDamage:   "✨覇者",    legendExtraHit:   "✨乱打",
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
    critDamage:   "クリティカル強化", extraHit:   "追撃",
    giantKiller:  "巨人殺し",      bossSlayer:   "ボス特効",
    evade:        "回避",          lastStand:    "背水の陣",
    regen:        "再生",
    resurrection: "復活",
    legendCaptureBoost: "✨捕縛者",  legendExpBoost:   "✨賢者",
    legendAtkBoost:     "✨破壊神",  legendDropBoost:  "✨財宝王",
    legendDmgBoost:     "✨剛力",    legendDmgReduce:  "✨鉄壁",
    legendHpBoost:      "✨巨人",    tripleAttack:     "✨連撃王",
    legendSurvive:      "✨不死身",  legendReflect:    "✨鏡盾",
    legendDrain:        "✨吸血鬼",  legendCritRate:   "✨致命眼",
    legendCritDamage:   "✨覇者",    legendExtraHit:   "✨乱打",
    legendGiantKiller:  "✨下剋上",  legendBossSlayer: "✨覇王討伐",
    legendEvade:        "✨幻影",    legendLastStand:  "✨挑戦者",
    legendRegen:        "✨不滅",
    legendResurrection: "✨輪廻転生",
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
    const uid = parseFloat(uidAttr);
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
    const uid = parseFloat(uidAttr);
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

  // 与ダメ上昇
  let dmgBoost = 0;
  if (pet?.passive === "dmgBoost") dmgBoost += pet.passiveValue ?? 0;
  if (weapon?.passive === "dmgBoost") dmgBoost += weapon.passiveValue ?? 0;
  if (pet?.passive === "legendDmgBoost") dmgBoost += pet.passiveValue ?? 0;
  if (weapon?.passive === "legendDmgBoost") dmgBoost += weapon.passiveValue ?? 0;

  // 被ダメ減少
  let dmgReduce = 0;
  if (pet?.passive === "dmgReduce") dmgReduce += pet.passiveValue ?? 0;
  if (weapon?.passive === "dmgReduce") dmgReduce += weapon.passiveValue ?? 0;
  if (pet?.passive === "legendDmgReduce") dmgReduce += pet.passiveValue ?? 0;
  if (weapon?.passive === "legendDmgReduce") dmgReduce += weapon.passiveValue ?? 0;

  // HP増加
  let hpBoost = 0;
  if (pet?.passive === "hpBoost") hpBoost += pet.passiveValue ?? 0;
  if (weapon?.passive === "hpBoost") hpBoost += weapon.passiveValue ?? 0;
  if (pet?.passive === "legendHpBoost") hpBoost += pet.passiveValue ?? 0;
  if (weapon?.passive === "legendHpBoost") hpBoost += weapon.passiveValue ?? 0;

  // 反射確率
  let reflectRate = 0;
  if (pet?.passive === "reflect") reflectRate += pet.passiveValue ?? 0;
  if (weapon?.passive === "reflect") reflectRate += weapon.passiveValue ?? 0;
  if (pet?.passive === "legendReflect") reflectRate += pet.passiveValue ?? 0;
  if (weapon?.passive === "legendReflect") reflectRate += weapon.passiveValue ?? 0;

  // 吸収確率
  let drainRate = 0;
  if (pet?.passive === "drain") drainRate += pet.passiveValue ?? 0;
  if (weapon?.passive === "drain") drainRate += weapon.passiveValue ?? 0;
  if (pet?.passive === "legendDrain") drainRate += pet.passiveValue ?? 0;
  if (weapon?.passive === "legendDrain") drainRate += weapon.passiveValue ?? 0;

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

  // 追撃
  let extraHitRate = 0;
  if (pet?.passive === "extraHit") extraHitRate += pet.passiveValue ?? 0;
  if (weapon?.passive === "extraHit") extraHitRate += weapon.passiveValue ?? 0;
  if (pet?.passive === "legendExtraHit") extraHitRate += pet.passiveValue ?? 0;
  if (weapon?.passive === "legendExtraHit") extraHitRate += weapon.passiveValue ?? 0;

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
  const hasLegendSurvive = pet?.passive === "legendSurvive" || weapon?.passive === "legendSurvive";
  const hasLegendResurrection = pet?.passive === "legendResurrection" || weapon?.passive === "legendResurrection";
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

  const gemBonus = (player.gems ?? []).reduce((sum, g) => sum + (g.atkBonus ?? 0), 0);

  el.innerHTML = `
    <div class="status-detail-section">
      <div class="status-detail-heading">⚔️ 戦闘ステータス</div>
      ${row("HP", `${player.hp} / ${totalHp}`)}
      ${row("攻撃力", totalAtk)}
      ${gemBonus > 0 ? row("宝玉ATKボーナス", `+${gemBonus}`) : ""}
    </div>
    <div class="status-detail-section">
      <div class="status-detail-heading">✨ スキル効果</div>
      ${expBoost > 0 ? row("経験値増加率", `+${expBoost}%`) : ""}
      ${captureBoost > 0 ? row("捕獲率", `+${captureBoost}%`) : ""}
      ${atkBoost > 0 ? row("攻撃力増加率", `+${atkBoost}%`) : ""}
      ${dropBoost > 0 ? row("ドロップ率", `+${dropBoost}%`) : ""}
      ${dmgBoost > 0 ? row("与ダメ上昇率", `+${dmgBoost}%`) : ""}
      ${dmgReduce > 0 ? row("被ダメ減少率", `${dmgReduce}%`) : ""}
      ${hpBoost > 0 ? row("HP増加率", `+${hpBoost}%`) : ""}
      ${doubleRate > 0 ? row("2回攻撃 発生率", `${doubleRate}%`) : ""}
      ${hasTripleAttack ? row("✨連撃王", "3回攻撃") : ""}
      ${surviveRate > 0 ? row("根性 発生率", `${surviveRate}%`) : ""}
      ${hasLegendSurvive ? row("✨不死身", "常時発動") : ""}
      ${reflectRate > 0 ? row("ダメージ反射 発生率", `${reflectRate}%`) : ""}
      ${drainRate > 0 ? row("与ダメ吸収 発生率", `${drainRate}%`) : ""}
      ${critRate > 0 ? row("クリティカル率", `${critRate}%`) : ""}
      ${critDmg > 0 ? row("クリティカル強化率", `+${critDmg}%`) : ""}
      ${extraHitRate > 0 ? row("追撃 発生率", `${extraHitRate}%`) : ""}
      ${giantKiller > 0 ? row("巨人殺し 効果率", `+${giantKiller}%`) : ""}
      ${bossSlayer > 0 ? row("ボス特効 効果率", `+${bossSlayer}%`) : ""}
      ${evadeRate > 0 ? row("回避 発生率", `${evadeRate}%`) : ""}
      ${lastStand > 0 ? row("背水の陣 効果率", `+${lastStand}%`) : ""}
      ${regenRate > 0 ? row("再生率", `${regenRate}%/ターン`) : ""}
      ${hasLegendResurrection ? row("✨輪廻転生", "復活") : ""}
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
export function showUltimatePopup(entity, type) {
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
    statsEl.innerHTML = `ATK ${entity.power} ／ HP ${entity.hp} ／ ${passive}${pval}`;
    overlay.classList.remove("hidden");
    overlay.onclick = () => overlay.classList.add("hidden");
    return;
  } else if (type === "pet") {
    subEl.textContent = "極個体を捕獲した！";
    nameEl.textContent = `${getTitleName(entity)}${entity.name}`;
    const passive = passiveLabelText(entity);
    const pval = entity.passiveValue != null ? `(${entity.passiveValue}%)` : "";
    statsEl.innerHTML = `ATK ${entity.power} ／ HP ${entity.hp} ／ ${passive}${pval}`;
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
export function showLegendaryPopup(enemy, mode = "appear", pet = null) {
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
      statsEl.textContent = `ATK ${pet.power} ／ HP ${pet.hp} ／ ${passive}${pval}`;
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
}

export function showLegendUltimatePopup(enemy, mode = "appear", pet = null) {
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
      statsEl.textContent = `ATK ${pet.power} ／ HP ${pet.hp} ／ ${passive}${pval}`;
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
}

export function showElitePopup(enemy, mode = "appear", pet = null) {
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
      statsEl.textContent = `ATK ${pet.power} ／ HP ${pet.hp} ／ ${passive}${pval}`;
      statsEl.classList.remove("hidden");
    }
  } else {
    subEl.textContent = enemy.isBoss ? "極個体のボスが現れた！" : "極個体が現れた！";
    nameEl.textContent = enemy.name;
    if (statsEl) statsEl.classList.add("hidden");
  }

  overlay.classList.remove("hidden");
  overlay.onclick = () => overlay.classList.add("hidden");
}