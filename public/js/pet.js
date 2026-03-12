import { state } from "./state.js";
import { normalEnemies, bossEnemies, floorTable } from "./data/index.js";
import { addLog } from "./log.js";
import { getTitleName, legendaryTitles, normalPassiveOf, isLegendaryPassive } from "./data/index.js";
import { updateBookUltimate } from "./book.js";
import { showUltimatePopup, showElitePopup, showLegendaryPopup, showLegendUltimatePopup } from "./ui.js";
import { checkAchievements } from "./achievements.js";

const allEnemyDefs = [...normalEnemies, ...bossEnemies];

// 称号ごとのパッシブ倍率（id:5はレジェンダリー、legendaryTitlesのpassiveMultを使うため1.0として定義）
const titlePassiveMult = { 1: 1.0, 2: 1.2, 3: 1.5, 4: 2.0, 5: 1.0 };

// パッシブスキルの表示名
export const passiveLabels = {
  // 通常スキル
  captureBoost: "捕獲率上昇",
  expBoost:     "経験値上昇",
  atkBoost:     "攻撃力増加",
  dropBoost:    "ドロップ率上昇",
  dmgBoost:     "与ダメ上昇",
  dmgReduce:    "被ダメ減少",
  hpBoost:      "HP増加",
  doubleAttack: "2回攻撃",
  survive:      "根性",
  reflect:      "被ダメ時反射",
  drain:        "与ダメ時回復",
  critRate:     "クリティカル率上昇",
  critDamage:   "クリティカル強化",
  extraHit:     "追撃",
  giantKiller:  "巨人殺し",
  bossSlayer:   "ボス特効",
  evade:        "回避",
  lastStand:    "背水の陣",
  regen:        "再生",
  resurrection: "復活",
  // レジェンダリースキル
  legendCaptureBoost: "【捕縛者】捕獲率大幅上昇",
  legendExpBoost:     "【賢者】経験値大幅上昇",
  legendAtkBoost:     "【破壊神】攻撃力大幅増加",
  legendDropBoost:    "【財宝王】ドロップ率大幅上昇",
  legendDmgBoost:     "【剛力】与ダメ大幅上昇",
  legendDmgReduce:    "【鉄壁】被ダメ大幅減少",
  legendHpBoost:      "【巨人】HP大幅増加",
  tripleAttack:       "【連撃王】確率で3回攻撃",
  legendSurvive:      "【不死身】複数回1で耐える",
  legendReflect:      "【鏡盾】被ダメを100%反射",
  legendDrain:        "【吸血鬼】与ダメ時大回復",
  legendCritRate:     "【致命眼】クリティカル率大幅上昇",
  legendCritDamage:   "【覇者】クリティカル大幅強化",
  legendExtraHit:     "【乱打】確率で2回追撃",
  legendGiantKiller:  "【下剋上】巨人殺し大幅強化",
  legendBossSlayer:   "【覇王討伐】ボス特効大幅強化",
  legendEvade:        "【幻影】回避時完全無敵1ターン",
  legendLastStand:    "【挑戦者】HP低下時大幅強化",
  legendRegen:        "【不滅】毎ターン大回復",
  legendResurrection: "【輪廻転生】複数回HP50%復活",
};

// パッシブの効果量テキスト
export function passiveValueText(pet) {
  if (pet.passiveValue == null) return "";
  return `+${pet.passiveValue}%`;
}

// 捕獲率を取得（ペット・武器の捕獲率上昇パッシブを反映）※後述のlegend版で上書き
export function getEffectiveCaptureRate(baseRate) {
  const pet = state.player.equippedPet;
  const weapon = state.player.equippedWeapon;
  let rate = baseRate;
  if (pet?.passive === "captureBoost" || pet?.passive === "legendCaptureBoost") rate *= (1 + (pet.passiveValue ?? 0) / 100);
  if (weapon?.passive === "captureBoost" || weapon?.passive === "legendCaptureBoost") rate *= (1 + (weapon.passiveValue ?? 0) / 100);
  return rate;
}

