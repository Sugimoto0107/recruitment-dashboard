"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { CA_METRIC_KEYS, CAMetricKey } from "@/lib/types";
import { MARKETING_COSTS, getMarketingCostMap } from "@/lib/marketing-data";
import type {
  DashboardData,
  MonthlyCAMetrics,
  ProfileDistribution,
  AverageDays,
  InProgressBuckets,
  InProgressItem,
  JobSeekerSummary,
} from "@/lib/process-data";
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

// --- カラーパレット ---
const COLORS = [
  "#3B82F6", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6",
  "#EC4899", "#06B6D4", "#F97316", "#84CC16", "#6366F1",
  "#14B8A6", "#D946EF",
];

// --- 数値フォーマット ---
function fmt(n: number): string {
  return n.toLocaleString("ja-JP");
}

function pct(numerator: number, denominator: number): string {
  if (denominator === 0) return "-";
  return ((numerator / denominator) * 100).toFixed(1) + "%";
}

// --- KPIカード ---
function KPICard({
  title,
  value,
  sub,
}: {
  title: string;
  value: string | number;
  sub?: string;
}) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 flex flex-col gap-1">
      <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">{title}</p>
      <p className="text-2xl font-bold text-gray-900">
        {typeof value === "number" ? fmt(value) : value}
      </p>
      {sub && <p className="text-xs text-gray-400">{sub}</p>}
    </div>
  );
}

