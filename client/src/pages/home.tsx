import { useState, useRef, useEffect, useMemo } from "react";
import { Copy, Check, ArrowUp, X, RefreshCw } from "lucide-react";
import { SiInstagram, SiFacebook, SiTiktok } from "react-icons/si";
import { marked } from "marked";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LineChart,
  Line,
  AreaChart,
  Area,
  LabelList,
  Cell,
  PieChart,
  Pie,
} from "recharts";
import {
  AGENCY_LOGO,
  CLIENT_LOGO,
} from "@/data/config";
import { apiRequest } from "@/lib/queryClient";

marked.setOptions({
  breaks: true,
  gfm: true,
});

const MONTH_LABELS: Record<string, string> = {
  "2025-11": "Nov",
  "2025-12": "Dic",
  "2026-01": "Ene",
  "2026-02": "Feb",
};

interface MonthlyData {
  facebook: { reach: number; engagement: number; followers_total: number };
  instagram: { reach: number; engagement: number; new_followers: number; likes: number; comments: number; saves: number; shares: number };
  meta_ads: { spend: number; impressions: number; clicks: number; ctr: number };
}

interface SheetsApiData {
  plaza: string;
  months: string[];
  monthly: Record<string, MonthlyData>;
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  suggestions?: string[];
}

function parseSuggested(text: string): { cleanText: string; suggestions: string[] } {
  const match = text.match(/\n?SUGGESTED:\s*(\[[\s\S]*?\])\s*$/);
  if (match) {
    try {
      const suggestions = JSON.parse(match[1]) as string[];
      if (Array.isArray(suggestions) && suggestions.length > 0) {
        return { cleanText: text.replace(match[0], "").trim(), suggestions };
      }
    } catch {}
  }
  return { cleanText: text, suggestions: [] };
}

function MarkdownContent({ content }: { content: string }) {
  const html = useMemo(() => marked.parse(content) as string, [content]);
  return <div className="prose-chat" dangerouslySetInnerHTML={{ __html: html }} />;
}

interface ChartData {
  type: "bar" | "line" | "area" | "pie";
  title: string;
  data: Record<string, unknown>[];
  dataKeys: string[];
  colors: string[];
}

function parseChartData(text: string): { cleanText: string; chartData: ChartData | null } {
  const patterns = [
    /CHART_DATA:\s*(\{[^\n]*\})/,
    /```CHART_DATA\s*\n([\s\S]*?)\n```/,
    /```json\s*\n?\s*CHART_DATA\s*\n([\s\S]*?)\n```/,
    /```\s*CHART_DATA\s*\n([\s\S]*?)\n```/,
  ];

  for (const regex of patterns) {
    const match = text.match(regex);
    if (match) {
      try {
        const jsonStr = match[1].replace(/,\s*([}\]])/g, "$1");
        const parsed = JSON.parse(jsonStr);
        const chartData: ChartData = {
          type: parsed.type,
          title: parsed.title,
          data: parsed.data,
          dataKeys: parsed.dataKeys || (parsed.dataKey ? [parsed.dataKey] : ["value"]),
          colors: parsed.colors || [],
        };
        if (chartData.type && chartData.data) {
          const cleanText = text.replace(regex, "").trim();
          return { cleanText, chartData };
        }
      } catch {
        continue;
      }
    }
  }

  return { cleanText: text, chartData: null };
}

function formatNumber(n: number): string {
  if (n >= 1000000) return (n / 1000000).toFixed(1) + "M";
  if (n >= 1000) return (n / 1000).toFixed(1) + "K";
  return n.toLocaleString();
}

function formatCurrency(n: number): string {
  if (n === 0) return "$0";
  return "$" + formatNumber(n);
}

function pctDelta(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0;
  return +((current - previous) / previous * 100).toFixed(1);
}

function DeltaBadge({ value, suffix = "%" }: { value: number; suffix?: string }) {
  const color = value >= 0 ? "text-green-600" : "text-red-600";
  return (
    <span className={`text-xs font-medium ${color}`}>
      {value >= 0 ? "+" : ""}{value}{suffix}
    </span>
  );
}

