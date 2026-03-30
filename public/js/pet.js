import { state } from "./state.js";
import { normalEnemies, bossEnemies, floorTable } from "./data/index.js";
import { isLocked } from "./listPrefs.js";
import { addLog } from "./log.js";
import { getTitleName, legendaryTitles, normalPassiveOf, isLegendaryPassive } from "./data/index.js";
import { updateBookUltimate } from "./book.js";
import { showUltimatePopup, showElitePopup, showLegendaryPopup, showLegendUltimatePopup } from "./ui.js";
import { checkAchievements } from "./achievements.js";

const allEnemyDefs = [...normalEnemies, ...bossEnemies];

// =====================
// ペット強化値計算（武器と同一式）
// =====================
const K_ATK = 7.5 / Math.sqrt(15);
const K_HP  = 4.5 / Math.sqrt(15);

function calcPetAtk(basePower, level) {
  const mult = level <= 15
    ? (1 + level * 0.5)
    : (1 + Math.sqrt(level) * K_ATK);
  return Math.floor(basePower * mult);
}

function calcPetHp(baseHp, level) {
  const mult = level <= 15
    ? (1 + level * 0.3)
    : (1 + Math.sqrt(level) * K_HP);
  return Math.floor(baseHp * mult);
}

export function getPetPower(pet) {
  return calcPetAtk(pet.basePower, pet.level ?? 0);
}

export function getPetHp(pet) {
  return calcPetHp(pet.baseHp ?? 0, pet.level ?? 0);
}

// 称号ごとのパッシブ倍率（id:5はレジェンダリー、legendaryTitlesのpassiveMultを使うため1.0として定義）
const titlePassiveMult = { 1: 1.0, 2: 1.2, 3: 1.5, 4: 2.0, 5: 1.0 };

// パッシブスキルの表示名
export const passiveLabels = {
  // 通常スキル
  captureBoost: "捕獲率上昇",
  expBoost:     "経験値上昇",
  atkBoost:     "攻撃力増加",
  dropBoost:    "ドロップ率上昇",
  dmgBoost:     "与ダメ増加",
  dmgReduce:    "被ダメ減少",
  hpBoost:      "HP増加",
  doubleAttack: "2回攻撃",
  survive:      "根性",
  reflect:      "ダメージ反射",
  drain:        "与ダメ吸収",
  critRate:     "クリティカル率上昇",
  critDamage:   "クリティカル強化",
  expBurst:     "経験値爆発",
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
  legendDmgBoost:     "【剛力】与ダメ大幅増加",
  legendDmgReduce:    "【鉄壁】被ダメ大幅減少",
  legendHpBoost:      "【巨人】HP大幅増加",
  tripleAttack:       "【連撃王】確率で3回攻撃",
  legendSurvive:      "【不死身】複数回1で耐える",
  legendReflect:      "【鏡盾】被ダメを100%反射",
  legendDrain:        "【吸血鬼】与ダメ時大回復",
  legendCritRate:     "【致命眼】クリティカル率大幅上昇",
  legendCritDamage:   "【覇者】クリティカル大幅強化",
  legendExpBurst:     "✨幸運の女神",
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
  let total = 0;
  if (pet?.passive === "captureBoost" || pet?.passive === "legendCaptureBoost") total += (pet.passiveValue ?? 0);
  if (weapon?.passive === "captureBoost" || weapon?.passive === "legendCaptureBoost") total += (weapon.passiveValue ?? 0);
  const researchBonus = (state.research?.captureBonus ?? 0) * 0.001;
  return baseRate * (1 + total / 100) + researchBonus;
}

// 経験値倍率を取得（ペット・武器）
export function getExpMultiplier() {
  const pet = state.player.equippedPet;
  const weapon = state.player.equippedWeapon;
  let total = 0;
  if (pet?.passive === "expBoost" || pet?.passive === "legendExpBoost") total += (pet.passiveValue ?? 0);
  if (weapon?.passive === "expBoost" || weapon?.passive === "legendExpBoost") total += (weapon.passiveValue ?? 0);
  // expBurst系の超過分を加算
  total += (state._expBurstOverflowExpBoost ?? 0);
  return 1 + total / 100;
}

