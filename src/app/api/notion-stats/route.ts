// ===================================
// Notion API: RA指標（契約企業数・求人数）取得
// ===================================

import { NextResponse } from "next/server";
import { Client } from "@notionhq/client";

export async function GET() {
  const apiKey = process.env.NOTION_API_KEY;
  const companyDbId = process.env.NOTION_COMPANY_DB_ID;
  const jobDbId = process.env.NOTION_JOB_DB_ID;

  // APIキー未設定時はフォールバック値を返す
  if (!apiKey || apiKey === "your_notion_api_key_here") {
    return NextResponse.json({
      contractedCompanies: 0,
      activeJobs: 0,
      error: "NOTION_API_KEY not configured",
    });
  }

  try {
    const notion = new Client({ auth: apiKey });

    // Notion SDK v5: dataSources.query を使用
    // 契約企業数: ステータスが「契約」のもの
    const companyRes = await (notion as any).dataSources.query({
      data_source_id: companyDbId!,
      filter: {
        property: "ステータス",
        select: { equals: "契約" },
      },
    });

    // 求人数: ステータスが「公開中」のもの
    const jobRes = await (notion as any).dataSources.query({
      data_source_id: jobDbId!,
      filter: {
        property: "ステータス",
        select: { equals: "公開中" },
      },
    });

    return NextResponse.json({
      contractedCompanies: companyRes.results.length,
      activeJobs: jobRes.results.length,
    });
  } catch (error) {
    console.error("Notion API error:", error);
    return NextResponse.json(
      { contractedCompanies: 0, activeJobs: 0, error: "Notion API error" },
      { status: 500 }
    );
  }
}