function useChartColors() {
  const el = typeof document !== "undefined" ? document.documentElement : null;
  function getCssColor(varName: string): string {
    if (!el) return "#888";
    const val = getComputedStyle(el).getPropertyValue(varName).trim();
    return val ? `hsl(${val})` : "#888";
  }
  return {
    chart1: getCssColor("--chart-1"),
    chart2: getCssColor("--chart-2"),
    chart3: getCssColor("--chart-3"),
    chart4: getCssColor("--chart-4"),
    chart5: getCssColor("--chart-5"),
    primary: getCssColor("--primary"),
    muted: getCssColor("--muted"),
    mutedFg: getCssColor("--muted-foreground"),
    border: getCssColor("--border"),
    foreground: getCssColor("--foreground"),
  };
}

function ThinkingAnimation() {
  return (
    <div className="flex items-start gap-3 mb-6">
      <div className="thinking-logo">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="10" stroke="hsl(var(--primary))" strokeWidth="2" className="thinking-circle" />
          <circle cx="12" cy="12" r="4" fill="hsl(var(--primary))" className="thinking-dot" />
        </svg>
      </div>
      <div className="flex items-center gap-1.5 pt-1">
        <div className="thinking-dot-bounce" style={{ animationDelay: "0ms" }} />
        <div className="thinking-dot-bounce" style={{ animationDelay: "150ms" }} />
        <div className="thinking-dot-bounce" style={{ animationDelay: "300ms" }} />
      </div>
    </div>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <button
      onClick={handleCopy}
      className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-md transition-colors text-muted-foreground"
      data-testid="button-copy"
    >
      {copied ? (
        <>
          <Check className="w-3.5 h-3.5" />
          <span>Copiado</span>
        </>
      ) : (
        <>
          <Copy className="w-3.5 h-3.5" />
          <span>Copiar</span>
        </>
      )}
    </button>
  );
}

