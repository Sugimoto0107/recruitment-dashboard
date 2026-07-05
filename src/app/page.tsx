"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { CA_METRIC_KEYS, CAMetricKey } from "@/lib/types";
import { MARKETING_COSTS, getMarketingCostMap } from "@/lib/marketing-data";
import type {
  DashboardData,
  MonthlyCAMetrics,
  ProfileDistribution,
  ProfileGroup,
  AverageDays,
  InProgressBuckets,
  InProgressItem,
  JobSeekerSummary,
  OfferComparison,
  OfferGroupStat,
  MonthlySpeakingRatioData,
  MonthlyAcceptanceData,
  MonthlyJoinForecastData,
} from "@/lib/process-data";
import type { RakudenSummary } from "@/lib/sheets";
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

const COLORS = [
  "#3B82F6", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6",
  "#EC4899", "#06B6D4", "#F97316", "#84CC16", "#6366F1",
  "#14B8A6", "#D946EF",
];

function fmt(n: number): string {
  return n.toLocaleString("ja-JP");
}

function pct(numerator: number, denominator: number): string {
  if (denominator === 0) return "-";
  return ((numerator / denominator) * 100).toFixed(1) + "%";
}

function fmtDate(value: string | null | undefined): string {
  if (!value) return "-";
  return value.slice(0, 10);
}

const CA_METRIC_LABELS: Record<CAMetricKey, string> = {
  エントリー数: "エントリー",
  有効エントリー数: "有効",
  面談数: "面談",
  推薦社数: "推薦",
  面接設定数: "面接設定",
  面接実施数: "面接実施",
  一次面接通過数: "1次通過",
  二次面接通過数: "2次通過",
  内定数: "内定",
  内定承諾数: "承諾",
  入社数: "入社",
};

function emptyMonthlyMetrics(month: string): MonthlyCAMetrics {
  return {
    month,
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
  };
}

// 複数 list の月別指標を合計
function sumMetricsLists(lists: MonthlyCAMetrics[][]): MonthlyCAMetrics[] {
  if (lists.length === 0) return [];
  const map = new Map<string, MonthlyCAMetrics>();
  for (const list of lists) {
    for (const m of list) {
      if (!map.has(m.month)) map.set(m.month, emptyMonthlyMetrics(m.month));
      const t = map.get(m.month)!;
      for (const k of CA_METRIC_KEYS) {
        t[k] += m[k];
      }
    }
  }
  return Array.from(map.values()).sort((a, b) =>
    a.month.localeCompare(b.month)
  );
}

// 担当者×流入経路 を併用してメトリクスを取得
function selectMetrics(
  data: DashboardData,
  staff: string,
  sources: string[]
): MonthlyCAMetrics[] {
  const isAllStaff = staff === "全体";
  const isAllSources = sources.length === 0;

  if (isAllStaff && isAllSources) return data.monthlyMetrics;
  if (!isAllStaff && isAllSources) return data.staffMetrics[staff] ?? [];
  if (isAllStaff && !isAllSources) {
    return sumMetricsLists(sources.map((s) => data.sourceMetrics[s] ?? []));
  }
  // 担当者×流入経路 (両方選択中)
  const staffMap = data.staffSourceMetrics[staff] ?? {};
  return sumMetricsLists(sources.map((s) => staffMap[s] ?? []));
}

