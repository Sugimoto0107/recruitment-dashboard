// ===================================
// マーケティング費用データ
// 月ごとの広告費・マーケ費用を管理
// Notion等から自動取得できないため、手動更新
// ===================================

export interface MonthlyMarketingCost {
  month: string;
  cost: number;
  breakdown?: Record<string, number>;
}

// --- 月別マーケティング費用 ---
// 新しい月を追加する際はここに追記
export const MARKETING_COSTS: MonthlyMarketingCost[] = [
  { month: "2025-12", cost: 620000,  breakdown: { "DODA Maps": 620000 } },
  { month: "2026-01", cost: 783000,  breakdown: { "DODA Maps": 783000 } },
  { month: "2026-02", cost: 224795,  breakdown: { "DODA Maps": 73000,  "Meta": 151795 } },
  { month: "2026-03", cost: 493560,  breakdown: { "DODA Maps": 256000, "Meta": 237560 } },
  { month: "2026-04", cost: 910000,  breakdown: { "DODA Maps": 70000,  "DODA X": 840000 } },
  { month: "2026-05", cost: 442000,  breakdown: { "DODA Maps": 442000 } },
  { month: "2026-06", cost: 224000,  breakdown: { "DODA Maps": 224000 } },
  { month: "2026-07", cost: 850300,  breakdown: { "DODA Maps": 235000, "DODA X": 615300 } },
  { month: "2026-08", cost: 1120000, breakdown: { "DODA Maps": 300000, "リファラル": 820000 } },
];

// --- マーケ費用のマップ取得 ---
export function getMarketingCostMap(): Record<string, number> {
  const map: Record<string, number> = {};
  for (const mc of MARKETING_COSTS) {
    map[mc.month] = mc.cost;
  }
  return map;
}

// --- 媒体別の月次費用集計 ---
export function getMarketingBreakdownBySource(): Record<string, Record<string, number>> {
  const result: Record<string, Record<string, number>> = {};
  for (const mc of MARKETING_COSTS) {
    if (!mc.breakdown) continue;
    for (const [source, cost] of Object.entries(mc.breakdown)) {
      if (!result[source]) result[source] = {};
      result[source][mc.month] = cost;
    }
  }
  return result;
}