function KpiCards({ apiData }: { apiData: SheetsApiData }) {
  const months = apiData.months;
  const current = months[months.length - 1];
  const prev = months[months.length - 2];
  const threeMonthsAgo = months[0];
  const cur = apiData.monthly[current];
  const prv = apiData.monthly[prev];
  const old = apiData.monthly[threeMonthsAgo];

  const curReach = cur.facebook.reach + cur.instagram.reach;
  const prevReach = prv.facebook.reach + prv.instagram.reach;
  const oldReach = old.facebook.reach + old.instagram.reach;

  const curEngagements = cur.instagram.likes + cur.instagram.comments + cur.instagram.saves + cur.instagram.shares + cur.facebook.engagement;
  const prevEngagements = prv.instagram.likes + prv.instagram.comments + prv.instagram.saves + prv.instagram.shares + prv.facebook.engagement;

  const curEngRate = curReach > 0 ? +(curEngagements / curReach * 100).toFixed(2) : 0;
  const prevEngRate = prevReach > 0 ? +(prevEngagements / prevReach * 100).toFixed(2) : 0;

  return (
    <div className="grid grid-cols-2 xl:grid-cols-3 gap-3 mb-5">
      <div className="bg-card rounded-xl p-4 border border-card-border shadow-sm">
        <p className="text-xs mb-1 font-bold text-[#392e22]">Alcance Total</p>
        <p className="text-2xl font-bold text-foreground" data-testid="text-total-reach">{formatNumber(curReach)}</p>
        <p className="text-[10px] text-muted-foreground">FB + IG — {MONTH_LABELS[current]}</p>
        <div className="flex items-center gap-2 mt-1">
          <DeltaBadge value={pctDelta(curReach, prevReach)} />
          <span className="text-[10px] text-muted-foreground">vs mes anterior</span>
        </div>
        <div className="flex items-center gap-2">
          <DeltaBadge value={pctDelta(curReach, oldReach)} />
          <span className="text-[10px] text-muted-foreground">vs 3 meses</span>
        </div>
      </div>

      <div className="bg-card rounded-xl p-4 border border-card-border shadow-sm">
        <p className="text-xs mb-1 font-bold text-[#392e22]">Engagement Rate</p>
        <p className="text-2xl font-bold text-foreground" data-testid="text-engagement-rate">{curEngRate}%</p>
        <p className="text-[10px] text-muted-foreground">Promedio FB + IG</p>
        <div className="flex items-center gap-2 mt-1">
          <DeltaBadge value={+(curEngRate - prevEngRate).toFixed(2)} suffix="pp" />
          <span className="text-[10px] text-muted-foreground">vs mes anterior</span>
        </div>
      </div>

      <div className="bg-card rounded-xl p-4 border border-card-border shadow-sm">
        <p className="text-xs mb-1 font-bold text-[#392e22]">Interacciones Totales</p>
        <p className="text-2xl font-bold text-foreground" data-testid="text-total-interactions">{formatNumber(curEngagements)}</p>
        <p className="text-[10px] text-muted-foreground">IG + FB — {MONTH_LABELS[current]}</p>
        <div className="flex items-center gap-2 mt-1">
          <DeltaBadge value={pctDelta(curEngagements, prevEngagements)} />
          <span className="text-[10px] text-muted-foreground">vs mes anterior</span>
        </div>
      </div>

      <div className="bg-card rounded-xl p-4 border border-card-border shadow-sm">
        <div className="flex items-center gap-2 mb-1">
          <SiInstagram className="text-[#E1306C]" size={14} />
          <p className="text-xs font-bold text-[#392e22]">Nuevos Seguidores IG</p>
        </div>
        <p className="text-2xl font-bold text-foreground" data-testid="text-ig-new-followers">{formatNumber(cur.instagram.new_followers)}</p>
        <p className="text-[10px] text-muted-foreground">{MONTH_LABELS[current]}</p>
        <div className="flex items-center gap-2 mt-1">
          <DeltaBadge value={pctDelta(cur.instagram.new_followers, prv.instagram.new_followers)} />
          <span className="text-[10px] text-muted-foreground">vs mes anterior</span>
        </div>
      </div>

      <div className="bg-card rounded-xl p-4 border border-card-border shadow-sm col-span-2 xl:col-span-1">
        <p className="text-xs mb-1 font-bold text-[#392e22]">Gasto Meta Ads</p>
        <p className="text-2xl font-bold text-foreground" data-testid="text-meta-spend">{formatCurrency(cur.meta_ads.spend)}</p>
        {cur.meta_ads.spend === 0 ? (
          <p className="text-[10px] text-muted-foreground italic">Sin pauta este mes</p>
        ) : (
          <>
            <p className="text-[10px] text-muted-foreground">MXN — {MONTH_LABELS[current]}</p>
            <div className="flex items-center gap-2 mt-1">
              <DeltaBadge value={pctDelta(cur.meta_ads.spend, prv.meta_ads.spend)} />
              <span className="text-[10px] text-muted-foreground">vs mes anterior</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function PlatformTable({ apiData }: { apiData: SheetsApiData }) {
  const months = apiData.months;
  const current = months[months.length - 1];
  const prev = months[months.length - 2];
  const cur = apiData.monthly[current];
  const prv = apiData.monthly[prev];

  const fbEngRate = cur.facebook.reach > 0 ? +(cur.facebook.engagement / cur.facebook.reach * 100).toFixed(2) : 0;
  const igEngRate = cur.instagram.reach > 0 ? +((cur.instagram.likes + cur.instagram.comments + cur.instagram.saves + cur.instagram.shares) / cur.instagram.reach * 100).toFixed(2) : 0;

  const igInteractions = cur.instagram.likes + cur.instagram.comments + cur.instagram.saves + cur.instagram.shares;
  const prevIgInteractions = prv.instagram.likes + prv.instagram.comments + prv.instagram.saves + prv.instagram.shares;

  const rows = [
    {
      platform: "Facebook",
      color: "#1877F2",
      icon: <SiFacebook size={14} />,
      reach: cur.facebook.reach,
      interactions: cur.facebook.engagement,
      engRate: fbEngRate,
      newFollowers: "—",
      vsPrev: pctDelta(cur.facebook.reach, prv.facebook.reach),
    },
    {
      platform: "Instagram",
      color: "#E1306C",
      icon: <SiInstagram size={14} />,
      reach: cur.instagram.reach,
      interactions: igInteractions,
      engRate: igEngRate,
      newFollowers: formatNumber(cur.instagram.new_followers),
      vsPrev: pctDelta(cur.instagram.reach, prv.instagram.reach),
    },
    {
      platform: "TikTok",
      color: "#69C9D0",
      icon: <SiTiktok size={14} />,
      reach: null,
      interactions: null,
      engRate: null,
      newFollowers: null,
      vsPrev: null,
    },
  ];

  return (
    <div className="bg-card rounded-xl border border-card-border shadow-sm mb-5 overflow-hidden">
      <table className="w-full text-xs" data-testid="table-platform-summary">
        <thead>
          <tr className="border-b border-card-border bg-muted/30">
            <th className="text-left px-4 py-2.5 font-semibold text-[#392e22]">Plataforma</th>
            <th className="text-right px-3 py-2.5 font-semibold text-[#392e22]">Alcance</th>
            <th className="text-right px-3 py-2.5 font-semibold text-[#392e22]">Interacciones</th>
            <th className="text-right px-3 py-2.5 font-semibold text-[#392e22]">Eng. Rate</th>
            <th className="text-right px-3 py-2.5 font-semibold text-[#392e22]">Nuevos Seg.</th>
            <th className="text-right px-4 py-2.5 font-semibold text-[#392e22]">vs Mes Ant.</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.platform} className="border-b border-card-border last:border-0">
              <td className="px-4 py-2.5">
                <div className="flex items-center gap-2">
                  <span style={{ color: r.color }}>{r.icon}</span>
                  <span className="font-semibold" style={{ color: r.color }}>{r.platform}</span>
                </div>
              </td>
              <td className="text-right px-3 py-2.5 text-foreground">{r.reach !== null ? formatNumber(r.reach) : <span className="text-muted-foreground italic">Sin datos</span>}</td>
              <td className="text-right px-3 py-2.5 text-foreground">{r.interactions !== null ? formatNumber(r.interactions) : <span className="text-muted-foreground italic">Sin datos</span>}</td>
              <td className="text-right px-3 py-2.5 text-foreground">{r.engRate !== null ? `${r.engRate}%` : <span className="text-muted-foreground italic">Sin datos</span>}</td>
              <td className="text-right px-3 py-2.5 text-foreground">{r.newFollowers !== null ? r.newFollowers : <span className="text-muted-foreground italic">Sin datos</span>}</td>
              <td className="text-right px-4 py-2.5">{r.vsPrev !== null ? <DeltaBadge value={r.vsPrev} /> : <span className="text-muted-foreground italic">—</span>}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const PIE_COLORS = ["#E1306C", "#F77737", "#FCAF45", "#833AB4"];

function DefaultCharts({ apiData }: { apiData: SheetsApiData }) {
  const themeColors = useChartColors();
  const months = apiData.months;
  const current = months[months.length - 1];
  const cur = apiData.monthly[current];

  const reachData = months.map((ym) => ({
    name: MONTH_LABELS[ym] || ym,
    Facebook: apiData.monthly[ym].facebook.reach,
    Instagram: apiData.monthly[ym].instagram.reach,
  }));

  const engRateData = months.map((ym) => {
    const m = apiData.monthly[ym];
    const fbRate = m.facebook.reach > 0 ? +(m.facebook.engagement / m.facebook.reach * 100).toFixed(2) : 0;
    const igTotal = m.instagram.likes + m.instagram.comments + m.instagram.saves + m.instagram.shares;
    const igRate = m.instagram.reach > 0 ? +(igTotal / m.instagram.reach * 100).toFixed(2) : 0;
    return { name: MONTH_LABELS[ym] || ym, Facebook: fbRate, Instagram: igRate };
  });

  const pieData = [
    { name: "Likes", value: cur.instagram.likes },
    { name: "Comentarios", value: cur.instagram.comments },
    { name: "Guardados", value: cur.instagram.saves },
    { name: "Compartidos", value: cur.instagram.shares },
  ];
  const pieTotal = pieData.reduce((a, b) => a + b.value, 0);

  const followersData = months.map((ym) => ({
    name: MONTH_LABELS[ym] || ym,
    Seguidores: apiData.monthly[ym].instagram.new_followers,
  }));

  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
      <div className="bg-card rounded-xl p-5 border border-card-border shadow-sm">
        <h3 className="text-sm mb-4 font-bold text-[#392e22]" data-testid="text-reach-chart-title">Alcance Mensual por Plataforma</h3>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={reachData}>
            <CartesianGrid strokeDasharray="3 3" stroke={themeColors.border} />
            <XAxis dataKey="name" tick={{ fontSize: 12, fill: themeColors.mutedFg }} />
            <YAxis tick={{ fontSize: 12, fill: themeColors.mutedFg }} tickFormatter={(v) => formatNumber(v)} />
            <Tooltip contentStyle={{ background: "#fff", borderRadius: "8px", border: "1px solid #e0e0e0", padding: "12px", fontSize: "12px" }} formatter={(v: number) => formatNumber(v)} cursor={false} />
            <Legend wrapperStyle={{ fontSize: "12px" }} />
            <Bar dataKey="Facebook" fill="#1877F2" radius={[4, 4, 0, 0]} />
            <Bar dataKey="Instagram" fill="#E1306C" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="bg-card rounded-xl p-5 border border-card-border shadow-sm">
        <h3 className="text-sm mb-4 font-bold text-[#392e22]" data-testid="text-engagement-chart-title">Evolución de Engagement Rate</h3>
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={engRateData}>
            <CartesianGrid strokeDasharray="3 3" stroke={themeColors.border} />
            <XAxis dataKey="name" tick={{ fontSize: 12, fill: themeColors.mutedFg }} />
            <YAxis tick={{ fontSize: 12, fill: themeColors.mutedFg }} tickFormatter={(v) => `${v}%`} />
            <Tooltip contentStyle={{ background: "#fff", borderRadius: "8px", border: "1px solid #e0e0e0", padding: "12px", fontSize: "12px" }} formatter={(v: number) => `${v}%`} cursor={false} />
            <Legend wrapperStyle={{ fontSize: "12px" }} />
            <Line type="monotone" dataKey="Facebook" stroke="#1877F2" strokeWidth={2} dot={{ r: 4 }} />
            <Line type="monotone" dataKey="Instagram" stroke="#E1306C" strokeWidth={2} dot={{ r: 4 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="bg-card rounded-xl p-5 border border-card-border shadow-sm">
        <h3 className="text-sm mb-4 font-bold text-[#392e22]" data-testid="text-pie-chart-title">Tipo de Interacciones — Instagram {MONTH_LABELS[current]} 2026</h3>
        <ResponsiveContainer width="100%" height={260}>
          <PieChart>
            <Pie
              data={pieData}
              cx="50%"
              cy="50%"
              outerRadius={90}
              dataKey="value"
              label={({ name, value }) => `${name} ${pieTotal > 0 ? ((value / pieTotal) * 100).toFixed(0) : 0}%`}
              labelLine={false}
            >
              {pieData.map((_, idx) => (
                <Cell key={idx} fill={PIE_COLORS[idx]} />
              ))}
            </Pie>
            <Tooltip contentStyle={{ background: "#fff", borderRadius: "8px", border: "1px solid #e0e0e0", padding: "12px", fontSize: "12px" }} formatter={(v: number) => formatNumber(v)} />
            <Legend wrapperStyle={{ fontSize: "12px" }} />
          </PieChart>
        </ResponsiveContainer>
      </div>

      <div className="bg-card rounded-xl p-5 border border-card-border shadow-sm">
        <h3 className="text-sm mb-4 font-bold text-[#392e22]" data-testid="text-followers-chart-title">Nuevos Seguidores Mensuales — Instagram</h3>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={followersData}>
            <CartesianGrid strokeDasharray="3 3" stroke={themeColors.border} />
            <XAxis dataKey="name" tick={{ fontSize: 12, fill: themeColors.mutedFg }} />
            <YAxis tick={{ fontSize: 12, fill: themeColors.mutedFg }} />
            <Tooltip contentStyle={{ background: "#fff", borderRadius: "8px", border: "1px solid #e0e0e0", padding: "12px", fontSize: "12px" }} cursor={false} />
            <Bar dataKey="Seguidores" fill="#E1306C" radius={[4, 4, 0, 0]}>
              <LabelList dataKey="Seguidores" position="top" formatter={(v: number) => formatNumber(v)} style={{ fontSize: 10, fill: themeColors.mutedFg }} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function DynamicChart({ chartData }: { chartData: ChartData }) {
  const { type, title, data, dataKeys, colors: chartColors } = chartData;
  const themeColors = useChartColors();
  const defaultColors = ["#E1306C", "#1877F2", "#69C9D0", "#ED7C22", "#833AB4"];

  if (type === "pie") {
    const total = data.reduce((a, d) => a + (Number(d[dataKeys[0]] || d.value) || 0), 0);
    return (
      <div className="bg-card rounded-xl p-5 border border-card-border shadow-sm">
        <h3 className="text-sm font-semibold text-foreground mb-4">{title}</h3>
        <ResponsiveContainer width="100%" height={280}>
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              outerRadius={90}
              dataKey={dataKeys[0] || "value"}
              label={({ name, value }) => `${name} ${total > 0 ? ((Number(value) / total) * 100).toFixed(0) : 0}%`}
              labelLine={false}
            >
              {data.map((_, idx) => (
                <Cell key={idx} fill={chartColors[idx] || defaultColors[idx % defaultColors.length]} />
              ))}
            </Pie>
            <Tooltip contentStyle={{ background: "#fff", borderRadius: "8px", border: "1px solid #e0e0e0", padding: "12px", fontSize: "12px" }} formatter={(v: number) => formatNumber(v)} />
            <Legend wrapperStyle={{ fontSize: "12px" }} />
          </PieChart>
        </ResponsiveContainer>
      </div>
    );
  }

  return (
    <div className="bg-card rounded-xl p-5 border border-card-border shadow-sm">
      <h3 className="text-sm font-semibold text-foreground mb-4">{title}</h3>
      <ResponsiveContainer width="100%" height={280}>
        {type === "line" ? (
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke={themeColors.border} />
            <XAxis dataKey="name" tick={{ fontSize: 12, fill: themeColors.mutedFg }} />
            <YAxis tick={{ fontSize: 12, fill: themeColors.mutedFg }} />
            <Tooltip contentStyle={{ background: "#fff", borderRadius: "8px", border: "1px solid #e0e0e0", padding: "12px", fontSize: "12px" }} cursor={false} />
            <Legend wrapperStyle={{ fontSize: "12px" }} />
            {dataKeys.map((key, i) => (
              <Line key={key} type="monotone" dataKey={key} stroke={chartColors[i] || defaultColors[i % defaultColors.length]} strokeWidth={2} dot={{ r: 4 }} />
            ))}
          </LineChart>
        ) : type === "area" ? (
          <AreaChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke={themeColors.border} />
            <XAxis dataKey="name" tick={{ fontSize: 12, fill: themeColors.mutedFg }} />
            <YAxis tick={{ fontSize: 12, fill: themeColors.mutedFg }} />
            <Tooltip contentStyle={{ background: "#fff", borderRadius: "8px", border: "1px solid #e0e0e0", padding: "12px", fontSize: "12px" }} cursor={false} />
            <Legend wrapperStyle={{ fontSize: "12px" }} />
            {dataKeys.map((key, i) => (
              <Area key={key} type="monotone" dataKey={key} fill={chartColors[i] || defaultColors[i % defaultColors.length]} stroke={chartColors[i] || defaultColors[i % defaultColors.length]} fillOpacity={0.2} />
            ))}
          </AreaChart>
        ) : (
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke={themeColors.border} />
            <XAxis dataKey="name" tick={{ fontSize: 12, fill: themeColors.mutedFg }} />
            <YAxis tick={{ fontSize: 12, fill: themeColors.mutedFg }} />
            <Tooltip contentStyle={{ background: "#fff", borderRadius: "8px", border: "1px solid #e0e0e0", padding: "12px", fontSize: "12px" }} formatter={(value: number) => formatNumber(value)} cursor={false} />
            <Legend wrapperStyle={{ fontSize: "12px" }} />
            {dataKeys.map((key, i) => (
              <Bar key={key} dataKey={key} fill={chartColors[i] || defaultColors[i % defaultColors.length]} radius={[6, 6, 0, 0]}>
                <LabelList dataKey={key} position="top" formatter={(v: number) => formatNumber(v)} style={{ fontSize: 10, fill: themeColors.mutedFg }} />
              </Bar>
            ))}
          </BarChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}

const FALLBACK_API_DATA: SheetsApiData = {
  plaza: "Patio Santa Fe",
  months: ["2025-11", "2025-12", "2026-01", "2026-02"],
  monthly: {
    "2025-11": {
      facebook: { reach: 0, engagement: 0, followers_total: 0 },
      instagram: { reach: 0, engagement: 0, new_followers: 0, likes: 0, comments: 0, saves: 0, shares: 0 },
      meta_ads: { spend: 0, impressions: 0, clicks: 0, ctr: 0 },
    },
    "2025-12": {
      facebook: { reach: 0, engagement: 0, followers_total: 0 },
      instagram: { reach: 0, engagement: 0, new_followers: 0, likes: 0, comments: 0, saves: 0, shares: 0 },
      meta_ads: { spend: 0, impressions: 0, clicks: 0, ctr: 0 },
    },
    "2026-01": {
      facebook: { reach: 0, engagement: 0, followers_total: 0 },
      instagram: { reach: 0, engagement: 0, new_followers: 0, likes: 0, comments: 0, saves: 0, shares: 0 },
      meta_ads: { spend: 0, impressions: 0, clicks: 0, ctr: 0 },
    },
    "2026-02": {
      facebook: { reach: 0, engagement: 0, followers_total: 0 },
      instagram: { reach: 0, engagement: 0, new_followers: 0, likes: 0, comments: 0, saves: 0, shares: 0 },
      meta_ads: { spend: 0, impressions: 0, clicks: 0, ctr: 0 },
    },
  },
};

export default function Home() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [activeChart, setActiveChart] = useState<ChartData | null>(null);
  const [canvasOpen, setCanvasOpen] = useState(true);
  const [questionChips, setQuestionChips] = useState<string[]>([]);
  const [chipsLoading, setChipsLoading] = useState(true);
  const [apiData, setApiData] = useState<SheetsApiData>(FALLBACK_API_DATA);
  const [dataContext, setDataContext] = useState(JSON.stringify(FALLBACK_API_DATA, null, 2));
  const [dataLoaded, setDataLoaded] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    async function fetchSheetsData() {
      try {
        const res = await fetch("/api/sheets-data");
        if (res.ok) {
          const data = await res.json();
          setApiData(data);
          setDataContext(JSON.stringify(data, null, 2));
        }
      } catch {}
      setDataLoaded(true);
    }
    fetchSheetsData();
  }, []);

  useEffect(() => {
    if (!dataLoaded) return;
    async function fetchChips() {
      try {
        const res = await apiRequest("POST", "/api/chat", {
          messages: [
            {
              role: "user",
              content:
                "Based on this social media data, generate 6 relevant opening questions a marketing manager would want to ask. Return ONLY a JSON array of 6 questions in Spanish, nothing else. Example: [\"question 1\", \"question 2\", ...]. Do NOT include any CHART_DATA or SUGGESTED block.",
            },
          ],
          context: dataContext,
        });
        const data = await res.json();
        const stripped = data.response.replace(/\n?SUGGESTED:\s*\[[\s\S]*?\]\s*$/, "").replace(/CHART_DATA:\s*\{[^\n]*\}/g, "").trim();
        const raw = stripped.replace(/```json\s*/g, "").replace(/```/g, "").trim();
        const jsonMatch = raw.match(/\[[\s\S]*\]/);
        const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setQuestionChips(parsed);
        }
      } catch {}
      finally {
        setChipsLoading(false);
      }
    }
    fetchChips();
  }, [dataLoaded, dataContext]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 120) + "px";
    }
  }, [input]);

  async function sendMessage(text: string) {
    if (!text.trim() || isLoading) return;

    const userMessage: ChatMessage = { role: "user", content: text };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput("");
    setIsLoading(true);

    try {
      const res = await apiRequest("POST", "/api/chat", {
        messages: newMessages,
        context: dataContext,
      });
      const data = await res.json();
      const { cleanText: afterSuggested, suggestions } = parseSuggested(data.response);
      const { cleanText, chartData } = parseChartData(afterSuggested);

      if (chartData) {
        setActiveChart(chartData);
        setCanvasOpen(true);
      }

      setMessages((prev) => [...prev, { role: "assistant", content: cleanText, suggestions }]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Lo siento, hubo un error al procesar tu solicitud. Intenta de nuevo." },
      ]);
    } finally {
      setIsLoading(false);
      textareaRef.current?.focus();
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    sendMessage(input);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  }

  function handleExportPdf() {
    window.print();
  }

  const currentMonthLabel = MONTH_LABELS[apiData.months[apiData.months.length - 1]] || "";

  return (
    <div className="h-screen flex flex-col bg-background">
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
        <div className={`flex flex-col h-full transition-all duration-300 ${canvasOpen ? "w-full md:w-[42%]" : "w-full"}`}>
          <div className="flex items-center justify-between px-[26px] pt-[25px] pb-[15px]">
            <img
              src={AGENCY_LOGO}
              alt="Parallax"
              className="h-5 md:h-6"
              data-testid="img-agency-logo"
            />
            <img
              src={CLIENT_LOGO}
              alt="FUNO"
              className="h-5 md:h-6"
              data-testid="img-client-logo"
            />
          </div>

          <div className="flex-1 overflow-y-auto px-4 md:px-8 py-6" data-testid="chat-scroll-area">
            {messages.length === 0 && (
              <div className="max-w-xl mx-auto pt-8">
                <h1 className="text-2xl font-semibold text-foreground mb-6">Hola, pregunta lo que necesites sobre tus redes sociales.</h1>
                <div className="flex flex-wrap gap-2">
                  {chipsLoading ? (
                    [180, 150, 200, 160, 190, 170].map((w, i) => (
                      <div
                        key={i}
                        className="h-9 rounded-full bg-muted animate-pulse"
                        style={{ width: `${w}px` }}
                        data-testid={`skeleton-chip-${i}`}
                      />
                    ))
                  ) : (
                    questionChips.map((q, i) => (
                      <button
                        key={i}
                        onClick={() => sendMessage(q)}
                        disabled={isLoading}
                        className="chip-button px-4 py-2 rounded-full border border-border text-foreground bg-transparent transition-all disabled:opacity-50 text-[13px] text-left"
                        data-testid={`button-chip-${i}`}
                      >
                        {q}
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}

            <div className="max-w-xl mx-auto">
              {messages.map((msg, i) => (
                <div key={i} className="mb-5">
                  {msg.role === "user" ? (
                    <div className="flex justify-end">
                      <div
                        className="px-4 py-2.5 rounded-2xl text-sm leading-relaxed max-w-[85%] bg-secondary text-foreground"
                        data-testid={`text-message-${i}`}
                      >
                        <p className="whitespace-pre-wrap">{msg.content}</p>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-start">
                      <div
                        className="text-sm leading-relaxed max-w-full text-foreground"
                        data-testid={`text-message-${i}`}
                      >
                        <MarkdownContent content={msg.content} />
                      </div>
                      <div className="mt-1.5">
                        <CopyButton text={msg.content} />
                      </div>
                      {msg.suggestions && msg.suggestions.length > 0 && i === messages.length - 1 && (
                        <div className="flex flex-wrap gap-2 mt-3">
                          {msg.suggestions.map((s, si) => (
                            <button
                              key={si}
                              onClick={() => sendMessage(s)}
                              disabled={isLoading}
                              className="chip-button text-sm px-4 py-2 rounded-full border border-border text-foreground bg-transparent transition-all disabled:opacity-50"
                              data-testid={`button-suggestion-${si}`}
                            >
                              {s}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}

              {isLoading && <ThinkingAnimation />}

              <div ref={messagesEndRef} />
            </div>
          </div>

          <div className="px-4 md:px-8 pb-4 pt-2 print:hidden">
            <form
              onSubmit={handleSubmit}
              className="relative rounded-2xl border border-border shadow-sm bg-card"
            >
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Responder..."
                disabled={isLoading}
                rows={1}
                className="w-full resize-none bg-transparent px-4 pt-3.5 pb-12 text-sm text-foreground focus:outline-none disabled:opacity-50"
                style={{ minHeight: "52px" }}
                data-testid="input-chat"
              />
              <div className="absolute bottom-2.5 right-2.5">
                <button
                  type="submit"
                  disabled={isLoading || !input.trim()}
                  className="w-8 h-8 rounded-lg flex items-center justify-center transition-opacity disabled:opacity-30 bg-primary text-primary-foreground"
                  data-testid="button-send"
                >
                  <ArrowUp className="w-4 h-4" />
                </button>
              </div>
            </form>
            <p className="text-center text-xs mt-2 text-muted-foreground">
              La IA puede cometer errores. Verifica los datos importantes.
            </p>
          </div>
        </div>

        {canvasOpen && (
          <div className="hidden md:flex print:flex w-full md:w-[58%] flex-col border-l border-border overflow-hidden print:w-1/2 bg-accent">
            <div className="flex items-center justify-between gap-2 px-5 py-3 border-b border-border">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <RefreshCw className="w-3.5 h-3.5 text-muted-foreground" />
                  <span className="text-sm font-medium text-foreground">{apiData.plaza}</span>
                  <span className="text-xs text-muted-foreground">{currentMonthLabel} 2026</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleExportPdf}
                  className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-md border border-border text-foreground bg-transparent transition-colors"
                  data-testid="button-export-pdf"
                >
                  Exportar PDF
                </button>
                <button
                  onClick={() => setCanvasOpen(false)}
                  className="w-7 h-7 rounded-md flex items-center justify-center transition-colors text-muted-foreground md:hidden"
                  data-testid="button-close-canvas"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-5">
              <KpiCards apiData={apiData} />
              <PlatformTable apiData={apiData} />
              {activeChart ? <DynamicChart chartData={activeChart} /> : <DefaultCharts apiData={apiData} />}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
