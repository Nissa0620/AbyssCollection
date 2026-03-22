// =====================
// 実績システム
// =====================

import { state } from "./state.js";
import { addLog } from "./log.js";
import { normalEnemies, bossEnemies, weaponTemplates, floorTable, legendaryTitles } from "./data/index.js";

// =====================
// 実績定義
// =====================

export const achievementDefs = [
  // --- レベル達成 ---
  { id: "lv100",    category: "level", label: "駆け出し冒険者",     desc: "Lv.100 に到達する",    check: (s) => s.player.level >= 100    },
  { id: "lv200",    category: "level", label: "上位の冒険者",       desc: "Lv.200 に到達する",    check: (s) => s.player.level >= 200    },
  { id: "lv300",    category: "level", label: "最上位の冒険者",     desc: "Lv.300 に到達する",    check: (s) => s.player.level >= 300    },
  { id: "lv400",    category: "level", label: "伝説の冒険者",       desc: "Lv.400 に到達する",    check: (s) => s.player.level >= 400    },
  { id: "lv500",    category: "level", label: "真の勇者",           desc: "Lv.500 に到達する",    check: (s) => s.player.level >= 500    },
  { id: "lv600",    category: "level", label: "不滅の勇者",         desc: "Lv.600 に到達する",    check: (s) => s.player.level >= 600    },
  { id: "lv700",    category: "level", label: "深淵を目指す者",     desc: "Lv.700 に到達する",    check: (s) => s.player.level >= 700    },
  { id: "lv800",    category: "level", label: "深淵の英雄",         desc: "Lv.800 に到達する",    check: (s) => s.player.level >= 800    },
  { id: "lv900",    category: "level", label: "深淵の覇者",         desc: "Lv.900 に到達する",    check: (s) => s.player.level >= 900    },
  { id: "lv1000",   category: "level", label: "深淵の支配者",       desc: "Lv.1000 に到達する",   check: (s) => s.player.level >= 1000   },
  { id: "lv10000",  category: "level", label: "深淵を統べる者",     desc: "Lv.10000 に到達する",  check: (s) => s.player.level >= 10000  },
  { id: "lv50000",  category: "level", label: "超越者",             desc: "Lv.50000 に到達する",  check: (s) => s.player.level >= 50000  },
  { id: "lv100000", category: "level", label: "深淵を司る神",       desc: "Lv.100000 に到達する", check: (s) => s.player.level >= 100000 },

  // --- ボス突破 ---
  { id: "floor100",  category: "floor", label: "深淵の入り口",   desc: "地下100階のボスを突破する",   check: (s) => s.maxFloor > 100  },
  { id: "floor200",  category: "floor", label: "深淵の探索者",   desc: "地下200階のボスを突破する",   check: (s) => s.maxFloor > 200  },
  { id: "floor300",  category: "floor", label: "深淵の征服者",   desc: "地下300階のボスを突破する",   check: (s) => s.maxFloor > 300  },
  { id: "floor400",  category: "floor", label: "深淵の覇者",     desc: "地下400階のボスを突破する",   check: (s) => s.maxFloor > 400  },
  { id: "floor500",  category: "floor", label: "深淵の勇者",     desc: "地下500階のボスを突破する",   check: (s) => s.maxFloor > 500  },
  { id: "floor600",  category: "floor", label: "深淵の英雄",     desc: "地下600階のボスを突破する",   check: (s) => s.maxFloor > 600  },
  { id: "floor700",  category: "floor", label: "深淵の王",       desc: "地下700階のボスを突破する",   check: (s) => s.maxFloor > 700  },
  { id: "floor800",  category: "floor", label: "深淵の覇王",     desc: "地下800階のボスを突破する",   check: (s) => s.maxFloor > 800  },
  { id: "floor900",  category: "floor", label: "深淵の支配者",   desc: "地下900階のボスを突破する",   check: (s) => s.maxFloor > 900  },
  { id: "floor1000", category: "floor", label: "深淵の神",       desc: "地下1000階のボスを突破する",  check: (s) => s.maxFloor > 1000 },
  { id: "floor2000", category: "floor", label: "深淵の創造者",   desc: "地下2000階のボスを突破する",  check: (s) => s.maxFloor > 2000 },
  { id: "floor3000", category: "floor", label: "深淵の超越者",   desc: "地下3000階のボスを突破する",  check: (s) => s.maxFloor > 3000 },
  { id: "floor4000", category: "floor", label: "深淵の異端者",   desc: "地下4000階のボスを突破する",  check: (s) => s.maxFloor > 4000 },
  { id: "floor5000", category: "floor", label: "深淵の絶対者",   desc: "地下5000階のボスを突破する",  check: (s) => s.maxFloor > 5000 },
  { id: "floor6000", category: "floor", label: "深淵の破壊神",   desc: "地下6000階のボスを突破する",  check: (s) => s.maxFloor > 6000 },
  { id: "floor7000", category: "floor", label: "深淵の始原者",   desc: "地下7000階のボスを突破する",  check: (s) => s.maxFloor > 7000 },
  { id: "floor8000", category: "floor", label: "深淵の終焉者",   desc: "地下8000階のボスを突破する",  check: (s) => s.maxFloor > 8000 },
  { id: "floor9000", category: "floor", label: "深淵の虚無",     desc: "地下9000階のボスを突破する",  check: (s) => s.maxFloor > 9000 },
  { id: "floor10000",category: "floor", label: "深淵の果て",     desc: "地下10000階のボスを突破する", check: (s) => s.maxFloor > 10000 },

  // --- 敵の捕獲（フロア帯別 全捕獲） ---
  ...buildCaptureAchievements(),

  // --- 武器コレクション（フロア帯別 全入手） ---
  ...buildWeaponCollectAchievements(),

  // --- 武器合成回数 ---
  { id: "wsynth10",     category: "synthesis", label: "鍛冶見習い",       desc: "武器を合成する（10回）",      check: (s) => (s.achievements?.weaponSynthCount ?? 0) >= 10     },
  { id: "wsynth100",    category: "synthesis", label: "鍛冶職人",         desc: "武器を合成する（100回）",     check: (s) => (s.achievements?.weaponSynthCount ?? 0) >= 100    },
  { id: "wsynth1000",   category: "synthesis", label: "伝説の鍛冶師",     desc: "武器を合成する（1000回）",    check: (s) => (s.achievements?.weaponSynthCount ?? 0) >= 1000   },
  { id: "wsynth10000",  category: "synthesis", label: "神話の鍛冶師",     desc: "武器を合成する（10000回）",   check: (s) => (s.achievements?.weaponSynthCount ?? 0) >= 10000  },
  { id: "wsynth50000",  category: "synthesis", label: "鍛冶の超越者",     desc: "武器を合成する（50000回）",   check: (s) => (s.achievements?.weaponSynthCount ?? 0) >= 50000  },
  { id: "wsynth100000", category: "synthesis", label: "鍛冶の神",         desc: "武器を合成する（100000回）",  check: (s) => (s.achievements?.weaponSynthCount ?? 0) >= 100000 },

  // --- ペット合成回数 ---
  { id: "psynth10",     category: "synthesis", label: "訓練士見習い",     desc: "ペットを合成する（10回）",    check: (s) => (s.achievements?.petSynthCount ?? 0) >= 10     },
  { id: "psynth100",    category: "synthesis", label: "ペット訓練士",     desc: "ペットを合成する（100回）",   check: (s) => (s.achievements?.petSynthCount ?? 0) >= 100    },
  { id: "psynth1000",   category: "synthesis", label: "伝説の訓練士",     desc: "ペットを合成する（1000回）",  check: (s) => (s.achievements?.petSynthCount ?? 0) >= 1000   },
  { id: "psynth10000",  category: "synthesis", label: "神話の訓練士",     desc: "ペットを合成する（10000回）", check: (s) => (s.achievements?.petSynthCount ?? 0) >= 10000  },
  { id: "psynth50000",  category: "synthesis", label: "調教の超越者",     desc: "ペットを合成する（50000回）", check: (s) => (s.achievements?.petSynthCount ?? 0) >= 50000  },
  { id: "psynth100000", category: "synthesis", label: "調教の神",         desc: "ペットを合成する（100000回）",check: (s) => (s.achievements?.petSynthCount ?? 0) >= 100000 },

  // --- 極個体ペット数 ---
  { id: "elitepet1",     category: "ultimate", label: "奇跡の出会い",     desc: "極個体を1体捕まえる",     check: (s) => (s.achievements?.elitePetCount ?? 0) >= 1     },
  { id: "elitepet10",    category: "ultimate", label: "奇跡の収集家",     desc: "極個体を10体捕まえる",    check: (s) => (s.achievements?.elitePetCount ?? 0) >= 10    },
  { id: "elitepet100",   category: "ultimate", label: "奇跡の伝道師",     desc: "極個体を100体捕まえる",   check: (s) => (s.achievements?.elitePetCount ?? 0) >= 100   },
  { id: "elitepet1000",  category: "ultimate", label: "奇跡の支配者",     desc: "極個体を1000体捕まえる",  check: (s) => (s.achievements?.elitePetCount ?? 0) >= 1000  },
  { id: "elitepet10000", category: "ultimate", label: "奇跡の創造者",     desc: "極個体を10000体捕まえる", check: (s) => (s.achievements?.elitePetCount ?? 0) >= 10000 },

  // --- 伝説個体ペット数 ---
  { id: "legpet1",     category: "ultimate", label: "伝説の予感",         desc: "伝説個体を1体捕まえる",     check: (s) => (s.achievements?.legendaryPetCount ?? 0) >= 1     },
  { id: "legpet10",    category: "ultimate", label: "伝説の追跡者",       desc: "伝説個体を10体捕まえる",    check: (s) => (s.achievements?.legendaryPetCount ?? 0) >= 10    },
  { id: "legpet100",   category: "ultimate", label: "伝説の収集家",       desc: "伝説個体を100体捕まえる",   check: (s) => (s.achievements?.legendaryPetCount ?? 0) >= 100   },
  { id: "legpet1000",  category: "ultimate", label: "伝説の支配者",       desc: "伝説個体を1000体捕まえる",  check: (s) => (s.achievements?.legendaryPetCount ?? 0) >= 1000  },
  { id: "legpet10000", category: "ultimate", label: "伝説の創造者",       desc: "伝説個体を10000体捕まえる", check: (s) => (s.achievements?.legendaryPetCount ?? 0) >= 10000 },

  // --- 究極個体ペット数 ---
  { id: "legultpet1",     category: "ultimate", label: "伝説との邂逅",   desc: "究極個体を1体捕まえる",     check: (s) => (s.achievements?.legendUltimatePetCount ?? 0) >= 1     },
  { id: "legultpet10",    category: "ultimate", label: "伝説の収縛者",   desc: "究極個体を10体捕まえる",    check: (s) => (s.achievements?.legendUltimatePetCount ?? 0) >= 10    },
  { id: "legultpet100",   category: "ultimate", label: "究極の伝道師",   desc: "究極個体を100体捕まえる",   check: (s) => (s.achievements?.legendUltimatePetCount ?? 0) >= 100   },
  { id: "legultpet1000",  category: "ultimate", label: "究極の支配者",   desc: "究極個体を1000体捕まえる",  check: (s) => (s.achievements?.legendUltimatePetCount ?? 0) >= 1000  },
  { id: "legultpet10000", category: "ultimate", label: "究極の創造者",   desc: "究極個体を10000体捕まえる", check: (s) => (s.achievements?.legendUltimatePetCount ?? 0) >= 10000 },

  // --- 極武器数 ---
  { id: "ultwep1",     category: "ultimate", label: "至高の刃",           desc: "極武器を1本入手する",         check: (s) => (s.achievements?.ultimateWeaponCount ?? 0) >= 1     },
  { id: "ultwep10",    category: "ultimate", label: "至高の武器商",       desc: "極武器を10本入手する",        check: (s) => (s.achievements?.ultimateWeaponCount ?? 0) >= 10    },
  { id: "ultwep100",   category: "ultimate", label: "至高の武器庫",       desc: "極武器を100本入手する",       check: (s) => (s.achievements?.ultimateWeaponCount ?? 0) >= 100   },
  { id: "ultwep1000",  category: "ultimate", label: "至高の武器神殿",     desc: "極武器を1000本入手する",      check: (s) => (s.achievements?.ultimateWeaponCount ?? 0) >= 1000  },
  { id: "ultwep10000", category: "ultimate", label: "至高の兵器庫",       desc: "極武器を10000本入手する",     check: (s) => (s.achievements?.ultimateWeaponCount ?? 0) >= 10000 },
];

