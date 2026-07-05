// ===================================
// ダッシュボードAPI: メインエンドポイント
// ===================================

import {
  getContractCompanySummary,
  getJobSummary,
  getAllJobSeekers,
  getAllApplications,
  isNotionConnected,
} from "@/lib/notion";
import { processAllData, DashboardData } from "@/lib/process-data";

export const revalidate = 300;

function emptyJobCategory() {
  return {
    total: 0,
    byStatus: {},
    publishedByJobCode: {},
    monthlyAcquisition: {},
  };
}

function emptyData(): DashboardData {
  return {
    isConnected: false,
    generatedAt: new Date().toISOString(),
    companySummary: { total: 0, byStatus: {}, records: [] },
    jobSummary: {
      total: 0,
      byStatus: {},
      publishedByJobCode: {},
      monthlyAcquisition: {},
      shokuhinIgai: emptyJobCategory(),
      shokuhin: emptyJobCategory(),
    },
    contractedCompanies: 0,
    activeJobs: 0,
    monthlyMetrics: [],
    staffList: [],
    staffMetrics: {},
    sourceList: [],
    sourceMetrics: {},
    staffSourceMetrics: {},
    grandTotals: {
      month: "累計",
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
    },
    averageDays: { entryToInterview: null, entryToAcceptance: null, interviewToFirstRecommend: null, entryToOffer: null, entryToHire: null },
    staffAverageDays: {},
    sourceAverageDays: {},
    monthlyAverageDaysRaw: {},
    prefectureData: [],
    ageGroupData: [],
    salaryRangeData: [],
    profileNonFood: { count: 0, prefectureData: [], ageGroupData: [], salaryRangeData: [], genderData: [], educationData: [], jobChangeData: [] },
    profileFood: { count: 0, prefectureData: [], ageGroupData: [], salaryRangeData: [], genderData: [], educationData: [], jobChangeData: [] },
    profileNonFoodBySource: {},
    profileFoodBySource: {},
    applicationFunnel: {
      totalApplications: 0,
      byPhase: {},
      recommended: 0,
      firstInterview: 0,
      secondInterview: 0,
      finalInterview: 0,
      offers: 0,
      acceptances: 0,
      joins: 0,
      documentNg: 0,
      interviewNg: 0,
      declines: 0,
    },
    offerComparison: {
      offer: { count: 0, avgRecommendations: 0, avgFirstInterview: 0 },
      noOffer: { count: 0, avgRecommendations: 0, avgFirstInterview: 0 },
    },
    inProgress: {
      書類選考: [],
      一次面接: [],
      二次面接: [],
      最終面接: [],
      内定: [],
    },
    jobSeekerSummaries: [],
    monthlySpeakingRatio: { months: [], staffList: [], byStaff: {}, overall: {} },
    monthlyAcceptances: [],
    monthlyJoinForecast: [],
    monthlyAcceptancesBySource: {},
    monthlyJoinForecastBySource: {},
    monthlyAcceptancesByStaff: {},
    monthlyJoinForecastByStaff: {},
    monthlyAcceptancesByStaffSource: {},
    monthlyJoinForecastByStaffSource: {},
    monthlyForFY: [],
    monthlyForFYBySource: {},
    monthlyForFYByStaff: {},
    monthlyForFYByStaffSource: {},
  };
}

export async function GET() {
  const connected = isNotionConnected();

  if (!connected) {
    return Response.json({
      ...emptyData(),
      error: "NOTION_API_KEY が設定されていません",
    });
  }

  try {
    const [companySummary, jobSummary, seekers, applications] =
      await Promise.all([
        getContractCompanySummary(),
        getJobSummary(),
        getAllJobSeekers(),
        getAllApplications(),
      ]);

    const data = processAllData(
      seekers,
      applications,
      companySummary,
      jobSummary,
      connected
    );

    return Response.json(data);
  } catch (error) {
    console.error("Dashboard API error:", error);
    return Response.json(
      {
        ...emptyData(),
        isConnected: true,
        error: "データ取得中にエラーが発生しました",
      },
      { status: 500 }
    );
  }
}
