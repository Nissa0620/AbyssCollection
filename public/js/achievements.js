// =====================
// 実績システム
// =====================

import { state } from "./state.js";
import { addLog } from "./log.js";
import { normalEnemies, bossEnemies, weaponTemplates, floorTable } from "./data/index.js";

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

  // --- ボス突破 ---
  { id: "floor100",  category: "floor", label: "深淵の入り口",   desc: "地下100階のボスを突破する",   check: (s) => s.maxFloor > 100  },
  { id: "floor200",  category: "floor", label: "深淵の浅瀬",   desc: "地下200階のボスを突破する",   check: (s) => s.maxFloor > 200  },
  { id: "floor300",  category: "floor", label: "深淵の薄暗がり",   desc: "地下300階のボスを突破する",   check: (s) => s.maxFloor > 300  },
  { id: "floor400",  category: "floor", label: "深淵の中層へ",     desc: "地下400階のボスを突破する",   check: (s) => s.maxFloor > 400  },
  { id: "floor500",  category: "floor", label: "深淵の霧の中",     desc: "地下500階のボスを突破する",   check: (s) => s.maxFloor > 500  },
  { id: "floor600",  category: "floor", label: "深淵の暗闇",     desc: "地下600階のボスを突破する",   check: (s) => s.maxFloor > 600  },
  { id: "floor700",  category: "floor", label: "深淵の深部へ",       desc: "地下700階のボスを突破する",   check: (s) => s.maxFloor > 700  },
  { id: "floor800",  category: "floor", label: "深淵の底なし沼",     desc: "地下800階のボスを突破する",   check: (s) => s.maxFloor > 800  },
  { id: "floor900",  category: "floor", label: "深淵の奥地",   desc: "地下900階のボスを突破する",   check: (s) => s.maxFloor > 900  },
  { id: "floor1000", category: "floor", label: "深淵の千層",       desc: "地下1000階のボスを突破する",  check: (s) => s.maxFloor > 1000 },
  { id: "floor2000", category: "floor", label: "深淵の核心へ",   desc: "地下2000階のボスを突破する",  check: (s) => s.maxFloor > 2000 },
  { id: "floor3000", category: "floor", label: "深淵の鼓動",   desc: "地下3000階のボスを突破する",  check: (s) => s.maxFloor > 3000 },
  { id: "floor4000", category: "floor", label: "深淵の吐息",   desc: "地下4000階のボスを突破する",  check: (s) => s.maxFloor > 4000 },
  { id: "floor5000", category: "floor", label: "深淵の輪郭",   desc: "地下5000階のボスを突破する",  check: (s) => s.maxFloor > 5000 },
  { id: "floor6000", category: "floor", label: "深淵の瞳",   desc: "地下6000階のボスを突破する",  check: (s) => s.maxFloor > 6000 },
  { id: "floor7000", category: "floor", label: "深淵との邂逅",   desc: "地下7000階のボスを突破する",  check: (s) => s.maxFloor > 7000 },
  { id: "floor8000", category: "floor", label: "深淵への接触",   desc: "地下8000階のボスを突破する",  check: (s) => s.maxFloor > 8000 },
  { id: "floor9000", category: "floor", label: "深淵との融合",     desc: "地下9000階のボスを突破する",  check: (s) => s.maxFloor > 9000 },
  { id: "floor10000",category: "floor", label: "私こそが深淵",     desc: "地下10000階のボスを突破する", check: (s) => s.maxFloor > 10000 },

  // --- 敵の捕獲（フロア帯別 全捕獲） ---
  ...buildCaptureAchievements(),

  // --- 武器コレクション（フロア帯別 全入手） ---
  ...buildWeaponCollectAchievements(),

  // --- 武器進化コンプリート（フロア帯別 全進化） ---
  ...buildWeaponEvolveAchievements(),

  // --- 武器進化回数 ---
  { id: "wevo10",   category: "weapon", label: "鍛冶の開眼",       desc: "武器を進化させる（10回）",    check: (s) => (s.achievements?.weaponEvolveCount ?? 0) >= 10,   progress: (s) => ({ current: s.achievements?.weaponEvolveCount ?? 0, unit: "回" }) },
  { id: "wevo100",  category: "weapon", label: "進化の職人",       desc: "武器を進化させる（100回）",   check: (s) => (s.achievements?.weaponEvolveCount ?? 0) >= 100,  progress: (s) => ({ current: s.achievements?.weaponEvolveCount ?? 0, unit: "回" }) },
  { id: "wevo500",  category: "weapon", label: "進化の達人",       desc: "武器を進化させる（500回）",   check: (s) => (s.achievements?.weaponEvolveCount ?? 0) >= 500,  progress: (s) => ({ current: s.achievements?.weaponEvolveCount ?? 0, unit: "回" }) },
  { id: "wevo1000", category: "weapon", label: "進化を極めし者",   desc: "武器を進化させる（1000回）",  check: (s) => (s.achievements?.weaponEvolveCount ?? 0) >= 1000, progress: (s) => ({ current: s.achievements?.weaponEvolveCount ?? 0, unit: "回" }) },

  // --- 武器合成回数 ---
  { id: "wsynth10",     category: "synthesis", label: "鍛冶見習い",       desc: "武器を合成する（10回）",      check: (s) => (s.achievements?.weaponSynthCount ?? 0) >= 10,     progress: (s) => ({ current: s.achievements?.weaponSynthCount ?? 0, unit: "回" }) },
  { id: "wsynth100",    category: "synthesis", label: "鍛冶職人",         desc: "武器を合成する（100回）",     check: (s) => (s.achievements?.weaponSynthCount ?? 0) >= 100,    progress: (s) => ({ current: s.achievements?.weaponSynthCount ?? 0, unit: "回" }) },
  { id: "wsynth1000",   category: "synthesis", label: "伝説の鍛冶師",     desc: "武器を合成する（1000回）",    check: (s) => (s.achievements?.weaponSynthCount ?? 0) >= 1000,   progress: (s) => ({ current: s.achievements?.weaponSynthCount ?? 0, unit: "回" }) },
  { id: "wsynth10000",  category: "synthesis", label: "神話の鍛冶師",     desc: "武器を合成する（10000回）",   check: (s) => (s.achievements?.weaponSynthCount ?? 0) >= 10000,  progress: (s) => ({ current: s.achievements?.weaponSynthCount ?? 0, unit: "回" }) },
  { id: "wsynth50000",  category: "synthesis", label: "鍛冶の超越者",     desc: "武器を合成する（50000回）",   check: (s) => (s.achievements?.weaponSynthCount ?? 0) >= 50000,  progress: (s) => ({ current: s.achievements?.weaponSynthCount ?? 0, unit: "回" }) },
  { id: "wsynth100000", category: "synthesis", label: "鍛冶の神",         desc: "武器を合成する（100000回）",  check: (s) => (s.achievements?.weaponSynthCount ?? 0) >= 100000, progress: (s) => ({ current: s.achievements?.weaponSynthCount ?? 0, unit: "回" }) },

  // --- ペット合成回数 ---
  { id: "psynth10",     category: "synthesis", label: "訓練士見習い",     desc: "ペットを合成する（10回）",    check: (s) => (s.achievements?.petSynthCount ?? 0) >= 10,     progress: (s) => ({ current: s.achievements?.petSynthCount ?? 0, unit: "回" }) },
  { id: "psynth100",    category: "synthesis", label: "ペット訓練士",     desc: "ペットを合成する（100回）",   check: (s) => (s.achievements?.petSynthCount ?? 0) >= 100,    progress: (s) => ({ current: s.achievements?.petSynthCount ?? 0, unit: "回" }) },
  { id: "psynth1000",   category: "synthesis", label: "伝説の訓練士",     desc: "ペットを合成する（1000回）",  check: (s) => (s.achievements?.petSynthCount ?? 0) >= 1000,   progress: (s) => ({ current: s.achievements?.petSynthCount ?? 0, unit: "回" }) },
  { id: "psynth10000",  category: "synthesis", label: "神話の訓練士",     desc: "ペットを合成する（10000回）", check: (s) => (s.achievements?.petSynthCount ?? 0) >= 10000,  progress: (s) => ({ current: s.achievements?.petSynthCount ?? 0, unit: "回" }) },
  { id: "psynth50000",  category: "synthesis", label: "調教の超越者",     desc: "ペットを合成する（50000回）", check: (s) => (s.achievements?.petSynthCount ?? 0) >= 50000,  progress: (s) => ({ current: s.achievements?.petSynthCount ?? 0, unit: "回" }) },
  { id: "psynth100000", category: "synthesis", label: "調教の神",         desc: "ペットを合成する（100000回）",check: (s) => (s.achievements?.petSynthCount ?? 0) >= 100000, progress: (s) => ({ current: s.achievements?.petSynthCount ?? 0, unit: "回" }) },

  // --- 極個体ペット数 ---
  { id: "elitepet1",    category: "ultimate", label: "奇跡の出会い",   desc: "極個体を1体捕まえる",    check: (s) => (s.achievements?.elitePetCount ?? 0) >= 1,    progress: (s) => ({ current: s.achievements?.elitePetCount ?? 0, unit: "体" }) },
  { id: "elitepet10",   category: "ultimate", label: "奇跡の収集家",   desc: "極個体を10体捕まえる",   check: (s) => (s.achievements?.elitePetCount ?? 0) >= 10,   progress: (s) => ({ current: s.achievements?.elitePetCount ?? 0, unit: "体" }) },
  { id: "elitepet100",  category: "ultimate", label: "奇跡の伝道師",   desc: "極個体を100体捕まえる",  check: (s) => (s.achievements?.elitePetCount ?? 0) >= 100,  progress: (s) => ({ current: s.achievements?.elitePetCount ?? 0, unit: "体" }) },
  { id: "elitepet1000", category: "ultimate", label: "奇跡の支配者",   desc: "極個体を1000体捕まえる", check: (s) => (s.achievements?.elitePetCount ?? 0) >= 1000, progress: (s) => ({ current: s.achievements?.elitePetCount ?? 0, unit: "体" }) },
  { id: "elitepet2000", category: "ultimate", label: "奇跡の体現者",   desc: "極個体を2000体捕まえる", check: (s) => (s.achievements?.elitePetCount ?? 0) >= 2000, progress: (s) => ({ current: s.achievements?.elitePetCount ?? 0, unit: "体" }) },
  { id: "elitepet3000", category: "ultimate", label: "奇跡の超越者",   desc: "極個体を3000体捕まえる", check: (s) => (s.achievements?.elitePetCount ?? 0) >= 3000, progress: (s) => ({ current: s.achievements?.elitePetCount ?? 0, unit: "体" }) },

  // --- 伝説個体ペット数 ---
  { id: "legpet1",    category: "ultimate", label: "伝説の予感",   desc: "伝説個体を1体捕まえる",    check: (s) => (s.achievements?.legendaryPetCount ?? 0) >= 1,   progress: (s) => ({ current: s.achievements?.legendaryPetCount ?? 0, unit: "体" }) },
  { id: "legpet10",   category: "ultimate", label: "伝説の追跡者", desc: "伝説個体を10体捕まえる",   check: (s) => (s.achievements?.legendaryPetCount ?? 0) >= 10,  progress: (s) => ({ current: s.achievements?.legendaryPetCount ?? 0, unit: "体" }) },
  { id: "legpet100",  category: "ultimate", label: "伝説の収集家", desc: "伝説個体を100体捕まえる",  check: (s) => (s.achievements?.legendaryPetCount ?? 0) >= 100, progress: (s) => ({ current: s.achievements?.legendaryPetCount ?? 0, unit: "体" }) },
  { id: "legpet500",  category: "ultimate", label: "伝説の覇者",   desc: "伝説個体を500体捕まえる",  check: (s) => (s.achievements?.legendaryPetCount ?? 0) >= 500, progress: (s) => ({ current: s.achievements?.legendaryPetCount ?? 0, unit: "体" }) },
  { id: "legpet1000", category: "ultimate", label: "伝説の支配者", desc: "伝説個体を1000体捕まえる", check: (s) => (s.achievements?.legendaryPetCount ?? 0) >= 1000, progress: (s) => ({ current: s.achievements?.legendaryPetCount ?? 0, unit: "体" }) },

  // --- 究極個体ペット数 ---
  { id: "legultpet1",    category: "ultimate", label: "伝説との邂逅", desc: "究極個体を1体捕まえる",    check: (s) => (s.achievements?.legendUltimatePetCount ?? 0) >= 1,    progress: (s) => ({ current: s.achievements?.legendUltimatePetCount ?? 0, unit: "体" }) },
  { id: "legultpet10",   category: "ultimate", label: "伝説の収縛者", desc: "究極個体を10体捕まえる",   check: (s) => (s.achievements?.legendUltimatePetCount ?? 0) >= 10,   progress: (s) => ({ current: s.achievements?.legendUltimatePetCount ?? 0, unit: "体" }) },
  { id: "legultpet100",  category: "ultimate", label: "究極の伝道師", desc: "究極個体を100体捕まえる",  check: (s) => (s.achievements?.legendUltimatePetCount ?? 0) >= 100,  progress: (s) => ({ current: s.achievements?.legendUltimatePetCount ?? 0, unit: "体" }) },
  { id: "legultpet500",  category: "ultimate", label: "究極の覇者",   desc: "究極個体を500体捕まえる",  check: (s) => (s.achievements?.legendUltimatePetCount ?? 0) >= 500,  progress: (s) => ({ current: s.achievements?.legendUltimatePetCount ?? 0, unit: "体" }) },
  { id: "legultpet1000", category: "ultimate", label: "究極の支配者", desc: "究極個体を1000体捕まえる", check: (s) => (s.achievements?.legendUltimatePetCount ?? 0) >= 1000, progress: (s) => ({ current: s.achievements?.legendUltimatePetCount ?? 0, unit: "体" }) },

  // --- 極武器数 ---
  { id: "ultwep1",   category: "ultimate", label: "至高の刃",     desc: "極武器を1本入手する",   check: (s) => (s.achievements?.ultimateWeaponCount ?? 0) >= 1,   progress: (s) => ({ current: s.achievements?.ultimateWeaponCount ?? 0, unit: "本" }) },
  { id: "ultwep10",  category: "ultimate", label: "至高の武器商", desc: "極武器を10本入手する",  check: (s) => (s.achievements?.ultimateWeaponCount ?? 0) >= 10,  progress: (s) => ({ current: s.achievements?.ultimateWeaponCount ?? 0, unit: "本" }) },
  { id: "ultwep100", category: "ultimate", label: "至高の武器庫", desc: "極武器を100本入手する", check: (s) => (s.achievements?.ultimateWeaponCount ?? 0) >= 100, progress: (s) => ({ current: s.achievements?.ultimateWeaponCount ?? 0, unit: "本" }) },

  // --- ボス捕獲数 ---
  { id: "bosscatch1",   category: "capture", label: "初めてのボス捕獲",   desc: "ボスを捕獲する（1体）",    check: (s) => (s.achievements?.bossCatchCount ?? 0) >= 1,   progress: (s) => ({ current: s.achievements?.bossCatchCount ?? 0, unit: "体" }) },
  { id: "bosscatch10",  category: "capture", label: "ボス狩りの始まり",   desc: "ボスを捕獲する（10体）",   check: (s) => (s.achievements?.bossCatchCount ?? 0) >= 10,  progress: (s) => ({ current: s.achievements?.bossCatchCount ?? 0, unit: "体" }) },
  { id: "bosscatch50",  category: "capture", label: "強者を従える者",     desc: "ボスを捕獲する（50体）",   check: (s) => (s.achievements?.bossCatchCount ?? 0) >= 50,  progress: (s) => ({ current: s.achievements?.bossCatchCount ?? 0, unit: "体" }) },
  { id: "bosscatch100", category: "capture", label: "百の覇者",           desc: "ボスを捕獲する（100体）",  check: (s) => (s.achievements?.bossCatchCount ?? 0) >= 100, progress: (s) => ({ current: s.achievements?.bossCatchCount ?? 0, unit: "体" }) },

  // --- ボス帯別全捕獲 ---
  ...buildBossCaptureAchievements(),

  // --- 隠しボス初撃破 ---
  { id: "hbkill_greed",    category: "hidden_boss", label: "強欲の断罪者",   desc: "強欲の罪・マモナスを初めて撃破する",     check: (s) => !!(s.achievements?.hiddenBossFirstKill?.["hidden_greed"])    },
  { id: "hbkill_wrath",    category: "hidden_boss", label: "憤怒の断罪者",   desc: "憤怒の罪・ラグナロスを初めて撃破する",   check: (s) => !!(s.achievements?.hiddenBossFirstKill?.["hidden_wrath"])    },
  { id: "hbkill_envy",     category: "hidden_boss", label: "嫉妬の断罪者",   desc: "嫉妬の罪・ゼルヴィアを初めて撃破する",   check: (s) => !!(s.achievements?.hiddenBossFirstKill?.["hidden_envy"])     },
  { id: "hbkill_sloth",    category: "hidden_boss", label: "怠惰の断罪者",   desc: "怠惰の罪・ベルフェゴンを初めて撃破する", check: (s) => !!(s.achievements?.hiddenBossFirstKill?.["hidden_sloth"])    },
  { id: "hbkill_gluttony", category: "hidden_boss", label: "暴食の断罪者",   desc: "暴食の罪・グルマンダを初めて撃破する",   check: (s) => !!(s.achievements?.hiddenBossFirstKill?.["hidden_gluttony"]) },
  { id: "hbkill_lust",     category: "hidden_boss", label: "色欲の断罪者",   desc: "色欲の罪・アスタレスを初めて撃破する",   check: (s) => !!(s.achievements?.hiddenBossFirstKill?.["hidden_lust"])     },
  { id: "hbkill_pride",    category: "hidden_boss", label: "傲慢の断罪者",   desc: "傲慢の罪・ルシフェルナを初めて撃破する", check: (s) => !!(s.achievements?.hiddenBossFirstKill?.["hidden_pride"])    },
  { id: "hbkill_all",      category: "hidden_boss", label: "七大罪の終焉者", desc: "七大罪のボスをすべて初めて撃破する",     check: (s) => {
    const kills = s.achievements?.hiddenBossFirstKill ?? {};
    return ["hidden_greed","hidden_wrath","hidden_envy","hidden_sloth","hidden_gluttony","hidden_lust","hidden_pride"].every(id => !!kills[id]);
  }},
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
          // 全敵 × 称号1〜4 がすべて図鑑にcaught済み
          return targetEnemies.every((e) =>
            [1, 2, 3, 4].every((titleId) =>
              s.book?.enemies?.[`normal_${e.id}`]?.titles?.[titleId]?.caught === true
            )
          );
        },
      };
    });

  return [...normal];
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

