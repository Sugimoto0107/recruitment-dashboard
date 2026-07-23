// ===================================
// データ処理関数
// Notionから取得した生データをダッシュボード表示用の指標に変換
// ===================================

import {
  RawJobSeeker,
  RawApplication,
  CompanyRecord,
  CompanySummary,
  JobSummary,
  APPLICATION_PHASES,
} from "./notion";

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
  // 推薦以降の各フェーズの「ユニーク実人数」（応募件数に対する重複を除いた求職者数）
  unique?: Record<string, number>;
}

// 推薦以降のフェーズキー（ユニーク人数を併記する対象）
export const RECOMMEND_ONWARD_KEYS = [
  "推薦社数",
  "面接設定数",
  "面接実施数",
  "一次面接通過数",
  "二次面接通過数",
  "内定数",
  "内定承諾数",
  "入社数",
] as const;

// --- プロフィール分布 ---
export interface ProfileDistribution {
  label: string;
  count: number;
  percentage: number;
}

// --- 平均日数 ---
export interface AverageDays {
  entryToInterview: number | null;
  entryToAcceptance: number | null;
  interviewToFirstRecommend: number | null;
  entryToOffer: number | null;
  entryToHire: number | null;
}

// --- 月別平均日数の集計元データ（月フィルター用）---
export interface AverageDaysRaw {
  interviewSum: number; interviewCount: number;
  acceptanceSum: number; acceptanceCount: number;
  interviewToRecommendSum: number; interviewToRecommendCount: number;
  entryToOfferSum: number; entryToOfferCount: number;
  entryToHireSum: number; entryToHireCount: number;
}

// --- 応募ファネル指標 ---
export interface ApplicationFunnel {
  totalApplications: number;
  byPhase: Record<string, number>;
  recommended: number;
  firstInterview: number;
  secondInterview: number;
  finalInterview: number;
  offers: number;
  acceptances: number;
  joins: number;
  documentNg: number;
  interviewNg: number;
  declines: number;
  // 各フェーズの「ユニーク実人数」（重複を除いた求職者数）
  unique: {
    recommended: number;
    firstInterview: number;
    secondInterview: number;
    finalInterview: number;
    offers: number;
    acceptances: number;
    joins: number;
  };
}

// --- 内定到達有無による候補者比較（応募管理ベースで候補者単位に集計）---
export interface OfferGroupStat {
  count: number;
  avgRecommendations: number;
  avgFirstInterview: number;
}
export interface OfferComparison {
  offer: OfferGroupStat;
  noOffer: OfferGroupStat;
}

// --- 選考中・内定承諾待ちのリストアイテム ---
export interface InProgressItem {
  applicationId: string;
  phase: string;
  candidateName: string;
  companyName: string;
  scheduledDate: string | null;
}

export interface InProgressBuckets {
  書類選考: InProgressItem[];
  一次面接: InProgressItem[];
  二次面接: InProgressItem[];
  最終面接: InProgressItem[];
  内定: InProgressItem[];
}

// --- 求職者サマリー (個別表示) ---
export interface JobSeekerSummary {
  id: string;
  name: string;
  age: number | null;
  candidateNo: string;
  staff: string;
  entryDate: string | null;
  interviewDate: string | null;
  finalResult: string;
  source: string;
  isFood: boolean;
  gender: string;
  education: string;
  jobChangeCount: number | null;
  recommendations: number;
  interviewSettings: number;
  interviewsConducted: number;
  firstInterviewPass: number;
  secondInterviewExecuted: number;
  secondInterviewPass: number;
  finalInterviewExecuted: number;
  offers: number;
  acceptances: number;
  acceptanceDate: string | null;
  hires: number;
  hireDate: string | null;
}

// --- 内定承諾日ベース月別集計 ---
export interface MonthlyAcceptanceData {
  month: string;
  count: number;
  revenue: number;
}

// --- 入社想定日ベース月別集計 ---
export interface MonthlyJoinForecastData {
  month: string;
  count: number;
  revenue: number;
}

// --- 発話比率CA 月別・担当者別平均 ---
export interface MonthlySpeakingRatioData {
  months: string[];
  staffList: string[];
  byStaff: Record<string, Record<string, { avg: number; count: number }>>;
  overall: Record<string, { avg: number; count: number }>;
}

// --- ダッシュボード全体のレスポンス型 ---
export interface DashboardData {
  isConnected: boolean;
  generatedAt: string;
  // RA: 契約企業 / 求人
  companySummary: CompanySummary;
  jobSummary: JobSummary;
  // 後方互換
  contractedCompanies: number;
  activeJobs: number;
  // CA: 月別・担当者別・流入経路別・(担当者×流入経路)
  monthlyMetrics: MonthlyCAMetrics[];
  staffList: string[];
  staffMetrics: Record<string, MonthlyCAMetrics[]>;
  sourceList: string[];
  sourceMetrics: Record<string, MonthlyCAMetrics[]>;
  // 担当者×流入経路 の 2D 集計 (担当者と流入経路の併用フィルタ用)
  staffSourceMetrics: Record<string, Record<string, MonthlyCAMetrics[]>>;
  grandTotals: MonthlyCAMetrics;
  averageDays: AverageDays;
  staffAverageDays: Record<string, AverageDays>;
  sourceAverageDays: Record<string, AverageDays>;
  monthlyAverageDaysRaw: Record<string, AverageDaysRaw>;
  // プロフィール分析（全体 + 飲食別）
  prefectureData: ProfileDistribution[];
  ageGroupData: ProfileDistribution[];
  salaryRangeData: ProfileDistribution[];
  profileNonFood: ProfileGroup;
  profileFood: ProfileGroup;
  // 応募ファネル
  applicationFunnel: ApplicationFunnel;
  offerComparison: OfferComparison;
  inProgress: InProgressBuckets;
  // 求職者個別
  jobSeekerSummaries: JobSeekerSummary[];
  // 発話比率CA 月別・担当者別平均
  monthlySpeakingRatio: MonthlySpeakingRatioData;
  // プロフィール分析 流入経路別
  profileNonFoodBySource: Record<string, ProfileGroup>;
  profileFoodBySource: Record<string, ProfileGroup>;
  // 応募管理DBベース: 内定承諾日・入社想定日別集計（全体＋流入経路別＋担当者別＋2D）
  monthlyAcceptances: MonthlyAcceptanceData[];
  monthlyJoinForecast: MonthlyJoinForecastData[];
  monthlyAcceptancesBySource: Record<string, MonthlyAcceptanceData[]>;
  monthlyJoinForecastBySource: Record<string, MonthlyJoinForecastData[]>;
  monthlyAcceptancesByStaff: Record<string, MonthlyAcceptanceData[]>;
  monthlyJoinForecastByStaff: Record<string, MonthlyJoinForecastData[]>;
  monthlyAcceptancesByStaffSource: Record<string, Record<string, MonthlyAcceptanceData[]>>;
  monthlyJoinForecastByStaffSource: Record<string, Record<string, MonthlyJoinForecastData[]>>;
  // 売上見込みFY分割用（入社想定日優先・無ければ内定承諾日で概算）
  monthlyForFY: MonthlyJoinForecastData[];
  monthlyForFYBySource: Record<string, MonthlyJoinForecastData[]>;
  monthlyForFYByStaff: Record<string, MonthlyJoinForecastData[]>;
  monthlyForFYByStaffSource: Record<string, Record<string, MonthlyJoinForecastData[]>>;
}