// --- KPIカード ---
function KPICard({ title, value, sub }: { title: string; value: string | number; sub?: string }) {
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

// --- ステータス別カード ---
function StatusBreakdownCard({
  title,
  total,
  byStatus,
  highlight,
  subtitle,
}: {
  title: string;
  total: number;
  byStatus: Record<string, number>;
  highlight?: string;
  subtitle?: string;
}) {
  const entries = Object.entries(byStatus).sort((a, b) => b[1] - a[1]);
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
      <div className="flex items-baseline justify-between gap-2 mb-1">
        <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">{title}</p>
        {subtitle && <p className="text-[10px] text-gray-400">{subtitle}</p>}
      </div>
      <p className="text-3xl font-bold text-gray-900 mb-3">{fmt(total)}</p>
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
function DonutChart({ data, title }: { data: ProfileDistribution[]; title: string }) {
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
          <Tooltip formatter={(value: any) => [fmt(Number(value)) + "人", "人数"]} />
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

// --- 選考中・承諾待ちカード ---
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
          <span className={`w-1 h-4 ${accentClass} rounded-full inline-block`} />
          <h4 className="text-sm font-semibold text-gray-800">{title}</h4>
        </div>
        <span className="text-xs text-gray-500 tabular-nums">{fmt(items.length)} 件</span>
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
              <div className="font-medium text-gray-800 truncate">{it.candidateName}</div>
              <div className="text-xs text-gray-600 truncate">{it.companyName}</div>
              {showDate && (
                <div className="text-xs text-gray-400 tabular-nums">
                  実施予定日: {fmtDate(it.scheduledDate) || "未設定"}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function OfferComparisonCard({
  tone,
  title,
  subtitle,
  stat,
}: {
  tone: "offer" | "noOffer";
  title: string;
  subtitle: string;
  stat: OfferGroupStat;
}) {
  const isOffer = tone === "offer";
  const bar = isOffer ? "border-t-emerald-500" : "border-t-amber-500";
  const chip = isOffer ? "text-emerald-700 bg-emerald-50" : "text-amber-700 bg-amber-50";
  const num = isOffer ? "text-emerald-600" : "text-amber-600";
  const chipLabel = isOffer ? "内定を獲得" : "内定なし";
  return (
    <div className={`bg-white rounded-xl shadow-sm border border-gray-100 border-t-[3px] ${bar} p-4`}>
      <span className={`inline-flex items-center gap-1.5 text-[11px] font-semibold rounded-full px-2.5 py-1 ${chip}`}>
        ● {chipLabel}
      </span>
      <h4 className="text-sm font-semibold text-gray-800 mt-2.5">
        {title} <span className="text-gray-400 font-normal text-xs">n={stat.count}</span>
      </h4>
      <p className="text-[11px] text-gray-400 mb-3.5">{subtitle}</p>
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-gray-50 rounded-lg border border-gray-100 p-3">
          <p className="text-[10px] text-gray-500 mb-1.5 leading-tight">平均 推薦社数</p>
          <p className={`text-2xl font-bold tabular-nums leading-none ${num}`}>
            {stat.avgRecommendations.toFixed(1)}
            <span className="text-xs font-semibold text-gray-400 ml-0.5">社</span>
          </p>
        </div>
        <div className="bg-gray-50 rounded-lg border border-gray-100 p-3">
          <p className="text-[10px] text-gray-500 mb-1.5 leading-tight">平均 1次面接<br />実施数</p>
          <p className={`text-2xl font-bold tabular-nums leading-none ${num}`}>
            {stat.avgFirstInterview.toFixed(1)}
            <span className="text-xs font-semibold text-gray-400 ml-0.5">社</span>
          </p>
        </div>
      </div>
    </div>
  );
}

function ApplicationFunnelSection({
  funnel,
  comparison,
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
  comparison: OfferComparison;
  inProgress: InProgressBuckets;
}) {
  const base = Math.max(funnel.recommended, 1);

  const rows = [
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
      {/* 左: ファネル表（コンパクト・左詰） / 右: 内定到達有無の比較カード */}
      <div className="flex flex-col lg:flex-row lg:items-start gap-5">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-x-auto lg:shrink-0">
          <table className="text-sm">
            <thead>
              <tr className="bg-gray-50 text-gray-600 text-left">
                <th className="px-3 py-1.5 font-medium">ステップ</th>
                <th className="px-3 py-1.5 font-medium text-right">件数</th>
                <th className="px-3 py-1.5 font-medium text-right">推薦比 (%)</th>
                <th className="px-3 py-1.5 font-medium text-right">前段比 (%)</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => {
                const prev = i === 0 ? row.count : rows[i - 1].count;
                return (
                  <tr key={row.label} className="border-t border-gray-100 hover:bg-gray-50">
                    <td className="px-3 py-1.5 font-medium text-gray-800 whitespace-nowrap">{row.label}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums font-semibold">{fmt(row.count)}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums text-blue-600">
                      {pct(row.count, base)}
                    </td>
                    <td className="px-3 py-1.5 text-right tabular-nums text-gray-500">
                      {i === 0 ? "-" : pct(row.count, prev)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 flex-1 w-full">
          <OfferComparisonCard
            tone="offer"
            title="内定をもらえた候補者"
            subtitle="内定・承諾・入社に到達した人"
            stat={comparison.offer}
          />
          <OfferComparisonCard
            tone="noOffer"
            title="内定をもらえない候補者"
            subtitle="推薦されたが内定に至らなかった人"
            stat={comparison.noOffer}
          />
        </div>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-gray-800 mb-2 flex items-center gap-2">
          <span className="w-1 h-4 bg-yellow-500 rounded-full inline-block" />
          選考中の方
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          <InProgressPhaseCard title="書類選考" items={inProgress.書類選考} accentClass="bg-blue-400" />
          <InProgressPhaseCard title="一次面接" items={inProgress.一次面接} accentClass="bg-yellow-400" />
          <InProgressPhaseCard title="二次面接" items={inProgress.二次面接} accentClass="bg-orange-400" />
          <InProgressPhaseCard title="最終面接" items={inProgress.最終面接} accentClass="bg-pink-400" />
        </div>
      </div>

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

// --- 複数選択ピル UI ---
function MultiSelectPills({
  label,
  options,
  selected,
  onToggle,
  onSelectAll,
  allActiveLabel = "全体",
}: {
  label: string;
  options: string[];
  selected: string[];
  onToggle: (value: string) => void;
  onSelectAll: () => void;
  allActiveLabel?: string;
}) {
  const isAll = selected.length === 0;
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="text-xs text-gray-500 mr-1 shrink-0">{label}:</span>
      <button
        type="button"
        onClick={onSelectAll}
        className={`text-xs px-2 py-1 rounded-md border transition ${
          isAll
            ? "bg-blue-500 text-white border-blue-500"
            : "bg-white text-gray-600 border-gray-300 hover:bg-gray-50"
        }`}
      >
        {allActiveLabel}
      </button>
      {options.map((opt) => {
        const active = selected.includes(opt);
        return (
          <button
            type="button"
            key={opt}
            onClick={() => onToggle(opt)}
            className={`text-xs px-2 py-1 rounded-md border transition ${
              active
                ? "bg-blue-500 text-white border-blue-500"
                : "bg-white text-gray-600 border-gray-300 hover:bg-gray-50"
            }`}
          >
            {opt}
          </button>
        );
      })}
    </div>
  );
}

// --- 求職者テーブル（共通ヘッダー・行） ---
// 最終結果・承諾・承諾日・入社・入社日を削除 → 比率3列を追加: 計19列
const SEEKER_COL_SPAN = 19;

function SeekerTableHeader() {
  const th  = "px-1.5 py-1.5 font-medium bg-gray-50 border-b border-gray-200 leading-tight text-left align-bottom";
  const thR = "px-1.5 py-1.5 font-medium bg-gray-50 border-b border-gray-200 leading-tight text-right align-bottom";
  return (
    <tr className="text-gray-600 text-[11px]">
      <th className={th}  style={{ width: 100 }}>氏名</th>
      <th className={th}  style={{ width: 80  }}>流入<br/>経路</th>
      <th className={th}  style={{ width: 36  }}>性別</th>
      <th className={th}  style={{ width: 72  }}>最終<br/>学歴</th>
      <th className={thR} style={{ width: 38  }}>転職<br/>回数</th>
      <th className={th}  style={{ width: 60  }}>担当者</th>
      <th className={th}  style={{ width: 66  }}>面談日</th>
      <th className={th}  style={{ width: 72  }}>エントリー日</th>
      <th className={thR} style={{ width: 34  }}>推薦</th>
      <th className={thR} style={{ width: 36  }}>面接<br/>設定</th>
      <th className={thR} style={{ width: 36  }}>面接<br/>実施</th>
      <th className={thR} style={{ width: 36  }}>1次<br/>通過</th>
      <th className={thR} style={{ width: 36  }}>2次<br/>実施</th>
      <th className={thR} style={{ width: 36  }}>2次<br/>通過</th>
      <th className={thR} style={{ width: 36  }}>最終<br/>実施</th>
      <th className={thR} style={{ width: 34  }}>内定</th>
      <th className={thR} style={{ width: 52  }}>推薦→<br/>面接率</th>
      <th className={thR} style={{ width: 52  }}>面接→<br/>1次率</th>
      <th className={thR} style={{ width: 52  }}>面接→<br/>内定率</th>
    </tr>
  );
}

function SeekerTableRows({ rows, label }: { rows: JobSeekerSummary[]; label: string }) {
  if (rows.length === 0) {
    return (
      <tr>
        <td colSpan={SEEKER_COL_SPAN} className="px-4 py-4 text-center text-gray-400">
          対象データがありません
        </td>
      </tr>
    );
  }
  const td  = "px-1.5 py-1.5 text-gray-600 max-w-0 overflow-hidden text-ellipsis whitespace-nowrap";
  const tdR = "px-1.5 py-1.5 text-right tabular-nums";
  const tdP = "px-1.5 py-1.5 text-right tabular-nums text-blue-600 font-medium";
  return (
    <>
      <tr>
        <td colSpan={SEEKER_COL_SPAN} className="px-2 py-1 bg-blue-50 text-blue-700 text-xs font-semibold border-t border-blue-100">
          {label}（{fmt(rows.length)}件）
        </td>
      </tr>
      {rows.map((r) => (
        <tr key={r.id} className="border-t border-gray-100 hover:bg-gray-50 text-[11px]">
          <td className={td + " font-medium text-gray-800"}>{r.name}</td>
          <td className={td}>{r.source || "-"}</td>
          <td className={td}>{r.gender || "-"}</td>
          <td className={td}>{r.education || "-"}</td>
          <td className={tdR + " text-gray-600"}>{r.jobChangeCount !== null ? r.jobChangeCount : "-"}</td>
          <td className={td}>{r.staff || "-"}</td>
          <td className="px-1.5 py-1.5 whitespace-nowrap text-gray-700 font-medium">{fmtDate(r.interviewDate)}</td>
          <td className="px-1.5 py-1.5 whitespace-nowrap text-gray-600">{fmtDate(r.entryDate)}</td>
          <td className={tdR}>{r.recommendations}</td>
          <td className={tdR}>{r.interviewSettings}</td>
          <td className={tdR}>{r.interviewsConducted}</td>
          <td className={tdR}>{r.firstInterviewPass}</td>
          <td className={tdR}>{r.secondInterviewExecuted}</td>
          <td className={tdR}>{r.secondInterviewPass}</td>
          <td className={tdR}>{r.finalInterviewExecuted}</td>
          <td className={tdR}>{r.offers}</td>
          <td className={tdP}>{pct(r.interviewsConducted, r.recommendations)}</td>
          <td className={tdP}>{pct(r.firstInterviewPass, r.interviewsConducted)}</td>
          <td className={tdP}>{pct(r.offers, r.interviewsConducted)}</td>
        </tr>
      ))}
    </>
  );
}

type SeekerSortKey = "interviewDate" | "staff";

// --- 求職者個別テーブル ---
function JobSeekerTable({ rows }: { rows: JobSeekerSummary[] }) {
  const [filter, setFilter] = useState("");
  const [sortKey, setSortKey] = useState<SeekerSortKey>("interviewDate");
  const { foodRows, nonFoodRows, totalFiltered } = useMemo(() => {
    const q = filter.trim();
    const base = q
      ? rows.filter(
          (r) =>
            r.name.includes(q) ||
            r.source.includes(q) ||
            r.staff.includes(q) ||
            r.finalResult.includes(q)
        )
      : rows.filter((r) => !r.finalResult);

    const sorted = [...base].sort((a, b) => {
      if (sortKey === "staff") return a.staff.localeCompare(b.staff, "ja");
      return (b.interviewDate ?? "").localeCompare(a.interviewDate ?? "");
    });

    const foodRows = sorted.filter((r) => r.isFood);
    const nonFoodRows = sorted.filter((r) => !r.isFood);
    return { foodRows, nonFoodRows, totalFiltered: base.length };
  }, [rows, filter, sortKey]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3 flex-wrap">
          <input
            type="text"
            placeholder="氏名・流入経路・担当者で絞り込み"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 bg-white text-gray-700 w-72 max-w-full"
          />
          <select
            value={sortKey}
            onChange={(e) => setSortKey(e.target.value as SeekerSortKey)}
            className="text-sm border border-gray-300 rounded-lg px-2 py-1.5 bg-white text-gray-700"
          >
            <option value="interviewDate">面談日順</option>
            <option value="staff">担当者順</option>
          </select>
          <span className="text-xs text-gray-500">
            {filter ? "面談実施済 全員から検索" : "面談実施済 × 最終結果未設定"}
          </span>
        </div>
        <span className="text-xs text-gray-500">
          {fmt(totalFiltered)} / {fmt(rows.length)} 件
        </span>
      </div>
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-y-auto max-h-[600px]">
        <table className="w-full table-fixed text-[11px]">
          <thead className="sticky top-0 z-10">
            <SeekerTableHeader />
          </thead>
          <tbody>
            <SeekerTableRows rows={nonFoodRows} label="飲食以外" />
            <SeekerTableRows rows={foodRows} label="飲食" />
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ProfileGroupSection({
  group,
  label,
}: {
  group: ProfileGroup | undefined;
  label: string;
}) {
  const g = group ?? {
    count: 0,
    prefectureData: [],
    ageGroupData: [],
    salaryRangeData: [],
    genderData: [],
    educationData: [],
    jobChangeData: [],
  };
  return (
    <div>
      <p className="text-sm font-semibold text-gray-700 mb-2">
        {label}
        <span className="ml-2 text-xs font-normal text-gray-400">
          {fmt(g.count)} 件
        </span>
      </p>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <DonutChart data={g.prefectureData} title="現住所の都道府県別" />
        <DonutChart data={g.ageGroupData} title="年代別構成比" />
        <DonutChart data={g.salaryRangeData} title="現年収帯別構成比" />
        <DonutChart data={g.genderData} title="性別" />
        <DonutChart data={g.educationData} title="最終学歴" />
        <DonutChart data={g.jobChangeData} title="転職回数" />
      </div>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-[1440px] mx-auto px-4 py-3 flex items-center justify-between">
          <h1 className="text-lg font-bold text-gray-900">採用ダッシュボード</h1>
          <span className="text-xs text-gray-400">読み込み中...</span>
        </div>
      </header>
      <main className="max-w-[1440px] mx-auto px-4 py-6 space-y-8">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 animate-pulse">
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
            .env.local に NOTION_API_KEY を設定してください。
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
  const [rakudenData, setRakudenData] = useState<RakudenSummary | null>(null);

  // 担当者 (single) / 流入経路 (multi) / 期間 (multi)
  // すべて併用可能
  const [selectedStaff, setSelectedStaff] = useState("全体");
  const [selectedSources, setSelectedSources] = useState<string[]>([]);
  const [selectedMonths, setSelectedMonths] = useState<string[]>([]);
  // プロフィールセクション専用の流入経路フィルター
  const [profileSource, setProfileSource] = useState<string>("全体");

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [res, rakudenRes] = await Promise.all([
        fetch("/api/dashboard", { cache: "no-store" }),
        fetch("/api/rakuden", { cache: "no-store" }),
      ]);
      if (!res.ok) throw new Error("API error");
      const json: DashboardData = await res.json();
      setData(json);
      if (rakudenRes.ok) {
        const rj = await rakudenRes.json();
        if (rj.rows?.length > 0) setRakudenData(rj);
      }
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
  // 選択中の流入経路に対応するマーケ費（媒体名が流入経路と一致する前提）
  const selectedMarketingCostMap = useMemo((): Record<string, number> => {
    if (selectedSources.length === 0) return marketingCostMap;
    const map: Record<string, number> = {};
    for (const mc of MARKETING_COSTS) {
      let cost = 0;
      for (const src of selectedSources) {
        cost += mc.breakdown?.[src] ?? 0;
      }
      if (cost > 0) map[mc.month] = cost;
    }
    return map;
  }, [selectedSources, marketingCostMap]);

  // 全期間・選択媒体の合計（累計行用）
  const selectedMarketingTotal = useMemo(
    () => Object.values(selectedMarketingCostMap).reduce((a, b) => a + b, 0),
    [selectedMarketingCostMap]
  );

  const displayMetrics = useMemo((): MonthlyCAMetrics[] => {
    if (!data) return [];
    let metrics = selectMetrics(data, selectedStaff, selectedSources);
    if (selectedMonths.length > 0) {
      metrics = metrics.filter((m) => selectedMonths.includes(m.month));
    }
    return metrics;
  }, [data, selectedStaff, selectedSources, selectedMonths]);

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

  // 表示中の期間×選択媒体のマーケ費合計（KPIカード・合計行用）
  // 期間フィルターなし = 全マーケ費（求職者エントリーがない月も含む）
  // 期間フィルターあり = 選択月のみ合算
  const displayMarketingTotal = useMemo(() => {
    if (selectedMonths.length > 0) {
      return selectedMonths.reduce((sum, month) => sum + (selectedMarketingCostMap[month] ?? 0), 0);
    }
    return selectedMarketingTotal;
  }, [selectedMonths, selectedMarketingCostMap, selectedMarketingTotal]);

  const grandTotals = useMemo((): Record<CAMetricKey, number> => {
    if (!data) {
      const t: Record<string, number> = {};
      for (const key of CA_METRIC_KEYS) t[key] = 0;
      return t as Record<CAMetricKey, number>;
    }
    return data.grandTotals as unknown as Record<CAMetricKey, number>;
  }, [data]);

  const averageDays = useMemo((): AverageDays => {
    const nullDays: AverageDays = { entryToInterview: null, entryToAcceptance: null, interviewToFirstRecommend: null, entryToOffer: null, entryToHire: null };
    if (!data) return nullDays;

    // 期間フィルターのみ有効な場合: 月別 raw データから集計
    if (selectedMonths.length > 0 && selectedStaff === "全体" && selectedSources.length === 0) {
      const t = { interviewSum: 0, interviewCount: 0, acceptanceSum: 0, acceptanceCount: 0, interviewToRecommendSum: 0, interviewToRecommendCount: 0, entryToOfferSum: 0, entryToOfferCount: 0, entryToHireSum: 0, entryToHireCount: 0 };
      for (const month of selectedMonths) {
        const m = data.monthlyAverageDaysRaw[month];
        if (!m) continue;
        t.interviewSum += m.interviewSum; t.interviewCount += m.interviewCount;
        t.acceptanceSum += m.acceptanceSum; t.acceptanceCount += m.acceptanceCount;
        t.interviewToRecommendSum += m.interviewToRecommendSum; t.interviewToRecommendCount += m.interviewToRecommendCount;
        t.entryToOfferSum += m.entryToOfferSum; t.entryToOfferCount += m.entryToOfferCount;
        t.entryToHireSum += m.entryToHireSum; t.entryToHireCount += m.entryToHireCount;
      }
      const avg = (sum: number, count: number) => count > 0 ? Math.round(sum / count * 10) / 10 : null;
      return {
        entryToInterview: avg(t.interviewSum, t.interviewCount),
        entryToAcceptance: avg(t.acceptanceSum, t.acceptanceCount),
        interviewToFirstRecommend: avg(t.interviewToRecommendSum, t.interviewToRecommendCount),
        entryToOffer: avg(t.entryToOfferSum, t.entryToOfferCount),
        entryToHire: avg(t.entryToHireSum, t.entryToHireCount),
      };
    }

    // 担当者と流入経路を併用している場合は全体平均にフォールバック
    if (selectedStaff !== "全体" && selectedSources.length > 0) {
      return data.averageDays;
    }
    if (selectedSources.length === 1) {
      return data.sourceAverageDays[selectedSources[0]] ?? nullDays;
    }
    if (selectedSources.length > 1) {
      return data.averageDays;
    }
    if (selectedStaff !== "全体") {
      return data.staffAverageDays[selectedStaff] ?? nullDays;
    }
    return data.averageDays;
  }, [data, selectedStaff, selectedSources, selectedMonths]);

  function cpa(month: string): string {
    const cost = selectedMarketingCostMap[month] ?? 0;
    const row = displayMetrics.find((m) => m.month === month);
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

  // 2025-12 スタートで全月を埋めた月リストを生成
  const CHART_START = "2025-12";
  function buildMonthRange(latestMonth: string): string[] {
    const months: string[] = [];
    const now = new Date();
    const curMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const end = latestMonth > curMonth ? latestMonth : curMonth;
    const [sy, sm] = CHART_START.split("-").map(Number);
    const [ey, em] = end.split("-").map(Number);
    let y = sy, mo = sm;
    while (y < ey || (y === ey && mo <= em)) {
      months.push(`${y}-${String(mo).padStart(2, "0")}`);
      mo++;
      if (mo > 12) { mo = 1; y++; }
    }
    return months;
  }
  function toChartLabel(month: string): string {
    // "2025-12" → "25/12"
    return month.slice(2, 4) + "/" + month.slice(5);
  }

  // 流入経路フィルターを適用した内定承諾集計（全体 or ソース別合計）
  const filteredAcceptances = useMemo((): MonthlyAcceptanceData[] => {
    if (!data) return [];
    const hasStaff = selectedStaff !== "全体";
    const hasSources = selectedSources.length > 0;

    if (!hasStaff && !hasSources) return data.monthlyAcceptances ?? [];

    const combined = new Map<string, MonthlyAcceptanceData>();
    const merge = (rows: MonthlyAcceptanceData[]) => {
      for (const m of rows) {
        if (!combined.has(m.month)) combined.set(m.month, { month: m.month, count: 0, revenue: 0 });
        const e = combined.get(m.month)!;
        e.count += m.count;
        e.revenue += m.revenue;
      }
    };

    if (hasStaff && hasSources) {
      const byStaffSource = data.monthlyAcceptancesByStaffSource ?? {};
      const staffSlice = byStaffSource[selectedStaff] ?? {};
      for (const src of selectedSources) merge(staffSlice[src] ?? []);
    } else if (hasStaff) {
      merge((data.monthlyAcceptancesByStaff ?? {})[selectedStaff] ?? []);
    } else {
      const bySource = data.monthlyAcceptancesBySource ?? {};
      for (const src of selectedSources) merge(bySource[src] ?? []);
    }

    return Array.from(combined.values()).sort((a, b) => a.month.localeCompare(b.month));
  }, [data, selectedStaff, selectedSources]);

  // 担当者・流入経路フィルターを適用した入社見込み集計
  const filteredJoinForecast = useMemo((): MonthlyJoinForecastData[] => {
    if (!data) return [];
    const hasStaff = selectedStaff !== "全体";
    const hasSources = selectedSources.length > 0;

    if (!hasStaff && !hasSources) return data.monthlyJoinForecast ?? [];

    const combined = new Map<string, MonthlyJoinForecastData>();
    const merge = (rows: MonthlyJoinForecastData[]) => {
      for (const m of rows) {
        if (!combined.has(m.month)) combined.set(m.month, { month: m.month, count: 0, revenue: 0 });
        const e = combined.get(m.month)!;
        e.count += m.count;
        e.revenue += m.revenue;
      }
    };

    if (hasStaff && hasSources) {
      const byStaffSource = data.monthlyJoinForecastByStaffSource ?? {};
      const staffSlice = byStaffSource[selectedStaff] ?? {};
      for (const src of selectedSources) merge(staffSlice[src] ?? []);
    } else if (hasStaff) {
      merge((data.monthlyJoinForecastByStaff ?? {})[selectedStaff] ?? []);
    } else {
      const bySource = data.monthlyJoinForecastBySource ?? {};
      for (const src of selectedSources) merge(bySource[src] ?? []);
    }

    return Array.from(combined.values()).sort((a, b) => a.month.localeCompare(b.month));
  }, [data, selectedStaff, selectedSources]);

  // 売上見込みFY分割用（入社想定日優先・無ければ内定承諾日で概算）フィルター連動
  const filteredForFY = useMemo((): MonthlyJoinForecastData[] => {
    if (!data) return [];
    const hasStaff = selectedStaff !== "全体";
    const hasSources = selectedSources.length > 0;

    if (!hasStaff && !hasSources) return data.monthlyForFY ?? [];

    const combined = new Map<string, MonthlyJoinForecastData>();
    const merge = (rows: MonthlyJoinForecastData[]) => {
      for (const m of rows) {
        if (!combined.has(m.month)) combined.set(m.month, { month: m.month, count: 0, revenue: 0 });
        const e = combined.get(m.month)!;
        e.count += m.count;
        e.revenue += m.revenue;
      }
    };

    if (hasStaff && hasSources) {
      const byStaffSource = data.monthlyForFYByStaffSource ?? {};
      const staffSlice = byStaffSource[selectedStaff] ?? {};
      for (const src of selectedSources) merge(staffSlice[src] ?? []);
    } else if (hasStaff) {
      merge((data.monthlyForFYByStaff ?? {})[selectedStaff] ?? []);
    } else {
      const bySource = data.monthlyForFYBySource ?? {};
      for (const src of selectedSources) merge(bySource[src] ?? []);
    }

    return Array.from(combined.values()).sort((a, b) => a.month.localeCompare(b.month));
  }, [data, selectedStaff, selectedSources]);

  // 内定承諾日ベース月別チャート（流入経路フィルター連動・全月表示）
  const acceptanceChartData = useMemo((): { month: string; 内定承諾数: number }[] => {
    const last = filteredAcceptances.length > 0
      ? filteredAcceptances[filteredAcceptances.length - 1].month
      : CHART_START;
    const lookup = new Map(filteredAcceptances.map((m: MonthlyAcceptanceData) => [m.month, m.count]));
    return buildMonthRange(last).map(month => ({
      month: toChartLabel(month),
      内定承諾数: lookup.get(month) ?? 0,
    }));
  }, [filteredAcceptances]);

  // 入社想定日ベース月別チャート（流入経路フィルター連動・全月表示）
  const joinForecastChartData = useMemo((): { month: string; 入社見込み数: number }[] => {
    const last = filteredJoinForecast.length > 0
      ? filteredJoinForecast[filteredJoinForecast.length - 1].month
      : CHART_START;
    const lookup = new Map(filteredJoinForecast.map((m: MonthlyJoinForecastData) => [m.month, m.count]));
    return buildMonthRange(last).map(month => ({
      month: toChartLabel(month),
      入社見込み数: lookup.get(month) ?? 0,
    }));
  }, [filteredJoinForecast]);

  // 流入経路フィルターを適用したプロフィールデータ（複数選択時はカウントをマージ）
  const mergeProfileGroups = (groups: ProfileGroup[]): ProfileGroup => {
    const mergeDistributions = (dists: ProfileDistribution[][]): ProfileDistribution[] => {
      const map = new Map<string, number>();
      for (const dist of dists) for (const d of dist) map.set(d.label, (map.get(d.label) ?? 0) + d.count);
      const total = Array.from(map.values()).reduce((a, b) => a + b, 0);
      return Array.from(map.entries())
        .map(([label, count]) => ({ label, count, percentage: total > 0 ? Math.round(count / total * 1000) / 10 : 0 }))
        .sort((a, b) => b.count - a.count);
    };
    return {
      count: groups.reduce((s, g) => s + g.count, 0),
      prefectureData: mergeDistributions(groups.map(g => g.prefectureData)),
      ageGroupData: mergeDistributions(groups.map(g => g.ageGroupData)),
      salaryRangeData: mergeDistributions(groups.map(g => g.salaryRangeData)),
      genderData: mergeDistributions(groups.map(g => g.genderData)),
      educationData: mergeDistributions(groups.map(g => g.educationData)),
      jobChangeData: mergeDistributions(groups.map(g => g.jobChangeData)),
    };
  };

  const displayProfileNonFood = useMemo((): ProfileGroup | undefined => {
    if (!data) return undefined;
    if (profileSource === "全体") return data.profileNonFood;
    return (data.profileNonFoodBySource ?? {})[profileSource] ?? data.profileNonFood;
  }, [data, profileSource]);

  const displayProfileFood = useMemo((): ProfileGroup | undefined => {
    if (!data) return undefined;
    if (profileSource === "全体") return data.profileFood;
    return (data.profileFoodBySource ?? {})[profileSource] ?? data.profileFood;
  }, [data, profileSource]);

  // 売上見込み合計（流入経路フィルター × 期間フィルター）
  const displayRevenueForecast = useMemo(() => {
    const months = selectedMonths.length > 0
      ? filteredAcceptances.filter((m: MonthlyAcceptanceData) => selectedMonths.includes(m.month))
      : filteredAcceptances;
    return months.reduce((sum: number, m: MonthlyAcceptanceData) => sum + m.revenue, 0);
  }, [filteredAcceptances, selectedMonths]);

  // 売上見込み（入社想定日ベース）をFYで分割（7月決算: FY25=2025/8〜2026/7, FY26=2026/8〜2027/7）
  const salesForecastByFY = useMemo(() => {
    const inFY = (month: string, startYear: number) =>
      month >= `${startYear}-08` && month <= `${startYear + 1}-07`;
    let fy25 = 0, fy26 = 0, total = 0;
    for (const m of filteredForFY) {
      total += m.revenue;
      if (inFY(m.month, 2025)) fy25 += m.revenue;
      else if (inFY(m.month, 2026)) fy26 += m.revenue;
    }
    return { fy25, fy26, total };
  }, [filteredForFY]);

  function scrollToSection(id: string) {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function toggleSource(s: string) {
    setSelectedSources((prev) =>
      prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]
    );
  }
  function clearSources() {
    setSelectedSources([]);
  }
  function toggleMonth(m: string) {
    setSelectedMonths((prev) =>
      prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m]
    );
  }
  function clearMonths() {
    setSelectedMonths([]);
  }

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
    ? new Date(data.generatedAt).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" })
    : "";

  const periodNote =
    selectedMonths.length > 0
      ? `表示期間: ${selectedMonths.length} ヶ月`
      : "表示期間: 全期間";

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-[1440px] mx-auto px-4 pt-3 flex items-center justify-between">
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
        <nav className="max-w-[1440px] mx-auto px-4 pt-2 pb-2.5 flex gap-2 overflow-x-auto">
          <button onClick={() => scrollToSection("ca")} className="shrink-0 text-xs font-semibold px-3 py-1.5 rounded-full border border-gray-200 text-gray-600 hover:text-gray-900 hover:border-gray-300 transition">
            <span className="text-[10px] text-gray-400 font-bold mr-1">CA</span>求職者対応
          </button>
          <button onClick={() => scrollToSection("funnel")} className="shrink-0 text-xs font-semibold px-3 py-1.5 rounded-full border border-gray-200 text-gray-600 hover:text-gray-900 hover:border-gray-300 transition">
            応募ファネル
          </button>
          <button onClick={() => scrollToSection("status")} className="shrink-0 text-xs font-semibold px-3 py-1.5 rounded-full border border-gray-200 text-gray-600 hover:text-gray-900 hover:border-gray-300 transition">
            求職者個別
          </button>
          <button onClick={() => scrollToSection("ra")} className="shrink-0 text-xs font-semibold px-3 py-1.5 rounded-full bg-blue-50 text-blue-700 border border-transparent hover:bg-blue-100 transition">
            <span className="text-[10px] text-blue-500 font-bold mr-1">RA</span>求人開拓
          </button>
          <button onClick={() => scrollToSection("profile")} className="shrink-0 text-xs font-semibold px-3 py-1.5 rounded-full border border-gray-200 text-gray-600 hover:text-gray-900 hover:border-gray-300 transition">
            エントリー者プロフィール
          </button>
        </nav>
      </header>

      <main className="max-w-[1440px] mx-auto px-4 py-6 space-y-8">
        {data && !data.isConnected && <NotConnectedBanner />}

        {/* ================= CA: 求職者対応 ================= */}
        <section id="ca" className="scroll-mt-28">
          <h2 className="text-base font-bold text-gray-800 mb-3 flex items-center gap-2">
            <span className="w-1.5 h-5 bg-green-500 rounded-full inline-block" />
            求職者対応（CA）
          </h2>

          {/* 内定承諾数 / 入社見込み 月別推移（最上部） */}
          {(acceptanceChartData.length > 0 || joinForecastChartData.length > 0) && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              {acceptanceChartData.length > 0 && (
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold text-gray-700">内定承諾数 月別推移</h3>
                    <div className="text-right">
                      <span className="text-xs text-gray-500">累計</span>
                      <span className="ml-1.5 text-xl font-bold text-purple-600 tabular-nums">
                        {fmt(acceptanceChartData.reduce((s, r) => s + r.内定承諾数, 0))}
                      </span>
                      <span className="text-xs text-gray-500 ml-0.5">件</span>
                    </div>
                  </div>
                  <p className="text-[10px] text-gray-400 mb-2">内定承諾日ベース（応募管理 DB）</p>
                  <ResponsiveContainer width="100%" height={180}>
                    <BarChart data={acceptanceChartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 11 }} width={24} />
                      <Tooltip
                        formatter={(v: any) => [`${v}件`, "内定承諾数"]}
                        contentStyle={{ fontSize: 12 }}
                      />
                      <Bar dataKey="内定承諾数" fill="#8B5CF6" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
              {joinForecastChartData.length > 0 && (
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold text-gray-700">入社見込み 月別推移</h3>
                    <div className="text-right">
                      <span className="text-xs text-gray-500">累計</span>
                      <span className="ml-1.5 text-xl font-bold text-emerald-600 tabular-nums">
                        {fmt(joinForecastChartData.reduce((s, r) => s + r.入社見込み数, 0))}
                      </span>
                      <span className="text-xs text-gray-500 ml-0.5">件</span>
                    </div>
                  </div>
                  <p className="text-[10px] text-gray-400 mb-2">入社想定日ベース（応募管理 DB）</p>
                  <ResponsiveContainer width="100%" height={180}>
                    <BarChart data={joinForecastChartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 11 }} width={24} />
                      <Tooltip
                        formatter={(v: any) => [`${v}件`, "入社見込み数"]}
                        contentStyle={{ fontSize: 12 }}
                      />
                      <Bar dataKey="入社見込み数" fill="#10B981" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          )}

          <div className="space-y-2 mb-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-gray-500 mr-1 shrink-0">担当者:</span>
              <select
                value={selectedStaff}
                onChange={(e) => setSelectedStaff(e.target.value)}
                className="text-xs border border-gray-300 rounded-md px-2 py-1 bg-white text-gray-700"
              >
                <option value="全体">全体</option>
                {(data?.staffList ?? []).map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
              <span className="text-xs text-gray-400">
                ※担当者と流入経路は併用可（AND 条件）
              </span>
            </div>

            <MultiSelectPills
              label="流入経路"
              options={data?.sourceList ?? []}
              selected={selectedSources}
              onToggle={toggleSource}
              onSelectAll={clearSources}
              allActiveLabel="全体"
            />

            <MultiSelectPills
              label="期間"
              options={allMonths}
              selected={selectedMonths}
              onToggle={toggleMonth}
              onSelectAll={clearMonths}
              allActiveLabel="全期間"
            />
          </div>

          {/* 売上見込み（FY別・入社想定日ベース）※7月決算 */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-3">
            <KPICard
              title="売上見込み FY25"
              value={salesForecastByFY.fy25 > 0 ? "¥" + fmt(salesForecastByFY.fy25) : "-"}
              sub="入社想定日 2025/8〜2026/7"
            />
            <KPICard
              title="売上見込み FY26"
              value={salesForecastByFY.fy26 > 0 ? "¥" + fmt(salesForecastByFY.fy26) : "-"}
              sub="入社想定日 2026/8〜2027/7"
            />
            <KPICard
              title="売上見込み 累計"
              value={salesForecastByFY.total > 0 ? "¥" + fmt(salesForecastByFY.total) : "-"}
              sub="FY25＋FY26／入社想定日・無ければ承諾日で概算"
            />
          </div>

          {/* マーケ費用KPIカード（フィルターに連動） */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-3">
            {selectedStaff === "全体" ? (
              <>
                <KPICard
                  title="決定原価"
                  value={displayTotals["内定承諾数"] > 0 && displayMarketingTotal > 0
                    ? "¥" + fmt(Math.round(displayMarketingTotal / displayTotals["内定承諾数"]))
                    : "-"}
                  sub={`マーケ費 ¥${fmt(displayMarketingTotal)} ÷ 承諾 ${fmt(displayTotals["内定承諾数"])}件`}
                />
                <KPICard
                  title="原価率"
                  value={displayRevenueForecast > 0 && displayMarketingTotal > 0
                    ? ((displayMarketingTotal / displayRevenueForecast) * 100).toFixed(1) + "%"
                    : "-"}
                  sub={`マーケ費 ÷ 売上見込み`}
                />
              </>
            ) : (
              <div className="col-span-2 flex items-center justify-center rounded-lg border border-dashed border-gray-200 bg-gray-50 p-4 text-sm text-gray-400">
                決定原価・原価率はマーケ費が会社全体のため担当者別では非表示
              </div>
            )}
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-3">
            <KPICard
              title="面談実施率"
              value={displayTotals["エントリー数"] > 0
                ? ((displayTotals["面談数"] / displayTotals["エントリー数"]) * 100).toFixed(1) + "%"
                : "-"}
              sub={`面談 ${fmt(displayTotals["面談数"])}件 ÷ エントリー ${fmt(displayTotals["エントリー数"])}件`}
            />
            {selectedStaff === "全体" && (
              <>
                <KPICard
                  title="面談単価"
                  value={displayTotals["面談数"] > 0 && displayMarketingTotal > 0
                    ? "¥" + fmt(Math.round(displayMarketingTotal / displayTotals["面談数"]))
                    : "-"}
                  sub={`÷ 面談 ${fmt(displayTotals["面談数"])}件`}
                />
                <KPICard
                  title="エントリー単価"
                  value={displayTotals["エントリー数"] > 0 && displayMarketingTotal > 0
                    ? "¥" + fmt(Math.round(displayMarketingTotal / displayTotals["エントリー数"]))
                    : "-"}
                  sub={`÷ エントリー ${fmt(displayTotals["エントリー数"])}件`}
                />
                <KPICard
                  title="有効エントリー単価"
                  value={displayTotals["有効エントリー数"] > 0 && displayMarketingTotal > 0
                    ? "¥" + fmt(Math.round(displayMarketingTotal / displayTotals["有効エントリー数"]))
                    : "-"}
                  sub={`÷ 有効 ${fmt(displayTotals["有効エントリー数"])}件`}
                />
              </>
            )}
          </div>

          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-4">
            <KPICard
              title="エントリー → 面談実施"
              value={averageDays.entryToInterview !== null ? `${averageDays.entryToInterview}日` : "-"}
              sub="平均所要日数"
            />
            <KPICard
              title="面談実施 → 推薦"
              value={averageDays.interviewToFirstRecommend !== null ? `${averageDays.interviewToFirstRecommend}日` : "-"}
              sub="平均所要日数"
            />
            <KPICard
              title="エントリー → 内定"
              value={averageDays.entryToOffer !== null ? `${averageDays.entryToOffer}日` : "-"}
              sub="平均所要日数"
            />
            <KPICard
              title="エントリー → 内定承諾"
              value={averageDays.entryToAcceptance !== null ? `${averageDays.entryToAcceptance}日` : "-"}
              sub="平均所要日数"
            />
            <KPICard
              title="エントリー → 入社"
              value={averageDays.entryToHire !== null ? `${averageDays.entryToHire}日` : "-"}
              sub="平均所要日数"
            />
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-100">
            <table className="w-full text-xs table-fixed">
              <colgroup>
                <col className="w-[68px]" />
                {CA_METRIC_KEYS.map((k) => (
                  <col key={k} className="w-[64px]" />
                ))}
                <col className="w-[60px]" />
                <col className="w-[60px]" />
                <col className="w-[68px]" />
                <col className="w-[68px]" />
              </colgroup>
              <thead>
                <tr className="bg-gray-50 text-gray-600 text-left">
                  <th className="px-1.5 py-1.5 font-medium">月</th>
                  {CA_METRIC_KEYS.map((key) => (
                    <th key={key} className="px-1.5 py-1.5 font-medium text-right">
                      {CA_METRIC_LABELS[key]}
                    </th>
                  ))}
                  <th className="px-1.5 py-1.5 font-medium text-right">E→承諾率</th>
                  <th className="px-1.5 py-1.5 font-medium text-right">面談→承諾率</th>
                  <th className="px-1.5 py-1.5 font-medium text-right">マーケ費</th>
                  <th className="px-1.5 py-1.5 font-medium text-right">CPA</th>
                </tr>
              </thead>
              <tbody>
                {displayMetrics.length === 0 ? (
                  <tr>
                    <td
                      colSpan={CA_METRIC_KEYS.length + 5}
                      className="px-2 py-8 text-center text-gray-400"
                    >
                      データがありません
                    </td>
                  </tr>
                ) : (
                  <>
                    {displayMetrics.map((row, i) => (
                      <tr key={i} className="border-t border-gray-100 hover:bg-gray-50 transition-colors">
                        <td className="px-1.5 py-1.5 font-medium text-gray-800">{row.month.slice(2)}</td>
                        {CA_METRIC_KEYS.map((key) => (
                          <td key={key} className="px-1.5 py-1.5 text-right tabular-nums">
                            {fmt(row[key])}
                          </td>
                        ))}
                        <td className="px-1.5 py-1.5 text-right text-blue-600 font-medium">
                          {pct(row.内定承諾数, row.エントリー数)}
                        </td>
                        <td className="px-1.5 py-1.5 text-right text-blue-600 font-medium">
                          {pct(row.内定承諾数, row.面談数)}
                        </td>
                        <td className="px-1.5 py-1.5 text-right tabular-nums">
                          {selectedMarketingCostMap[row.month] != null
                            ? "¥" + fmt(selectedMarketingCostMap[row.month])
                            : "-"}
                        </td>
                        <td className="px-1.5 py-1.5 text-right tabular-nums">{cpa(row.month)}</td>
                      </tr>
                    ))}

                    <tr className="border-t-2 border-gray-200 bg-blue-50/50 text-[10px] text-gray-500">
                      <td className="px-1.5 py-1 font-medium">転換率</td>
                      <td className="px-1.5 py-1 text-right">-</td>
                      {CA_METRIC_KEYS.slice(1).map((key, idx) => (
                        <td key={key} className="px-1.5 py-1 text-right">
                          {pct(displayTotals[key], displayTotals[CA_METRIC_KEYS[idx]])}
                        </td>
                      ))}
                      <td className="px-1.5 py-1 text-right">-</td>
                      <td className="px-1.5 py-1 text-right">-</td>
                      <td className="px-1.5 py-1 text-right">-</td>
                      <td className="px-1.5 py-1 text-right">-</td>
                    </tr>

                    <tr className="border-t-2 border-gray-300 bg-gray-50 font-bold">
                      <td className="px-1.5 py-1.5">合計</td>
                      {CA_METRIC_KEYS.map((key) => (
                        <td key={key} className="px-1.5 py-1.5 text-right tabular-nums">
                          {fmt(displayTotals[key])}
                        </td>
                      ))}
                      <td className="px-1.5 py-1.5 text-right text-blue-600">
                        {pct(displayTotals["内定承諾数"], displayTotals["エントリー数"])}
                      </td>
                      <td className="px-1.5 py-1.5 text-right text-blue-600">
                        {pct(displayTotals["内定承諾数"], displayTotals["面談数"])}
                      </td>
                      <td className="px-1.5 py-1.5 text-right tabular-nums">
                        ¥{fmt(displayMarketingTotal)}
                      </td>
                      <td className="px-1.5 py-1.5 text-right tabular-nums text-orange-600 font-medium">
                        {displayTotals["エントリー数"] > 0 && displayMarketingTotal > 0
                          ? "¥" + fmt(Math.round(displayMarketingTotal / displayTotals["エントリー数"]))
                          : "-"}
                      </td>
                    </tr>

                    <tr className="border-t border-gray-200 bg-yellow-50/50 font-semibold text-gray-700">
                      <td className="px-1.5 py-1.5">累計</td>
                      {CA_METRIC_KEYS.map((key) => (
                        <td key={key} className="px-1.5 py-1.5 text-right tabular-nums">
                          {fmt(grandTotals[key])}
                        </td>
                      ))}
                      <td className="px-1.5 py-1.5 text-right text-blue-600">
                        {pct(grandTotals["内定承諾数"], grandTotals["エントリー数"])}
                      </td>
                      <td className="px-1.5 py-1.5 text-right text-blue-600">
                        {pct(grandTotals["内定承諾数"], grandTotals["面談数"])}
                      </td>
                      <td className="px-1.5 py-1.5 text-right tabular-nums">
                        ¥{fmt(selectedMarketingTotal)}
                      </td>
                      <td className="px-1.5 py-1.5 text-right tabular-nums text-orange-600">
                        {grandTotals["エントリー数"] > 0 && selectedMarketingTotal > 0
                          ? "¥" + fmt(Math.round(selectedMarketingTotal / grandTotals["エントリー数"]))
                          : "-"}
                      </td>
                    </tr>
                  </>
                )}
              </tbody>
            </table>
          </div>
          <p className="text-[10px] text-gray-400 mt-1">
            {periodNote} ｜ 月の表示は YY-MM。短縮ラベル: E=エントリー
          </p>

          {barChartData.length > 0 && (
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
          )}

          {data?.monthlySpeakingRatio && data.monthlySpeakingRatio.months.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 mt-4">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">
                発話比率CA 月別平均（担当者別）
              </h3>
              <p className="text-[10px] text-gray-400 mb-3">
                CA が面談中に発言した文字数の割合の平均。面談実施日の月で集計。
              </p>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-gray-50 text-gray-600 text-left">
                      <th className="px-2 py-1.5 font-medium">月</th>
                      {data.monthlySpeakingRatio.staffList.map((staff) => (
                        <th key={staff} className="px-2 py-1.5 font-medium text-right">
                          {staff}
                        </th>
                      ))}
                      <th className="px-2 py-1.5 font-medium text-right text-gray-800">全体</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.monthlySpeakingRatio.months.map((month) => {
                      const overall = data.monthlySpeakingRatio.overall[month];
                      return (
                        <tr key={month} className="border-t border-gray-100 hover:bg-gray-50">
                          <td className="px-2 py-1.5 font-medium text-gray-800">
                            {month.slice(2)}
                          </td>
                          {data.monthlySpeakingRatio.staffList.map((staff) => {
                            const d = data.monthlySpeakingRatio.byStaff[staff]?.[month];
                            return (
                              <td key={staff} className="px-2 py-1.5 text-right tabular-nums">
                                {d ? (
                                  <>
                                    <span className="font-medium text-blue-600">{d.avg}%</span>
                                    <span className="text-gray-400 text-[10px] ml-1">
                                      ({d.count}件)
                                    </span>
                                  </>
                                ) : (
                                  <span className="text-gray-300">-</span>
                                )}
                              </td>
                            );
                          })}
                          <td className="px-2 py-1.5 text-right tabular-nums">
                            {overall ? (
                              <>
                                <span className="font-bold text-gray-800">{overall.avg}%</span>
                                <span className="text-gray-400 text-[10px] ml-1">
                                  ({overall.count}件)
                                </span>
                              </>
                            ) : (
                              <span className="text-gray-300">-</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-gray-300 bg-gray-50 font-semibold">
                      <td className="px-2 py-1.5 text-gray-700">平均</td>
                      {data.monthlySpeakingRatio.staffList.map((staff) => {
                        let sum = 0, cnt = 0;
                        for (const m of data.monthlySpeakingRatio.months) {
                          const d = data.monthlySpeakingRatio.byStaff[staff]?.[m];
                          if (d) { sum += d.avg * d.count; cnt += d.count; }
                        }
                        const avg = cnt > 0 ? Math.round(sum / cnt) : null;
                        return (
                          <td key={staff} className="px-2 py-1.5 text-right tabular-nums">
                            {avg !== null ? (
                              <>
                                <span className="text-blue-700">{avg}%</span>
                                <span className="text-gray-400 text-[10px] ml-1">({cnt}件)</span>
                              </>
                            ) : <span className="text-gray-300">-</span>}
                          </td>
                        );
                      })}
                      {(() => {
                        let oSum = 0, oCnt = 0;
                        for (const m of data.monthlySpeakingRatio.months) {
                          const d = data.monthlySpeakingRatio.overall[m];
                          if (d) { oSum += d.avg * d.count; oCnt += d.count; }
                        }
                        const oAvg = oCnt > 0 ? Math.round(oSum / oCnt) : null;
                        return (
                          <td className="px-2 py-1.5 text-right tabular-nums">
                            {oAvg !== null ? (
                              <>
                                <span className="text-gray-800">{oAvg}%</span>
                                <span className="text-gray-400 text-[10px] ml-1">({oCnt}件)</span>
                              </>
                            ) : <span className="text-gray-300">-</span>}
                          </td>
                        );
                      })()}
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}
        </section>

        {/* ================= 応募ファネル ================= */}
        <section id="funnel" className="scroll-mt-28">
          <h2 className="text-base font-bold text-gray-800 mb-3 flex items-center gap-2">
            <span className="w-1.5 h-5 bg-cyan-500 rounded-full inline-block" />
            応募ファネル（エントリー以降の歩留）
          </h2>
          {data ? (
            <ApplicationFunnelSection funnel={data.applicationFunnel} comparison={data.offerComparison} inProgress={data.inProgress} />
          ) : null}
        </section>

        {/* ================= 求職者個別 ================= */}
        <section id="status" className="scroll-mt-28">
          <h2 className="text-base font-bold text-gray-800 mb-3 flex items-center gap-2">
            <span className="w-1.5 h-5 bg-pink-500 rounded-full inline-block" />
            求職者個別の状況
          </h2>
          {data ? <JobSeekerTable rows={data.jobSeekerSummaries} /> : null}
        </section>

        {/* ================= RA: 求人開拓 ================= */}
        <section id="ra" className="scroll-mt-28">
          <h2 className="text-base font-bold text-gray-800 mb-3 flex items-center gap-2">
            <span className="w-1.5 h-5 bg-blue-500 rounded-full inline-block" />
            求人開拓（RA）
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <StatusBreakdownCard
              title="契約企業数"
              total={data?.companySummary.total ?? 0}
              byStatus={data?.companySummary.byStatus ?? {}}
              highlight="契約"
            />
            <StatusBreakdownCard
              title="求人数（飲食以外）"
              subtitle="求人案件管理 DB"
              total={data?.jobSummary.shokuhinIgai.total ?? 0}
              byStatus={data?.jobSummary.shokuhinIgai.byStatus ?? {}}
              highlight="公開中"
            />
            <StatusBreakdownCard
              title="求人数（飲食）"
              subtitle="求人案件管理(飲食) DB"
              total={data?.jobSummary.shokuhin.total ?? 0}
              byStatus={data?.jobSummary.shokuhin.byStatus ?? {}}
              highlight="公開中"
            />
          </div>

          {/* 合算サマリ (薄め) */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 px-5 py-3 mt-3 flex flex-wrap items-center gap-4 text-sm">
            <span className="text-xs text-gray-500 uppercase tracking-wide">求人合計</span>
            <span className="font-bold text-gray-900 text-lg tabular-nums">
              {fmt(data?.jobSummary.total ?? 0)}
            </span>
            <span className="text-xs text-gray-400">
              飲食以外 {fmt(data?.jobSummary.shokuhinIgai.total ?? 0)} ／ 飲食 {fmt(data?.jobSummary.shokuhin.total ?? 0)}
            </span>
            {Object.entries(data?.jobSummary.byStatus ?? {})
              .filter(([, n]) => n > 0)
              .sort((a, b) => b[1] - a[1])
              .map(([status, count]) => (
                <span key={status} className="text-xs text-gray-600">
                  {status}: <span className="tabular-nums font-medium text-gray-800">{fmt(count)}</span>
                </span>
              ))}
          </div>

          {/* 月別求人獲得推移 */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 mt-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">
              月別求人獲得件数（Notionへの登録日ベース）
            </h3>
            {data && Object.keys(data.jobSummary.monthlyAcquisition).length > 0 ? (() => {
              const igai = data.jobSummary.shokuhinIgai.monthlyAcquisition;
              const shokuhin = data.jobSummary.shokuhin.monthlyAcquisition;
              const allMonths = Array.from(new Set([...Object.keys(igai), ...Object.keys(shokuhin)])).sort();
              const chartData = allMonths.map((month) => ({
                month,
                飲食以外: igai[month] ?? 0,
                飲食: shokuhin[month] ?? 0,
              }));
              return (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11 }} width={30} />
                    <Tooltip formatter={(v) => [`${v}件`]} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="飲食以外" fill="#3B82F6" radius={[3, 3, 0, 0]} />
                    <Bar dataKey="飲食" fill="#10B981" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              );
            })() : (
              <p className="text-xs text-gray-400">データがありません。</p>
            )}
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 mt-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">
              公開中求人の職種コード別内訳（飲食以外＋飲食 合算）
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

        {/* ================= プロフィール分析 ================= */}
        <section id="profile" className="scroll-mt-28">
          <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
            <h2 className="text-base font-bold text-gray-800 flex items-center gap-2">
              <span className="w-1.5 h-5 bg-purple-500 rounded-full inline-block" />
              エントリー者プロフィール
            </h2>
            <div className="flex gap-1.5 flex-wrap">
              {["全体", ...(data?.sourceList ?? [])].map(src => (
                <button
                  key={src}
                  onClick={() => setProfileSource(src)}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                    profileSource === src
                      ? "bg-purple-600 text-white"
                      : "bg-gray-100 text-gray-600 hover:bg-purple-100"
                  }`}
                >
                  {src}
                </button>
              ))}
            </div>
          </div>
          <ProfileGroupSection group={displayProfileNonFood} label="飲食以外" />
          <div className="mt-6">
            <ProfileGroupSection group={displayProfileFood} label="飲食" />
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
