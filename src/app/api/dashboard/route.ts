// ===================================
// ダッシュボードAPI: メインエンドポイント
// 4つのNotionデータベースから取得・集計して返す
//
// キャッシュ方針: 24時間 (毎朝 GitHub Actions Cron 経由で revalidate される)
// ===================================

import {
  getContractCompanySummary,
  getJobSummary,
  getAllJobSeekers,
  getAllApplications,
  isNotionConnected,
} from "@/lib/notion";
import { processAllData, DashboardData } from "@/lib/process-data";

// 1日キャッシュ (再生成は /api/revalidate 経由 or revalidate 期限切れ)
export const revalidate = 86400;

function emptyData(): DashboardData {
  return {
    isConnected: false,
    generatedAt: new Date().toISOString(),
    companySummary: { total: 0, byStatus: {} },
    jobSummary: { total: 0, byStatus: {}, publishedByJobCode: {} },
    contractedCompanies: 0,
    activeJobs: 0,
    monthlyMetrics: [],
    staffList: [],
    staffMetrics: {},
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
    averageDays: { entryToInterview: null, entryToAcceptance: null },
    staffAverageDays: {},
    prefectureData: [],
    ageGroupData: [],
    salaryRangeData: [],
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
    jobSeekerSummaries: [],
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