// 経験値倍率を取得（ペット・武器）
export function getExpMultiplier() {
  const pet = state.player.equippedPet;
  const weapon = state.player.equippedWeapon;
  let mult = 1;
  if (pet?.passive === "expBoost" || pet?.passive === "legendExpBoost") mult *= (1 + (pet.passiveValue ?? 0) / 100);
  if (weapon?.passive === "expBoost" || weapon?.passive === "legendExpBoost") mult *= (1 + (weapon.passiveValue ?? 0) / 100);
  return mult;
}

// 攻撃力倍率を取得
export function getAtkMultiplier() {
  const pet = state.player.equippedPet;
  if (pet?.passive === "atkBoost" || pet?.passive === "legendAtkBoost") {
    return 1 + (pet.passiveValue ?? 0) / 100;
  }
  return 1;
}

// ドロップ率倍率を取得（ペット・武器）
export function getDropMultiplier() {
  const pet = state.player.equippedPet;
  const weapon = state.player.equippedWeapon;
  let mult = 1;
  if (pet?.passive === "dropBoost" || pet?.passive === "legendDropBoost") mult *= (1 + (pet.passiveValue ?? 0) / 100);
  if (weapon?.passive === "dropBoost" || weapon?.passive === "legendDropBoost") mult *= (1 + (weapon.passiveValue ?? 0) / 100);
  return mult;
}

// 2回攻撃が発動するか（passiveValueを確率%として使用）
export function hasDoubleAttack() {
  const pet = state.player.equippedPet;
  if (pet?.passive !== "doubleAttack") return false;
  const rate = Math.min((pet.passiveValue ?? 50) / 100, 1.0);
  return Math.random() < rate;
}

// 1で耐えるパッシブが発動するか（passiveValueを確率%として使用）
export function hasSurvivePassive() {
  const pet = state.player.equippedPet;
  if (pet?.passive !== "survive") return false;
  const rate = Math.min((pet.passiveValue ?? 50) / 100, 1.0);
  return Math.random() < rate;
}

// 与ダメ上昇倍率を取得
export function getDmgBoostMultiplier() {
  const pet = state.player.equippedPet;
  const weapon = state.player.equippedWeapon;
  let mult = 1;
  if (pet?.passive === "dmgBoost") mult *= (1 + (pet.passiveValue ?? 0) / 100);
  if (weapon?.passive === "dmgBoost") mult *= (1 + (weapon.passiveValue ?? 0) / 100);
  return mult;
}

// 被ダメ減少倍率を取得（上限99%減少、最低1%は受ける）
export function getDmgReduceMultiplier() {
  const pet = state.player.equippedPet;
  const weapon = state.player.equippedWeapon;
  let mult = 1;
  if (pet?.passive === "dmgReduce" || pet?.passive === "legendDmgReduce") mult *= (1 - (pet.passiveValue ?? 0) / 100);
  if (weapon?.passive === "dmgReduce" || weapon?.passive === "legendDmgReduce") mult *= (1 - (weapon.passiveValue ?? 0) / 100);
  return Math.max(mult, 0.2); // 上限80%減少（最低20%は受ける）
}

// HP増加倍率を取得
export function getHpBoostMultiplier() {
  const pet = state.player.equippedPet;
  const weapon = state.player.equippedWeapon;
  let mult = 1;
  if (pet?.passive === "hpBoost") mult *= (1 + (pet.passiveValue ?? 0) / 100);
  if (weapon?.passive === "hpBoost") mult *= (1 + (weapon.passiveValue ?? 0) / 100);
  return mult;
}

// 被ダメ反射が発動するか＆反射ダメージを返す
export function getReflectDamage(incomingDamage) {
  const pet = state.player.equippedPet;
  if (pet?.passive !== "reflect") return 0;
  const rate = Math.min((pet.passiveValue ?? 0) / 100, 1.0);
  if (Math.random() >= rate) return 0;
  return Math.max(1, Math.floor(incomingDamage * 0.5)); // 被ダメの50%を反射
}

