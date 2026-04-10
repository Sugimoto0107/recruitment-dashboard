// ===================================
// データ処理関数
// Notionから取得した求職者データを月別指標・プロフィール分析に変換
// ===================================

import { RawJobSeeker } from "./notion";

// --- 月別CA指標 ---
export interface MonthlyCAMetrics {
  month: string;
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
}

// --- プロフィール分布 ---
export interface ProfileDistribution {
  label: string;
  count: number;
  percentage: number;
}

// --- 平均日数 ---
export interface AverageDays {
  entryToInterview: number | null; // エントリー→面談実施
  entryToAcceptance: number | null; // エントリー→内定承諾
}

// --- ダッシュボード全体のレスポンス型 ---
export interface DashboardData {
  isConnected: boolean;
  contractedCompanies: number;
  activeJobs: number;
  monthlyMetrics: MonthlyCAMetrics[];
  staffList: string[];
  staffMetrics: Record<string, MonthlyCAMetrics[]>;
  grandTotals: MonthlyCAMetrics;
  averageDays: AverageDays;
  staffAverageDays: Record<string, AverageDays>;
  prefectureData: ProfileDistribution[];
  ageGroupData: ProfileDistribution[];
  salaryRangeData: ProfileDistribution[];
}

// --- 日付差分をミリ秒→日に変換 ---
function daysBetween(dateA: string, dateB: string): number {
  const a = new Date(dateA);
  const b = new Date(dateB);
  return Math.abs(b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24);
}

// --- エントリー日から月文字列を取得 (YYYY-MM) ---
function toMonthKey(dateStr: string): string {
  return dateStr.slice(0, 7);
}

// --- 空の月別指標を生成 ---
function emptyMetrics(month: string): MonthlyCAMetrics {
  return {
    month,
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
  };
}

// --- 求職者リストから月別指標を算出 ---
export function computeMonthlyMetrics(seekers: RawJobSeeker[]): MonthlyCAMetrics[] {
  const monthMap = new Map<string, MonthlyCAMetrics>();

  for (const s of seekers) {
    if (!s.entryDate) continue;

    const monthKey = toMonthKey(s.entryDate);
    if (!monthMap.has(monthKey)) {
      monthMap.set(monthKey, emptyMetrics(monthKey));
    }
    const m = monthMap.get(monthKey)!;

    m.エントリー数 += 1;
    if (!s.isInvalid) {
      m.有効エントリー数 += 1;
    }
    if (s.interviewDone) {
      m.面談数 += 1;
    }
    m.推薦社数 += s.recommendations;
    m.面接設定数 += s.interviewSettings;
    m.面接実施数 += s.interviewsConducted;
    m.一次面接通過数 += s.firstInterviewPass;
    m.二次面接通過数 += s.secondInterviewPass;
    m.内定数 += s.offers;
    m.内定承諾数 += s.acceptances;
    m.入社数 += s.hires;
  }

  // 月順でソート
  return Array.from(monthMap.values()).sort((a, b) => a.month.localeCompare(b.month));
}

// --- 担当者別の月別指標を算出 ---
export function computeStaffMetrics(seekers: RawJobSeeker[]): {
  staffList: string[];
  staffMetrics: Record<string, MonthlyCAMetrics[]>;
} {
  // 担当者ごとにグループ化
  const staffGroups = new Map<string, RawJobSeeker[]>();
  for (const s of seekers) {
    const staff = s.staff || "未設定";
    if (!staffGroups.has(staff)) {
      staffGroups.set(staff, []);
    }
    staffGroups.get(staff)!.push(s);
  }

  const staffList = Array.from(staffGroups.keys()).sort();
  const staffMetrics: Record<string, MonthlyCAMetrics[]> = {};

  for (const [staff, group] of staffGroups) {
    staffMetrics[staff] = computeMonthlyMetrics(group);
  }

  return { staffList, staffMetrics };
}

// --- 累計（全期間合計）を算出 ---
export function computeGrandTotals(monthlyMetrics: MonthlyCAMetrics[]): MonthlyCAMetrics {
  const totals = emptyMetrics("累計");

  for (const m of monthlyMetrics) {
    totals.エントリー数 += m.エントリー数;
    totals.有効エントリー数 += m.有効エントリー数;
    totals.面談数 += m.面談数;
    totals.推薦社数 += m.推薦社数;
    totals.面接設定数 += m.面接設定数;
    totals.面接実施数 += m.面接実施数;
    totals.一次面接通過数 += m.一次面接通過数;
    totals.二次面接通過数 += m.二次面接通過数;
    totals.内定数 += m.内定数;
    totals.内定承諾数 += m.内定承諾数;
    totals.入社数 += m.入社数;
  }

  return totals;
}