// ドロップ率倍率を取得（ペット・武器）
export function getDropMultiplier() {
  const pet = state.player.equippedPet;
  const weapon = state.player.equippedWeapon;
  let total = 0;
  if (pet?.passive === "dropBoost" || pet?.passive === "legendDropBoost") total += (pet.passiveValue ?? 0);
  if (weapon?.passive === "dropBoost" || weapon?.passive === "legendDropBoost") total += (weapon.passiveValue ?? 0);
  return 1 + total / 100;
}

// 2回攻撃が発動するか（passiveValueを確率%として使用）
export function hasDoubleAttack() {
  const pet = state.player.equippedPet;
  const weapon = state.player.equippedWeapon;
  let rate = 0;
  if (pet?.passive === "doubleAttack") rate += (pet.passiveValue ?? 0);
  if (weapon?.passive === "doubleAttack") rate += (weapon.passiveValue ?? 0);
  if (rate <= 0) return false;

  return Math.random() < Math.min(rate / 100, 1.0);
}

// 1で耐えるパッシブが発動するか（passiveValueを確率%として使用）
export function hasSurvivePassive() {
  const pet = state.player.equippedPet;
  const weapon = state.player.equippedWeapon;
  let rate = 0;
  if (pet?.passive === "survive") rate += (pet.passiveValue ?? 0);
  if (weapon?.passive === "survive") rate += (weapon.passiveValue ?? 0);
  if (rate <= 0) return false;

  return Math.random() < Math.min(rate / 100, 0.8);
}

// 与ダメ上昇倍率を取得
export function getDmgBoostMultiplier() {
  const pet = state.player.equippedPet;
  const weapon = state.player.equippedWeapon;
  let total = 0;
  if (pet?.passive === "dmgBoost" || pet?.passive === "legendDmgBoost") total += (pet.passiveValue ?? 0);
  if (weapon?.passive === "dmgBoost" || weapon?.passive === "legendDmgBoost") total += (weapon.passiveValue ?? 0);

  // trigger系スキルの上限超過分を加算
  total += (state._triggerOverflowDmgBoost ?? 0);

  return 1 + total / 100;
}

// 被ダメ減少倍率を取得（上限80%減少）
export function getDmgReduceMultiplier() {
  const pet = state.player.equippedPet;
  const weapon = state.player.equippedWeapon;
  let totalRate = 0;
  if (pet?.passive === "dmgReduce" || pet?.passive === "legendDmgReduce") totalRate += (pet.passiveValue ?? 0);
  if (weapon?.passive === "dmgReduce" || weapon?.passive === "legendDmgReduce") totalRate += (weapon.passiveValue ?? 0);

  const clampedRate = Math.min(totalRate, 80);
  return 1 - clampedRate / 100;
}

// HP増加倍率を取得
export function getHpBoostMultiplier() {
  const pet = state.player.equippedPet;
  const weapon = state.player.equippedWeapon;
  let total = 0;
  if (pet?.passive === "hpBoost" || pet?.passive === "legendHpBoost") total += (pet.passiveValue ?? 0);
  if (weapon?.passive === "hpBoost" || weapon?.passive === "legendHpBoost") total += (weapon.passiveValue ?? 0);
  return 1 + total / 100;
}

// 被ダメ反射が発動するか＆反射ダメージを返す
export function getReflectDamage(incomingDamage) {
  const pet = state.player.equippedPet;
  const weapon = state.player.equippedWeapon;
  let rate = 0;
  if (pet?.passive === "reflect") rate += (pet.passiveValue ?? 0);
  if (weapon?.passive === "reflect") rate += (weapon.passiveValue ?? 0);
  if (rate <= 0) return 0;
  return Math.max(1, Math.floor(incomingDamage * rate / 100)); // 常時・passiveValue%を反射
}