// 与ダメ吸収が発動するか＆回復量を返す
export function getDrainHeal(dealtDamage) {
  const pet = state.player.equippedPet;
  if (pet?.passive !== "drain") return 0;
  const rate = Math.min((pet.passiveValue ?? 0) / 100, 1.0);
  if (Math.random() >= rate) return 0;
  return Math.max(1, Math.floor(dealtDamage * 0.3)); // 与ダメの30%を回復
}

// =====================
// 新スキル
// =====================

// クリティカル判定（critRate%の確率で発動）→ダメージ倍率を返す
// 100%超過分はクリティカルダメージ増加（%）に変換される
export function getCritMultiplier() {
  const pet = state.player.equippedPet;
  const weapon = state.player.equippedWeapon;
  let rate = 0;
  if (pet?.passive === "critRate" || pet?.passive === "legendCritRate") rate += (pet.passiveValue ?? 0);
  if (weapon?.passive === "critRate" || weapon?.passive === "legendCritRate") rate += (weapon.passiveValue ?? 0);
  if (rate <= 0) return 1;
  // 100%超過分をクリダメに変換
  const overflow = Math.max(0, rate - 100);
  if (Math.random() < Math.min(rate / 100, 1.0)) {
    let critMult = 1.5;
    if (pet?.passive === "critDamage" || pet?.passive === "legendCritDamage") critMult += (pet.passiveValue ?? 0) / 100;
    if (weapon?.passive === "critDamage" || weapon?.passive === "legendCritDamage") critMult += (weapon.passiveValue ?? 0) / 100;
    critMult += overflow / 100;
    return critMult;
  }
  return 1;
}

// クリティカル強化単体（critRateと同時装備時はgetCritMultiplierで処理）
export function getCritDamageBonus() {
  const pet = state.player.equippedPet;
  const weapon = state.player.equippedWeapon;
  let bonus = 0;
  if (pet?.passive === "critDamage" || pet?.passive === "legendCritDamage") bonus += (pet.passiveValue ?? 0);
  if (weapon?.passive === "critDamage" || weapon?.passive === "legendCritDamage") bonus += (weapon.passiveValue ?? 0);
  return bonus;
}

// 追撃が発動するか＆追加ダメージを返す（通常攻撃の%ダメージ）
export function getExtraHitDamage(baseDamage) {
  const pet = state.player.equippedPet;
  if (pet?.passive !== "extraHit") return 0;
  const rate = Math.min((pet.passiveValue ?? 0) / 100, 1.0);
  if (Math.random() >= rate) return 0;
  return Math.max(1, Math.floor(baseDamage * 0.5)); // 通常攻撃の50%
}

// 巨人殺し：敵HPが自分のHPより高いとき与ダメ増加
export function getGiantKillerMultiplier() {
  const pet = state.player.equippedPet;
  const weapon = state.player.equippedWeapon;
  let bonus = 0;
  if (pet?.passive === "giantKiller") bonus += (pet.passiveValue ?? 0);
  if (weapon?.passive === "giantKiller") bonus += (weapon.passiveValue ?? 0);
  if (bonus <= 0) return 1;
  if ((state.enemy?.hp ?? 0) > state.player.hp) {
    return 1 + bonus / 100;
  }
  return 1;
}

// ボス特効：ボス戦時に与ダメ増加
export function getBossSlayerMultiplier() {
  const pet = state.player.equippedPet;
  const weapon = state.player.equippedWeapon;
  let bonus = 0;
  if (pet?.passive === "bossSlayer") bonus += (pet.passiveValue ?? 0);
  if (weapon?.passive === "bossSlayer") bonus += (weapon.passiveValue ?? 0);
  if (bonus <= 0 || !state.enemy?.isBoss) return 1;
  return 1 + bonus / 100;
}

// 回避：攻撃を確率で回避するか（上限90%）
export function tryEvade() {
  const pet = state.player.equippedPet;
  if (pet?.passive !== "evade") return false;
  const rate = Math.min((pet.passiveValue ?? 0) / 100, 0.9);
  return Math.random() < rate;
}