// フロアテーブルをもとに「フロア帯別：全敵捕獲」実績を生成
// フロアテーブルをもとに「フロア帯別：全称号捕獲」実績を生成
function buildCaptureAchievements() {
  const normal = Object.entries(floorTable)
    .filter(([, area]) => area.min != null)
    .map(([bandKey, area]) => {
      const label = `${area.min}〜${area.max}階の捕獲王`;
      const desc = `${area.min}〜${area.max}階の全敵を称号1〜4すべて捕獲する`;
      return {
        id: `capture_all_titles_${area.min}_${area.max}`,
        category: "capture",
        label,
        desc,
        check: (s) => {
          const targetEnemies = normalEnemies.filter((e) => e.floorBand === bandKey);
          // 全敵 × 称号1〜4 がすべてpetListにある
          return targetEnemies.every((e) =>
            [1, 2, 3, 4].every((titleId) =>
              s.player.petList.some(
                (p) => p.enemyId === e.id && !p.isBoss && p.titleId === titleId
              )
            )
          );
        },
      };
    });

  // レジェンダリー捕獲実績（固定数4段階）
  const legendaryStages = [
    { count: 5,  label: "伝説の収集家・見習い",  desc: "レジェンダリースキル持ちを5種捕獲する" },
    { count: 10, label: "伝説の収集家・熟練",    desc: "レジェンダリースキル持ちを10種捕獲する" },
    { count: 15, label: "伝説の収集家・達人",    desc: "レジェンダリースキル持ちを15種捕獲する" },
    { count: 20, label: "伝説の収集家・伝説",    desc: "レジェンダリースキル持ちを20種捕獲する" },
  ];

  const legendary = legendaryStages.map(({ count, label, desc }) => ({
    id: `capture_legendary_${count}`,
    category: "capture",
    label,
    desc,
    check: (s) => {
      const legendaryPassives = new Set(
        Object.values(legendaryTitles).map((t) => t.legendaryPassive)
      );
      const captured = new Set(
        s.player.petList
          .filter((p) => legendaryPassives.has(p.passive))
          .map((p) => p.passive)
      );
      return captured.size >= count;
    },
  }));

  return [...normal, ...legendary];
}