// --- 平均日数を算出 ---
export function computeAverageDays(seekers: RawJobSeeker[]): AverageDays {
  // エントリー→面談実施の平均日数
  const interviewDays: number[] = [];
  for (const s of seekers) {
    if (s.entryDate && s.interviewDate && s.interviewDone) {
      interviewDays.push(daysBetween(s.entryDate, s.interviewDate));
    }
  }

  // エントリー→内定承諾の平均日数
  const acceptanceDays: number[] = [];
  for (const s of seekers) {
    if (s.entryDate && s.acceptanceDate && s.acceptances > 0) {
      acceptanceDays.push(daysBetween(s.entryDate, s.acceptanceDate));
    }
  }

  return {
    entryToInterview:
      interviewDays.length > 0
        ? Math.round((interviewDays.reduce((a, b) => a + b, 0) / interviewDays.length) * 10) / 10
        : null,
    entryToAcceptance:
      acceptanceDays.length > 0
        ? Math.round((acceptanceDays.reduce((a, b) => a + b, 0) / acceptanceDays.length) * 10) / 10
        : null,
  };
}

// --- 担当者別の平均日数を算出 ---
export function computeStaffAverageDays(seekers: RawJobSeeker[]): Record<string, AverageDays> {
  const staffGroups = new Map<string, RawJobSeeker[]>();
  for (const s of seekers) {
    const staff = s.staff || "未設定";
    if (!staffGroups.has(staff)) {
      staffGroups.set(staff, []);
    }
    staffGroups.get(staff)!.push(s);
  }

  const result: Record<string, AverageDays> = {};
  for (const [staff, group] of staffGroups) {
    result[staff] = computeAverageDays(group);
  }
  return result;
}

// --- 都道府県分布 ---
export function computePrefectureDistribution(seekers: RawJobSeeker[]): ProfileDistribution[] {
  const counts = new Map<string, number>();
  let total = 0;

  for (const s of seekers) {
    if (!s.entryDate) continue; // エントリー日がないものは除外
    const pref = s.prefecture || "不明";
    counts.set(pref, (counts.get(pref) ?? 0) + 1);
    total++;
  }

  return Array.from(counts.entries())
    .map(([label, count]) => ({
      label,
      count,
      percentage: total > 0 ? Math.round((count / total) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.count - a.count);
}

// --- 年代別分布 ---
export function computeAgeGroupDistribution(seekers: RawJobSeeker[]): ProfileDistribution[] {
  const groups: Record<string, number> = {
    "20代": 0,
    "30代": 0,
    "40代": 0,
    "50代以上": 0,
  };
  let total = 0;

  for (const s of seekers) {
    if (!s.entryDate || s.age === null) continue;
    total++;
    if (s.age < 30) {
      groups["20代"]++;
    } else if (s.age < 40) {
      groups["30代"]++;
    } else if (s.age < 50) {
      groups["40代"]++;
    } else {
      groups["50代以上"]++;
    }
  }

  return Object.entries(groups)
    .map(([label, count]) => ({
      label,
      count,
      percentage: total > 0 ? Math.round((count / total) * 1000) / 10 : 0,
    }))
    .filter((d) => d.count > 0);
}

// --- 年収帯別分布 ---
export function computeSalaryDistribution(seekers: RawJobSeeker[]): ProfileDistribution[] {
  const ranges: Record<string, number> = {
    "〜300万": 0,
    "300〜500万": 0,
    "500〜700万": 0,
    "700〜1000万": 0,
    "1000万〜": 0,
  };
  let total = 0;

  for (const s of seekers) {
    if (!s.entryDate || s.currentSalary === null) continue;
    total++;
    const salary = s.currentSalary;
    if (salary < 300) {
      ranges["〜300万"]++;
    } else if (salary < 500) {
      ranges["300〜500万"]++;
    } else if (salary < 700) {
      ranges["500〜700万"]++;
    } else if (salary < 1000) {
      ranges["700〜1000万"]++;
    } else {
      ranges["1000万〜"]++;
    }
  }

  return Object.entries(ranges)
    .map(([label, count]) => ({
      label,
      count,
      percentage: total > 0 ? Math.round((count / total) * 1000) / 10 : 0,
    }))
    .filter((d) => d.count > 0);
}

// --- 全データを統合して処理 ---
export function processAllData(
  seekers: RawJobSeeker[],
  contractedCompanies: number,
  activeJobs: number,
  isConnected: boolean
): DashboardData {
  const monthlyMetrics = computeMonthlyMetrics(seekers);
  const { staffList, staffMetrics } = computeStaffMetrics(seekers);
  const grandTotals = computeGrandTotals(monthlyMetrics);
  const averageDays = computeAverageDays(seekers);
  const staffAverageDays = computeStaffAverageDays(seekers);
  const prefectureData = computePrefectureDistribution(seekers);
  const ageGroupData = computeAgeGroupDistribution(seekers);
  const salaryRangeData = computeSalaryDistribution(seekers);

  return {
    isConnected,
    contractedCompanies,
    activeJobs,
    monthlyMetrics,
    staffList,
    staffMetrics,
    grandTotals,
    averageDays,
    staffAverageDays,
    prefectureData,
    ageGroupData,
    salaryRangeData,
  };
}