// 背水：HP30%以下で攻撃力倍率上昇
export function getLastStandMultiplier() {
  const pet = state.player.equippedPet;
  const weapon = state.player.equippedWeapon;
  let bonus = 0;
  if (pet?.passive === "lastStand") bonus += (pet.passiveValue ?? 0);
  if (weapon?.passive === "lastStand") bonus += (weapon.passiveValue ?? 0);
  if (bonus <= 0) return 1;
  const hpRatio = state.player.hp / state.player.totalHp;
  if (hpRatio <= 0.3) return 1 + bonus / 100;
  return 1;
}

// 再生：毎ターンHP回復量を返す（上限50%/ターン）
export function getRegenHeal() {
  const pet = state.player.equippedPet;
  const weapon = state.player.equippedWeapon;
  let rate = 0;
  if (pet?.passive === "regen" || pet?.passive === "legendRegen") rate += (pet.passiveValue ?? 0);
  if (weapon?.passive === "regen") rate += (weapon.passiveValue ?? 0);
  if (rate <= 0) return 0;
  const cappedRate = Math.min(rate, 50); // 上限50%/ターン
  return Math.max(1, Math.floor(state.player.totalHp * cappedRate / 100));
}

// =====================
// レジェンダリースキル専用関数
// =====================

// 3回攻撃（連撃王）
export function hasTripleAttack() {
  const pet = state.player.equippedPet;
  if (pet?.passive !== "tripleAttack") return false;
  const rate = Math.min((pet.passiveValue ?? 50) / 100, 1.0);
  return Math.random() < rate;
}

// 不死身：survive複数回（surviveUsedを使わず毎回確率判定）
export function hasLegendSurvive() {
  const pet = state.player.equippedPet;
  if (pet?.passive !== "legendSurvive") return false;
  const rate = Math.min((pet.passiveValue ?? 50) / 100, 1.0);
  return Math.random() < rate;
}

// 不屈：戦闘不能時にHP50%で復活（1戦1回）
export function hasResurrection() {
  const pet = state.player.equippedPet;
  if (pet?.passive !== "resurrection") return false;
  const rate = Math.min((pet.passiveValue ?? 50) / 100, 1.0);
  return Math.random() < rate;
}

// 転生：戦闘不能時にHP50%で復活（複数回発動可）
export function hasLegendResurrection() {
  const pet = state.player.equippedPet;
  if (pet?.passive !== "legendResurrection") return false;
  const rate = Math.min((pet.passiveValue ?? 50) / 100, 1.0);
  return Math.random() < rate;
}

// 鏡盾：反射100%
export function getLegendReflectDamage(incomingDamage) {
  const pet = state.player.equippedPet;
  if (pet?.passive !== "legendReflect") return 0;
  const rate = Math.min((pet.passiveValue ?? 0) / 100, 1.0);
  if (Math.random() >= rate) return 0;
  return incomingDamage; // 100%反射
}

// 吸血鬼：与ダメの60%回復（通常drainは30%）
export function getLegendDrainHeal(dealtDamage) {
  const pet = state.player.equippedPet;
  if (pet?.passive !== "legendDrain") return 0;
  const rate = Math.min((pet.passiveValue ?? 0) / 100, 1.0);
  if (Math.random() >= rate) return 0;
  return Math.max(1, Math.floor(dealtDamage * 0.6));
}

// 乱打：2回追撃
export function getLegendExtraHitDamage(baseDamage) {
  const pet = state.player.equippedPet;
  if (pet?.passive !== "legendExtraHit") return 0;
  const rate = Math.min((pet.passiveValue ?? 0) / 100, 1.0);
  if (Math.random() >= rate) return 0;
  return Math.max(1, Math.floor(baseDamage * 0.5));
}

// 幻影：回避時に完全無敵1ターン（フラグを立てる）（上限90%）
export function tryLegendEvade() {
  const pet = state.player.equippedPet;
  if (pet?.passive !== "legendEvade") return false;
  const rate = Math.min((pet.passiveValue ?? 0) / 100, 0.9);
  if (Math.random() < rate) {
    state.legendEvadeActive = true;
    return true;
  }
  return false;
}

