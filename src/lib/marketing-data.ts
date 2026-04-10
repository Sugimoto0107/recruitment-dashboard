// ===================================
// マーケティング費用データ
// 月ごとの広告費・マーケ費用を管理
// Notion等から自動取得できないため、手動更新
// ===================================

export interface MonthlyMarketingCost {
  month: string;
  cost: number;
}

// --- 月別マーケティング費用 ---
// 新しい月を追加する際はここに追記
export const MARKETING_COSTS: MonthlyMarketingCost[] = [
  { month: "2025-12", cost: 682000 },
  { month: "2026-01", cost: 1483000 },
  { month: "2026-02", cost: 273745 },
  { month: "2026-03", cost: 280000 },
  { month: "2026-04", cost: 0 }, // TBD
];

// --- マーケ費用のマップ取得 ---
export function getMarketingCostMap(): Record<string, number> {
  const map: Record<string, number> = {};
  for (const mc of MARKETING_COSTS) {
    map[mc.month] = mc.cost;
  }
  return map;
}
