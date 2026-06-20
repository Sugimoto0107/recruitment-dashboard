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
}

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
  candidateNo: string;
  staff: string;
  entryDate: string | null;
  interviewDate: string | null;
  finalResult: string;
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
  // プロフィール分析
  prefectureData: ProfileDistribution[];
  ageGroupData: ProfileDistribution[];
  salaryRangeData: ProfileDistribution[];
  // 応募ファネル
  applicationFunnel: ApplicationFunnel;
  inProgress: InProgressBuckets;
  // 求職者個別
  jobSeekerSummaries: JobSeekerSummary[];
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
  };
}

// =============================================================
// 月別 CA 指標
// =============================================================
export function computeMonthlyMetrics(
  seekers: RawJobSeeker[]
): MonthlyCAMetrics[] {
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

  return Array.from(monthMap.values()).sort((a, b) =>
    a.month.localeCompare(b.month)
  );
}

export function computeStaffMetrics(seekers: RawJobSeeker[]): {
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
    staffMetrics[staff] = computeMonthlyMetrics(group);
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
export function computeSourceMetrics(seekers: RawJobSeeker[]): {
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
    sourceMetrics[src] = computeMonthlyMetrics(group);
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
  seekers: RawJobSeeker[]
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
      result[staff][src] = computeMonthlyMetrics(list);
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

// =============================================================
// 応募ファネル
// =============================================================
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

  for (const a of apps) {
    if (a.phase) {
      byPhase[a.phase] = (byPhase[a.phase] ?? 0) + 1;
    }
    if (a.recommendDate) recommended += 1;
    if (a.firstInterviewDate) firstInterview += 1;
    if (a.secondInterviewDate) secondInterview += 1;
    if (a.finalInterviewDate) finalInterview += 1;
    if (a.offerDate) offers += 1;
    if (a.acceptanceDate) acceptances += 1;
    if (a.phase === "入社") joins += 1;
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
    return {
      applicationId: a.id,
      phase: a.phase ?? "",
      candidateName: candidate?.name || "(未設定)",
      companyName: company?.name || "(未設定)",
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
          buildItem(a, a.firstInterviewSetDate ?? a.firstInterviewDate)
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
    .filter((s) => !s.isInvalid && s.interviewDone)
    .map((s) => ({
      id: s.id,
      name: s.name || "(未設定)",
      candidateNo: s.candidateNo,
      staff: s.staff,
      entryDate: s.entryDate,
      interviewDate: s.interviewDate,
      finalResult: s.finalResult,
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
      if (app.recommendDate) m.recommendations++;
      if (app.firstInterviewSetDate) m.interviewSettings++;
      if (app.firstInterviewDate) m.interviewsConducted++;
      if (app.secondInterviewDate) { m.firstInterviewPass++; m.secondInterviewExecuted++; }
      if (app.finalInterviewDate) { m.secondInterviewPass++; m.finalInterviewExecuted++; }
      if (app.offerDate) m.offers++;
      if (app.acceptanceDate) m.acceptances++;
      if (app.phase === "入社") m.hires++;
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

  const monthlyMetrics = computeMonthlyMetrics(enrichedSeekers);
  const { staffList, staffMetrics } = computeStaffMetrics(enrichedSeekers);
  const { sourceList, sourceMetrics } = computeSourceMetrics(enrichedSeekers);
  const staffSourceMetrics = computeStaffSourceMetrics(enrichedSeekers);
  const grandTotals = computeGrandTotals(monthlyMetrics);
  const averageDays = computeAverageDays(seekers, applications);
  const staffAverageDays = computeStaffAverageDays(seekers, applications);
  const sourceAverageDays = computeSourceAverageDays(seekers, applications);
  const monthlyAverageDaysRaw = computeMonthlyAverageDaysRaw(seekers, applications);
  const prefectureData = computePrefectureDistribution(seekers);
  const ageGroupData = computeAgeGroupDistribution(seekers);
  const salaryRangeData = computeSalaryDistribution(seekers);
  const applicationFunnel = computeApplicationFunnel(applications);
  const inProgress = computeInProgress(
    applications,
    enrichedSeekers,
    companySummary.records
  );
  const jobSeekerSummaries = buildJobSeekerSummaries(enrichedSeekers);

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
    applicationFunnel,
    inProgress,
    jobSeekerSummaries,
  };
}