// --- ステータス別ブレイクダウンカード ---
function StatusBreakdownCard({
  title,
  total,
  byStatus,
  highlight,
}: {
  title: string;
  total: number;
  byStatus: Record<string, number>;
  highlight?: string;
}) {
  const entries = Object.entries(byStatus).sort((a, b) => b[1] - a[1]);
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
      <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">{title}</p>
      <p className="text-3xl font-bold text-gray-900 mt-1 mb-3">{fmt(total)}</p>
      <div className="space-y-1.5">
        {entries.map(([status, count]) => (
          <div
            key={status}
            className={`flex items-center justify-between text-sm ${
              status === highlight ? "font-semibold text-gray-900" : "text-gray-600"
            }`}
          >
            <span className="truncate">{status}</span>
            <span className="tabular-nums ml-2">
              {fmt(count)} <span className="text-gray-400 text-xs">({pct(count, total)})</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// --- 円グラフ ---
function DonutChart({
  data,
  title,
}: {
  data: ProfileDistribution[];
  title: string;
}) {
  if (data.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">{title}</h3>
        <div className="flex items-center justify-center h-[260px] text-gray-400 text-sm">
          データなし
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
      <h3 className="text-sm font-semibold text-gray-700 mb-3">{title}</h3>
      <ResponsiveContainer width="100%" height={200}>
        <PieChart>
          <Pie
            data={data}
            dataKey="count"
            nameKey="label"
            cx="50%"
            cy="50%"
            innerRadius={45}
            outerRadius={80}
            paddingAngle={2}
            startAngle={90}
            endAngle={-270}
            label={false}
          >
            {data.map((_, i) => (
              <Cell key={i} fill={COLORS[i % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip
            formatter={(value: any) => [fmt(Number(value)) + "人", "人数"]}
          />
        </PieChart>
      </ResponsiveContainer>
      <div className="mt-2 space-y-1">
        {data.map((d, i) => (
          <div key={i} className="flex items-center justify-between text-xs text-gray-700">
            <div className="flex items-center gap-1.5 min-w-0">
              <span
                className="w-2.5 h-2.5 rounded-sm flex-shrink-0"
                style={{ backgroundColor: COLORS[i % COLORS.length] }}
              />
              <span className="truncate">{d.label}</span>
            </div>
            <span className="ml-2 flex-shrink-0 tabular-nums font-medium">
              {d.count}人（{d.percentage}%）
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// --- 選考中・承諾待ちのフェーズカード ---
function InProgressPhaseCard({
  title,
  items,
  showDate = true,
  accentClass = "bg-blue-500",
}: {
  title: string;
  items: InProgressItem[];
  showDate?: boolean;
  accentClass?: string;
}) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span
            className={`w-1 h-4 ${accentClass} rounded-full inline-block`}
          />
          <h4 className="text-sm font-semibold text-gray-800">{title}</h4>
        </div>
        <span className="text-xs text-gray-500 tabular-nums">
          {fmt(items.length)} 件
        </span>
      </div>
      {items.length === 0 ? (
        <p className="text-xs text-gray-400 py-2">該当なし</p>
      ) : (
        <ul className="space-y-1.5 max-h-[300px] overflow-y-auto pr-1">
          {items.map((it) => (
            <li
              key={it.applicationId}
              className="text-sm border-l-2 border-gray-200 pl-2 py-0.5"
            >
              <div className="font-medium text-gray-800 truncate">
                {it.candidateName}
              </div>
              <div className="text-xs text-gray-600 truncate">
                {it.companyName}
              </div>
              {showDate && (
                <div className="text-xs text-gray-400 tabular-nums">
                  {it.scheduledDate ? `実施予定日: ${it.scheduledDate}` : "実施予定日: 未設定"}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// --- 応募ファネルセクション ---
function ApplicationFunnelSection({
  funnel,
  inProgress,
}: {
  funnel: {
    recommended: number;
    firstInterview: number;
    secondInterview: number;
    finalInterview: number;
    offers: number;
    acceptances: number;
    joins: number;
  };
  inProgress: InProgressBuckets;
}) {
  const base = Math.max(funnel.recommended, 1);

  const rows: { label: string; count: number }[] = [
    { label: "推薦", count: funnel.recommended },
    { label: "一次面接 実施", count: funnel.firstInterview },
    { label: "二次面接 実施", count: funnel.secondInterview },
    { label: "最終面接 実施", count: funnel.finalInterview },
    { label: "内定", count: funnel.offers },
    { label: "内定承諾", count: funnel.acceptances },
    { label: "入社", count: funnel.joins },
  ];

  return (
    <div className="space-y-6">
      {/* メインファネル */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 text-gray-600 text-left">
              <th className="px-4 py-2.5 font-medium">ステップ</th>
              <th className="px-3 py-2.5 font-medium text-right">件数</th>
              <th className="px-3 py-2.5 font-medium text-right">推薦比 (%)</th>
              <th className="px-3 py-2.5 font-medium text-right">前段比 (%)</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => {
              const prev = i === 0 ? row.count : rows[i - 1].count;
              return (
                <tr
                  key={row.label}
                  className="border-t border-gray-100 hover:bg-gray-50"
                >
                  <td className="px-4 py-2.5 font-medium text-gray-800">
                    {row.label}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums">
                    {fmt(row.count)}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-blue-600">
                    {pct(row.count, base)}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-gray-500">
                    {i === 0 ? "-" : pct(row.count, prev)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* 選考中の方 */}
      <div>
        <h3 className="text-sm font-semibold text-gray-800 mb-2 flex items-center gap-2">
          <span className="w-1 h-4 bg-yellow-500 rounded-full inline-block" />
          選考中の方
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          <InProgressPhaseCard
            title="書類選考"
            items={inProgress.書類選考}
            accentClass="bg-blue-400"
          />
          <InProgressPhaseCard
            title="一次面接"
            items={inProgress.一次面接}
            accentClass="bg-yellow-400"
          />
          <InProgressPhaseCard
            title="二次面接"
            items={inProgress.二次面接}
            accentClass="bg-orange-400"
          />
          <InProgressPhaseCard
            title="最終面接"
            items={inProgress.最終面接}
            accentClass="bg-pink-400"
          />
        </div>
      </div>

      {/* 内定承諾待ちの方 */}
      <div>
        <h3 className="text-sm font-semibold text-gray-800 mb-2 flex items-center gap-2">
          <span className="w-1 h-4 bg-green-500 rounded-full inline-block" />
          内定承諾待ちの方
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <InProgressPhaseCard
            title="内定"
            items={inProgress.内定}
            showDate={false}
            accentClass="bg-green-500"
          />
        </div>
      </div>
    </div>
  );
}

// --- 求職者個別テーブル ---
function JobSeekerTable({ rows }: { rows: JobSeekerSummary[] }) {
  const [filter, setFilter] = useState("");
  const filtered = useMemo(() => {
    const q = filter.trim();
    if (!q) {
      // デフォルト: 最終結果が空のものだけ
      return rows.filter((r) => !r.finalResult);
    }
    // 検索時: 面談実施済の全員から名前/担当者/最終結果/候補者NOで部分一致
    return rows.filter(
      (r) =>
        r.name.includes(q) ||
        r.candidateNo.includes(q) ||
        r.staff.includes(q) ||
        r.finalResult.includes(q)
    );
  }, [rows, filter]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3 flex-wrap">
          <input
            type="text"
            placeholder="氏名・候補者NO・担当者で絞り込み"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 bg-white text-gray-700 w-72 max-w-full"
          />
          <span className="text-xs text-gray-500">
            {filter ? "面談実施済 全員から検索" : "面談実施済 × 最終結果未設定"}
          </span>
        </div>
        <span className="text-xs text-gray-500">
          {fmt(filtered.length)} / {fmt(rows.length)} 件
        </span>
      </div>
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-gray-50 text-gray-600 text-left">
              <th className="px-3 py-2 font-medium whitespace-nowrap">氏名</th>
              <th className="px-3 py-2 font-medium whitespace-nowrap">候補者NO</th>
              <th className="px-3 py-2 font-medium whitespace-nowrap">担当者</th>
              <th className="px-3 py-2 font-medium whitespace-nowrap">面談日</th>
              <th className="px-3 py-2 font-medium whitespace-nowrap">エントリー日</th>
              <th className="px-3 py-2 font-medium whitespace-nowrap">最終結果</th>
              <th className="px-3 py-2 font-medium whitespace-nowrap text-right">推薦</th>
              <th className="px-3 py-2 font-medium whitespace-nowrap text-right">面接設定</th>
              <th className="px-3 py-2 font-medium whitespace-nowrap text-right">面接実施</th>
              <th className="px-3 py-2 font-medium whitespace-nowrap text-right">1次通過</th>
              <th className="px-3 py-2 font-medium whitespace-nowrap text-right">2次実施</th>
              <th className="px-3 py-2 font-medium whitespace-nowrap text-right">2次通過</th>
              <th className="px-3 py-2 font-medium whitespace-nowrap text-right">最終実施</th>
              <th className="px-3 py-2 font-medium whitespace-nowrap text-right">内定</th>
              <th className="px-3 py-2 font-medium whitespace-nowrap text-right">承諾</th>
              <th className="px-3 py-2 font-medium whitespace-nowrap">承諾日</th>
              <th className="px-3 py-2 font-medium whitespace-nowrap text-right">入社</th>
              <th className="px-3 py-2 font-medium whitespace-nowrap">入社日</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td
                  colSpan={18}
                  className="px-4 py-8 text-center text-gray-400"
                >
                  対象データがありません
                </td>
              </tr>
            ) : (
              filtered.map((r) => (
                <tr
                  key={r.id}
                  className="border-t border-gray-100 hover:bg-gray-50"
                >
                  <td className="px-3 py-2 whitespace-nowrap font-medium text-gray-800">
                    {r.name}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap text-gray-600">
                    {r.candidateNo || "-"}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap text-gray-600">
                    {r.staff || "-"}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap text-gray-700 font-medium">
                    {r.interviewDate ?? "-"}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap text-gray-600">
                    {r.entryDate ?? "-"}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap text-gray-600">
                    {r.finalResult || "-"}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{fmt(r.recommendations)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{fmt(r.interviewSettings)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{fmt(r.interviewsConducted)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{fmt(r.firstInterviewPass)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{fmt(r.secondInterviewExecuted)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{fmt(r.secondInterviewPass)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{fmt(r.finalInterviewExecuted)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{fmt(r.offers)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{fmt(r.acceptances)}</td>
                  <td className="px-3 py-2 whitespace-nowrap text-gray-600">
                    {r.acceptanceDate ?? "-"}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{fmt(r.hires)}</td>
                  <td className="px-3 py-2 whitespace-nowrap text-gray-600">
                    {r.hireDate ?? "-"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// --- ローディング ---
function LoadingSkeleton() {
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <h1 className="text-lg font-bold text-gray-900">採用ダッシュボード</h1>
          <span className="text-xs text-gray-400">読み込み中...</span>
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-4 py-6 space-y-8">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div
              key={i}
              className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 animate-pulse"
            >
              <div className="h-3 bg-gray-200 rounded w-20 mb-3" />
              <div className="h-7 bg-gray-200 rounded w-16" />
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}

function NotConnectedBanner() {
  return (
    <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 mb-6">
      <div className="flex items-center gap-2">
        <span className="text-yellow-600 text-lg">⚠</span>
        <div>
          <p className="text-sm font-semibold text-yellow-800">Notion未接続</p>
          <p className="text-xs text-yellow-600">
            .env.local に NOTION_API_KEY を設定してください。現在はダミーデータを表示しています。
          </p>
        </div>
      </div>
    </div>
  );
}

// ===================================
// メインダッシュボード
// ===================================
export default function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 切り口: staff or source (片方ずつ。どちらか選択時、もう片方は "全体" にリセット)
  const [selectedStaff, setSelectedStaff] = useState("全体");
  const [selectedSource, setSelectedSource] = useState("全体");
  const [selectedMonth, setSelectedMonth] = useState("all");

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/dashboard", { cache: "no-store" });
      if (!res.ok) throw new Error("API error");
      const json: DashboardData = await res.json();
      setData(json);
      setError(null);
    } catch (e) {
      setError("データの取得に失敗しました");
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const marketingCostMap = useMemo(() => getMarketingCostMap(), []);

  const displayMetrics = useMemo((): MonthlyCAMetrics[] => {
    if (!data) return [];

    let metrics: MonthlyCAMetrics[];
    if (selectedSource !== "全体") {
      metrics = data.sourceMetrics[selectedSource] ?? [];
    } else if (selectedStaff !== "全体") {
      metrics = data.staffMetrics[selectedStaff] ?? [];
    } else {
      metrics = data.monthlyMetrics;
    }

    if (selectedMonth !== "all") {
      metrics = metrics.filter((m) => m.month === selectedMonth);
    }

    return metrics;
  }, [data, selectedStaff, selectedSource, selectedMonth]);

  const allMonths = useMemo((): string[] => {
    if (!data) return [];
    return data.monthlyMetrics.map((m) => m.month);
  }, [data]);

  const displayTotals = useMemo((): Record<CAMetricKey, number> => {
    const t: Record<string, number> = {};
    for (const key of CA_METRIC_KEYS) t[key] = 0;
    for (const row of displayMetrics) {
      for (const key of CA_METRIC_KEYS) {
        t[key] += row[key];
      }
    }
    return t as Record<CAMetricKey, number>;
  }, [displayMetrics]);

  const grandTotals = useMemo((): Record<CAMetricKey, number> => {
    if (!data) {
      const t: Record<string, number> = {};
      for (const key of CA_METRIC_KEYS) t[key] = 0;
      return t as Record<CAMetricKey, number>;
    }
    return data.grandTotals as unknown as Record<CAMetricKey, number>;
  }, [data]);

  const averageDays = useMemo((): AverageDays => {
    if (!data) return { entryToInterview: null, entryToAcceptance: null };
    if (selectedSource !== "全体") {
      return (
        data.sourceAverageDays[selectedSource] ?? {
          entryToInterview: null,
          entryToAcceptance: null,
        }
      );
    }
    if (selectedStaff !== "全体") {
      return (
        data.staffAverageDays[selectedStaff] ?? {
          entryToInterview: null,
          entryToAcceptance: null,
        }
      );
    }
    return data.averageDays;
  }, [data, selectedStaff, selectedSource]);

  function cpa(month: string): string {
    const cost = marketingCostMap[month] ?? 0;
    if (!data) return "-";
    const row = data.monthlyMetrics.find((m) => m.month === month);
    if (!row || row.エントリー数 === 0 || cost === 0) return "-";
    return "¥" + fmt(Math.round(cost / row.エントリー数));
  }

  const barChartData = useMemo(() => {
    return displayMetrics.map((row) => ({
      month: row.month.slice(5),
      エントリー数: row.エントリー数,
      有効エントリー数: row.有効エントリー数,
      面談数: row.面談数,
      内定承諾数: row.内定承諾数,
      入社数: row.入社数,
    }));
  }, [displayMetrics]);

  const staffOptions = useMemo((): string[] => {
    if (!data) return ["全体"];
    return ["全体", ...data.staffList];
  }, [data]);

  const sourceOptions = useMemo((): string[] => {
    if (!data) return ["全体"];
    return ["全体", ...data.sourceList];
  }, [data]);

  if (loading) return <LoadingSkeleton />;

  if (error && !data) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white rounded-xl shadow-sm border border-red-200 p-8 text-center">
          <p className="text-red-600 font-semibold mb-2">エラー</p>
          <p className="text-gray-600 text-sm">{error}</p>
          <button
            onClick={fetchData}
            className="mt-4 px-4 py-2 bg-blue-500 text-white rounded-lg text-sm hover:bg-blue-600 transition"
          >
            再読み込み
          </button>
        </div>
      </div>
    );
  }

  const generatedAt = data?.generatedAt
    ? new Date(data.generatedAt).toLocaleString("ja-JP", {
        timeZone: "Asia/Tokyo",
      })
    : "";

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <h1 className="text-lg font-bold text-gray-900">採用ダッシュボード</h1>
          <div className="flex items-center gap-3">
            <button
              onClick={fetchData}
              className="text-xs text-blue-500 hover:text-blue-700 transition"
            >
              更新
            </button>
            <span className="text-xs text-gray-400">
              データ生成: {generatedAt || "-"}
            </span>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6 space-y-8">
        {data && !data.isConnected && <NotConnectedBanner />}

        {/* ================= RA: 求人開拓 ================= */}
        <section>
          <h2 className="text-base font-bold text-gray-800 mb-3 flex items-center gap-2">
            <span className="w-1.5 h-5 bg-blue-500 rounded-full inline-block" />
            求人開拓（RA）
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <StatusBreakdownCard
              title="契約企業数"
              total={data?.companySummary.total ?? 0}
              byStatus={data?.companySummary.byStatus ?? {}}
              highlight="契約"
            />
            <StatusBreakdownCard
              title="求人数"
              total={data?.jobSummary.total ?? 0}
              byStatus={data?.jobSummary.byStatus ?? {}}
              highlight="公開中"
            />
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 mt-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">
              公開中求人の職種コード別内訳
            </h3>
            {data && Object.keys(data.jobSummary.publishedByJobCode).length > 0 ? (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
                {Object.entries(data.jobSummary.publishedByJobCode)
                  .sort((a, b) => b[1] - a[1])
                  .map(([code, count]) => (
                    <div
                      key={code}
                      className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2"
                    >
                      <span className="text-gray-700 truncate">{code}</span>
                      <span className="tabular-nums font-semibold text-gray-900 ml-2">
                        {fmt(count)}
                      </span>
                    </div>
                  ))}
              </div>
            ) : (
              <p className="text-xs text-gray-400">
                職種コードのデータがありません（Notion 側に「職種コード」を入力すると表示されます）。
              </p>
            )}
          </div>
        </section>

        {/* ================= 応募ファネル (応募管理 DB) ================= */}
        <section>
          <h2 className="text-base font-bold text-gray-800 mb-3 flex items-center gap-2">
            <span className="w-1.5 h-5 bg-cyan-500 rounded-full inline-block" />
            応募ファネル（エントリー以降の歩留）
          </h2>
          {data ? (
            <ApplicationFunnelSection
              funnel={data.applicationFunnel}
              inProgress={data.inProgress}
            />
          ) : null}
        </section>

        {/* ================= CA: 求職者対応 ================= */}
        <section>
          <h2 className="text-base font-bold text-gray-800 mb-3 flex items-center gap-2">
            <span className="w-1.5 h-5 bg-green-500 rounded-full inline-block" />
            求職者対応（CA）
          </h2>

          <div className="flex flex-wrap gap-3 mb-4 items-center">
            <label className="text-xs text-gray-500">担当者:</label>
            <select
              value={selectedStaff}
              onChange={(e) => {
                setSelectedStaff(e.target.value);
                if (e.target.value !== "全体") setSelectedSource("全体");
              }}
              className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 bg-white text-gray-700"
            >
              {staffOptions.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>

            <label className="text-xs text-gray-500 ml-2">流入経路:</label>
            <select
              value={selectedSource}
              onChange={(e) => {
                setSelectedSource(e.target.value);
                if (e.target.value !== "全体") setSelectedStaff("全体");
              }}
              className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 bg-white text-gray-700"
            >
              {sourceOptions.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>

            <label className="text-xs text-gray-500 ml-2">月:</label>
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 bg-white text-gray-700"
            >
              <option value="all">全期間</option>
              {allMonths.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>

            {(selectedStaff !== "全体" || selectedSource !== "全体") && (
              <span className="text-xs text-gray-400">
                ※担当者と流入経路は片方ずつ
              </span>
            )}
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            <KPICard
              title="エントリー → 面談実施"
              value={
                averageDays.entryToInterview !== null
                  ? `${averageDays.entryToInterview}日`
                  : "-"
              }
              sub="平均所要日数"
            />
            <KPICard
              title="エントリー → 内定承諾"
              value={
                averageDays.entryToAcceptance !== null
                  ? `${averageDays.entryToAcceptance}日`
                  : "-"
              }
              sub="平均所要日数"
            />
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-gray-600 text-left">
                  <th className="px-4 py-2.5 font-medium whitespace-nowrap">月</th>
                  {CA_METRIC_KEYS.map((key) => (
                    <th
                      key={key}
                      className="px-3 py-2.5 font-medium whitespace-nowrap text-right"
                    >
                      {key}
                    </th>
                  ))}
                  <th className="px-3 py-2.5 font-medium whitespace-nowrap text-right">
                    エントリー→承諾率
                  </th>
                  <th className="px-3 py-2.5 font-medium whitespace-nowrap text-right">
                    面談→承諾率
                  </th>
                  <th className="px-3 py-2.5 font-medium whitespace-nowrap text-right">
                    マーケ費
                  </th>
                  <th className="px-3 py-2.5 font-medium whitespace-nowrap text-right">
                    CPA
                  </th>
                </tr>
              </thead>
              <tbody>
                {displayMetrics.length === 0 ? (
                  <tr>
                    <td
                      colSpan={CA_METRIC_KEYS.length + 5}
                      className="px-4 py-8 text-center text-gray-400"
                    >
                      データがありません
                    </td>
                  </tr>
                ) : (
                  <>
                    {displayMetrics.map((row, i) => (
                      <tr
                        key={i}
                        className="border-t border-gray-100 hover:bg-gray-50 transition-colors"
                      >
                        <td className="px-4 py-2.5 font-medium text-gray-800">
                          {row.month}
                        </td>
                        {CA_METRIC_KEYS.map((key) => (
                          <td
                            key={key}
                            className="px-3 py-2.5 text-right tabular-nums"
                          >
                            {fmt(row[key])}
                          </td>
                        ))}
                        <td className="px-3 py-2.5 text-right text-blue-600 font-medium">
                          {pct(row.内定承諾数, row.エントリー数)}
                        </td>
                        <td className="px-3 py-2.5 text-right text-blue-600 font-medium">
                          {pct(row.内定承諾数, row.面談数)}
                        </td>
                        <td className="px-3 py-2.5 text-right tabular-nums">
                          {marketingCostMap[row.month] != null
                            ? "¥" + fmt(marketingCostMap[row.month])
                            : "-"}
                        </td>
                        <td className="px-3 py-2.5 text-right tabular-nums">
                          {cpa(row.month)}
                        </td>
                      </tr>
                    ))}

                    <tr className="border-t-2 border-gray-200 bg-blue-50/50 text-xs text-gray-500">
                      <td className="px-4 py-2 font-medium">転換率</td>
                      <td className="px-3 py-2 text-right">-</td>
                      {CA_METRIC_KEYS.slice(1).map((key, idx) => (
                        <td key={key} className="px-3 py-2 text-right">
                          {pct(
                            displayTotals[key],
                            displayTotals[CA_METRIC_KEYS[idx]]
                          )}
                        </td>
                      ))}
                      <td className="px-3 py-2 text-right">-</td>
                      <td className="px-3 py-2 text-right">-</td>
                      <td className="px-3 py-2 text-right">-</td>
                      <td className="px-3 py-2 text-right">-</td>
                    </tr>

                    <tr className="border-t-2 border-gray-300 bg-gray-50 font-bold">
                      <td className="px-4 py-2.5">合計（表示期間）</td>
                      {CA_METRIC_KEYS.map((key) => (
                        <td
                          key={key}
                          className="px-3 py-2.5 text-right tabular-nums"
                        >
                          {fmt(displayTotals[key])}
                        </td>
                      ))}
                      <td className="px-3 py-2.5 text-right text-blue-600">
                        {pct(displayTotals["内定承諾数"], displayTotals["エントリー数"])}
                      </td>
                      <td className="px-3 py-2.5 text-right text-blue-600">
                        {pct(displayTotals["内定承諾数"], displayTotals["面談数"])}
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums">
                        ¥
                        {fmt(
                          displayMetrics.reduce(
                            (sum, r) => sum + (marketingCostMap[r.month] ?? 0),
                            0
                          )
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-right">-</td>
                    </tr>

                    <tr className="border-t border-gray-200 bg-yellow-50/50 font-semibold text-gray-700">
                      <td className="px-4 py-2.5">累計（事業開始から）</td>
                      {CA_METRIC_KEYS.map((key) => (
                        <td
                          key={key}
                          className="px-3 py-2.5 text-right tabular-nums"
                        >
                          {fmt(grandTotals[key])}
                        </td>
                      ))}
                      <td className="px-3 py-2.5 text-right text-blue-600">
                        {pct(grandTotals["内定承諾数"], grandTotals["エントリー数"])}
                      </td>
                      <td className="px-3 py-2.5 text-right text-blue-600">
                        {pct(grandTotals["内定承諾数"], grandTotals["面談数"])}
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums">
                        ¥{fmt(MARKETING_COSTS.reduce((sum, mc) => sum + mc.cost, 0))}
                      </td>
                      <td className="px-3 py-2.5 text-right">-</td>
                    </tr>
                  </>
                )}
              </tbody>
            </table>
          </div>

          {barChartData.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 mt-4">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">
                月別推移
              </h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={barChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="エントリー数" fill="#3B82F6" />
                  <Bar dataKey="有効エントリー数" fill="#10B981" />
                  <Bar dataKey="面談数" fill="#F59E0B" />
                  <Bar dataKey="内定承諾数" fill="#8B5CF6" />
                  <Bar dataKey="入社数" fill="#EF4444" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </section>

        {/* ================= 求職者個別 ================= */}
        <section>
          <h2 className="text-base font-bold text-gray-800 mb-3 flex items-center gap-2">
            <span className="w-1.5 h-5 bg-pink-500 rounded-full inline-block" />
            求職者個別の状況
          </h2>
          {data ? <JobSeekerTable rows={data.jobSeekerSummaries} /> : null}
        </section>

        {/* ================= プロフィール分析 ================= */}
        <section>
          <h2 className="text-base font-bold text-gray-800 mb-3 flex items-center gap-2">
            <span className="w-1.5 h-5 bg-purple-500 rounded-full inline-block" />
            エントリー者プロフィール
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <DonutChart
              data={data?.prefectureData ?? []}
              title="現住所の都道府県別"
            />
            <DonutChart
              data={data?.ageGroupData ?? []}
              title="年代別構成比"
            />
            <DonutChart
              data={data?.salaryRangeData ?? []}
              title="現年収帯別構成比"
            />
          </div>
        </section>

        {/* ================= マーケ費用・CPA ================= */}
        <section>
          <h2 className="text-base font-bold text-gray-800 mb-3 flex items-center gap-2">
            <span className="w-1.5 h-5 bg-orange-500 rounded-full inline-block" />
            マーケ費用・CPA
          </h2>
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-gray-600 text-left">
                  <th className="px-4 py-2.5 font-medium">月</th>
                  <th className="px-3 py-2.5 font-medium text-right">マーケ費用</th>
                  <th className="px-3 py-2.5 font-medium text-right">エントリー数</th>
                  <th className="px-3 py-2.5 font-medium text-right">
                    CPA（マーケ費/エントリー）
                  </th>
                  <th className="px-3 py-2.5 font-medium text-right">有効エントリー数</th>
                  <th className="px-3 py-2.5 font-medium text-right">
                    有効CPA（マーケ費/有効エントリー）
                  </th>
                </tr>
              </thead>
              <tbody>
                {MARKETING_COSTS.map((mc, i) => {
                  const row = data?.monthlyMetrics.find((m) => m.month === mc.month);
                  const entries = row?.エントリー数 ?? 0;
                  const validEntries = row?.有効エントリー数 ?? 0;
                  return (
                    <tr
                      key={i}
                      className="border-t border-gray-100 hover:bg-gray-50"
                    >
                      <td className="px-4 py-2.5 font-medium text-gray-800">
                        {mc.month}
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums">
                        ¥{fmt(mc.cost)}
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums">
                        {fmt(entries)}
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums font-medium text-orange-600">
                        {entries > 0 && mc.cost > 0
                          ? "¥" + fmt(Math.round(mc.cost / entries))
                          : "-"}
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums">
                        {fmt(validEntries)}
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums font-medium text-orange-600">
                        {validEntries > 0 && mc.cost > 0
                          ? "¥" + fmt(Math.round(mc.cost / validEntries))
                          : "-"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      </main>

      <footer className="bg-white border-t border-gray-200 mt-8 py-4 text-center text-xs text-gray-400">
        マーケ費用編集: src/lib/marketing-data.ts ｜ Notion APIから取得・毎朝
        9:00 JST に GitHub Actions で自動 revalidate
      </footer>
    </div>
  );
}
