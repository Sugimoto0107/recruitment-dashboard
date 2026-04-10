// ===================================
// データ設定ファイル
// Notionから自動取得できない指標や、マーケ費用はここで管理
// 将来的にNotion APIやスプレッドシートAPIに置き換え可能
// ===================================

import { MonthlyCAMetrics, MonthlyMarketingCost, ProfileDistribution } from "./types";

// --- CA月別指標データ ---
// 担当者: "全体" は全担当者の合計
// 担当者別に分けたい場合は、同じmonthで担当者名を変えて追加
// ※ここのデータは後でNotion APIから自動取得に切り替え可能
export const caMetricsData: MonthlyCAMetrics[] = [
  // === 2025年12月 ===
  {
    month: "2025-12",
    エントリー数: 0,
    有効エントリー数: 0,
    面談数: 0,
    推薦社数: 0,
    面接設定数: 0,
    面接実施数: 0,
    一次面接通過数: 0,
    二次面接通過数: 0,
    内定数: 0,
    内定承諾数: 0,
    入社数: 0,
    担当者: "全体",
  },
  // === 2026年1月 ===
  {
    month: "2026-01",
    エントリー数: 0,
    有効エントリー数: 0,
    面談数: 0,
    推薦社数: 0,
    面接設定数: 0,
    面接実施数: 0,
    一次面接通過数: 0,
    二次面接通過数: 0,
    内定数: 0,
    内定承諾数: 0,
    入社数: 0,
    担当者: "全体",
  },
  // === 2026年2月 ===
  {
    month: "2026-02",
    エントリー数: 0,
    有効エントリー数: 0,
    面談数: 0,
    推薦社数: 0,
    面接設定数: 0,
    面接実施数: 0,
    一次面接通過数: 0,
    二次面接通過数: 0,
    内定数: 0,
    内定承諾数: 0,
    入社数: 0,
    担当者: "全体",
  },
  // === 2026年3月 ===
  {
    month: "2026-03",
    エントリー数: 0,
    有効エントリー数: 0,
    面談数: 0,
    推薦社数: 0,
    面接設定数: 0,
    面接実施数: 0,
    一次面接通過数: 0,
    二次面接通過数: 0,
    内定数: 0,
    内定承諾数: 0,
    入社数: 0,
    担当者: "全体",
  },
  // === 2026年4月 ===
  {
    month: "2026-04",
    エントリー数: 0,
    有効エントリー数: 0,
    面談数: 0,
    推薦社数: 0,
    面接設定数: 0,
    面接実施数: 0,
    一次面接通過数: 0,
    二次面接通過数: 0,
    内定数: 0,
    内定承諾数: 0,
    入社数: 0,
    担当者: "全体",
  },
  // --- 担当者別のサンプル（必要に応じて追加） ---
  // {
  //   month: "2026-01",
  //   エントリー数: 5,
  //   有効エントリー数: 4,
  //   面談数: 3,
  //   ...
  //   担当者: "田中",
  // },
];

// --- マーケ費用データ（スプレッドシートKPIシートから転記） ---
export const marketingCostData: MonthlyMarketingCost[] = [
  { month: "2025-12", cost: 682000 },
  { month: "2026-01", cost: 1483000 },
  { month: "2026-02", cost: 273745 },
  { month: "2026-03", cost: 280000 },
  { month: "2026-04", cost: 0 },
];

// --- プロフィールデータ（スプレッドシートから転記、またはNotion APIから取得） ---
// ※後でNotionの求職者管理DBから自動算出に切り替え可能

export const prefectureData: ProfileDistribution[] = [
  { label: "東京都", count: 61, percentage: 55.5 },
  { label: "神奈川県", count: 23, percentage: 20.9 },
  { label: "埼玉県", count: 15, percentage: 13.6 },
  { label: "千葉県", count: 8, percentage: 7.3 },
  { label: "大阪府", count: 1, percentage: 0.9 },
  { label: "奈良県", count: 1, percentage: 0.9 },
  { label: "岩手県", count: 1, percentage: 0.9 },
];

export const ageGroupData: ProfileDistribution[] = [
  { label: "20代", count: 36, percentage: 26.5 },
  { label: "30代", count: 55, percentage: 40.4 },
  { label: "40代", count: 21, percentage: 15.4 },
  { label: "50代", count: 17, percentage: 12.5 },
  { label: "60代以上", count: 7, percentage: 5.1 },
];

export const salaryRangeData: ProfileDistribution[] = [
  { label: "〜400万円", count: 5, percentage: 5.1 },
  { label: "400万円台", count: 10, percentage: 10.1 },
  { label: "500万円台", count: 18, percentage: 18.2 },
  { label: "600万円台", count: 25, percentage: 25.3 },
  { label: "700万円台", count: 12, percentage: 12.1 },
  { label: "800万円台", count: 8, percentage: 8.1 },
  { label: "900万円台", count: 3, percentage: 3.0 },
  { label: "1,000万円〜", count: 4, percentage: 4.0 },
];

// --- 担当者リスト（フィルター用） ---
export const staffList = ["全体"];
// 担当者が増えたら追加: ["全体", "田中", "鈴木", ...]