// 与ダメ吸収が発動するか＆回復量を返す
export function getDrainHeal(dealtDamage) {
  const pet = state.player.equippedPet;
  const weapon = state.player.equippedWeapon;
  let rate = 0;
  if (pet?.passive === "drain") rate += (pet.passiveValue ?? 0);
  if (weapon?.passive === "drain") rate += (weapon.passiveValue ?? 0);
  if (rate <= 0) return 0;
  return Math.max(1, Math.floor(dealtDamage * rate / 100)); // 常時・passiveValue%を回復
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

// 経験値爆発：passiveValue%の確率で取得経験値2倍
export function getExpBurstMultiplier() {
  const pet = state.player.equippedPet;
  const weapon = state.player.equippedWeapon;
  let rate = 0;
  if (pet?.passive === "expBurst") rate += (pet.passiveValue ?? 0);
  if (weapon?.passive === "expBurst") rate += (weapon.passiveValue ?? 0);
  if (rate <= 0) return 1;

  if (Math.random() < Math.min(rate / 100, 1.0)) return 2;
  return 1;
}

// 巨人殺し：敵HPが自分のHPより高いとき与ダメ増加
export function getGiantKillerMultiplier() {
  const pet = state.player.equippedPet;
  const weapon = state.player.equippedWeapon;
  let bonus = 0;
  if (pet?.passive === "giantKiller" || pet?.passive === "legendGiantKiller") bonus += (pet.passiveValue ?? 0);
  if (weapon?.passive === "giantKiller" || weapon?.passive === "legendGiantKiller") bonus += (weapon.passiveValue ?? 0);
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
  if (pet?.passive === "bossSlayer" || pet?.passive === "legendBossSlayer") bonus += (pet.passiveValue ?? 0);
  if (weapon?.passive === "bossSlayer" || weapon?.passive === "legendBossSlayer") bonus += (weapon.passiveValue ?? 0);
  if (bonus <= 0 || !state.enemy?.isBoss) return 1;
  return 1 + bonus / 100;
}

// 回避：攻撃を確率で回避するか（evade・legendEvade を合算、上限70%）
export function tryEvade() {
  const pet = state.player.equippedPet;
  const weapon = state.player.equippedWeapon;
  let rate = 0;
  if (pet?.passive === "evade")          rate += (pet.passiveValue ?? 0);
  if (weapon?.passive === "evade")       rate += (weapon.passiveValue ?? 0);
  if (pet?.passive === "legendEvade")    rate += (pet.passiveValue ?? 0);
  if (weapon?.passive === "legendEvade") rate += (weapon.passiveValue ?? 0);
  if (rate <= 0) return false;

  const hasLegendEvade =
    pet?.passive === "legendEvade" || weapon?.passive === "legendEvade";

  if (Math.random() < Math.min(rate / 100, 0.7)) {
    if (hasLegendEvade) state.legendEvadeActive = true;
    return true;
  }
  return false;
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

// 再生：2ターンに1回HP回復（legendRegenは毎ターン）（上限50%/ターン）
export function getRegenHeal() {
  const pet = state.player.equippedPet;
  const weapon = state.player.equippedWeapon;

  // regenとlegendRegenを分離して判定
  let regenRate = 0;
  let legendRegenRate = 0;
  if (pet?.passive === "regen") regenRate += (pet.passiveValue ?? 0);
  if (weapon?.passive === "regen") regenRate += (weapon.passiveValue ?? 0);
  if (pet?.passive === "legendRegen") legendRegenRate += (pet.passiveValue ?? 0);
  if (weapon?.passive === "legendRegen") legendRegenRate += (weapon.passiveValue ?? 0);

  let totalRate = 0;

  // legendRegen：毎ターン発動
  if (legendRegenRate > 0) {
    totalRate += legendRegenRate;
  }

  // regen：2ターンに1回発動
  if (regenRate > 0) {
    state.regenTurnCount = (state.regenTurnCount ?? 0) + 1;
    if (state.regenTurnCount >= 2) {
      state.regenTurnCount = 0;
      totalRate += regenRate;
    }
  }

  if (totalRate <= 0) return 0;
  const cappedRate = Math.min(totalRate, 50);
  return Math.max(1, Math.floor(state.player.totalHp * cappedRate / 100));
}

// =====================
// レジェンダリースキル専用関数
// =====================

// 3回攻撃（連撃王）
export function hasTripleAttack() {
  const pet = state.player.equippedPet;
  const weapon = state.player.equippedWeapon;
  let rate = 0;
  if (pet?.passive === "tripleAttack") rate += (pet.passiveValue ?? 0);
  if (weapon?.passive === "tripleAttack") rate += (weapon.passiveValue ?? 0);
  if (rate <= 0) return false;

  return Math.random() < Math.min(rate / 100, 1.0);
}

// 不死身：survive複数回（surviveUsedを使わず毎回確率判定）
export function hasLegendSurvive() {
  const pet = state.player.equippedPet;
  const weapon = state.player.equippedWeapon;
  let rate = 0;
  if (pet?.passive === "legendSurvive") rate += (pet.passiveValue ?? 0);
  if (weapon?.passive === "legendSurvive") rate += (weapon.passiveValue ?? 0);
  if (rate <= 0) return false;

  return Math.random() < Math.min(rate / 100, 0.8);
}

// 不屈：戦闘不能時にHP50%で復活（1戦1回）
export function hasResurrection() {
  const pet = state.player.equippedPet;
  const weapon = state.player.equippedWeapon;
  let rate = 0;
  if (pet?.passive === "resurrection") rate += (pet.passiveValue ?? 0);
  if (weapon?.passive === "resurrection") rate += (weapon.passiveValue ?? 0);
  if (rate <= 0) return false;

  return Math.random() < Math.min(rate / 100, 1.0);
}

// 転生：戦闘不能時にHP50%で復活（複数回発動可）
export function hasLegendResurrection() {
  const pet = state.player.equippedPet;
  const weapon = state.player.equippedWeapon;
  let rate = 0;
  if (pet?.passive === "legendResurrection") rate += (pet.passiveValue ?? 0);
  if (weapon?.passive === "legendResurrection") rate += (weapon.passiveValue ?? 0);
  if (rate <= 0) return false;

  return Math.random() < Math.min(rate / 100, 0.8);
}

// 鏡盾：passiveValue%を常時反射、反射するたびに+50%累積
export function getLegendReflectDamage(incomingDamage) {
  const pet = state.player.equippedPet;
  const weapon = state.player.equippedWeapon;
  let rate = 0;
  if (pet?.passive === "legendReflect") rate += (pet.passiveValue ?? 0);
  if (weapon?.passive === "legendReflect") rate += (weapon.passiveValue ?? 0);
  if (rate <= 0) return 0;
  const totalRate = rate + (state.legendReflectBonus ?? 0);
  const reflectDmg = Math.max(1, Math.floor(incomingDamage * totalRate / 100));
  state.legendReflectBonus = (state.legendReflectBonus ?? 0) + 50; // 反射するたびに+50%
  return reflectDmg;
}

// 吸血鬼：passiveValue%を常時回復、オーバーヒール分はATKボーナスに変換
export function getLegendDrainHeal(dealtDamage) {
  const pet = state.player.equippedPet;
  const weapon = state.player.equippedWeapon;
  let rate = 0;
  if (pet?.passive === "legendDrain") rate += (pet.passiveValue ?? 0);
  if (weapon?.passive === "legendDrain") rate += (weapon.passiveValue ?? 0);
  if (rate <= 0) return 0;
  return Math.max(1, Math.floor(dealtDamage * rate / 100)); // 常時・passiveValue%を回復
}

// 経験値大爆発：passiveValue%の確率で取得経験値5倍
export function getLegendExpBurstMultiplier() {
  const pet = state.player.equippedPet;
  const weapon = state.player.equippedWeapon;
  let rate = 0;
  if (pet?.passive === "legendExpBurst") rate += (pet.passiveValue ?? 0);
  if (weapon?.passive === "legendExpBurst") rate += (weapon.passiveValue ?? 0);
  if (rate <= 0) return 1;

  if (Math.random() < Math.min(rate / 100, 1.0)) return 5;
  return 1;
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
  if ((isLegendary || isLegendUltimate) && def.passive && legendaryTitles[def.passive]) {
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
    uid: `${Date.now()}_${Math.random()}`,
    enemyId: def.id,
    isBoss,
    titleId,
    isLegendary: isLegendary ?? false,
    isLegendUltimate: isLegendUltimate ?? false,
    isElite: isElite ?? false,
    titleGroup: def.titleGroup ?? null,
    name: def.name,
    basePower: power,
    baseHp: hp,
    level: 0,
    passive,
    passiveValue,
    acquiredOrder: state.acquiredCounter++,
  };

  state.player.petList.push(pet);

  // 図鑑に捕獲フラグを永続保存
  const bookKey = pet.isBoss ? `boss_${pet.enemyId}` : `normal_${pet.enemyId}`;
  const bookEntry = state.book.enemies[bookKey];
  if (bookEntry) {
    if (!bookEntry.titles[titleId]) {
      bookEntry.titles[titleId] = { seen: true, defeated: false };
    }
    bookEntry.titles[titleId].caught = true;

    // レジェンダリーの場合は titleId=5 にもフラグを立てる
    if (isLegendary) {
      if (!bookEntry.titles[5]) {
        bookEntry.titles[5] = { seen: true, defeated: false };
      }
      bookEntry.titles[5].caught = true;
    }
  }

  const legendMark = isLegendUltimate ? "🔴" : isLegendary ? "✨" : isElite ? "⭐" : "";
  const capturedTitleName = getTitleName(pet);
  addLog(`🐾${legendMark} ${capturedTitleName}${def.name} を捕獲した！`);
  updateBookUltimate();

  const enemyFullName = state.enemy?.name ?? def.name;
  if (!state.achievements) state.achievements = {};
  if (isBoss) {
    state.achievements.bossCatchCount = (state.achievements.bossCatchCount ?? 0) + 1;
  }

  if (isLegendUltimate) {
    state.achievements.legendUltimatePetCount = (state.achievements.legendUltimatePetCount ?? 0) + 1;
    checkAchievements();
    showLegendUltimatePopup({ name: enemyFullName, passive: def.passive, isBoss }, "captured", pet);
  } else if (isLegendary) {
    state.achievements.legendaryPetCount = (state.achievements.legendaryPetCount ?? 0) + 1;
    checkAchievements();
    showLegendaryPopup({ name: enemyFullName, passive: def.passive, isBoss }, "captured", pet);
  } else if (isElite) {
    state.achievements.elitePetCount = (state.achievements.elitePetCount ?? 0) + 1;
    checkAchievements();
    showElitePopup({ name: enemyFullName }, "captured", pet);
  } else if (isUltimatePet(pet)) {
    // isUltimatePet は称号4かつ全ステ最大（通常フロー）
    // ※ elitePetCount とは別カウント
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
  if (!base || base.enemyId !== clicked.enemyId || base.isBoss !== clicked.isBoss) return;

  // 素材トグル（手動追加・解除）
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

  // 武器と同じ式：素材のlevel合計 + 素材数
  const totalLevelGain = materialUids.reduce((sum, uid) => {
    const m = petList.find((p) => p.uid === uid);
    return m ? sum + (m.level ?? 0) + 1 : sum;
  }, 0);

  const oldLevel = base.level ?? 0;
  const newLevel = oldLevel + totalLevelGain;

  return {
    oldLevel,
    newLevel,
    oldPower: calcPetAtk(base.basePower, oldLevel),
    newPower: calcPetAtk(base.basePower, newLevel),
    oldHp:    calcPetHp(base.baseHp ?? 0, oldLevel),
    newHp:    calcPetHp(base.baseHp ?? 0, newLevel),
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

  const oldPower = calcPetAtk(base.basePower, base.level ?? 0);

  // 武器と同じ式：素材のlevel合計 + 素材数
  const levelGain = materialUids.reduce((sum, uid) => {
    const m = petList.find((p) => p.uid === uid);
    return m ? sum + (m.level ?? 0) + 1 : sum;
  }, 0);

  base.level = (base.level ?? 0) + levelGain;

  const newPower = calcPetAtk(base.basePower, base.level);

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
  state.player.petList = petList.filter((p) => !materialUids.includes(p.uid));

  base.acquiredOrder = state.acquiredCounter++;
  addLog(`🐾 ${base.name} を合成！ATK ${oldPower} → ${newPower}`);

  state.petSynthesis.baseUid = null;
  state.petSynthesis.materialUids = [];
  if (!state.achievements) state.achievements = {};
  state.achievements.petSynthCount = (state.achievements.petSynthCount ?? 0) + materialUids.length;
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

  // レア個体・ロック済みを除外
  const sameUids = petList
    .filter((p) =>
      p.uid !== baseUid &&
      p.enemyId === base.enemyId &&
      p.isBoss === base.isBoss &&
      !p.isLegendUltimate &&
      !p.isLegendary &&
      !p.isElite &&
      !isLocked(p.uid)
    )
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
  if (pet.basePower < maxPower) return false;
  if ((pet.baseHp ?? 0) < maxHp) return false;
  if (maxPassive !== null && (pet.passiveValue ?? 0) < maxPassive) return false;
  return true;
}

// 超過分ボーナスを一括計算してstateに設定する（バトル開始時に1回呼ぶ）
export function calcOverflowBonuses() {
  const pet = state.player.equippedPet;
  const weapon = state.player.equippedWeapon;

  // --- HP増加への超過変換 ---
  let overflowHpBoost = 0;

  // 根性（上限80%）
  {
    let rate = 0;
    if (pet?.passive === "survive") rate += (pet.passiveValue ?? 0);
    if (weapon?.passive === "survive") rate += (weapon.passiveValue ?? 0);
    overflowHpBoost += Math.max(0, rate - 80) * 0.2;
  }

  // 被ダメ減少（上限80%）
  {
    let rate = 0;
    if (pet?.passive === "dmgReduce" || pet?.passive === "legendDmgReduce") rate += (pet.passiveValue ?? 0);
    if (weapon?.passive === "dmgReduce" || weapon?.passive === "legendDmgReduce") rate += (weapon.passiveValue ?? 0);
    overflowHpBoost += Math.max(0, rate - 80) * 0.2;
  }

  // ✨不死身（上限80%）
  {
    let rate = 0;
    if (pet?.passive === "legendSurvive") rate += (pet.passiveValue ?? 0);
    if (weapon?.passive === "legendSurvive") rate += (weapon.passiveValue ?? 0);
    overflowHpBoost += Math.max(0, rate - 80) * 0.2;
  }

  // 復活（上限100%）
  {
    let rate = 0;
    if (pet?.passive === "resurrection") rate += (pet.passiveValue ?? 0);
    if (weapon?.passive === "resurrection") rate += (weapon.passiveValue ?? 0);
    overflowHpBoost += Math.max(0, rate - 100) * 0.2;
  }

  // ✨輪廻転生（上限80%）
  {
    let rate = 0;
    if (pet?.passive === "legendResurrection") rate += (pet.passiveValue ?? 0);
    if (weapon?.passive === "legendResurrection") rate += (weapon.passiveValue ?? 0);
    overflowHpBoost += Math.max(0, rate - 80) * 0.2;
  }

  // 再生（上限50%）
  {
    let rate = 0;
    if (pet?.passive === "regen") rate += (pet.passiveValue ?? 0);
    if (weapon?.passive === "regen") rate += (weapon.passiveValue ?? 0);
    overflowHpBoost += Math.max(0, rate - 50) * 0.2;
  }

  // ✨不滅（上限50%）
  {
    let rate = 0;
    if (pet?.passive === "legendRegen") rate += (pet.passiveValue ?? 0);
    if (weapon?.passive === "legendRegen") rate += (weapon.passiveValue ?? 0);
    overflowHpBoost += Math.max(0, rate - 50) * 0.2;
  }

  state._triggerOverflowHpBoost = Math.floor(overflowHpBoost);

  // --- 与ダメ増加への超過変換 ---
  let overflowDmgBoost = 0;

  // 2回攻撃（上限100%）
  {
    let rate = 0;
    if (pet?.passive === "doubleAttack") rate += (pet.passiveValue ?? 0);
    if (weapon?.passive === "doubleAttack") rate += (weapon.passiveValue ?? 0);
    overflowDmgBoost += Math.max(0, rate - 100) * 0.2;
  }

  // 回避（上限70%）
  {
    let rate = 0;
    if (pet?.passive === "evade" || pet?.passive === "legendEvade") rate += (pet.passiveValue ?? 0);
    if (weapon?.passive === "evade" || weapon?.passive === "legendEvade") rate += (weapon.passiveValue ?? 0);
    overflowDmgBoost += Math.max(0, rate - 70) * 0.2;
  }

  // ✨連撃王（上限100%）
  {
    let rate = 0;
    if (pet?.passive === "tripleAttack") rate += (pet.passiveValue ?? 0);
    if (weapon?.passive === "tripleAttack") rate += (weapon.passiveValue ?? 0);
    overflowDmgBoost += Math.max(0, rate - 100) * 0.2;
  }

  state._triggerOverflowDmgBoost = Math.floor(overflowDmgBoost);

  // --- 経験値増加への超過変換 ---
  let overflowExpBoost = 0;

  // 経験値爆発（上限100%）
  {
    let rate = 0;
    if (pet?.passive === "expBurst") rate += (pet.passiveValue ?? 0);
    if (weapon?.passive === "expBurst") rate += (weapon.passiveValue ?? 0);
    overflowExpBoost += Math.max(0, rate - 100) * 0.2;
  }

  // ✨幸運の女神（上限100%）
  {
    let rate = 0;
    if (pet?.passive === "legendExpBurst") rate += (pet.passiveValue ?? 0);
    if (weapon?.passive === "legendExpBurst") rate += (weapon.passiveValue ?? 0);
    overflowExpBoost += Math.max(0, rate - 100) * 0.2;
  }

  state._expBurstOverflowExpBoost = Math.floor(overflowExpBoost);
}