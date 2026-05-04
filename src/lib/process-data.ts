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
}

// --- 応募ファネル指標 (応募管理 DB から集計) ---
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
  scheduledDate: string | null; // 各フェーズの実施予定日
}

export interface InProgressBuckets {
  // 選考中
  書類選考: InProgressItem[];
  一次面接: InProgressItem[];
  二次面接: InProgressItem[];
  最終面接: InProgressItem[];
  // 内定承諾待ち
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
  // CA: 月別・担当者別
  monthlyMetrics: MonthlyCAMetrics[];
  staffList: string[];
  staffMetrics: Record<string, MonthlyCAMetrics[]>;
  sourceList: string[];
  sourceMetrics: Record<string, MonthlyCAMetrics[]>;
  grandTotals: MonthlyCAMetrics;
  averageDays: AverageDays;
  staffAverageDays: Record<string, AverageDays>;
  sourceAverageDays: Record<string, AverageDays>;
  // プロフィール分析
  prefectureData: ProfileDistribution[];
  ageGroupData: ProfileDistribution[];
  salaryRangeData: ProfileDistribution[];
  // 応募ファネル
  applicationFunnel: ApplicationFunnel;
  // 現フェーズ別の選考中・承諾待ち
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

export function computeAverageDays(seekers: RawJobSeeker[]): AverageDays {
  const interviewDays: number[] = [];
  for (const s of seekers) {
    if (s.entryDate && s.interviewDate && s.interviewDone) {
      interviewDays.push(daysBetween(s.entryDate, s.interviewDate));
    }
  }

  const acceptanceDays: number[] = [];
  for (const s of seekers) {
    if (s.entryDate && s.acceptanceDate && s.acceptances > 0) {
      acceptanceDays.push(daysBetween(s.entryDate, s.acceptanceDate));
    }
  }

  return {
    entryToInterview:
      interviewDays.length > 0
        ? Math.round(
            (interviewDays.reduce((a, b) => a + b, 0) /
              interviewDays.length) *
              10
          ) / 10
        : null,
    entryToAcceptance:
      acceptanceDays.length > 0
        ? Math.round(
            (acceptanceDays.reduce((a, b) => a + b, 0) /
              acceptanceDays.length) *
              10
          ) / 10
        : null,
  };
}

export function computeStaffAverageDays(
  seekers: RawJobSeeker[]
): Record<string, AverageDays> {
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

// =============================================================
// 流入経路別 CA 指標 (担当者別と同じロジックで source で切り出す)
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
  seekers: RawJobSeeker[]
): Record<string, AverageDays> {
  const groups = new Map<string, RawJobSeeker[]>();
  for (const s of seekers) {
    const src = s.source || "未設定";
    if (!groups.has(src)) groups.set(src, []);
    groups.get(src)!.push(s);
  }
  const result: Record<string, AverageDays> = {};
  for (const [src, group] of groups) {
    result[src] = computeAverageDays(group);
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
    const pref = s.prefecture || "不明";
    counts.set(pref, (counts.get(pref) ?? 0) + 1);
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
// 応募ファネル (応募管理 DB)
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

  function buildItem(a: RawApplication, scheduledDate: string | null): InProgressItem {
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

  // 各バケットを 実施予定日 昇順 (近い順) でソート
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
// 面談実施済かつ無効でない人だけを返す
// 検索/全表示の切り分けはフロント側で行う
// 並び順: 面談実施日 降順
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
      return bDate.localeCompare(aDate); // 面談日の降順
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
  const monthlyMetrics = computeMonthlyMetrics(seekers);
  const { staffList, staffMetrics } = computeStaffMetrics(seekers);
  const { sourceList, sourceMetrics } = computeSourceMetrics(seekers);
  const grandTotals = computeGrandTotals(monthlyMetrics);
  const averageDays = computeAverageDays(seekers);
  const staffAverageDays = computeStaffAverageDays(seekers);
  const sourceAverageDays = computeSourceAverageDays(seekers);
  const prefectureData = computePrefectureDistribution(seekers);
  const ageGroupData = computeAgeGroupDistribution(seekers);
  const salaryRangeData = computeSalaryDistribution(seekers);
  const applicationFunnel = computeApplicationFunnel(applications);
  const inProgress = computeInProgress(
    applications,
    seekers,
    companySummary.records
  );
  const jobSeekerSummaries = buildJobSeekerSummaries(seekers);

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
    grandTotals,
    averageDays,
    staffAverageDays,
    sourceAverageDays,
    prefectureData,
    ageGroupData,
    salaryRangeData,
    applicationFunnel,
    inProgress,
    jobSeekerSummaries,
  };
}
