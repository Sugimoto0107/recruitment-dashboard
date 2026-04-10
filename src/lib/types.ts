// ===================================
// 人材紹介ダッシュボード 型定義
// ===================================

// --- CA指標: 月別ファネルデータ ---
export interface MonthlyCAMetrics {
  month: string; // "2025-12", "2026-01" etc.
  エントリー数: number;
  有効エントリー数: number;
  面談数: number;
  推薦社数: number;
  面接設定数: number;
  面接実施数: number;
  一次面接通過数: number;
  二次面接通過数: number;
  内定数: number;
  内定承諾数: number;
  入社数: number;
  担当者: string; // "全体" or 担当者名
}

// --- CA指標のキー名リスト（表示順） ---
export const CA_METRIC_KEYS = [
  "エントリー数",
  "有効エントリー数",
  "面談数",
  "推薦社数",
  "面接設定数",
  "面接実施数",
  "一次面接通過数",
  "二次面接通過数",
  "内定数",
  "内定承諾数",
  "入社数",
] as const;

export type CAMetricKey = (typeof CA_METRIC_KEYS)[number];

// --- RA指標 ---
export interface RAMetrics {
  contractedCompanies: number;
  activeJobs: number;
  // 将来: 求人別の詳細データなど
}

// --- プロフィール分析 ---
export interface ProfileDistribution {
  label: string;
  count: number;
  percentage: number;
}

// --- マーケ費用 ---
export interface MonthlyMarketingCost {
  month: string;
  cost: number;
}
