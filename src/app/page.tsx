"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { CA_METRIC_KEYS, CAMetricKey } from "@/lib/types";
import { MARKETING_COSTS, getMarketingCostMap } from "@/lib/marketing-data";
import type { DashboardData, MonthlyCAMetrics, ProfileDistribution, AverageDays } from "@/lib/process-data";
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
      {/* ドーナツグラフ */}
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
      {/* 凡例をグラフ下に表示（切れない） */}
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

// --- ローディングスケルトン ---
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
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-32 mb-4" />
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-8 bg-gray-100 rounded" />
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}

// --- Notion未接続メッセージ ---
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
// メインダッシュボードコンポーネント
// ===================================
export default function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // フィルター状態
  const [selectedStaff, setSelectedStaff] = useState("全体");
  const [selectedMonth, setSelectedMonth] = useState("all");

  // データ取得
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/dashboard");
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

  // マーケ費用マップ
  const marketingCostMap = useMemo(() => getMarketingCostMap(), []);

  // 表示用の月別指標（フィルター適用）
  const displayMetrics = useMemo((): MonthlyCAMetrics[] => {
    if (!data) return [];

    let metrics: MonthlyCAMetrics[];
    if (selectedStaff === "全体") {
      metrics = data.monthlyMetrics;
    } else {
      metrics = data.staffMetrics[selectedStaff] ?? [];
    }

    if (selectedMonth !== "all") {
      metrics = metrics.filter((m) => m.month === selectedMonth);
    }

    return metrics;
  }, [data, selectedStaff, selectedMonth]);

  // 全月リスト
  const allMonths = useMemo((): string[] => {
    if (!data) return [];
    return data.monthlyMetrics.map((m) => m.month);
  }, [data]);

  // 表示期間の合計
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

  // 事業開始からの累計（全体のみ）
  const grandTotals = useMemo((): Record<CAMetricKey, number> => {
    if (!data) {
      const t: Record<string, number> = {};
      for (const key of CA_METRIC_KEYS) t[key] = 0;
      return t as Record<CAMetricKey, number>;
    }
    return data.grandTotals as unknown as Record<CAMetricKey, number>;
  }, [data]);

  // 平均日数
  const averageDays = useMemo((): AverageDays => {
    if (!data) return { entryToInterview: null, entryToAcceptance: null };
    if (selectedStaff === "全体") {
      return data.averageDays;
    }
    return data.staffAverageDays[selectedStaff] ?? { entryToInterview: null, entryToAcceptance: null };
  }, [data, selectedStaff]);

  // CPA算出
  function cpa(month: string): string {
    const cost = marketingCostMap[month] ?? 0;
    if (!data) return "-";
    const row = data.monthlyMetrics.find((m) => m.month === month);
    if (!row || row.エントリー数 === 0 || cost === 0) return "-";
    return "¥" + fmt(Math.round(cost / row.エントリー数));
  }

  // 棒グラフ用データ
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

  // 担当者リスト（全体を先頭に）
  const staffOptions = useMemo((): string[] => {
    if (!data) return ["全体"];
    return ["全体", ...data.staffList];
  }, [data]);

  // --- ローディング中 ---
  if (loading) return <LoadingSkeleton />;

  // --- エラー ---
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

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ヘッダー */}
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
              {new Date().toLocaleDateString("ja-JP")} 更新
            </span>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6 space-y-8">
        {/* Notion未接続バナー */}
        {data && !data.isConnected && <NotConnectedBanner />}

        {/* ================= RA: 求人開拓 ================= */}
        <section>
          <h2 className="text-base font-bold text-gray-800 mb-3 flex items-center gap-2">
            <span className="w-1.5 h-5 bg-blue-500 rounded-full inline-block" />
            求人開拓（RA）
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <KPICard
              title="契約企業数"
              value={data?.contractedCompanies ?? 0}
              sub="Notion連携"
            />
            <KPICard
              title="公開中の求人数"
              value={data?.activeJobs ?? 0}
              sub="Notion連携"
            />
          </div>
        </section>

        {/* ================= CA: 求職者対応 ================= */}
        <section>
          <h2 className="text-base font-bold text-gray-800 mb-3 flex items-center gap-2">
            <span className="w-1.5 h-5 bg-green-500 rounded-full inline-block" />
            求職者対応（CA）
          </h2>

          {/* フィルター */}
          <div className="flex flex-wrap gap-3 mb-4">
            <select
              value={selectedStaff}
              onChange={(e) => setSelectedStaff(e.target.value)}
              className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 bg-white text-gray-700"
            >
              {staffOptions.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
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
          </div>

          {/* 平均日数カード */}
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

          {/* ファネルテーブル */}
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

                    {/* 転換率行 */}
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

                    {/* 合計行（表示期間） */}
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

                    {/* 事業開始からの累計 */}
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

          {/* ファネル棒グラフ */}
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

      {/* フッター */}
      <footer className="bg-white border-t border-gray-200 mt-8 py-4 text-center text-xs text-gray-400">
        マーケ費用編集: src/lib/marketing-data.ts | Notion APIからリアルタイム取得
      </footer>
    </div>
  );
}