// フロアテーブルをもとに「フロア帯別：全武器入手」実績を生成
function buildWeaponCollectAchievements() {
  return Object.values(floorTable).filter((area) => area.min != null).map((area) => {
    const [minId, maxId] = area.weaponIdRange;
    const label = `${area.min}〜${area.max}階の収集家`;
    const desc = `${area.min}〜${area.max}階で入手できる通常武器をすべて入手する`;
    return {
      id: `weapon_${area.min}_${area.max}`,
      category: "weapon",
      label,
      desc,
      check: (s) => {
        const targetWeapons = weaponTemplates.filter(
          (w) => !w.isBossDrop && w.id >= minId && w.id <= maxId
        );
        return targetWeapons.every((t) =>
          s.player.inventory.some((w) => w.templateId === t.id && !w.isBossDrop) ||
          // 図鑑に登録済みでも可
          s.book.weapons[`normal_${t.id}`] != null
        );
      },
    };
  });
}

// =====================
// 実績チェック＆通知
// =====================

export function checkAchievements() {
  if (!state.achievements) state.achievements = { unlocked: {} };

  const newly = [];

  for (const def of achievementDefs) {
    if (state.achievements.unlocked[def.id]) continue; // 既達成
    if (def.check(state)) {
      state.achievements.unlocked[def.id] = Date.now();
      newly.push(def);
    }
  }

  for (const def of newly) {
    addLog(`🏆 実績解除：${def.label}`);
    showAchievementPopup(def);
  }
}

