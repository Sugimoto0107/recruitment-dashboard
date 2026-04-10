"use client";

import { useState, useEffect, useMemo } from "react";
import {
  caMetricsData,
  marketingCostData,
  prefectureData,
  ageGroupData,
  salaryRangeData,
  staffList,
} from "@/lib/data";
import { CA_METRIC_KEYS, CAMetricKey, RAMetrics } from "@/lib/types";
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
function KPICard({ title, value, sub }: { title: string; value: string | number; sub?: string }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 flex flex-col gap-1">
      <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">{title}</p>
      <p className="text-2xl font-bold text-gray-900">{typeof value === "number" ? fmt(value) : value}</p>
      {sub && <p className="text-xs text-gray-400">{sub}</p>}
    </div>
  );
}

// --- 円グラフ ---
function DonutChart({ data, title }: { data: { label: string; count: number; percentage: number }[]; title: string }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
      <h3 className="text-sm font-semibold text-gray-700 mb-3">{title}</h3>
      <ResponsiveContainer width="100%" height={260}>
        <PieChart>
          <Pie
            data={data}
            dataKey="count"
            nameKey="label"
            cx="50%"
            cy="50%"
            innerRadius={50}
            outerRadius={90}
            paddingAngle={2}
            label={({ name, payload }: any) => `${name} ${payload?.percentage ?? ""}%`}
          >
            {data.map((_, i) => (
              <Cell key={i} fill={COLORS[i % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip formatter={(value: any) => [fmt(Number(value)) + "人", "人数"]} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

export default function Dashboard() {
  // --- RA指標 ---
  const [raMetrics, setRaMetrics] = useState<RAMetrics>({ contractedCompanies: 0, activeJobs: 0 });

  useEffect(() => {
    fetch("/api/notion-stats")
      .then((r) => r.json())
      .then(setRaMetrics)
      .catch(() => {});
  }, []);

  // --- CA指標のフィルタリング ---
  const [selectedStaff, setSelectedStaff] = useState("全体");
  const [selectedMonth, setSelectedMonth] = useState("all");

  const allMonths = useMemo(() => {
    const months = [...new Set(caMetricsData.map((d) => d.month))].sort();
    return months;
  }, []);

  // フィルター済みデータ
  const filteredCA = useMemo(() => {
    return caMetricsData.filter(
      (d) => d.担当者 === selectedStaff && (selectedMonth === "all" || d.month === selectedMonth)
    );
  }, [selectedStaff, selectedMonth]);

  // 合計行の算出
  const totals = useMemo(() => {
    const t: Record<CAMetricKey, number> = {} as Record<CAMetricKey, number>;
    for (const key of CA_METRIC_KEYS) t[key] = 0;
    for (const row of filteredCA) {
      for (const key of CA_METRIC_KEYS) {
        t[key] += row[key];
      }
    }
    return t;
  }, [filteredCA]);

  // 事業開始からの累計（全担当者・全月）
  const grandTotals = useMemo(() => {
    const t: Record<CAMetricKey, number> = {} as Record<CAMetricKey, number>;
    for (const key of CA_METRIC_KEYS) t[key] = 0;
    const allData = caMetricsData.filter((d) => d.担当者 === "全体");
    for (const row of allData) {
      for (const key of CA_METRIC_KEYS) {
        t[key] += row[key];
      }
    }
    return t;
  }, []);

  // マーケ費のマッチング
  const monthlyMarketingMap = useMemo(() => {
    const m: Record<string, number> = {};
    for (const mc of marketingCostData) m[mc.month] = mc.cost;
    return m;
  }, []);

  // CPA算出
  function cpa(month: string): string {
    const cost = monthlyMarketingMap[month] ?? 0;
    const entry = caMetricsData.find((d) => d.month === month && d.担当者 === "全体");
    if (!entry || entry.エントリー数 === 0 || cost === 0) return "-";
    return "¥" + fmt(Math.round(cost / entry.エントリー数));
  }

  // 棒グラフ用データ
  const barChartData = useMemo(() => {
    return allMonths.map((month) => {
      const row = caMetricsData.find((d) => d.month === month && d.担当者 === selectedStaff);
      return {
        month: month.slice(5),
        エントリー数: row?.エントリー数 ?? 0,
        有効エントリー数: row?.有効エントリー数 ?? 0,
        面談数: row?.面談数 ?? 0,
        内定承諾数: row?.内定承諾数 ?? 0,
        入社数: row?.入社数 ?? 0,
      };
    });
  }, [allMonths, selectedStaff]);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ヘッダー */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <h1 className="text-lg font-bold text-gray-900">採用ダッシュボード</h1>
          <span className="text-xs text-gray-400">Last updated: {new Date().toLocaleDateString("ja-JP")}</span>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6 space-y-8">
        {/* ================= RA: 求人開拓 ================= */}
        <section>
          <h2 className="text-base font-bold text-gray-800 mb-3 flex items-center gap-2">
            <span className="w-1.5 h-5 bg-blue-500 rounded-full inline-block" />
            求人開拓（RA）
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <KPICard title="契約企業数" value={raMetrics.contractedCompanies} sub="Notion連携" />
            <KPICard title="公開中の求人数" value={raMetrics.activeJobs} sub="Notion連携" />
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
              {staffList.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 bg-white text-gray-700"
            >
              <option value="all">全期間</option>
              {allMonths.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>

          {/* ファネルテーブル */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-gray-600 text-left">
                  <th className="px-4 py-2.5 font-medium whitespace-nowrap">月</th>
                  {CA_METRIC_KEYS.map((key) => (
                    <th key={key} className="px-3 py-2.5 font-medium whitespace-nowrap text-right">{key}</th>
                  ))}
                  <th className="px-3 py-2.5 font-medium whitespace-nowrap text-right">エントリー→承諾率</th>
                  <th className="px-3 py-2.5 font-medium whitespace-nowrap text-right">面談→承諾率</th>
                  <th className="px-3 py-2.5 font-medium whitespace-nowrap text-right">マーケ費</th>
                  <th className="px-3 py-2.5 font-medium whitespace-nowrap text-right">CPA</th>
                </tr>
              </thead>
              <tbody>
                {filteredCA.map((row, i) => (
                  <tr key={i} className="border-t border-gray-100 hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-2.5 font-medium text-gray-800">{row.month}</td>
                    {CA_METRIC_KEYS.map((key) => (
                      <td key={key} className="px-3 py-2.5 text-right tabular-nums">{fmt(row[key])}</td>
                    ))}
                    <td className="px-3 py-2.5 text-right text-blue-600 font-medium">
                      {pct(row.内定承諾数, row.エントリー数)}
                    </td>
                    <td className="px-3 py-2.5 text-right text-blue-600 font-medium">
                      {pct(row.内定承諾数, row.面談数)}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums">
                      {monthlyMarketingMap[row.month] ? "¥" + fmt(monthlyMarketingMap[row.month]) : "-"}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{cpa(row.month)}</td>
                  </tr>
                ))}

                {/* 転換率行 */}
                <tr className="border-t-2 border-gray-200 bg-blue-50/50 text-xs text-gray-500">
                  <td className="px-4 py-2 font-medium">転換率</td>
                  <td className="px-3 py-2 text-right">-</td>
                  {CA_METRIC_KEYS.slice(1).map((key, idx) => (
                    <td key={key} className="px-3 py-2 text-right">
                      {pct(totals[key], totals[CA_METRIC_KEYS[idx]])}
                    </td>
                  ))}
                  <td className="px-3 py-2 text-right">-</td>
                  <td className="px-3 py-2 text-right">-</td>
                  <td className="px-3 py-2 text-right">-</td>
                  <td className="px-3 py-2 text-right">-</td>
                </tr>

                {/* 合計行 */}
                <tr className="border-t-2 border-gray-300 bg-gray-50 font-bold">
                  <td className="px-4 py-2.5">合計（表示期間）</td>
                  {CA_METRIC_KEYS.map((key) => (
                    <td key={key} className="px-3 py-2.5 text-right tabular-nums">{fmt(totals[key])}</td>
                  ))}
                  <td className="px-3 py-2.5 text-right text-blue-600">
                    {pct(totals["内定承諾数"], totals["エントリー数"])}
                  </td>
                  <td className="px-3 py-2.5 text-right text-blue-600">
                    {pct(totals["内定承諾数"], totals["面談数"])}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums">
                    ¥{fmt(filteredCA.reduce((sum, r) => sum + (monthlyMarketingMap[r.month] ?? 0), 0))}
                  </td>
                  <td className="px-3 py-2.5 text-right">-</td>
                </tr>

                {/* 事業開始からの累計 */}
                <tr className="border-t border-gray-200 bg-yellow-50/50 font-semibold text-gray-700">
                  <td className="px-4 py-2.5">累計（事業開始から）</td>
                  {CA_METRIC_KEYS.map((key) => (
                    <td key={key} className="px-3 py-2.5 text-right tabular-nums">{fmt(grandTotals[key])}</td>
                  ))}
                  <td className="px-3 py-2.5 text-right text-blue-600">
                    {pct(grandTotals["内定承諾数"], grandTotals["エントリー数"])}
                  </td>
                  <td className="px-3 py-2.5 text-right text-blue-600">
                    {pct(grandTotals["内定承諾数"], grandTotals["面談数"])}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums">
                    ¥{fmt(marketingCostData.reduce((sum, mc) => sum + mc.cost, 0))}
                  </td>
                  <td className="px-3 py-2.5 text-right">-</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* ファネル棒グラフ */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 mt-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">月別推移</h3>
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
        </section>

        {/* ================= プロフィール分析 ================= */}
        <section>
          <h2 className="text-base font-bold text-gray-800 mb-3 flex items-center gap-2">
            <span className="w-1.5 h-5 bg-purple-500 rounded-full inline-block" />
            エントリー者プロフィール
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <DonutChart data={prefectureData} title="現住所の都道府県別" />
            <DonutChart data={ageGroupData} title="年代別構成比" />
            <DonutChart data={salaryRangeData} title="現年収帯別構成比" />
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
                  <th className="px-3 py-2.5 font-medium text-right">CPA（マーケ費/エントリー）</th>
                  <th className="px-3 py-2.5 font-medium text-right">有効エントリー数</th>
                  <th className="px-3 py-2.5 font-medium text-right">有効CPA（マーケ費/有効エントリー）</th>
                </tr>
              </thead>
              <tbody>
                {marketingCostData.map((mc, i) => {
                  const row = caMetricsData.find((d) => d.month === mc.month && d.担当者 === "全体");
                  const entries = row?.エントリー数 ?? 0;
                  const validEntries = row?.有効エントリー数 ?? 0;
                  return (
                    <tr key={i} className="border-t border-gray-100 hover:bg-gray-50">
                      <td className="px-4 py-2.5 font-medium text-gray-800">{mc.month}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums">¥{fmt(mc.cost)}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums">{fmt(entries)}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums font-medium text-orange-600">
                        {entries > 0 && mc.cost > 0 ? "¥" + fmt(Math.round(mc.cost / entries)) : "-"}
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums">{fmt(validEntries)}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums font-medium text-orange-600">
                        {validEntries > 0 && mc.cost > 0 ? "¥" + fmt(Math.round(mc.cost / validEntries)) : "-"}
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
        データ編集: src/lib/data.ts | Notion連携: .env.local にAPIキーを設定
      </footer>
    </div>
  );
}