// 背水の陣：HP50%以下で発動（通常lastStandは30%）
export function getLegendLastStandMultiplier() {
  const pet = state.player.equippedPet;
  const weapon = state.player.equippedWeapon;
  let bonus = 0;
  if (pet?.passive === "legendLastStand") bonus += (pet.passiveValue ?? 0);
  if (weapon?.passive === "legendLastStand") bonus += (weapon.passiveValue ?? 0);
  if (bonus <= 0) return 1;
  const hpRatio = state.player.hp / state.player.totalHp;
  if (hpRatio <= 0.5) return 1 + bonus / 100;
  return 1;
}

// 捕獲を試みる（撃破後に呼ぶ）
export function tryCatch(enemyId, isBoss, titleId = 1, isLegendary = false, isLegendUltimate = false, isElite = false) {
  const def = allEnemyDefs.find(
    (e) => e.id === enemyId && !!e.isBoss === isBoss
  );
  if (!def) return;

  const effectiveRate = getEffectiveCaptureRate(def.captureRate ?? 0);
  if (Math.random() > effectiveRate) {
    if (isLegendUltimate) addLog("💔 究極個体を捕獲できなかった...");
    else if (isLegendary) addLog("💔 伝説個体を捕獲できなかった...");
    else if (isElite) addLog("💔 極個体を捕獲できなかった...");
    return;
  }

  // フロア帯基準値 × 敵比率でpetPower/petHpを計算
  const band = floorTable[def.floorBand] ?? floorTable["1-99"];
  const petPowerMin = Math.floor(band.petPower.min * (def.petPowerRate ?? 1.0));
  const petPowerMax = Math.floor(band.petPower.max * (def.petPowerRate ?? 1.0));
  const petHpMin = Math.floor(band.petHp.min * (def.petHpRate ?? 1.0));
  const petHpMax = Math.floor(band.petHp.max * (def.petHpRate ?? 1.0));

  // レジェンダリー称号の場合はlegendaryTitlesのpassiveMultを使い、スキルIDも変換
  let passive = def.passive;
  let mult = titlePassiveMult[titleId] ?? 1.0;
  if (isLegendary && def.passive && legendaryTitles[def.passive]) {
    const legend = legendaryTitles[def.passive];
    passive = legend.legendaryPassive;
    mult = legend.passiveMult;
  }

  // フロア帯のpassiveValueテーブルからpassiveTypeで取得
  const passiveType = def.passiveType ?? "buff";
  const pvRange = band.passiveValue?.[passiveType] ?? { min: 1, max: 10 };
  const maxPassiveValue = Math.floor(pvRange.max * mult);

  // 究極個体・極個体は全ステータス最大、レジェンダリーはスキル値最大
  let power, hp, passiveValue;
  if (isLegendUltimate || isElite) {
    power = petPowerMax;
    hp = petHpMax;
    passiveValue = maxPassiveValue;
  } else if (isLegendary) {
    power = Math.floor(Math.random() * (petPowerMax - petPowerMin + 1) + petPowerMin);
    hp = Math.floor(Math.random() * (petHpMax - petHpMin + 1) + petHpMin);
    passiveValue = maxPassiveValue;
  } else {
    power = Math.floor(Math.random() * (petPowerMax - petPowerMin + 1) + petPowerMin);
    hp = Math.floor(Math.random() * (petHpMax - petHpMin + 1) + petHpMin);
    passiveValue = Math.min(
      Math.floor(
        (Math.random() * (pvRange.max - pvRange.min + 1) + pvRange.min) * mult
      ),
      maxPassiveValue
    );
  }

  const pet = {
    uid: Date.now() + Math.random(),
    enemyId: def.id,
    isBoss,
    titleId,
    isLegendary: isLegendary ?? false,
    isLegendUltimate: isLegendUltimate ?? false,
    isElite: isElite ?? false,
    titleGroup: def.titleGroup ?? null,
    name: def.name,
    basePower: power,
    power,
    bonusPower: 0,
    baseHp: hp,
    hp,
    bonusHp: 0,
    passive,
    passiveValue,
  };

  state.player.petList.push(pet);
  const label = passiveLabels[pet.passive] ?? pet.passive;
  const valueText = passiveValue != null ? `(${passiveValue}%)` : "";
  const legendMark = isLegendUltimate ? "🔴" : isLegendary ? "✨" : isElite ? "⭐" : "";
  addLog(`🐾${legendMark} ${def.name} を捕獲した！ ATK:${power} HP:${hp} [${label}${valueText}]`);
  updateBookUltimate();

  const enemyFullName = state.enemy?.name ?? def.name;
  if (isLegendUltimate) {
    if (!state.achievements) state.achievements = {};
    state.achievements.legendUltimatePetCount = (state.achievements.legendUltimatePetCount ?? 0) + 1;
    checkAchievements();
    showLegendUltimatePopup({ name: enemyFullName, passive: def.passive, isBoss }, "captured", pet);
  } else if (isLegendary) {
    if (!state.achievements) state.achievements = {};
    checkAchievements();
    showLegendaryPopup({ name: enemyFullName, passive: def.passive, isBoss }, "captured", pet);
  } else if (isElite) {
    if (!state.achievements) state.achievements = {};
    state.achievements.ultimatePetCount = (state.achievements.ultimatePetCount ?? 0) + 1;
    checkAchievements();
    showElitePopup({ name: enemyFullName }, "captured", pet);
  } else if (isUltimatePet(pet)) {
    if (!state.achievements) state.achievements = {};
    state.achievements.ultimatePetCount = (state.achievements.ultimatePetCount ?? 0) + 1;
    checkAchievements();
    const alreadyHas = state.player.petList
      .filter((p) => p.uid !== pet.uid)
      .some((p) => p.enemyId === pet.enemyId && !!p.isBoss === !!pet.isBoss && isUltimatePet(p));
    if (!alreadyHas) showUltimatePopup(pet, "pet");
  } else {
    checkAchievements();
  }
}