// =====================
// 実績ポップアップ（順番に表示）
// =====================

let popupQueue = [];
let isShowingPopup = false;

function showAchievementPopup(def) {
  popupQueue.push(def);
  if (!isShowingPopup) processPopupQueue();
}

function processPopupQueue() {
  if (popupQueue.length === 0) { isShowingPopup = false; return; }
  isShowingPopup = true;

  const def = popupQueue.shift();
  const overlay = document.getElementById("achievementPopup");
  if (!overlay) { processPopupQueue(); return; }

  document.getElementById("achievementPopupLabel").textContent = def.label;
  document.getElementById("achievementPopupDesc").textContent = def.desc;
  overlay.classList.remove("hidden", "achievement-hide");
  overlay.classList.add("achievement-show");

  let dismissed = false;

  function dismiss() {
    if (dismissed) return;
    dismissed = true;
    clearTimeout(autoTimer);
    document.removeEventListener("pointerdown", dismiss);
    overlay.classList.remove("achievement-show");
    overlay.classList.add("achievement-hide");
    setTimeout(() => {
      overlay.classList.add("hidden");
      processPopupQueue();
    }, 400);
  }

  // 自動で閉じる（2500ms後）
  const autoTimer = setTimeout(dismiss, 2500);

  // タッチ/クリックでも閉じる
  document.addEventListener("pointerdown", dismiss, { once: true });
}

