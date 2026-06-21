// ===================================
// Notion API クライアント
// 契約企業・求人案件(飲食以外/飲食)・応募・求職者から取得
// ===================================

import { Client } from "@notionhq/client";

// --- UUID形式に正規化（ハイフンなし32桁→8-4-4-4-12形式） ---
function toUuid(id: string): string {
  if (!id) return id;
  const s = id.replace(/-/g, "");
  if (s.length !== 32) return id;
  return `${s.slice(0,8)}-${s.slice(8,12)}-${s.slice(12,16)}-${s.slice(16,20)}-${s.slice(20)}`;
}

// --- DB ID（環境変数から取得） ---
function getCompanyDbId(): string {
  return toUuid(process.env.NOTION_COMPANY_DB_ID ?? "");
}
function getJobIgaiDbId(): string {
  return toUuid(process.env.NOTION_JOB_DB_ID ?? "");
}
function getJobShokuhinDbId(): string {
  return toUuid(process.env.NOTION_JOB_SHOKUHIN_DB_ID ?? "");
}
function getApplicationDbId(): string {
  // GAS応募管理DBと同一（URLのページID）
  return toUuid(process.env.NOTION_APPLICATION_DB_ID ?? "388e7839dbed4aa6a18f38ea75334502");
}
function getSeekerDbId(): string {
  return toUuid(process.env.NOTION_SEEKER_DB_ID ?? "");
}

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
// notionVersion: "2022-06-28" を明示指定（SDKデフォルトの2025系ではdatabases.queryが廃止のため）
function getNotionClient(): Client | null {
  const apiKey = process.env.NOTION_API_KEY;
  if (!apiKey || apiKey === "your_notion_api_key_here") {
    return null;
  }
  return new Client({ auth: apiKey, notionVersion: "2022-06-28" });
}