// フロアテーブルをもとに「フロア帯別：全武器最終進化」実績を生成
function buildWeaponEvolveAchievements() {
  return Object.values(floorTable).filter((area) => area.min != null).map((area) => {
    const [minId, maxId] = area.weaponIdRange;
    const label = `${area.min}〜${area.max}階の進化完遂`;
    const desc = `${area.min}〜${area.max}階の武器をすべて最終段階まで進化させる`;
    return {
      id: `weapon_evo_${area.min}_${area.max}`,
      category: "weapon",
      label,
      desc,
      check: (s) => {
        const targetWeapons = weaponTemplates.filter(
          (w) => !w.isBossDrop && w.id >= minId && w.id <= maxId
        );
        return targetWeapons.every((t) => {
          if (!t.evolutions || t.evolutions.length === 0) return true;
          const finalEvo = t.evolutions[t.evolutions.length - 1];
          const bookKey = `normal_${t.id}`;
          const entry = s.book?.weapons?.[bookKey];
          return entry?.evolutions?.[finalEvo.name]?.obtained === true;
        });
      },
    };
  });
}

// 1000階ごとのボス帯別全捕獲実績を生成
function buildBossCaptureAchievements() {
  const bands = [
    { min: 100,  max: 1000  },
    { min: 1100, max: 2000  },
    { min: 2100, max: 3000  },
    { min: 3100, max: 4000  },
    { min: 4100, max: 5000  },
    { min: 5100, max: 6000  },
    { min: 6100, max: 7000  },
    { min: 7100, max: 8000  },
    { min: 8100, max: 9000  },
    { min: 9100, max: 10000 },
  ];

  return bands.map(({ min, max }) => {
    const label = `${min}〜${max}階のボス捕獲王`;
    const desc = `${min}〜${max}階のボスを称号1〜4すべて捕獲する`;
    return {
      id: `boss_capture_${min}_${max}`,
      category: "capture",
      label,
      desc,
      check: (s) => {
        const targetBosses = bossEnemies.filter(
          (e) => e.bossFloors.some((f) => f >= min && f <= max)
        );
        return targetBosses.every((e) =>
          [1, 2, 3, 4].every((titleId) =>
            s.book?.enemies?.[`boss_${e.id}`]?.titles?.[titleId]?.caught === true
          )
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

  // 未解除の実績が1件もなければスキップ
  const hasUnlocked = state.achievements.unlocked;
  const hasRemaining = achievementDefs.some((def) => !hasUnlocked[def.id]);
  if (!hasRemaining) return;

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

  // タッチ/クリックでも閉じる（ただし攻撃ボタンのホールド中は登録しない）
  if (!state.isHolding?.()) {
    document.addEventListener("pointerdown", dismiss, { once: true });
  }
}

// =====================
// 実績画面レンダリング
// =====================

const categoryLabel = {
  level:       "🧑‍🦯 レベル達成",
  floor:       "🏔️ ボス突破",
  capture:     "🐾 捕獲コレクション",
  weapon:      "⚔️ 武器コレクション",
  synthesis:   "🔨 合成記録",
  ultimate:    "✨ レアコレクション",
  hidden_boss: "💀 隠しボス討伐",
};

// 実績画面の現在選択中のカテゴリ・フィルターを保持（モジュールスコープ）
let _achActiveCategory = null; // null = 最初のカテゴリ
let _achActiveFilter = "all";  // "all" | "done" | "undone"

export function renderAchievements() {
  const stickyEl = document.getElementById("achievementStickyArea");
  const listEl   = document.getElementById("achievementContent");
  if (!stickyEl || !listEl) return;

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

  // ── stickyエリア（カテゴリタブ・進捗バー・フィルター）──
  const activeDefs = groups[_achActiveCategory] ?? [];
  const activeDone = activeDefs.filter(d => !!unlocked[d.id]).length;
  const progressPct = activeDefs.length > 0
    ? Math.round(activeDone / activeDefs.length * 100) : 0;

  let stickyHtml = `<div class="achievement-summary">達成 ${unlockedCount} / ${total}</div>`;

  stickyHtml += `<div class="achievement-tabs">`;
  for (const cat of categories) {
    const defs = groups[cat];
    const doneCnt = defs.filter(d => !!unlocked[d.id]).length;
    const active = cat === _achActiveCategory ? " active" : "";
    stickyHtml += `<button class="achievement-tab-btn${active}" data-cat="${cat}">
      ${categoryLabel[cat] ?? cat}
      <span class="achievement-tab-count">${doneCnt}/${defs.length}</span>
    </button>`;
  }
  stickyHtml += `</div>`;

  stickyHtml += `
    <div class="achievement-progress-bar-wrap">
      <div class="achievement-progress-bar" style="width:${progressPct}%"></div>
    </div>
    <div class="achievement-progress-label">${activeDone} / ${activeDefs.length} 達成（${progressPct}%）</div>
  `;

  stickyHtml += `<div class="achievement-filters">
    <button class="achievement-filter-btn${_achActiveFilter === "all"    ? " active" : ""}" data-filter="all">すべて</button>
    <button class="achievement-filter-btn${_achActiveFilter === "done"   ? " active" : ""}" data-filter="done">達成済み</button>
    <button class="achievement-filter-btn${_achActiveFilter === "undone" ? " active" : ""}" data-filter="undone">未達成</button>
  </div>`;

  stickyEl.innerHTML = stickyHtml;

  // ── リストエリア ──
  const filtered = activeDefs.filter(def => {
    const done = !!unlocked[def.id];
    if (_achActiveFilter === "done")   return done;
    if (_achActiveFilter === "undone") return !done;
    return true;
  });

  let listHtml = "";
  if (filtered.length === 0) {
    listHtml = `<div class="achievement-empty">該当する実績はありません</div>`;
  } else {
    listHtml += `<ul class="achievement-list">`;
    for (const def of filtered) {
      const done = !!unlocked[def.id];
      let progressHtml = "";
      if (!done && def.progress) {
        const { current, unit } = def.progress(state);
        progressHtml = `<div class="achievement-progress">現在: ${current.toLocaleString()}${unit}</div>`;
      }
      const descText = (!done && def.category === "hidden_boss") ? "？？？" : def.desc;
      listHtml += `
        <li class="achievement-item ${done ? "achievement-done" : "achievement-locked"}">
          <span class="achievement-icon">${done ? "🏆" : "🔒"}</span>
          <div class="achievement-text">
            <div class="achievement-label">${done ? def.label : "???（未解除）"}</div>
            <div class="achievement-desc">${descText}</div>
            ${progressHtml}
          </div>
        </li>`;
    }
    listHtml += `</ul>`;
  }

  listEl.innerHTML = listHtml;

  // ── イベント：カテゴリタブ ──
  stickyEl.querySelectorAll(".achievement-tab-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      _achActiveCategory = btn.dataset.cat;
      renderAchievements();
    });
  });

  // ── イベント：フィルター ──
  stickyEl.querySelectorAll(".achievement-filter-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      _achActiveFilter = btn.dataset.filter;
      renderAchievements();
    });
  });
}