// ===================================
// Notion API クライアント
// 契約企業・求人案件・応募・求職者の4つのデータベースから取得
// ===================================

import { Client } from "@notionhq/client";

// --- データソースID ---
const COMPANY_DS_ID = "bde1abad-8837-436b-9902-75ba5374f93d";
const JOB_DS_ID = "1ee32b1e-1895-446e-894b-033dadb6fc3f";
const APPLICATION_DS_ID = "37e90a21-501e-443f-ac28-de8b38989d06";
const SEEKER_DS_ID = "9404513f-bd36-40a4-a869-ccbc605b101c";

// --- ステータス候補 (Notion 側の select option と一致させる) ---
export const COMPANY_STATUSES = [
  "契約",
  "契約書はまだだけど合意済み",
  "人ありき",
  "アライアンス",
  "友人",
  "停止",
] as const;

export const JOB_STATUSES = [
  "公開中",
  "準備中",
  "非公開",
  "募集停止",
] as const;

export const APPLICATION_PHASES = [
  "書類選考",
  "一次面接",
  "二次面接",
  "最終面接",
  "内定",
  "内定承諾",
  "入社",
  "不採用（書類NG）",
  "不採用（一次面接NG）",
  "不採用（二次面接NG）",
  "不採用（最終面接NG）",
  "こちら辞退",
  "先方辞退",
] as const;

export type CompanyStatus = (typeof COMPANY_STATUSES)[number];
export type JobStatus = (typeof JOB_STATUSES)[number];
export type ApplicationPhase = (typeof APPLICATION_PHASES)[number];

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

// =====================================================
// 契約企業: 総数 + ステータス別 + 個別レコード一覧
// =====================================================
export interface CompanyRecord {
  id: string;
  name: string;
  status: string | null;
}

export interface CompanySummary {
  total: number;
  byStatus: Record<string, number>;
  records: CompanyRecord[]; // ID -> 企業名 解決用
}

export async function getContractCompanySummary(): Promise<CompanySummary> {
  const notion = getNotionClient();
  if (!notion) return { total: 0, byStatus: {}, records: [] };

  try {
    const results = await queryAllPages(notion, COMPANY_DS_ID);
    const byStatus: Record<string, number> = {};
    for (const status of COMPANY_STATUSES) byStatus[status] = 0;
    const records: CompanyRecord[] = [];

    for (const page of results) {
      const status = page.properties?.["ステータス"]?.select?.name as
        | string
        | undefined;
      const key = status ?? "未設定";
      byStatus[key] = (byStatus[key] ?? 0) + 1;
      const name =
        page.properties?.["企業名"]?.title?.[0]?.text?.content ?? "";
      records.push({ id: page.id, name, status: status ?? null });
    }
    return { total: results.length, byStatus, records };
  } catch (error) {
    console.error("Notion API error (companies):", error);
    return { total: 0, byStatus: {}, records: [] };
  }
}

// 後方互換: 旧 API
export async function getContractCompanyCount(): Promise<number> {
  const summary = await getContractCompanySummary();
  return summary.total;
}

// =====================================================
// 求人: 総数 + ステータス別 + 公開中の職種コード別
// =====================================================
export interface JobSummary {
  total: number;
  byStatus: Record<string, number>;
  publishedByJobCode: Record<string, number>;
}

export async function getJobSummary(): Promise<JobSummary> {
  const notion = getNotionClient();
  if (!notion) return { total: 0, byStatus: {}, publishedByJobCode: {} };

  try {
    const results = await queryAllPages(notion, JOB_DS_ID);
    const byStatus: Record<string, number> = {};
    for (const status of JOB_STATUSES) byStatus[status] = 0;
    const publishedByJobCode: Record<string, number> = {};

    for (const page of results) {
      const status = page.properties?.["ステータス"]?.select?.name as
        | string
        | undefined;
      const key = status ?? "未設定";
      byStatus[key] = (byStatus[key] ?? 0) + 1;

      if (status === "公開中") {
        const code = (
          page.properties?.["職種コード"]?.rich_text?.[0]?.text?.content ?? ""
        ).trim();
        const codeKey = code || "未設定";
        publishedByJobCode[codeKey] =
          (publishedByJobCode[codeKey] ?? 0) + 1;
      }
    }
    return { total: results.length, byStatus, publishedByJobCode };
  } catch (error) {
    console.error("Notion API error (jobs):", error);
    return { total: 0, byStatus: {}, publishedByJobCode: {} };
  }
}

// 後方互換: 旧 API
export async function getActiveJobCount(): Promise<number> {
  const summary = await getJobSummary();
  return summary.byStatus["公開中"] ?? 0;
}