// =============================================================
// ヘルパー
// =============================================================
function daysBetween(dateA: string, dateB: string): number {
  const a = new Date(dateA);
  const b = new Date(dateB);
  return Math.abs(b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24);
}

function toMonthKey(dateStr: string): string {
  return dateStr.slice(0, 7);
}

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
    unique: {},
  };
}

// =============================================================
// 月別 CA 指標
// =============================================================
export function computeMonthlyMetrics(
  seekers: RawJobSeeker[],
  apps: RawApplication[] = []
): MonthlyCAMetrics[] {
  const monthMap = new Map<string, MonthlyCAMetrics>();
  // 月別・フェーズ別の「重複を除いた求職者ID集合」
  const uniqueSets = new Map<string, Record<string, Set<string>>>();
  const seekerById = new Map(seekers.map((s) => [s.id, s]));

  const ensure = (monthKey: string): MonthlyCAMetrics => {
    if (!monthMap.has(monthKey)) {
      monthMap.set(monthKey, emptyMetrics(monthKey));
      const sets: Record<string, Set<string>> = {};
      for (const k of RECOMMEND_ONWARD_KEYS) sets[k] = new Set<string>();
      uniqueSets.set(monthKey, sets);
    }
    return monthMap.get(monthKey)!;
  };

  for (const s of seekers) {
    if (!s.entryDate) continue;

    const monthKey = toMonthKey(s.entryDate);
    const m = ensure(monthKey);
    const sets = uniqueSets.get(monthKey)!;

    m.エントリー数 += 1;
    if (!s.isInvalid) {
      m.有効エントリー数 += 1;
    }
    if (s.interviewDone) {
      m.面談数 += 1;
    }
    // 推薦社数は応募管理DB(apps)から別途集計する（求職者管理DBの手入力は使わない）
    m.面接設定数 += s.interviewSettings;
    m.面接実施数 += s.interviewsConducted;
    m.一次面接通過数 += s.firstInterviewPass;
    m.二次面接通過数 += s.secondInterviewPass;
    m.内定数 += s.offers;
    m.内定承諾数 += s.acceptances;
    m.入社数 += s.hires;

    // 推薦以降（推薦除く）のユニーク実人数: 各フィールド>0の求職者を1人としてカウント
    if (s.interviewSettings > 0) sets.面接設定数.add(s.id);
    if (s.interviewsConducted > 0) sets.面接実施数.add(s.id);
    if (s.firstInterviewPass > 0) sets.一次面接通過数.add(s.id);
    if (s.secondInterviewPass > 0) sets.二次面接通過数.add(s.id);
    if (s.offers > 0) sets.内定数.add(s.id);
    if (s.acceptances > 0) sets.内定承諾数.add(s.id);
    if (s.hires > 0) sets.入社数.add(s.id);
  }

  // 推薦数（応募管理ベース）: 推薦済み応募(推薦日時 or フェーズあり)を、その求職者のエントリー月に計上。
  // 集計数=応募件数（求職者×企業）、ユニーク=重複を除いた求職者数。
  for (const a of apps) {
    if (!(a.recommendDate || a.phase)) continue;
    for (const sid of a.seekerIds) {
      const s = seekerById.get(sid);
      if (!s || !s.entryDate) continue;
      const monthKey = toMonthKey(s.entryDate);
      const m = ensure(monthKey);
      m.推薦社数 += 1;
      uniqueSets.get(monthKey)!.推薦社数.add(sid);
      break; // 1応募につき1回（seekerIdsは通常1件）
    }
  }

  const result = Array.from(monthMap.values());
  for (const m of result) {
    const sets = uniqueSets.get(m.month)!;
    const unique: Record<string, number> = {};
    for (const k of RECOMMEND_ONWARD_KEYS) unique[k] = sets[k].size;
    m.unique = unique;
  }
  return result.sort((a, b) => a.month.localeCompare(b.month));
}

export function computeStaffMetrics(
  seekers: RawJobSeeker[],
  apps: RawApplication[] = []
): {
  staffList: string[];
  staffMetrics: Record<string, MonthlyCAMetrics[]>;
} {
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
    staffMetrics[staff] = computeMonthlyMetrics(group, apps);
  }

  return { staffList, staffMetrics };
}

export function computeGrandTotals(
  monthlyMetrics: MonthlyCAMetrics[]
): MonthlyCAMetrics {
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
    // ユニーク人数も合算（各求職者はエントリー月1つに属するため月別の単純加算で総ユニーク数になる）
    for (const k of RECOMMEND_ONWARD_KEYS) {
      totals.unique![k] = (totals.unique![k] ?? 0) + (m.unique?.[k] ?? 0);
    }
  }

  return totals;
}

// 応募データから求職者ごとの最早日付を構築
function buildSeekerAppDates(apps: RawApplication[]): Map<string, {
  firstRecommendDate: string | null;
  earliestOfferDate: string | null;
  earliestAcceptanceDate: string | null;
}> {
  const map = new Map<string, { firstRecommendDate: string | null; earliestOfferDate: string | null; earliestAcceptanceDate: string | null }>();
  for (const app of apps) {
    for (const seekerId of app.seekerIds) {
      if (!map.has(seekerId)) {
        map.set(seekerId, { firstRecommendDate: null, earliestOfferDate: null, earliestAcceptanceDate: null });
      }
      const d = map.get(seekerId)!;
      if (app.recommendDate && (!d.firstRecommendDate || app.recommendDate < d.firstRecommendDate)) {
        d.firstRecommendDate = app.recommendDate;
      }
      if (app.offerDate && (!d.earliestOfferDate || app.offerDate < d.earliestOfferDate)) {
        d.earliestOfferDate = app.offerDate;
      }
      if (app.acceptanceDate && (!d.earliestAcceptanceDate || app.acceptanceDate < d.earliestAcceptanceDate)) {
        d.earliestAcceptanceDate = app.acceptanceDate;
      }
    }
  }
  return map;
}

const nullAvgDays = (): AverageDays => ({
  entryToInterview: null, entryToAcceptance: null,
  interviewToFirstRecommend: null, entryToOffer: null, entryToHire: null,
});

