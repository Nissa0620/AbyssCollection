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
  { id: "lv10",   category: "level",   label: "駆け出しの冒険者",   desc: "Lv.10 に到達する",    check: (s) => s.player.level >= 10  },
  { id: "lv30",   category: "level",   label: "一人前の冒険者",     desc: "Lv.30 に到達する",    check: (s) => s.player.level >= 30  },
  { id: "lv50",   category: "level",   label: "熟練の冒険者",       desc: "Lv.50 に到達する",    check: (s) => s.player.level >= 50  },
  { id: "lv100",  category: "level",   label: "伝説の冒険者",       desc: "Lv.100 に到達する",   check: (s) => s.player.level >= 100 },
  { id: "lv200",  category: "level",   label: "神域の冒険者",       desc: "Lv.200 に到達する",   check: (s) => s.player.level >= 200 },

  // --- フロア到達 ---
  { id: "floor50",  category: "floor", label: "深淵の入り口",   desc: "地下50階に到達する",   check: (s) => s.maxFloor >= 50  },
  { id: "floor100", category: "floor", label: "深淵の探索者",   desc: "地下100階に到達する",  check: (s) => s.maxFloor >= 100 },
  { id: "floor200", category: "floor", label: "深淵の征服者",   desc: "地下200階に到達する",  check: (s) => s.maxFloor >= 200 },
  { id: "floor300", category: "floor", label: "深淵の支配者",   desc: "地下300階に到達する",  check: (s) => s.maxFloor >= 300 },

  // --- 敵の捕獲（フロア帯別 全捕獲） ---
  ...buildCaptureAchievements(),

  // --- 武器コレクション（フロア帯別 全入手） ---
  ...buildWeaponCollectAchievements(),

  // --- 武器合成回数 ---
  { id: "wsynth10",  category: "synthesis", label: "鍛冶見習い",     desc: "武器を合成する（10回）",  check: (s) => (s.achievements?.weaponSynthCount ?? 0) >= 10  },
  { id: "wsynth50",  category: "synthesis", label: "鍛冶職人",       desc: "武器を合成する（50回）",  check: (s) => (s.achievements?.weaponSynthCount ?? 0) >= 50  },
  { id: "wsynth100", category: "synthesis", label: "伝説の鍛冶師",   desc: "武器を合成する（100回）", check: (s) => (s.achievements?.weaponSynthCount ?? 0) >= 100 },

  // --- ペット合成回数 ---
  { id: "psynth10",  category: "synthesis", label: "訓練士見習い",   desc: "ペットを合成する（10回）",  check: (s) => (s.achievements?.petSynthCount ?? 0) >= 10  },
  { id: "psynth50",  category: "synthesis", label: "ペット訓練士",   desc: "ペットを合成する（50回）",  check: (s) => (s.achievements?.petSynthCount ?? 0) >= 50  },
  { id: "psynth100", category: "synthesis", label: "伝説の訓練士",   desc: "ペットを合成する（100回）", check: (s) => (s.achievements?.petSynthCount ?? 0) >= 100 },

  // --- 極ペット数 ---
  { id: "ultpet1",  category: "ultimate", label: "奇跡の出会い",   desc: "極ペットを1体捕獲する",   check: (s) => (s.achievements?.ultimatePetCount ?? 0) >= 1  },
  { id: "ultpet5",  category: "ultimate", label: "奇跡の収集家",   desc: "極ペットを5体捕獲する",   check: (s) => (s.achievements?.ultimatePetCount ?? 0) >= 5  },
  { id: "ultpet10", category: "ultimate", label: "奇跡の支配者",   desc: "極ペットを10体捕獲する",  check: (s) => (s.achievements?.ultimatePetCount ?? 0) >= 10 },

  // --- 究極個体ペット数 ---
  { id: "legultpet1",  category: "ultimate", label: "伝説との邂逅",     desc: "レジェンダリースキル持ちペットを1体捕まえる",   check: (s) => (s.achievements?.legendUltimatePetCount ?? 0) >= 1  },
  { id: "legultpet5",  category: "ultimate", label: "伝説の収縛者",     desc: "レジェンダリースキル持ちペットを5体捕まえる",   check: (s) => (s.achievements?.legendUltimatePetCount ?? 0) >= 5  },
  { id: "legultpet10", category: "ultimate", label: "究極の支配者",     desc: "レジェンダリースキル持ちペットを10体捕まえる",  check: (s) => (s.achievements?.legendUltimatePetCount ?? 0) >= 10 },

  // --- 極武器数 ---
  { id: "ultwep1",  category: "ultimate", label: "至高の刃",       desc: "極武器を1本入手する",     check: (s) => (s.achievements?.ultimateWeaponCount ?? 0) >= 1  },
  { id: "ultwep5",  category: "ultimate", label: "至高の武器商",   desc: "極武器を5本入手する",     check: (s) => (s.achievements?.ultimateWeaponCount ?? 0) >= 5  },
  { id: "ultwep10", category: "ultimate", label: "至高の武器庫",   desc: "極武器を10本入手する",    check: (s) => (s.achievements?.ultimateWeaponCount ?? 0) >= 10 },
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
  floor:     "🏔️ フロア到達",
  capture:   "🐾 捕獲コレクション",
  weapon:    "⚔️ 武器コレクション",
  synthesis: "🔨 合成記録",
  ultimate:  "✨ 極個体 / 究極個体",
};

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

  const total = achievementDefs.length;
  const unlockedCount = Object.keys(unlocked).length;

  let html = `<div class="achievement-summary">達成 ${unlockedCount} / ${total}</div>`;

  for (const [cat, defs] of Object.entries(groups)) {
    html += `<div class="achievement-category-label">${categoryLabel[cat] ?? cat}</div>`;
    html += `<ul class="achievement-list">`;
    for (const def of defs) {
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
}