// --- ページネーション付きクエリ（notion.request で databases/{id}/query を直接呼び出し） ---
async function queryAllPages(
  notion: Client,
  databaseId: string,
  filter?: Record<string, unknown>
): Promise<any[]> {
  if (!databaseId) return [];

  let allResults: any[] = [];
  let hasMore = true;
  let startCursor: string | undefined = undefined;

  while (hasMore) {
    const body: Record<string, unknown> = { page_size: 100 };
    if (filter) body.filter = filter;
    if (startCursor) body.start_cursor = startCursor;

    const response: any = await notion.request({
      path: `databases/${databaseId}/query`,
      method: "post",
      body,
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
  records: CompanyRecord[];
}

export async function getContractCompanySummary(): Promise<CompanySummary> {
  const notion = getNotionClient();
  if (!notion) return { total: 0, byStatus: {}, records: [] };

  try {
    const results = await queryAllPages(notion, getCompanyDbId());
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

// 後方互換
export async function getContractCompanyCount(): Promise<number> {
  const summary = await getContractCompanySummary();
  return summary.total;
}

// =====================================================
// 求人: 飲食以外 / 飲食 を別 DB から取得して合算
// =====================================================
export interface JobCategorySummary {
  total: number;
  byStatus: Record<string, number>;
  publishedByJobCode: Record<string, number>;
  monthlyAcquisition: Record<string, number>;
}

export interface JobSummary {
  // 全体合算
  total: number;
  byStatus: Record<string, number>;
  publishedByJobCode: Record<string, number>;
  monthlyAcquisition: Record<string, number>;
  // 飲食 / 飲食以外 のカテゴリ別
  shokuhinIgai: JobCategorySummary; // 飲食以外
  shokuhin: JobCategorySummary; // 飲食
}

function emptyJobCategory(): JobCategorySummary {
  const byStatus: Record<string, number> = {};
  for (const status of JOB_STATUSES) byStatus[status] = 0;
  return { total: 0, byStatus, publishedByJobCode: {}, monthlyAcquisition: {} };
}

function aggregateJobs(results: any[]): JobCategorySummary {
  const byStatus: Record<string, number> = {};
  for (const status of JOB_STATUSES) byStatus[status] = 0;
  const publishedByJobCode: Record<string, number> = {};
  const monthlyAcquisition: Record<string, number> = {};

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
      publishedByJobCode[codeKey] = (publishedByJobCode[codeKey] ?? 0) + 1;
    }

    const createdAt: string = page.created_time ?? "";
    if (createdAt) {
      const monthKey = createdAt.slice(0, 7);
      monthlyAcquisition[monthKey] = (monthlyAcquisition[monthKey] ?? 0) + 1;
    }
  }
  return { total: results.length, byStatus, publishedByJobCode, monthlyAcquisition };
}

function mergeJobCategories(
  a: JobCategorySummary,
  b: JobCategorySummary
): {
  total: number;
  byStatus: Record<string, number>;
  publishedByJobCode: Record<string, number>;
  monthlyAcquisition: Record<string, number>;
} {
  const byStatus: Record<string, number> = {};
  for (const k of Object.keys(a.byStatus)) byStatus[k] = a.byStatus[k];
  for (const k of Object.keys(b.byStatus))
    byStatus[k] = (byStatus[k] ?? 0) + b.byStatus[k];

  const publishedByJobCode: Record<string, number> = {
    ...a.publishedByJobCode,
  };
  for (const k of Object.keys(b.publishedByJobCode))
    publishedByJobCode[k] =
      (publishedByJobCode[k] ?? 0) + b.publishedByJobCode[k];

  const monthlyAcquisition: Record<string, number> = { ...a.monthlyAcquisition };
  for (const k of Object.keys(b.monthlyAcquisition))
    monthlyAcquisition[k] = (monthlyAcquisition[k] ?? 0) + b.monthlyAcquisition[k];

  return {
    total: a.total + b.total,
    byStatus,
    publishedByJobCode,
    monthlyAcquisition,
  };
}

export async function getJobSummary(): Promise<JobSummary> {
  const notion = getNotionClient();
  if (!notion) {
    const empty: JobSummary = {
      total: 0,
      byStatus: {},
      publishedByJobCode: {},
      monthlyAcquisition: {},
      shokuhinIgai: emptyJobCategory(),
      shokuhin: emptyJobCategory(),
    };
    return empty;
  }

  try {
    // 2つの DB を並列取得（飲食DBが未設定の場合は空配列）
    const [igaiResults, shokuhinResults] = await Promise.all([
      queryAllPages(notion, getJobIgaiDbId()),
      queryAllPages(notion, getJobShokuhinDbId()),
    ]);

    const shokuhinIgai = aggregateJobs(igaiResults);
    const shokuhin = aggregateJobs(shokuhinResults);
    const merged = mergeJobCategories(shokuhinIgai, shokuhin);

    return {
      total: merged.total,
      byStatus: merged.byStatus,
      publishedByJobCode: merged.publishedByJobCode,
      monthlyAcquisition: merged.monthlyAcquisition,
      shokuhinIgai,
      shokuhin,
    };
  } catch (error) {
    console.error("Notion API error (jobs):", error);
    return {
      total: 0,
      byStatus: {},
      publishedByJobCode: {},
      monthlyAcquisition: {},
      shokuhinIgai: emptyJobCategory(),
      shokuhin: emptyJobCategory(),
    };
  }
}

// 後方互換
export async function getActiveJobCount(): Promise<number> {
  const summary = await getJobSummary();
  return summary.byStatus["公開中"] ?? 0;
}

// =====================================================
// 応募 (応募管理 DB)
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
  seekerIds: string[];
  companyIds: string[];
}

export async function getAllApplications(): Promise<RawApplication[]> {
  const notion = getNotionClient();
  if (!notion) return [];

  try {
    const results = await queryAllPages(notion, getApplicationDbId());
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
  speakingRatio: number | null;
  isFood: boolean;
  gender: string;
  education: string;
  jobChangeCount: number | null;
}

export async function getAllJobSeekers(): Promise<RawJobSeeker[]> {
  const notion = getNotionClient();
  if (!notion) return [];

  try {
    const results = await queryAllPages(notion, getSeekerDbId());

    return results.map((page: any) => {
      const props = page.properties;
      const txt = (key: string) =>
        props[key]?.rich_text?.[0]?.text?.content ?? "";
      const title = (key: string) =>
        props[key]?.title?.[0]?.text?.content ?? "";
      const ageProp = props["年齢"];
      const ageFormula = ageProp?.formula?.number ?? ageProp?.number ?? null;
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
        // 生年月日がある場合はformulaが自動計算するので優先、なければ手入力を使用
        age: ageFormula ?? ageManual,
        currentSalary: props["現職年収"]?.number ?? null,
        source: props["流入経路"]?.select?.name ?? "",
        finalResult: props["最終結果"]?.select?.name ?? "",
        speakingRatio: props["発話比率CA"]?.number ?? null,
        isFood: props["飲食"]?.checkbox ?? false,
        gender: props["性別"]?.select?.name ?? "",
        education: props["最終学歴"]?.select?.name ?? "",
        jobChangeCount: props["転職回数"]?.number ?? null,
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
