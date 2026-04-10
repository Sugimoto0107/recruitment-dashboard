// ===================================
// Notion API: 求職者データ取得（将来のNotion連携用）
// ===================================

import { NextResponse } from "next/server";
import { Client } from "@notionhq/client";

export async function GET() {
  const apiKey = process.env.NOTION_API_KEY;
  const seekerDbId = process.env.NOTION_SEEKER_DB_ID;

  if (!apiKey || apiKey === "your_notion_api_key_here") {
    return NextResponse.json({
      seekers: [],
      error: "NOTION_API_KEY not configured",
    });
  }

  try {
    const notion = new Client({ auth: apiKey });

    // Notion SDK v5: dataSources.query を使用
    let allResults: any[] = [];
    let hasMore = true;
    let startCursor: string | undefined = undefined;

    while (hasMore) {
      const response: any = await (notion as any).dataSources.query({
        data_source_id: seekerDbId!,
        start_cursor: startCursor,
        page_size: 100,
      });
      allResults = allResults.concat(response.results);
      hasMore = response.has_more;
      startCursor = response.next_cursor ?? undefined;
    }

    const seekers = allResults.map((page: any) => {
      const props = page.properties;
      return {
        id: page.id,
        entryDate: props["エントリー日"]?.date?.start ?? null,
        prefecture: props["居住都道府県"]?.rich_text?.[0]?.text?.content ?? "",
        age: props["年齢"]?.number ?? null,
        currentSalary: props["現職年収"]?.number ?? null,
        isInvalid: props["無効エントリー"]?.checkbox ?? false,
        interviewDone: props["面談実施"]?.checkbox ?? false,
        interviewDate: props["面談実施日"]?.date?.start ?? null,
        recommendations: props["推薦社数"]?.number ?? 0,
        interviewSettings: props["面接設定社数"]?.number ?? 0,
        interviewsConducted: props["面接実施社数"]?.number ?? 0,
        offers: props["内定数"]?.number ?? 0,
        acceptances: props["内定承諾数"]?.number ?? 0,
        hires: props["入社数"]?.number ?? 0,
        staff: props["担当者"]?.rich_text?.[0]?.text?.content ?? "",
        source: props["流入経路"]?.select?.name ?? "",
      };
    });

    return NextResponse.json({ seekers });
  } catch (error) {
    console.error("Notion API error:", error);
    return NextResponse.json(
      { seekers: [], error: "Notion API error" },
      { status: 500 }
    );
  }
}