// =====================
// 実績画面レンダリング
// =====================

const categoryLabel = {
  level:     "🧑‍🦯 レベル達成",
  floor:     "🏔️ ボス突破",
  capture:   "🐾 捕獲コレクション",
  weapon:    "⚔️ 武器コレクション",
  synthesis: "🔨 合成記録",
  ultimate:  "✨ 極個体 / 究極個体",
};

// 実績画面の現在選択中のカテゴリ・フィルターを保持（モジュールスコープ）
let _achActiveCategory = null; // null = 最初のカテゴリ
let _achActiveFilter = "all";  // "all" | "done" | "undone"

export function renderAchievements() {
  const el = document.getElementById("achievementContent");
  if (!el) return;

  if (!state.achievements) state.achievements = { unlocked: {} };
  const unlocked = state.achievements.unlocked ?? {};

  // カテゴリごとにグループ化
  const groups = {};
  for (const def of achievementDefs) {
    if (!groups[def.category]) groups[def.category] = [];
    groups[def.category].push(def);
  }

  const categories = Object.keys(groups);
  if (_achActiveCategory === null || !categories.includes(_achActiveCategory)) {
    _achActiveCategory = categories[0];
  }

  const total = achievementDefs.length;
  const unlockedCount = Object.keys(unlocked).length;

  // ── 全体進捗サマリー ──
  let html = `<div class="achievement-summary">達成 ${unlockedCount} / ${total}</div>`;

  // ── カテゴリタブ ──
  html += `<div class="achievement-tabs">`;
  for (const cat of categories) {
    const defs = groups[cat];
    const doneCnt = defs.filter(d => !!unlocked[d.id]).length;
    const active = cat === _achActiveCategory ? " active" : "";
    html += `<button class="achievement-tab-btn${active}" data-cat="${cat}">
      ${categoryLabel[cat] ?? cat}
      <span class="achievement-tab-count">${doneCnt}/${defs.length}</span>
    </button>`;
  }
  html += `</div>`;

  // ── カテゴリ進捗バー ──
  const activeDefs = groups[_achActiveCategory] ?? [];
  const activeDone = activeDefs.filter(d => !!unlocked[d.id]).length;
  const progressPct = activeDefs.length > 0
    ? Math.round(activeDone / activeDefs.length * 100) : 0;

  html += `
    <div class="achievement-progress-bar-wrap">
      <div class="achievement-progress-bar" style="width:${progressPct}%"></div>
    </div>
    <div class="achievement-progress-label">${activeDone} / ${activeDefs.length} 達成（${progressPct}%）</div>
  `;

  // ── フィルタータブ ──
  html += `<div class="achievement-filters">
    <button class="achievement-filter-btn${_achActiveFilter === "all"    ? " active" : ""}" data-filter="all">すべて</button>
    <button class="achievement-filter-btn${_achActiveFilter === "done"   ? " active" : ""}" data-filter="done">達成済み</button>
    <button class="achievement-filter-btn${_achActiveFilter === "undone" ? " active" : ""}" data-filter="undone">未達成</button>
  </div>`;

  // ── 実績リスト ──
  const filtered = activeDefs.filter(def => {
    const done = !!unlocked[def.id];
    if (_achActiveFilter === "done")   return done;
    if (_achActiveFilter === "undone") return !done;
    return true;
  });

  if (filtered.length === 0) {
    html += `<div class="achievement-empty">該当する実績はありません</div>`;
  } else {
    html += `<ul class="achievement-list">`;
    for (const def of filtered) {
      const done = !!unlocked[def.id];
      html += `
        <li class="achievement-item ${done ? "achievement-done" : "achievement-locked"}">
          <span class="achievement-icon">${done ? "🏆" : "🔒"}</span>
          <div class="achievement-text">
            <div class="achievement-label">${done ? def.label : "???（未解除）"}</div>
            <div class="achievement-desc">${done ? def.desc : "条件を満たすと解除されます"}</div>
          </div>
        </li>`;
    }
    html += `</ul>`;
  }

  el.innerHTML = html;

  // ── イベント：カテゴリタブ ──
  el.querySelectorAll(".achievement-tab-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      _achActiveCategory = btn.dataset.cat;
      renderAchievements();
    });
  });

  // ── イベント：フィルター ──
  el.querySelectorAll(".achievement-filter-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      _achActiveFilter = btn.dataset.filter;
      renderAchievements();
    });
  });
}