export function computeAverageDays(seekers: RawJobSeeker[], applications: RawApplication[]): AverageDays {
  const appDates = buildSeekerAppDates(applications);
  const interviewDays: number[] = [];
  const acceptanceDays: number[] = [];
  const interviewToRecommendDays: number[] = [];
  const entryToOfferDays: number[] = [];
  const entryToHireDays: number[] = [];

  for (const s of seekers) {
    const d = appDates.get(s.id);
    if (s.entryDate && s.interviewDate && s.interviewDone) {
      interviewDays.push(daysBetween(s.entryDate, s.interviewDate));
    }
    if (s.entryDate && d?.earliestAcceptanceDate) {
      acceptanceDays.push(daysBetween(s.entryDate, d.earliestAcceptanceDate));
    }
    if (s.interviewDate && s.interviewDone && d?.firstRecommendDate) {
      interviewToRecommendDays.push(daysBetween(s.interviewDate, d.firstRecommendDate));
    }
    if (s.entryDate && d?.earliestOfferDate) {
      entryToOfferDays.push(daysBetween(s.entryDate, d.earliestOfferDate));
    }
    if (s.entryDate && s.hireDate) {
      entryToHireDays.push(daysBetween(s.entryDate, s.hireDate));
    }
  }

  const avg = (arr: number[]) =>
    arr.length > 0 ? Math.round((arr.reduce((a, b) => a + b, 0) / arr.length) * 10) / 10 : null;

  return {
    entryToInterview: avg(interviewDays),
    entryToAcceptance: avg(acceptanceDays),
    interviewToFirstRecommend: avg(interviewToRecommendDays),
    entryToOffer: avg(entryToOfferDays),
    entryToHire: avg(entryToHireDays),
  };
}

export function computeMonthlyAverageDaysRaw(
  seekers: RawJobSeeker[],
  applications: RawApplication[]
): Record<string, AverageDaysRaw> {
  const appDates = buildSeekerAppDates(applications);
  const result: Record<string, AverageDaysRaw> = {};

  const getOrCreate = (month: string): AverageDaysRaw => {
    if (!result[month]) {
      result[month] = {
        interviewSum: 0, interviewCount: 0,
        acceptanceSum: 0, acceptanceCount: 0,
        interviewToRecommendSum: 0, interviewToRecommendCount: 0,
        entryToOfferSum: 0, entryToOfferCount: 0,
        entryToHireSum: 0, entryToHireCount: 0,
      };
    }
    return result[month];
  };

  for (const s of seekers) {
    if (!s.entryDate) continue;
    const month = toMonthKey(s.entryDate);
    const raw = getOrCreate(month);
    const d = appDates.get(s.id);

    if (s.interviewDate && s.interviewDone) {
      raw.interviewSum += daysBetween(s.entryDate, s.interviewDate);
      raw.interviewCount++;
    }
    if (d?.earliestAcceptanceDate) {
      raw.acceptanceSum += daysBetween(s.entryDate, d.earliestAcceptanceDate);
      raw.acceptanceCount++;
    }
    if (s.interviewDate && s.interviewDone && d?.firstRecommendDate) {
      raw.interviewToRecommendSum += daysBetween(s.interviewDate, d.firstRecommendDate);
      raw.interviewToRecommendCount++;
    }
    if (d?.earliestOfferDate) {
      raw.entryToOfferSum += daysBetween(s.entryDate, d.earliestOfferDate);
      raw.entryToOfferCount++;
    }
    if (s.hireDate) {
      raw.entryToHireSum += daysBetween(s.entryDate, s.hireDate);
      raw.entryToHireCount++;
    }
  }

  return result;
}

export function computeStaffAverageDays(
  seekers: RawJobSeeker[],
  applications: RawApplication[]
): Record<string, AverageDays> {
  const staffGroups = new Map<string, RawJobSeeker[]>();
  for (const s of seekers) {
    const staff = s.staff || "未設定";
    if (!staffGroups.has(staff)) staffGroups.set(staff, []);
    staffGroups.get(staff)!.push(s);
  }
  const result: Record<string, AverageDays> = {};
  for (const [staff, group] of staffGroups) {
    result[staff] = computeAverageDays(group, applications);
  }
  return result;
}

// =============================================================
// 流入経路別 CA 指標
// =============================================================
export function computeSourceMetrics(
  seekers: RawJobSeeker[],
  apps: RawApplication[] = []
): {
  sourceList: string[];
  sourceMetrics: Record<string, MonthlyCAMetrics[]>;
} {
  const groups = new Map<string, RawJobSeeker[]>();
  for (const s of seekers) {
    const src = s.source || "未設定";
    if (!groups.has(src)) {
      groups.set(src, []);
    }
    groups.get(src)!.push(s);
  }

  const sourceList = Array.from(groups.keys()).sort();
  const sourceMetrics: Record<string, MonthlyCAMetrics[]> = {};
  for (const [src, group] of groups) {
    sourceMetrics[src] = computeMonthlyMetrics(group, apps);
  }
  return { sourceList, sourceMetrics };
}

export function computeSourceAverageDays(
  seekers: RawJobSeeker[],
  applications: RawApplication[]
): Record<string, AverageDays> {
  const groups = new Map<string, RawJobSeeker[]>();
  for (const s of seekers) {
    const src = s.source || "未設定";
    if (!groups.has(src)) groups.set(src, []);
    groups.get(src)!.push(s);
  }
  const result: Record<string, AverageDays> = {};
  for (const [src, group] of groups) {
    result[src] = computeAverageDays(group, applications);
  }
  return result;
}

// =============================================================
// 担当者 × 流入経路 の 2D 集計 (併用フィルタ用)
// =============================================================
export function computeStaffSourceMetrics(
  seekers: RawJobSeeker[],
  apps: RawApplication[] = []
): Record<string, Record<string, MonthlyCAMetrics[]>> {
  const groups = new Map<string, Map<string, RawJobSeeker[]>>();
  for (const s of seekers) {
    const staff = s.staff || "未設定";
    const src = s.source || "未設定";
    if (!groups.has(staff)) groups.set(staff, new Map());
    const staffMap = groups.get(staff)!;
    if (!staffMap.has(src)) staffMap.set(src, []);
    staffMap.get(src)!.push(s);
  }

  const result: Record<string, Record<string, MonthlyCAMetrics[]>> = {};
  for (const [staff, staffMap] of groups) {
    result[staff] = {};
    for (const [src, list] of staffMap) {
      result[staff][src] = computeMonthlyMetrics(list, apps);
    }
  }
  return result;
}

