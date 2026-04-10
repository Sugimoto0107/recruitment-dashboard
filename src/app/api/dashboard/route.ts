// ===================================
// ダッシュボードAPI: メインエンドポイント
// 3つのNotionデータベースからデータを取得し、集計して返す
// ===================================

import {
  getContractCompanyCount,
  getActiveJobCount,
  getAllJobSeekers,
  isNotionConnected,
} from "@/lib/notion";
import { processAllData } from "@/lib/process-data";

export const dynamic = "force-dynamic";

export async function GET() {
  const connected = isNotionConnected();

  if (!connected) {
    return Response.json({
      isConnected: false,
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
      error: "NOTION_API_KEY が設定されていません",
    });
  }

  try {
    // 3つのデータベースを並列に取得
    const [contractedCompanies, activeJobs, seekers] = await Promise.all([
      getContractCompanyCount(),
      getActiveJobCount(),
      getAllJobSeekers(),
    ]);

    const data = processAllData(seekers, contractedCompanies, activeJobs, connected);

    return Response.json(data);
  } catch (error) {
    console.error("Dashboard API error:", error);
    return Response.json(
      {
        isConnected: true,
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
        error: "データ取得中にエラーが発生しました",
      },
      { status: 500 }
    );
  }
}