// ペットを装備
export function equipPet(uid) {
  const pet = state.player.petList.find((p) => p.uid === uid);
  if (!pet) return;
  state.player.equippedPet = pet;
  const titleName = getTitleName(pet);
  addLog(`🐾 ${titleName}${pet.name} を装備した`);
}

// ペットを外す
export function unequipPet() {
  if (!state.player.equippedPet) return;
  const pet = state.player.equippedPet;
  const titleName = getTitleName(pet);
  addLog(`🐾 ${titleName}${pet.name} を外した`);
  state.player.equippedPet = null;
}


// =====================
// ペット合成
// =====================

// 合成素材の選択処理
export function handlePetSynthesisSelection(uid) {
  const synth = state.petSynthesis;
  const petList = state.player.petList;
  const clicked = petList.find((p) => p.uid === uid);
  if (!clicked) return;

  // ベース未選択 → ベースにセット
  if (synth.baseUid === null) {
    synth.baseUid = uid;
    return;
  }

  // ベースを再タップ → 選択解除
  if (uid === synth.baseUid) {
    synth.baseUid = null;
    synth.materialUids = [];
    return;
  }

  const base = petList.find((p) => p.uid === synth.baseUid);
  // 種族が違う → 無視
  if (!base || base.enemyId !== clicked.enemyId || base.isBoss !== clicked.isBoss) return;

  // 素材トグル
  const i = synth.materialUids.indexOf(uid);
  if (i === -1) {
    synth.materialUids.push(uid);
  } else {
    synth.materialUids.splice(i, 1);
  }
}

// 合成プレビュー
export function getPetSynthesisPreview() {
  const { baseUid, materialUids } = state.petSynthesis;
  if (!baseUid || materialUids.length === 0) return null;

  const petList = state.player.petList;
  const base = petList.find((p) => p.uid === baseUid);
  if (!base) return null;

  const gain = materialUids.reduce((sum, uid) => {
    const m = petList.find((p) => p.uid === uid);
    return m ? sum + Math.floor(m.power * 0.5) : sum;
  }, 0);

  const hpGain = materialUids.reduce((sum, uid) => {
    const m = petList.find((p) => p.uid === uid);
    return m ? sum + Math.floor((m.hp ?? 0) * 0.5) : sum;
  }, 0);

  return {
    oldPower: base.power,
    newPower: base.power + gain,
    oldHp: base.hp ?? 0,
    newHp: (base.hp ?? 0) + hpGain,
    materialCount: materialUids.length,
  };
}