// =====================================================
// 応募 (応募管理 DB) - 歩留まり用の生データ
// =====================================================
export interface RawApplication {
  id: string;
  phase: string | null;
  recommendDate: string | null;
  firstInterviewSetDate: string | null;
  firstInterviewDate: string | null;
  secondInterviewDate: string | null;
  finalInterviewDate: string | null;
  documentNgDate: string | null;
  interviewNgDate: string | null;
  declineDate: string | null;
  offerDate: string | null;
  acceptanceDate: string | null;
  expectedJoinDate: string | null;
  // リレーション (ID 配列)
  seekerIds: string[];
  companyIds: string[];
}

export async function getAllApplications(): Promise<RawApplication[]> {
  const notion = getNotionClient();
  if (!notion) return [];

  try {
    const results = await queryAllPages(notion, APPLICATION_DS_ID);
    return results.map((page: any) => {
      const props = page.properties;
      const dateOf = (key: string) => props[key]?.date?.start ?? null;
      const relIds = (key: string): string[] => {
        const rel = props[key]?.relation;
        if (!Array.isArray(rel)) return [];
        return rel.map((r: any) => r?.id).filter(Boolean);
      };
      return {
        id: page.id,
        phase: props["フェーズ"]?.select?.name ?? null,
        recommendDate: dateOf("推薦日時"),
        firstInterviewSetDate: dateOf("一次面接日程確定日"),
        firstInterviewDate: dateOf("一次面接実施日"),
        secondInterviewDate: dateOf("二次面接実施日"),
        finalInterviewDate: dateOf("最終面接日"),
        documentNgDate: dateOf("書類NG日時"),
        interviewNgDate: dateOf("面接NG日時"),
        declineDate: dateOf("求職者辞退日"),
        offerDate: dateOf("内定日"),
        acceptanceDate: dateOf("内定承諾日"),
        expectedJoinDate: dateOf("入社想定日"),
        seekerIds: relIds("求職者"),
        companyIds: relIds("応募企業"),
      };
    });
  } catch (error) {
    console.error("Notion API error (applications):", error);
    return [];
  }
}

// =====================================================
// 求職者 (求職者管理 DB)
// =====================================================
export interface RawJobSeeker {
  id: string;
  name: string;
  candidateNo: string;
  entryDate: string | null;
  isInvalid: boolean;
  interviewDone: boolean;
  interviewDate: string | null;
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
  staff: string;
  prefecture: string;
  age: number | null;
  currentSalary: number | null;
  source: string;
  finalResult: string;
}

export async function getAllJobSeekers(): Promise<RawJobSeeker[]> {
  const notion = getNotionClient();
  if (!notion) return [];

  try {
    const results = await queryAllPages(notion, SEEKER_DS_ID);

    return results.map((page: any) => {
      const props = page.properties;
      const txt = (key: string) =>
        props[key]?.rich_text?.[0]?.text?.content ?? "";
      const title = (key: string) =>
        props[key]?.title?.[0]?.text?.content ?? "";
      const ageProp = props["年齢"];
      const ageNumber =
        ageProp?.formula?.number ?? ageProp?.number ?? null;
      const ageManual = props["年齢（手入力）"]?.number ?? null;

      return {
        id: page.id,
        name:
          title("氏名") ||
          [txt("姓漢字"), txt("名漢字")].filter(Boolean).join(" "),
        candidateNo: txt("候補者NO"),
        entryDate: props["エントリー日"]?.date?.start ?? null,
        isInvalid: props["無効エントリー"]?.checkbox ?? false,
        interviewDone: props["面談実施"]?.checkbox ?? false,
        interviewDate: props["面談実施日"]?.date?.start ?? null,
        recommendations: props["推薦社数"]?.number ?? 0,
        interviewSettings: props["面接設定社数"]?.number ?? 0,
        interviewsConducted: props["面接実施社数"]?.number ?? 0,
        firstInterviewPass: props["一次面接通過数"]?.number ?? 0,
        secondInterviewExecuted: props["二次面接実施数"]?.number ?? 0,
        secondInterviewPass: props["二次面接通過数"]?.number ?? 0,
        finalInterviewExecuted: props["最終面接実施数"]?.number ?? 0,
        offers: props["内定数"]?.number ?? 0,
        acceptances: props["内定承諾数"]?.number ?? 0,
        acceptanceDate: props["内定承諾日"]?.date?.start ?? null,
        hires: props["入社数"]?.number ?? 0,
        hireDate: props["入社日"]?.date?.start ?? null,
        staff: txt("担当者"),
        prefecture: txt("居住都道府県"),
        age: ageNumber ?? ageManual,
        currentSalary: props["現職年収"]?.number ?? null,
        source: props["流入経路"]?.select?.name ?? "",
        finalResult: props["最終結果"]?.select?.name ?? "",
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