// =============================================================
// プロフィール分布
// =============================================================
export function computePrefectureDistribution(
  seekers: RawJobSeeker[]
): ProfileDistribution[] {
  const counts = new Map<string, number>();
  let total = 0;

  for (const s of seekers) {
    if (!s.entryDate) continue;
    // 値無しは除外 (3つのチャートで分母を揃える方針)
    if (!s.prefecture) continue;
    counts.set(s.prefecture, (counts.get(s.prefecture) ?? 0) + 1);
    total++;
  }

  return Array.from(counts.entries())
    .map(([label, count]) => ({
      label,
      count,
      percentage:
        total > 0 ? Math.round((count / total) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.count - a.count);
}

export function computeAgeGroupDistribution(
  seekers: RawJobSeeker[]
): ProfileDistribution[] {
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

  const ageOrder = ["20代", "30代", "40代", "50代以上"];
  return ageOrder
    .map((label) => ({
      label,
      count: groups[label],
      percentage:
        total > 0 ? Math.round((groups[label] / total) * 1000) / 10 : 0,
    }))
    .filter((d) => d.count > 0);
}

export function computeSalaryDistribution(
  seekers: RawJobSeeker[]
): ProfileDistribution[] {
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
    // Notion 側の「現職年収」は円単位で入力されているため、万円単位 (÷10000) に変換
    const salary = s.currentSalary / 10000;
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

  const salaryOrder = [
    "〜300万",
    "300〜500万",
    "500〜700万",
    "700〜1000万",
    "1000万〜",
  ];
  return salaryOrder
    .map((label) => ({
      label,
      count: ranges[label],
      percentage:
        total > 0 ? Math.round((ranges[label] / total) * 1000) / 10 : 0,
    }))
    .filter((d) => d.count > 0);
}

export function computeGenderDistribution(
  seekers: RawJobSeeker[]
): ProfileDistribution[] {
  const counts = new Map<string, number>();
  let total = 0;
  for (const s of seekers) {
    if (!s.entryDate || !s.gender) continue;
    counts.set(s.gender, (counts.get(s.gender) ?? 0) + 1);
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

export function computeEducationDistribution(
  seekers: RawJobSeeker[]
): ProfileDistribution[] {
  const counts = new Map<string, number>();
  let total = 0;
  for (const s of seekers) {
    if (!s.entryDate || !s.education) continue;
    counts.set(s.education, (counts.get(s.education) ?? 0) + 1);
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

export function computeJobChangeDistribution(
  seekers: RawJobSeeker[]
): ProfileDistribution[] {
  const ranges: Record<string, number> = {
    "0回": 0,
    "1〜2回": 0,
    "3〜5回": 0,
    "6回以上": 0,
  };
  let total = 0;
  for (const s of seekers) {
    if (!s.entryDate || s.jobChangeCount === null) continue;
    total++;
    if (s.jobChangeCount === 0) ranges["0回"]++;
    else if (s.jobChangeCount <= 2) ranges["1〜2回"]++;
    else if (s.jobChangeCount <= 5) ranges["3〜5回"]++;
    else ranges["6回以上"]++;
  }
  const order = ["0回", "1〜2回", "3〜5回", "6回以上"];
  return order
    .map((label) => ({
      label,
      count: ranges[label],
      percentage: total > 0 ? Math.round((ranges[label] / total) * 1000) / 10 : 0,
    }))
    .filter((d) => d.count > 0);
}

export interface ProfileGroup {
  count: number;
  prefectureData: ProfileDistribution[];
  ageGroupData: ProfileDistribution[];
  salaryRangeData: ProfileDistribution[];
  genderData: ProfileDistribution[];
  educationData: ProfileDistribution[];
  jobChangeData: ProfileDistribution[];
}

function buildProfileGroup(ss: RawJobSeeker[]): ProfileGroup {
  return {
    count: ss.filter((s) => !!s.entryDate).length,
    prefectureData: computePrefectureDistribution(ss),
    ageGroupData: computeAgeGroupDistribution(ss),
    salaryRangeData: computeSalaryDistribution(ss),
    genderData: computeGenderDistribution(ss),
    educationData: computeEducationDistribution(ss),
    jobChangeData: computeJobChangeDistribution(ss),
  };
}

// =============================================================
// 応募ファネル
// =============================================================
// 内定到達有無による候補者比較（応募管理を候補者単位に集計）
// ※求職者管理のロールアップ（推薦社数など）は未整備のため使わず、応募から直接集計してファネルと整合させる
export function computeOfferComparison(
  apps: RawApplication[]
): OfferComparison {
  const PASSED_FIRST = new Set([
    "一次面接","不採用（一次面接NG）","二次面接","不採用（二次面接NG）",
    "最終面接","不採用（最終面接NG）","内定","内定承諾","入社",
  ]);
  const PASSED_OFFER = new Set(["内定","内定承諾","入社"]);

  // 候補者(seeker)単位に: 推薦数(rec) / 一次面接実施数(first) / 内定到達(offer)
  const bySeeker = new Map<string, { rec: number; first: number; offer: boolean }>();
  for (const a of apps) {
    const seekerId = a.seekerIds[0];
    if (!seekerId) continue; // 求職者未紐付けの応募は除外
    let s = bySeeker.get(seekerId);
    if (!s) { s = { rec: 0, first: 0, offer: false }; bySeeker.set(seekerId, s); }
    s.rec += 1;
    if (a.firstInterviewDate || (a.phase && PASSED_FIRST.has(a.phase))) s.first += 1;
    if (a.offerDate || (a.phase && PASSED_OFFER.has(a.phase))) s.offer = true;
  }

  const agg = (want: boolean): OfferGroupStat => {
    let count = 0, sumRec = 0, sumFirst = 0;
    for (const v of bySeeker.values()) {
      if (v.offer !== want) continue;
      count++; sumRec += v.rec; sumFirst += v.first;
    }
    return {
      count,
      avgRecommendations: count ? sumRec / count : 0,
      avgFirstInterview: count ? sumFirst / count : 0,
    };
  };

  return { offer: agg(true), noOffer: agg(false) };
}

export function computeApplicationFunnel(
  apps: RawApplication[]
): ApplicationFunnel {
  const byPhase: Record<string, number> = {};
  for (const phase of APPLICATION_PHASES) byPhase[phase] = 0;

  let recommended = 0;
  let firstInterview = 0;
  let secondInterview = 0;
  let finalInterview = 0;
  let offers = 0;
  let acceptances = 0;
  let joins = 0;
  let documentNg = 0;
  let interviewNg = 0;
  let declines = 0;

  // フェーズからそのステップ以上に達したかを判定（日付未入力でも動作）
  const PASSED_FIRST  = new Set(["一次面接","不採用（一次面接NG）","二次面接","不採用（二次面接NG）","最終面接","不採用（最終面接NG）","内定","内定承諾","入社"]);
  const PASSED_SECOND = new Set(["二次面接","不採用（二次面接NG）","最終面接","不採用（最終面接NG）","内定","内定承諾","入社"]);
  const PASSED_FINAL  = new Set(["最終面接","不採用（最終面接NG）","内定","内定承諾","入社"]);
  const PASSED_OFFER  = new Set(["内定","内定承諾","入社"]);
  const PASSED_ACCEPT = new Set(["内定承諾","入社"]);

  // フェーズごとの「重複を除いた求職者ID集合」（ユニーク実人数用）
  const uRec = new Set<string>();
  const uFirst = new Set<string>();
  const uSecond = new Set<string>();
  const uFinal = new Set<string>();
  const uOffer = new Set<string>();
  const uAccept = new Set<string>();
  const uJoin = new Set<string>();
  const addAll = (set: Set<string>, ids: string[]) => { for (const id of ids) set.add(id); };

  for (const a of apps) {
    if (a.phase) {
      byPhase[a.phase] = (byPhase[a.phase] ?? 0) + 1;
    }
    const ids = a.seekerIds;
    // 日付があれば日付を優先、なければフェーズで推算（累積カウント）
    if (a.recommendDate || a.phase) { recommended += 1; addAll(uRec, ids); }
    if (a.firstInterviewDate  || (a.phase && PASSED_FIRST.has(a.phase)))  { firstInterview += 1; addAll(uFirst, ids); }
    if (a.secondInterviewDate || (a.phase && PASSED_SECOND.has(a.phase))) { secondInterview += 1; addAll(uSecond, ids); }
    if (a.finalInterviewDate  || (a.phase && PASSED_FINAL.has(a.phase)))  { finalInterview += 1; addAll(uFinal, ids); }
    if (a.offerDate           || (a.phase && PASSED_OFFER.has(a.phase)))  { offers += 1; addAll(uOffer, ids); }
    if (a.acceptanceDate      || (a.phase && PASSED_ACCEPT.has(a.phase))) { acceptances += 1; addAll(uAccept, ids); }
    if (a.phase === "入社") { joins += 1; addAll(uJoin, ids); }
    if (a.documentNgDate) documentNg += 1;
    if (a.interviewNgDate) interviewNg += 1;
    if (a.declineDate) declines += 1;
  }

  return {
    totalApplications: apps.length,
    byPhase,
    recommended,
    firstInterview,
    secondInterview,
    finalInterview,
    offers,
    acceptances,
    joins,
    documentNg,
    interviewNg,
    declines,
    unique: {
      recommended: uRec.size,
      firstInterview: uFirst.size,
      secondInterview: uSecond.size,
      finalInterview: uFinal.size,
      offers: uOffer.size,
      acceptances: uAccept.size,
      joins: uJoin.size,
    },
  };
}

// =============================================================
// 選考中 / 内定承諾待ちの個別リスト
// =============================================================
export function computeInProgress(
  apps: RawApplication[],
  seekers: RawJobSeeker[],
  companies: CompanyRecord[]
): InProgressBuckets {
  const seekerById = new Map(seekers.map((s) => [s.id, s]));
  const companyById = new Map(companies.map((c) => [c.id, c]));

  const buckets: InProgressBuckets = {
    書類選考: [],
    一次面接: [],
    二次面接: [],
    最終面接: [],
    内定: [],
  };

  // 件名「氏名 × 社名（フェーズ）」から氏名・社名を抽出（リレーション未設定時のフォールバック）
  function parseTitle(title: string): { name: string; company: string } {
    // 末尾の（...）/(...) を除去
    const stripped = title.replace(/[（(][^（()）]*[）)]\s*$/, "").trim();
    const parts = stripped.split(/\s*[×✕Ｘｘ]\s*|\s+[xX]\s+/);
    if (parts.length >= 2) {
      return {
        name: parts[0].trim(),
        company: parts.slice(1).join("×").trim(),
      };
    }
    return { name: stripped, company: "" };
  }

  function buildItem(
    a: RawApplication,
    scheduledDate: string | null
  ): InProgressItem {
    const candidate = a.seekerIds
      .map((id) => seekerById.get(id))
      .find((s) => !!s);
    const company = a.companyIds
      .map((id) => companyById.get(id))
      .find((c) => !!c);
    const fromTitle = parseTitle(a.title ?? "");
    return {
      applicationId: a.id,
      phase: a.phase ?? "",
      candidateName: candidate?.name || fromTitle.name || "(未設定)",
      companyName: company?.name || fromTitle.company || "(未設定)",
      scheduledDate,
    };
  }

  for (const a of apps) {
    if (!a.phase) continue;
    switch (a.phase) {
      case "書類選考":
        buckets.書類選考.push(buildItem(a, a.recommendDate));
        break;
      case "一次面接":
        buckets.一次面接.push(
          buildItem(a, a.firstInterviewDate ?? a.firstInterviewSetDate)
        );
        break;
      case "二次面接":
        buckets.二次面接.push(buildItem(a, a.secondInterviewDate));
        break;
      case "最終面接":
        buckets.最終面接.push(buildItem(a, a.finalInterviewDate));
        break;
      case "内定":
        buckets.内定.push(buildItem(a, a.offerDate));
        break;
      default:
        break;
    }
  }

  const sortByDate = (a: InProgressItem, b: InProgressItem) => {
    const aDate = a.scheduledDate ?? "9999-12-31";
    const bDate = b.scheduledDate ?? "9999-12-31";
    return aDate.localeCompare(bDate);
  };
  buckets.書類選考.sort(sortByDate);
  buckets.一次面接.sort(sortByDate);
  buckets.二次面接.sort(sortByDate);
  buckets.最終面接.sort(sortByDate);
  buckets.内定.sort(sortByDate);

  return buckets;
}

// =============================================================
// 求職者サマリー (個別)
// =============================================================
export function buildJobSeekerSummaries(
  seekers: RawJobSeeker[]
): JobSeekerSummary[] {
  return seekers
    .filter((s) => !s.isInvalid && (s.interviewDone || s.recommendations > 0))
    .map((s) => ({
      id: s.id,
      name: s.name || "(未設定)",
      age: s.age,
      candidateNo: s.candidateNo,
      staff: s.staff,
      entryDate: s.entryDate,
      interviewDate: s.interviewDate,
      finalResult: s.finalResult,
      source: s.source,
      isFood: s.isFood,
      gender: s.gender,
      education: s.education,
      jobChangeCount: s.jobChangeCount,
      recommendations: s.recommendations,
      interviewSettings: s.interviewSettings,
      interviewsConducted: s.interviewsConducted,
      firstInterviewPass: s.firstInterviewPass,
      secondInterviewExecuted: s.secondInterviewExecuted,
      secondInterviewPass: s.secondInterviewPass,
      finalInterviewExecuted: s.finalInterviewExecuted,
      offers: s.offers,
      acceptances: s.acceptances,
      acceptanceDate: s.acceptanceDate,
      hires: s.hires,
      hireDate: s.hireDate,
    }))
    .sort((a, b) => {
      const aDate = a.interviewDate ?? "";
      const bDate = b.interviewDate ?? "";
      return bDate.localeCompare(aDate);
    });
}

// =============================================================
// 発話比率CA 月別・担当者別平均
// =============================================================
export function computeMonthlySpeakingRatio(
  seekers: RawJobSeeker[]
): MonthlySpeakingRatioData {
  const byStaffRaw: Record<string, Record<string, { sum: number; count: number }>> = {};
  const overallRaw: Record<string, { sum: number; count: number }> = {};
  const monthSet = new Set<string>();
  const staffSet = new Set<string>();

  for (const s of seekers) {
    if (s.speakingRatio === null || s.speakingRatio === undefined) continue;
    if (!s.interviewDate) continue;

    const month = toMonthKey(s.interviewDate);
    const staff = s.staff || "未設定";

    monthSet.add(month);
    staffSet.add(staff);

    if (!byStaffRaw[staff]) byStaffRaw[staff] = {};
    if (!byStaffRaw[staff][month]) byStaffRaw[staff][month] = { sum: 0, count: 0 };
    byStaffRaw[staff][month].sum += s.speakingRatio;
    byStaffRaw[staff][month].count++;

    if (!overallRaw[month]) overallRaw[month] = { sum: 0, count: 0 };
    overallRaw[month].sum += s.speakingRatio;
    overallRaw[month].count++;
  }

  const months = Array.from(monthSet).sort();
  const staffList = Array.from(staffSet).sort();

  const byStaff: Record<string, Record<string, { avg: number; count: number }>> = {};
  for (const staff of staffList) {
    byStaff[staff] = {};
    for (const month of months) {
      const d = byStaffRaw[staff]?.[month];
      if (d && d.count > 0) {
        byStaff[staff][month] = { avg: Math.round(d.sum / d.count), count: d.count };
      }
    }
  }

  const overall: Record<string, { avg: number; count: number }> = {};
  for (const month of months) {
    const d = overallRaw[month];
    if (d && d.count > 0) {
      overall[month] = { avg: Math.round(d.sum / d.count), count: d.count };
    }
  }

  return { months, staffList, byStaff, overall };
}

// =============================================================
// 内定承諾日 / 入社想定日ベース月別集計（応募管理 DB から）
// =============================================================

// 応募から紐づく求職者の流入経路を取得（最初の seekerId を優先）
function getAppSource(app: RawApplication, seekerSourceMap: Map<string, string>): string {
  for (const id of app.seekerIds) {
    const src = seekerSourceMap.get(id);
    if (src) return src;
  }
  return "未設定";
}

// 応募から紐づく求職者の担当者を取得（最初の seekerId を優先）
function getAppStaff(app: RawApplication, seekerStaffMap: Map<string, string>): string {
  for (const id of app.seekerIds) {
    const staff = seekerStaffMap.get(id);
    if (staff) return staff;
  }
  return "未設定";
}

export function computeMonthlyAcceptances(apps: RawApplication[]): MonthlyAcceptanceData[] {
  const map = new Map<string, MonthlyAcceptanceData>();
  for (const app of apps) {
    if (!app.acceptanceDate) continue;
    const month = toMonthKey(app.acceptanceDate);
    if (!map.has(month)) map.set(month, { month, count: 0, revenue: 0 });
    const m = map.get(month)!;
    m.count++;
    if (app.revenue) m.revenue += app.revenue;
  }
  return Array.from(map.values()).sort((a, b) => a.month.localeCompare(b.month));
}

export function computeMonthlyJoinForecast(apps: RawApplication[]): MonthlyJoinForecastData[] {
  const map = new Map<string, MonthlyJoinForecastData>();
  for (const app of apps) {
    if (!app.expectedJoinDate) continue;
    const month = toMonthKey(app.expectedJoinDate);
    if (!map.has(month)) map.set(month, { month, count: 0, revenue: 0 });
    const m = map.get(month)!;
    m.count++;
    if (app.revenue) m.revenue += app.revenue;
  }
  return Array.from(map.values()).sort((a, b) => a.month.localeCompare(b.month));
}

// 任意のキー抽出関数で月別集計（流入経路別・担当者別の共通実装）
function buildMonthDataByKeyFn<T extends { month: string; count: number; revenue: number }>(
  apps: RawApplication[],
  getKey: (app: RawApplication) => string,
  getDateKey: (app: RawApplication) => string | null,
  makeEmpty: (month: string) => T
): Record<string, T[]> {
  const byKey: Record<string, Map<string, T>> = {};
  for (const app of apps) {
    const date = getDateKey(app);
    if (!date) continue;
    const month = toMonthKey(date);
    const key = getKey(app);
    if (!byKey[key]) byKey[key] = new Map();
    const keyMap = byKey[key];
    if (!keyMap.has(month)) keyMap.set(month, makeEmpty(month));
    const m = keyMap.get(month)!;
    m.count++;
    if (app.revenue) m.revenue += app.revenue;
  }
  const result: Record<string, T[]> = {};
  for (const [k, map] of Object.entries(byKey)) {
    result[k] = Array.from(map.values()).sort((a, b) => a.month.localeCompare(b.month));
  }
  return result;
}

// 2D集計（担当者 × 流入経路）
function buildMonthDataBy2D<T extends { month: string; count: number; revenue: number }>(
  apps: RawApplication[],
  getKey1: (app: RawApplication) => string,
  getKey2: (app: RawApplication) => string,
  getDateKey: (app: RawApplication) => string | null,
  makeEmpty: (month: string) => T
): Record<string, Record<string, T[]>> {
  const by2D: Record<string, Record<string, Map<string, T>>> = {};
  for (const app of apps) {
    const date = getDateKey(app);
    if (!date) continue;
    const month = toMonthKey(date);
    const k1 = getKey1(app);
    const k2 = getKey2(app);
    if (!by2D[k1]) by2D[k1] = {};
    if (!by2D[k1][k2]) by2D[k1][k2] = new Map();
    const map = by2D[k1][k2];
    if (!map.has(month)) map.set(month, makeEmpty(month));
    const m = map.get(month)!;
    m.count++;
    if (app.revenue) m.revenue += app.revenue;
  }
  const result: Record<string, Record<string, T[]>> = {};
  for (const [k1, inner] of Object.entries(by2D)) {
    result[k1] = {};
    for (const [k2, map] of Object.entries(inner)) {
      result[k1][k2] = Array.from(map.values()).sort((a, b) => a.month.localeCompare(b.month));
    }
  }
  return result;
}

export function computeMonthlyAcceptancesBySource(
  apps: RawApplication[],
  seekerSourceMap: Map<string, string>
): Record<string, MonthlyAcceptanceData[]> {
  return buildMonthDataByKeyFn(
    apps,
    (a) => getAppSource(a, seekerSourceMap),
    (a) => a.acceptanceDate,
    (month) => ({ month, count: 0, revenue: 0 })
  );
}

export function computeMonthlyJoinForecastBySource(
  apps: RawApplication[],
  seekerSourceMap: Map<string, string>
): Record<string, MonthlyJoinForecastData[]> {
  return buildMonthDataByKeyFn(
    apps,
    (a) => getAppSource(a, seekerSourceMap),
    (a) => a.expectedJoinDate,
    (month) => ({ month, count: 0, revenue: 0 })
  );
}

export function computeMonthlyAcceptancesByStaff(
  apps: RawApplication[],
  seekerStaffMap: Map<string, string>
): Record<string, MonthlyAcceptanceData[]> {
  return buildMonthDataByKeyFn(
    apps,
    (a) => getAppStaff(a, seekerStaffMap),
    (a) => a.acceptanceDate,
    (month) => ({ month, count: 0, revenue: 0 })
  );
}

export function computeMonthlyJoinForecastByStaff(
  apps: RawApplication[],
  seekerStaffMap: Map<string, string>
): Record<string, MonthlyJoinForecastData[]> {
  return buildMonthDataByKeyFn(
    apps,
    (a) => getAppStaff(a, seekerStaffMap),
    (a) => a.expectedJoinDate,
    (month) => ({ month, count: 0, revenue: 0 })
  );
}

export function computeMonthlyAcceptancesByStaffSource(
  apps: RawApplication[],
  seekerStaffMap: Map<string, string>,
  seekerSourceMap: Map<string, string>
): Record<string, Record<string, MonthlyAcceptanceData[]>> {
  return buildMonthDataBy2D(
    apps,
    (a) => getAppStaff(a, seekerStaffMap),
    (a) => getAppSource(a, seekerSourceMap),
    (a) => a.acceptanceDate,
    (month) => ({ month, count: 0, revenue: 0 })
  );
}

export function computeMonthlyJoinForecastByStaffSource(
  apps: RawApplication[],
  seekerStaffMap: Map<string, string>,
  seekerSourceMap: Map<string, string>
): Record<string, Record<string, MonthlyJoinForecastData[]>> {
  return buildMonthDataBy2D(
    apps,
    (a) => getAppStaff(a, seekerStaffMap),
    (a) => getAppSource(a, seekerSourceMap),
    (a) => a.expectedJoinDate,
    (month) => ({ month, count: 0, revenue: 0 })
  );
}

// -------------------------------------------------------------
// 売上見込みFY分割用: 入社想定日を優先し、無い場合のみ内定承諾「月の翌月」で概算
// （入社見込みチャートは従来どおり入社想定日ベースのまま。FYカード専用の系列）
// -------------------------------------------------------------
// "YYYY-MM-.." の翌月1日 "YYYY-MM-01" を返す
function nextMonthFirstDay(dateStr: string): string {
  const y = Number(dateStr.slice(0, 4));
  const m = Number(dateStr.slice(5, 7)); // 1-12
  const ny = m === 12 ? y + 1 : y;
  const nm = m === 12 ? 1 : m + 1;
  return `${ny}-${String(nm).padStart(2, "0")}-01`;
}

const fyDateKey = (a: RawApplication): string | null => {
  if (a.expectedJoinDate) return a.expectedJoinDate;
  if (a.acceptanceDate) return nextMonthFirstDay(a.acceptanceDate); // 承諾月の翌月で概算
  return null;
};

export function computeMonthlyForFY(apps: RawApplication[]): MonthlyJoinForecastData[] {
  const map = new Map<string, MonthlyJoinForecastData>();
  for (const app of apps) {
    const date = fyDateKey(app);
    if (!date) continue;
    const month = toMonthKey(date);
    if (!map.has(month)) map.set(month, { month, count: 0, revenue: 0 });
    const m = map.get(month)!;
    m.count++;
    if (app.revenue) m.revenue += app.revenue;
  }
  return Array.from(map.values()).sort((a, b) => a.month.localeCompare(b.month));
}

export function computeMonthlyForFYBySource(
  apps: RawApplication[],
  seekerSourceMap: Map<string, string>
): Record<string, MonthlyJoinForecastData[]> {
  return buildMonthDataByKeyFn(
    apps,
    (a) => getAppSource(a, seekerSourceMap),
    fyDateKey,
    (month) => ({ month, count: 0, revenue: 0 })
  );
}

export function computeMonthlyForFYByStaff(
  apps: RawApplication[],
  seekerStaffMap: Map<string, string>
): Record<string, MonthlyJoinForecastData[]> {
  return buildMonthDataByKeyFn(
    apps,
    (a) => getAppStaff(a, seekerStaffMap),
    fyDateKey,
    (month) => ({ month, count: 0, revenue: 0 })
  );
}

export function computeMonthlyForFYByStaffSource(
  apps: RawApplication[],
  seekerStaffMap: Map<string, string>,
  seekerSourceMap: Map<string, string>
): Record<string, Record<string, MonthlyJoinForecastData[]>> {
  return buildMonthDataBy2D(
    apps,
    (a) => getAppStaff(a, seekerStaffMap),
    (a) => getAppSource(a, seekerSourceMap),
    fyDateKey,
    (month) => ({ month, count: 0, revenue: 0 })
  );
}

// =============================================================
// 全体集計
// =============================================================
export function processAllData(
  seekers: RawJobSeeker[],
  applications: RawApplication[],
  companySummary: CompanySummary,
  jobSummary: JobSummary,
  isConnected: boolean
): DashboardData {
  // 応募DBから求職者ごとの各指標を算出（Notionプロパティの更新漏れを回避）
  interface AppDerivedMetrics {
    recommendations: number;
    interviewSettings: number;
    interviewsConducted: number;
    firstInterviewPass: number;
    secondInterviewExecuted: number;
    secondInterviewPass: number;
    finalInterviewExecuted: number;
    offers: number;
    acceptances: number;
    hires: number;
  }
  const appMetricsBySeeker = new Map<string, AppDerivedMetrics>();

  // 応募ファネルと同じフェーズ判定セット（日付未入力でもフェーズから補完）
  const _PASSED_FIRST  = new Set(["一次面接","不採用（一次面接NG）","二次面接","不採用（二次面接NG）","最終面接","不採用（最終面接NG）","内定","内定承諾","入社"]);
  const _PASSED_SECOND = new Set(["二次面接","不採用（二次面接NG）","最終面接","不採用（最終面接NG）","内定","内定承諾","入社"]);
  const _PASSED_FINAL  = new Set(["最終面接","不採用（最終面接NG）","内定","内定承諾","入社"]);
  const _PASSED_OFFER  = new Set(["内定","内定承諾","入社"]);
  const _PASSED_ACCEPT = new Set(["内定承諾","入社"]);

  for (const app of applications) {
    for (const seekerId of app.seekerIds) {
      if (!appMetricsBySeeker.has(seekerId)) {
        appMetricsBySeeker.set(seekerId, {
          recommendations: 0, interviewSettings: 0, interviewsConducted: 0,
          firstInterviewPass: 0, secondInterviewExecuted: 0, secondInterviewPass: 0,
          finalInterviewExecuted: 0, offers: 0, acceptances: 0, hires: 0,
        });
      }
      const m = appMetricsBySeeker.get(seekerId)!;
      const ph = app.phase;
      // 応募管理DBへの登録 = 推薦（全件カウント）
      m.recommendations++;
      if (app.firstInterviewSetDate || (ph && _PASSED_FIRST.has(ph)))  m.interviewSettings++;
      if (app.firstInterviewDate    || (ph && _PASSED_FIRST.has(ph)))  m.interviewsConducted++;
      if (app.secondInterviewDate   || (ph && _PASSED_SECOND.has(ph))) { m.firstInterviewPass++; m.secondInterviewExecuted++; }
      if (app.finalInterviewDate    || (ph && _PASSED_FINAL.has(ph)))  { m.secondInterviewPass++; m.finalInterviewExecuted++; }
      if (app.offerDate             || (ph && _PASSED_OFFER.has(ph)))  m.offers++;
      if (app.acceptanceDate        || (ph && _PASSED_ACCEPT.has(ph))) m.acceptances++;
      if (ph === "入社") m.hires++;
    }
  }

  const enrichedSeekers = seekers.map(s => {
    const m = appMetricsBySeeker.get(s.id);
    if (!m) return s;
    return {
      ...s,
      recommendations: m.recommendations,
      interviewSettings: m.interviewSettings,
      interviewsConducted: m.interviewsConducted,
      firstInterviewPass: m.firstInterviewPass,
      secondInterviewExecuted: m.secondInterviewExecuted,
      secondInterviewPass: m.secondInterviewPass,
      finalInterviewExecuted: m.finalInterviewExecuted,
      offers: m.offers,
      acceptances: m.acceptances,
      hires: m.hires,
    };
  });

  const monthlyMetrics = computeMonthlyMetrics(enrichedSeekers, applications);
  const { staffList, staffMetrics } = computeStaffMetrics(enrichedSeekers, applications);
  const { sourceList, sourceMetrics } = computeSourceMetrics(enrichedSeekers, applications);
  const staffSourceMetrics = computeStaffSourceMetrics(enrichedSeekers, applications);
  const grandTotals = computeGrandTotals(monthlyMetrics);
  const averageDays = computeAverageDays(seekers, applications);
  const staffAverageDays = computeStaffAverageDays(seekers, applications);
  const sourceAverageDays = computeSourceAverageDays(seekers, applications);
  const monthlyAverageDaysRaw = computeMonthlyAverageDaysRaw(seekers, applications);
  const prefectureData = computePrefectureDistribution(seekers);
  const ageGroupData = computeAgeGroupDistribution(seekers);
  const salaryRangeData = computeSalaryDistribution(seekers);
  const profileNonFood = buildProfileGroup(seekers.filter((s) => !s.isFood));
  const profileFood = buildProfileGroup(seekers.filter((s) => s.isFood));

  const profileNonFoodBySource: Record<string, ProfileGroup> = {};
  const profileFoodBySource: Record<string, ProfileGroup> = {};
  for (const src of sourceList) {
    const srcSeekers = seekers.filter(s => (s.source || "未設定") === src);
    profileNonFoodBySource[src] = buildProfileGroup(srcSeekers.filter(s => !s.isFood));
    profileFoodBySource[src] = buildProfileGroup(srcSeekers.filter(s => s.isFood));
  }
  const applicationFunnel = computeApplicationFunnel(applications);
  const offerComparison = computeOfferComparison(applications);
  const inProgress = computeInProgress(
    applications,
    enrichedSeekers,
    companySummary.records
  );
  const jobSeekerSummaries = buildJobSeekerSummaries(enrichedSeekers);
  const monthlySpeakingRatio = computeMonthlySpeakingRatio(seekers);
  const monthlyAcceptances = computeMonthlyAcceptances(applications);
  const monthlyJoinForecast = computeMonthlyJoinForecast(applications);
  const seekerSourceMap = new Map<string, string>(
    seekers.map(s => [s.id, s.source || "未設定"])
  );
  const seekerStaffMap = new Map<string, string>(
    seekers.map(s => [s.id, s.staff || "未設定"])
  );
  const monthlyAcceptancesBySource = computeMonthlyAcceptancesBySource(applications, seekerSourceMap);
  const monthlyJoinForecastBySource = computeMonthlyJoinForecastBySource(applications, seekerSourceMap);
  const monthlyAcceptancesByStaff = computeMonthlyAcceptancesByStaff(applications, seekerStaffMap);
  const monthlyJoinForecastByStaff = computeMonthlyJoinForecastByStaff(applications, seekerStaffMap);
  const monthlyAcceptancesByStaffSource = computeMonthlyAcceptancesByStaffSource(applications, seekerStaffMap, seekerSourceMap);
  const monthlyJoinForecastByStaffSource = computeMonthlyJoinForecastByStaffSource(applications, seekerStaffMap, seekerSourceMap);
  const monthlyForFY = computeMonthlyForFY(applications);
  const monthlyForFYBySource = computeMonthlyForFYBySource(applications, seekerSourceMap);
  const monthlyForFYByStaff = computeMonthlyForFYByStaff(applications, seekerStaffMap);
  const monthlyForFYByStaffSource = computeMonthlyForFYByStaffSource(applications, seekerStaffMap, seekerSourceMap);

  return {
    isConnected,
    generatedAt: new Date().toISOString(),
    companySummary,
    jobSummary,
    contractedCompanies: companySummary.total,
    activeJobs: jobSummary.byStatus["公開中"] ?? 0,
    monthlyMetrics,
    staffList,
    staffMetrics,
    sourceList,
    sourceMetrics,
    staffSourceMetrics,
    grandTotals,
    averageDays,
    staffAverageDays,
    sourceAverageDays,
    monthlyAverageDaysRaw,
    prefectureData,
    ageGroupData,
    salaryRangeData,
    profileNonFood,
    profileFood,
    profileNonFoodBySource,
    profileFoodBySource,
    applicationFunnel,
    offerComparison,
    inProgress,
    jobSeekerSummaries,
    monthlySpeakingRatio,
    monthlyAcceptances,
    monthlyJoinForecast,
    monthlyAcceptancesBySource,
    monthlyJoinForecastBySource,
    monthlyAcceptancesByStaff,
    monthlyJoinForecastByStaff,
    monthlyAcceptancesByStaffSource,
    monthlyJoinForecastByStaffSource,
    monthlyForFY,
    monthlyForFYBySource,
    monthlyForFYByStaff,
    monthlyForFYByStaffSource,
  };
}