// 合成実行
export function executePetSynthesis() {
  const { baseUid, materialUids } = state.petSynthesis;
  if (!baseUid || materialUids.length === 0) return false;

  const petList = state.player.petList;
  const base = petList.find((p) => p.uid === baseUid);
  if (!base) return false;

  const gain = materialUids.reduce((sum, uid) => {
    const m = petList.find((p) => p.uid === uid);
    return m ? sum + Math.floor(m.power * 0.5) : sum;
  }, 0);

  const hpGain = materialUids.reduce((sum, uid) => {
    const m = state.player.petList.find((p) => p.uid === uid);
    return m ? sum + Math.floor((m.hp ?? 0) * 0.5) : sum;
  }, 0);
  base.power += gain;
  base.bonusPower = (base.bonusPower ?? 0) + gain;
  base.hp = (base.hp ?? 0) + hpGain;
  base.bonusHp = (base.bonusHp ?? 0) + hpGain;

  // 装備中のペットも更新
  if (state.player.equippedPet?.uid === baseUid) {
    state.player.equippedPet = base;
  }

  // 素材に装備中ペットが含まれていたら外す
  if (materialUids.includes(state.player.equippedPet?.uid)) {
    state.player.equippedPet = null;
    addLog("🐾 素材として使用されたペットを外した");
  }

  // 素材を削除
  state.player.petList = petList.filter(
    (p) => !materialUids.includes(p.uid)
  );

  addLog(`🐾 ${base.name} を合成！ATK +${gain} → ${base.power}`);

  state.petSynthesis.baseUid = null;
  state.petSynthesis.materialUids = [];
  if (!state.achievements) state.achievements = {};
  state.achievements.petSynthCount = (state.achievements.petSynthCount ?? 0) + 1;
  checkAchievements();
  return true;
}

// ペット一括選択（同種族を全選択/全解除）
export function toggleSelectAllSamePets() {
  const { baseUid, materialUids } = state.petSynthesis;
  if (!baseUid) return;

  const petList = state.player.petList;
  const base = petList.find((p) => p.uid === baseUid);
  if (!base) return;

  const sameUids = petList
    .filter((p) => p.uid !== baseUid && p.enemyId === base.enemyId && p.isBoss === base.isBoss)
    .map((p) => p.uid);

  const allSelected = sameUids.length > 0 && sameUids.every((uid) => materialUids.includes(uid));
  state.petSynthesis.materialUids = allSelected ? [] : sameUids;
}

// =====================
// 究極個体判定
// =====================
export function isUltimatePet(pet) {
  if (!pet) return false;
  const def = allEnemyDefs.find((d) => d.id === pet.enemyId && !!d.isBoss === !!pet.isBoss);
  if (!def) return false;

  const band = floorTable[def.floorBand] ?? floorTable["1-99"];
  const maxPower = Math.floor(band.petPower.max * (def.petPowerRate ?? 1.0));
  const maxHp = Math.floor(band.petHp.max * (def.petHpRate ?? 1.0));
  const passiveType = def.passiveType ?? "buff";
  const pvRange = band.passiveValue?.[passiveType];
  const maxMult = titlePassiveMult[4] ?? 2.0;
  const maxPassive = (def.passive && pvRange) ? Math.floor(pvRange.max * maxMult) : null;

  // 称号がちょうど4（レジェンダリーは究極個体として別管理）かつ各ステータスが最大値
  if ((pet.titleId ?? 0) !== 4) return false;
  if ((pet.basePower ?? pet.power) < maxPower) return false;
  if ((pet.baseHp ?? pet.hp ?? 0) < maxHp) return false;
  if (maxPassive !== null && (pet.passiveValue ?? 0) < maxPassive) return false;
  return true;
}