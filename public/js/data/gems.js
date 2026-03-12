// 宝玉テンプレート（ボスドロップ・装備不可・所持するだけで攻撃力上昇）
export const gemTemplates = [
  { id: 1, name: "銅の宝玉", rarity: "copper", atkBonus: 3,  icon: "🟤" },
  { id: 2, name: "銀の宝玉", rarity: "silver", atkBonus: 5,  icon: "⚪" },
  { id: 3, name: "金の宝玉", rarity: "gold",   atkBonus: 10, icon: "🟡" },
];

/**
 * 指定ボスフロアでのドロップ宝玉を生成して返す
 * 階層が深くなるほど質（銅→銀→金）と個数が増加
 */
export function rollBossGems(floor) {
  const tier = Math.floor(floor / 100); // 1〜

  // 宝玉の質の重み（tier が増えるほど銀・金が増える）
  const copperW = Math.max(0, 10 - tier * 2);   // tier5以上で0
  const silverW = Math.min(tier * 2, 10);        // tier5で10、以降10固定
  const goldW   = Math.max(0, (tier - 5) * 2);  // tier6以上で出現

  const totalW = copperW + silverW + goldW;

  // ドロップ個数: 1 + floor(tier/5)、最大5個
  const count = Math.min(1 + Math.floor(tier / 5), 5);

  const result = [];
  for (let i = 0; i < count; i++) {
    const r = Math.random() * totalW;
    let gem;
    if (r < copperW) {
      gem = { ...gemTemplates[0], uid: Date.now() + Math.random() };
    } else if (r < copperW + silverW) {
      gem = { ...gemTemplates[1], uid: Date.now() + Math.random() };
    } else {
      gem = { ...gemTemplates[2], uid: Date.now() + Math.random() };
    }
    result.push(gem);
  }
  return result;
}
