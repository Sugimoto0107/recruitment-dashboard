// ===================================
// Notion API クライアント
// 契約企業・求人案件・求職者の3つのデータベースからデータを取得
// ===================================

import { Client } from "@notionhq/client";

// --- データソースID ---
const COMPANY_DS_ID = "bde1abad-8837-436b-9902-75ba5374f93d";
const JOB_DS_ID = "1ee32b1e-1895-446e-894b-033dadb6fc3f";
const SEEKER_DS_ID = "9404513f-bd36-40a4-a869-ccbc605b101c";

// --- Notion クライアント初期化 ---
function getNotionClient(): Client | null {
  const apiKey = process.env.NOTION_API_KEY;
  if (!apiKey || apiKey === "your_notion_api_key_here") {
    return null;
  }
  return new Client({ auth: apiKey });
}

// --- ページネーション付きクエリ ---
async function queryAllPages(
  notion: Client,
  dataSourceId: string,
  filter?: Record<string, unknown>
): Promise<any[]> {
  let allResults: any[] = [];
  let hasMore = true;
  let startCursor: string | undefined = undefined;

  while (hasMore) {
    const response: any = await notion.dataSources.query({
      data_source_id: dataSourceId,
      filter: filter as any,
      start_cursor: startCursor,
      page_size: 100,
    });
    allResults = allResults.concat(response.results);
    hasMore = response.has_more;
    startCursor = response.next_cursor ?? undefined;
  }

  return allResults;
}

// --- 契約企業数の取得（全件カウント） ---
export async function getContractCompanyCount(): Promise<number> {
  const notion = getNotionClient();
  if (!notion) return 0;

  try {
    const results = await queryAllPages(notion, COMPANY_DS_ID);
    return results.length;
  } catch (error) {
    console.error("Notion API error (companies):", error);
    return 0;
  }
}

// --- 公開中の求人数の取得 ---
export async function getActiveJobCount(): Promise<number> {
  const notion = getNotionClient();
  if (!notion) return 0;

  try {
    const results = await queryAllPages(notion, JOB_DS_ID, {
      property: "ステータス",
      select: { equals: "公開中" },
    });
    return results.length;
  } catch (error) {
    console.error("Notion API error (jobs):", error);
    return 0;
  }
}

// --- 求職者の生データ型 ---
export interface RawJobSeeker {
  id: string;
  entryDate: string | null;
  isInvalid: boolean;
  interviewDone: boolean;
  interviewDate: string | null;
  recommendations: number;
  interviewSettings: number;
  interviewsConducted: number;
  firstInterviewPass: number;
  secondInterviewPass: number;
  offers: number;
  acceptances: number;
  acceptanceDate: string | null;
  hires: number;
  staff: string;
  prefecture: string;
  age: number | null;
  currentSalary: number | null;
  source: string;
}

// --- 求職者データの全件取得 ---
export async function getAllJobSeekers(): Promise<RawJobSeeker[]> {
  const notion = getNotionClient();
  if (!notion) return [];

  try {
    const results = await queryAllPages(notion, SEEKER_DS_ID);

    return results.map((page: any) => {
      const props = page.properties;
      return {
        id: page.id,
        entryDate: props["エントリー日"]?.date?.start ?? null,
        isInvalid: props["無効エントリー"]?.checkbox ?? false,
        interviewDone: props["面談実施"]?.checkbox ?? false,
        interviewDate: props["面談実施日"]?.date?.start ?? null,
        recommendations: props["推薦社数"]?.number ?? 0,
        interviewSettings: props["面接設定社数"]?.number ?? 0,
        interviewsConducted: props["面接実施社数"]?.number ?? 0,
        firstInterviewPass: props["一次面接通過数"]?.number ?? 0,
        secondInterviewPass: props["二次面接通過数"]?.number ?? 0,
        offers: props["内定数"]?.number ?? 0,
        acceptances: props["内定承諾数"]?.number ?? 0,
        acceptanceDate: props["内定承諾日"]?.date?.start ?? null,
        hires: props["入社数"]?.number ?? 0,
        staff: props["担当者"]?.rich_text?.[0]?.text?.content ?? "",
        prefecture: props["居住都道府県"]?.rich_text?.[0]?.text?.content ?? "",
        age: props["年齢"]?.number ?? null,
        currentSalary: props["現職年収"]?.number ?? null,
        source: props["流入経路"]?.select?.name ?? "",
      };
    });
  } catch (error) {
    console.error("Notion API error (seekers):", error);
    return [];
  }
}

// --- Notion接続状態チェック ---
export function isNotionConnected(): boolean {
  const apiKey = process.env.NOTION_API_KEY;
  return !!apiKey && apiKey !== "your_notion_api_key_here";
}
