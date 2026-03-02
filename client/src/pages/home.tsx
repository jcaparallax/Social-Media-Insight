import { useState, useRef, useEffect, useMemo } from "react";
import { Copy, Check, ArrowUp, X, RefreshCw, ChevronDown } from "lucide-react";
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

function getMonthLabel(ym: string): string {
  const [yearStr, monthStr] = ym.split("-");
  const monthNames: Record<string, string> = {
    "01": "Ene", "02": "Feb", "03": "Mar", "04": "Abr",
    "05": "May", "06": "Jun", "07": "Jul", "08": "Ago",
    "09": "Sep", "10": "Oct", "11": "Nov", "12": "Dic",
  };
  return monthNames[monthStr] || ym;
}

function getMonthYear(ym: string): string {
  const [yearStr] = ym.split("-");
  return yearStr;
}

interface MonthlyData {
  facebook: { reach: number; reach_organic: number; engagement: number; followers_total: number };
  instagram: { reach: number; engagement: number; new_followers: number; likes: number; comments: number; saves: number; shares: number; has_followers_data: boolean };
  meta_ads: { spend: number; impressions: number; clicks: number; ctr: number };
}

interface PlazaData {
  months: string[];
  monthly: Record<string, MonthlyData>;
}

interface PlazaSummary {
  id: string;
  displayName: string;
}

interface SheetsApiResponse {
  plazas: Record<string, PlazaData>;
  availablePlazas: PlazaSummary[];
}

interface AggregatedData {
  months: string[];
  monthly: Record<string, MonthlyData>;
}

function aggregatePlazaData(response: SheetsApiResponse, selectedPlazaIds: string[]): AggregatedData {
  const plazaKeys = selectedPlazaIds.length === 0 || selectedPlazaIds.includes("all")
    ? Object.keys(response.plazas)
    : selectedPlazaIds.filter((id) => id in response.plazas);

  if (plazaKeys.length === 0) {
    return { months: [], monthly: {} };
  }

  if (plazaKeys.length === 1) {
    const p = response.plazas[plazaKeys[0]];
    return { months: p.months, monthly: p.monthly };
  }

  const allMonths = new Set<string>();
  for (const key of plazaKeys) {
    for (const m of response.plazas[key].months) {
      allMonths.add(m);
    }
  }
  const months = Array.from(allMonths).sort();

  const monthly: Record<string, MonthlyData> = {};
  for (const ym of months) {
    const agg: MonthlyData = {
      facebook: { reach: 0, reach_organic: 0, engagement: 0, followers_total: 0 },
      instagram: { reach: 0, engagement: 0, new_followers: 0, likes: 0, comments: 0, saves: 0, shares: 0, has_followers_data: false },
      meta_ads: { spend: 0, impressions: 0, clicks: 0, ctr: 0 },
    };
    let totalImpressions = 0;
    let totalClicks = 0;
    for (const key of plazaKeys) {
      const m = response.plazas[key].monthly[ym];
      if (!m) continue;
      agg.facebook.reach += m.facebook.reach;
      agg.facebook.reach_organic += m.facebook.reach_organic || 0;
      agg.facebook.engagement += m.facebook.engagement;
      agg.facebook.followers_total += m.facebook.followers_total;
      agg.instagram.reach += m.instagram.reach;
      agg.instagram.engagement += m.instagram.engagement;
      agg.instagram.new_followers += m.instagram.new_followers;
      agg.instagram.likes += m.instagram.likes;
      agg.instagram.comments += m.instagram.comments;
      agg.instagram.saves += m.instagram.saves;
      agg.instagram.shares += m.instagram.shares;
      if (m.instagram.has_followers_data) agg.instagram.has_followers_data = true;
      agg.meta_ads.spend += m.meta_ads.spend;
      agg.meta_ads.impressions += m.meta_ads.impressions;
      agg.meta_ads.clicks += m.meta_ads.clicks;
      totalImpressions += m.meta_ads.impressions;
      totalClicks += m.meta_ads.clicks;
    }
    agg.meta_ads.ctr = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;
    monthly[ym] = agg;
  }

  return { months, monthly };
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

function PlazaMultiSelect({
  availablePlazas,
  selectedPlazaIds,
  onChange,
}: {
  availablePlazas: PlazaSummary[];
  selectedPlazaIds: string[];
  onChange: (ids: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const allSelected = selectedPlazaIds.includes("all") || selectedPlazaIds.length === 0;

  const label = allSelected
    ? "Todas las plazas"
    : selectedPlazaIds.length === 1
      ? availablePlazas.find((p) => p.id === selectedPlazaIds[0])?.displayName || selectedPlazaIds[0]
      : `${selectedPlazaIds.length} plazas`;

  function toggleAll() {
    onChange(["all"]);
  }

  function togglePlaza(id: string) {
    if (allSelected) {
      onChange([id]);
    } else if (selectedPlazaIds.includes(id)) {
      const next = selectedPlazaIds.filter((p) => p !== id);
      if (next.length === 0) {
        onChange(["all"]);
      } else {
        onChange(next);
      }
    } else {
      const next = [...selectedPlazaIds, id];
      if (next.length === availablePlazas.length) {
        onChange(["all"]);
      } else {
        onChange(next);
      }
    }
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-md border border-border text-foreground bg-transparent transition-colors"
        data-testid="button-plaza-select"
      >
        {label}
        <ChevronDown className="w-3.5 h-3.5" />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 z-50 min-w-[200px] rounded-md border border-border bg-card shadow-md py-1">
          <button
            onClick={toggleAll}
            className={`w-full text-left px-3 py-2 text-xs transition-colors ${allSelected ? "bg-primary/10 font-semibold text-primary" : "text-foreground hover:bg-muted"}`}
            data-testid="button-plaza-all"
          >
            Todas las plazas
          </button>
          {availablePlazas.map((plaza) => {
            const isSelected = allSelected || selectedPlazaIds.includes(plaza.id);
            return (
              <button
                key={plaza.id}
                onClick={() => togglePlaza(plaza.id)}
                className={`w-full text-left px-3 py-2 text-xs transition-colors ${!allSelected && isSelected ? "bg-primary/10 font-semibold text-primary" : "text-foreground hover:bg-muted"}`}
                data-testid={`button-plaza-${plaza.id}`}
              >
                {plaza.displayName}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function KpiCard({ children, contextText, className = "", id }: { children: React.ReactNode; contextText: string; className?: string; id: string }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className={`bg-card rounded-xl border border-card-border shadow-sm ${className}`}>
      <div className="p-4 relative">
        {children}
        <button
          onClick={() => setExpanded(!expanded)}
          className="absolute bottom-2 right-2 p-1 text-muted-foreground hover:text-foreground transition-colors"
          data-testid={`button-kpi-context-${id}`}
        >
          <ChevronDown
            className={`w-3.5 h-3.5 transition-transform duration-200 ease-in-out ${expanded ? "rotate-180" : ""}`}
          />
        </button>
      </div>
      {expanded && (
        <div className="bg-muted/40 rounded-b-xl px-4 py-3">
          <p className="text-xs text-muted-foreground leading-relaxed">{contextText}</p>
        </div>
      )}
    </div>
  );
}

function KpiCards({ data }: { data: AggregatedData }) {
  const months = data.months;
  if (months.length < 2) return null;

  const current = months[months.length - 1];
  const prev = months[months.length - 2];
  const threeMonthsAgo = months[0];
  const cur = data.monthly[current];
  const prv = data.monthly[prev];
  const old = data.monthly[threeMonthsAgo];

  const curFbReachOrganic = cur.facebook.reach_organic || 0;
  const prevFbReachOrganic = prv.facebook.reach_organic || 0;
  const oldFbReachOrganic = old.facebook.reach_organic || 0;

  const curEngagements = cur.instagram.likes + cur.instagram.comments + cur.instagram.saves + cur.instagram.shares + cur.facebook.engagement;
  const prevEngagements = prv.instagram.likes + prv.instagram.comments + prv.instagram.saves + prv.instagram.shares + prv.facebook.engagement;

  const curFbEngDenom = cur.facebook.reach_organic > 0 ? cur.facebook.reach_organic : cur.facebook.reach;
  const prevFbEngDenom = prv.facebook.reach_organic > 0 ? prv.facebook.reach_organic : prv.facebook.reach;
  const curFbEngRate = curFbEngDenom > 0 ? +(cur.facebook.engagement / curFbEngDenom * 100).toFixed(2) : 0;
  const prevFbEngRate = prevFbEngDenom > 0 ? +(prv.facebook.engagement / prevFbEngDenom * 100).toFixed(2) : 0;

  const curIgEngTotal = cur.instagram.likes + cur.instagram.comments + cur.instagram.saves + cur.instagram.shares;
  const prevIgEngTotal = prv.instagram.likes + prv.instagram.comments + prv.instagram.saves + prv.instagram.shares;
  const curIgEngRate = cur.instagram.reach > 0 ? +(curIgEngTotal / cur.instagram.reach * 100).toFixed(2) : 0;
  const prevIgEngRate = prv.instagram.reach > 0 ? +(prevIgEngTotal / prv.instagram.reach * 100).toFixed(2) : 0;

  const currentLabel = getMonthLabel(current);

  const igFollowersDelta = cur.instagram.new_followers - prv.instagram.new_followers;
  const showFollowersPct = prv.instagram.new_followers >= 10;

  return (
    <div className="grid grid-cols-2 xl:grid-cols-3 gap-3 mb-5">
      <KpiCard id="fb-reach" contextText="Alcance de publicaciones sin incluir campañas de paid media. Refleja el rendimiento real del contenido orgánico.">
        <div className="flex items-center gap-2 mb-1">
          <SiFacebook className="text-[#1877F2]" size={14} />
          <p className="text-xs font-bold text-[#392e22]">Alcance Orgánico FB</p>
        </div>
        <p className="text-2xl font-bold text-foreground" data-testid="text-total-reach">{formatNumber(curFbReachOrganic)}</p>
        <p className="text-[10px] text-muted-foreground">{currentLabel}</p>
        <p className="text-[10px] text-muted-foreground">Total (con paid): {formatNumber(cur.facebook.reach)}</p>
        <div className="flex items-center gap-2 mt-1">
          <DeltaBadge value={pctDelta(curFbReachOrganic, prevFbReachOrganic)} />
          <span className="text-[10px] text-muted-foreground">vs mes anterior</span>
        </div>
        <div className="flex items-center gap-2">
          <DeltaBadge value={pctDelta(curFbReachOrganic, oldFbReachOrganic)} />
          <span className="text-[10px] text-muted-foreground">vs 3 meses</span>
        </div>
      </KpiCard>

      <KpiCard id="fb-eng-rate" contextText="Calculado sobre alcance orgánico. Un ER alto con alcance bajo puede indicar una audiencia pequeña muy activa — revisar volumen antes de reportar.">
        <div className="flex items-center gap-2 mb-1">
          <SiFacebook className="text-[#1877F2]" size={14} />
          <p className="text-xs font-bold text-[#392e22]">Eng. Rate Facebook</p>
        </div>
        <p className="text-2xl font-bold text-foreground" data-testid="text-engagement-rate-fb">{curFbEngRate}%</p>
        <p className="text-[10px] text-muted-foreground">{currentLabel}</p>
        <div className="flex items-center gap-2 mt-1">
          <DeltaBadge value={+(curFbEngRate - prevFbEngRate).toFixed(2)} suffix="pp" />
          <span className="text-[10px] text-muted-foreground">vs mes anterior</span>
        </div>
      </KpiCard>

      <KpiCard id="ig-eng-rate" contextText="Suma de likes, comentarios, guardados y compartidos sobre el alcance total. Benchmark promedio de industria: 1–3%.">
        <div className="flex items-center gap-2 mb-1">
          <SiInstagram className="text-[#E1306C]" size={14} />
          <p className="text-xs font-bold text-[#392e22]">Eng. Rate Instagram</p>
        </div>
        <p className="text-2xl font-bold text-foreground" data-testid="text-engagement-rate-ig">{curIgEngRate}%</p>
        <p className="text-[10px] text-muted-foreground">{currentLabel}</p>
        <div className="flex items-center gap-2 mt-1">
          <DeltaBadge value={+(curIgEngRate - prevIgEngRate).toFixed(2)} suffix="pp" />
          <span className="text-[10px] text-muted-foreground">vs mes anterior</span>
        </div>
      </KpiCard>

      <KpiCard id="total-interactions" contextText="Incluye todas las interacciones de FB e IG: reacciones, comentarios, guardados y compartidos.">
        <p className="text-xs mb-1 font-bold text-[#392e22]">Interacciones Totales</p>
        <p className="text-2xl font-bold text-foreground" data-testid="text-total-interactions">{formatNumber(curEngagements)}</p>
        <p className="text-[10px] text-muted-foreground">IG + FB — {currentLabel}</p>
        <div className="flex items-center gap-2 mt-1">
          <DeltaBadge value={pctDelta(curEngagements, prevEngagements)} />
          <span className="text-[10px] text-muted-foreground">vs mes anterior</span>
        </div>
      </KpiCard>

      <KpiCard id="ig-followers" contextText="Seguidores netos ganados en el período según Instagram Followers Insights. Meses sin datos aparecen como N/D.">
        <div className="flex items-center gap-2 mb-1">
          <SiInstagram className="text-[#E1306C]" size={14} />
          <p className="text-xs font-bold text-[#392e22]">Nuevos Seguidores IG</p>
        </div>
        <p className="text-2xl font-bold text-foreground" data-testid="text-ig-new-followers">{formatNumber(cur.instagram.new_followers)}</p>
        <p className="text-[10px] text-muted-foreground">{currentLabel}</p>
        {showFollowersPct ? (
          <div className="flex items-center gap-2 mt-1">
            <DeltaBadge value={pctDelta(cur.instagram.new_followers, prv.instagram.new_followers)} />
            <span className="text-[10px] text-muted-foreground">vs mes anterior</span>
          </div>
        ) : (
          <p className="text-[10px] text-muted-foreground mt-1">
            {igFollowersDelta >= 0 ? "+" : ""}{igFollowersDelta} vs mes anterior
          </p>
        )}
      </KpiCard>

      <KpiCard id="meta-spend" contextText="Inversión total en campañas Meta Ads del período. No incluye otras plataformas de paid media." className="col-span-2 xl:col-span-1">
        <p className="text-xs mb-1 font-bold text-[#392e22]">Gasto Meta Ads</p>
        <p className="text-2xl font-bold text-foreground" data-testid="text-meta-spend">{formatCurrency(cur.meta_ads.spend)}</p>
        {cur.meta_ads.spend === 0 ? (
          <p className="text-[10px] text-muted-foreground italic">Sin pauta este mes</p>
        ) : (
          <>
            <p className="text-[10px] text-muted-foreground">MXN — {currentLabel}</p>
            <div className="flex items-center gap-2 mt-1">
              <DeltaBadge value={pctDelta(cur.meta_ads.spend, prv.meta_ads.spend)} />
              <span className="text-[10px] text-muted-foreground">vs mes anterior</span>
            </div>
          </>
        )}
      </KpiCard>
    </div>
  );
}

function PlatformTable({ data }: { data: AggregatedData }) {
  const months = data.months;
  if (months.length < 2) return null;

  const current = months[months.length - 1];
  const prev = months[months.length - 2];
  const cur = data.monthly[current];
  const prv = data.monthly[prev];

  const curFbReachOrg = cur.facebook.reach_organic || 0;
  const prvFbReachOrg = prv.facebook.reach_organic || 0;
  const fbEngDenom = curFbReachOrg > 0 ? curFbReachOrg : cur.facebook.reach;
  const fbEngRate = fbEngDenom > 0 ? +(cur.facebook.engagement / fbEngDenom * 100).toFixed(2) : 0;
  const igEngRate = cur.instagram.reach > 0 ? +((cur.instagram.likes + cur.instagram.comments + cur.instagram.saves + cur.instagram.shares) / cur.instagram.reach * 100).toFixed(2) : 0;

  const rows = [
    {
      platform: "Facebook",
      color: "#1877F2",
      icon: <SiFacebook size={14} />,
      reach: curFbReachOrg,
      reachLabel: "(orgánico)",
      interactions: cur.facebook.engagement,
      engRate: fbEngRate,
      newFollowers: "—",
      vsPrev: pctDelta(curFbReachOrg, prvFbReachOrg),
    },
    {
      platform: "Instagram",
      color: "#E1306C",
      icon: <SiInstagram size={14} />,
      reach: cur.instagram.reach,
      interactions: cur.instagram.likes + cur.instagram.comments + cur.instagram.saves + cur.instagram.shares,
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
              <td className="text-right px-3 py-2.5 text-foreground">{r.reach !== null ? <span>{formatNumber(r.reach)}{"reachLabel" in r && r.reachLabel ? <span className="text-[10px] text-muted-foreground ml-1">{r.reachLabel}</span> : null}</span> : <span className="text-muted-foreground italic">Sin datos</span>}</td>
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

function DefaultCharts({ data }: { data: AggregatedData }) {
  const themeColors = useChartColors();
  const months = data.months;
  if (months.length < 2) return null;

  const current = months[months.length - 1];
  const cur = data.monthly[current];

  const fbReachData = months.map((ym) => ({
    name: getMonthLabel(ym),
    Facebook: data.monthly[ym].facebook.reach_organic || 0,
  }));

  const igReachData = months.map((ym) => ({
    name: getMonthLabel(ym),
    Instagram: data.monthly[ym].instagram.reach,
  }));

  const engRateData = months.map((ym) => {
    const m = data.monthly[ym];
    const fbOrg = m.facebook.reach_organic || 0;
    const fbDenom = fbOrg > 0 ? fbOrg : m.facebook.reach;
    const fbRate = fbDenom > 0 ? +(m.facebook.engagement / fbDenom * 100).toFixed(2) : 0;
    const igTotal = m.instagram.likes + m.instagram.comments + m.instagram.saves + m.instagram.shares;
    const igRate = m.instagram.reach > 0 ? +(igTotal / m.instagram.reach * 100).toFixed(2) : 0;
    return { name: getMonthLabel(ym), Facebook: fbRate, Instagram: igRate };
  });

  const interactionColors: Record<string, string> = {
    Likes: "#E1306C",
    Comentarios: "#F77737",
    Guardados: "#FCAF45",
    Compartidos: "#833AB4",
  };

  const interactionData = [
    { name: "Likes", value: cur.instagram.likes },
    { name: "Comentarios", value: cur.instagram.comments },
    { name: "Guardados", value: cur.instagram.saves },
    { name: "Compartidos", value: cur.instagram.shares },
  ];

  const maxFollowers = Math.max(...months.map((ym) => data.monthly[ym].instagram.new_followers), 1);
  const missingBarValue = Math.max(Math.round(maxFollowers * 0.05), 1);

  const followersData = months.map((ym) => {
    const m = data.monthly[ym];
    const isMissing = !m.instagram.has_followers_data;
    return {
      name: getMonthLabel(ym),
      Seguidores: isMissing ? missingBarValue : m.instagram.new_followers,
      isMissing,
    };
  });

  const currentYear = getMonthYear(current);

  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
      <div className="bg-card rounded-xl p-5 border border-card-border shadow-sm">
        <h3 className="text-sm mb-4 font-bold text-[#392e22]" data-testid="text-reach-chart-title">Alcance Mensual por Plataforma</h3>
        <p className="text-xs font-semibold text-[#1877F2] mb-0.5">Alcance Facebook</p>
        <p className="text-[10px] text-muted-foreground mb-1">Alcance orgánico (excluye paid)</p>
        <ResponsiveContainer width="100%" height={160}>
          <BarChart data={fbReachData}>
            <CartesianGrid strokeDasharray="3 3" stroke={themeColors.border} />
            <XAxis dataKey="name" tick={{ fontSize: 12, fill: themeColors.mutedFg }} />
            <YAxis tick={{ fontSize: 12, fill: themeColors.mutedFg }} tickFormatter={(v) => formatNumber(v)} />
            <Tooltip contentStyle={{ background: "#fff", borderRadius: "8px", border: "1px solid #e0e0e0", padding: "12px", fontSize: "12px" }} formatter={(v: number) => formatNumber(v)} cursor={false} />
            <Bar dataKey="Facebook" fill="#1877F2" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
        <p className="text-xs font-semibold text-[#E1306C] mb-1 mt-4">Alcance Instagram</p>
        <ResponsiveContainer width="100%" height={160}>
          <BarChart data={igReachData}>
            <CartesianGrid strokeDasharray="3 3" stroke={themeColors.border} />
            <XAxis dataKey="name" tick={{ fontSize: 12, fill: themeColors.mutedFg }} />
            <YAxis tick={{ fontSize: 12, fill: themeColors.mutedFg }} tickFormatter={(v) => formatNumber(v)} />
            <Tooltip contentStyle={{ background: "#fff", borderRadius: "8px", border: "1px solid #e0e0e0", padding: "12px", fontSize: "12px" }} formatter={(v: number) => formatNumber(v)} cursor={false} />
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
        <h3 className="text-sm mb-4 font-bold text-[#392e22]" data-testid="text-pie-chart-title">Tipo de Interacciones — Instagram {getMonthLabel(current)} {currentYear}</h3>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={interactionData} layout="vertical" margin={{ left: 20, right: 40 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={themeColors.border} />
            <XAxis type="number" tick={{ fontSize: 12, fill: themeColors.mutedFg }} tickFormatter={(v) => formatNumber(v)} />
            <YAxis type="category" dataKey="name" tick={{ fontSize: 12, fill: themeColors.mutedFg }} width={90} />
            <Tooltip contentStyle={{ background: "#fff", borderRadius: "8px", border: "1px solid #e0e0e0", padding: "12px", fontSize: "12px" }} formatter={(v: number) => formatNumber(v)} cursor={false} />
            <Bar dataKey="value" radius={[0, 4, 4, 0]}>
              {interactionData.map((entry, idx) => (
                <Cell key={idx} fill={interactionColors[entry.name]} />
              ))}
              <LabelList dataKey="value" position="right" formatter={(v: number) => formatNumber(v)} style={{ fontSize: 11, fill: themeColors.mutedFg }} />
            </Bar>
          </BarChart>
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
            <Bar dataKey="Seguidores" radius={[4, 4, 0, 0]}>
              {followersData.map((entry, idx) => (
                <Cell key={idx} fill={entry.isMissing ? "#9CA3AF" : "#E1306C"} fillOpacity={entry.isMissing ? 0.3 : 1} />
              ))}
              <LabelList
                dataKey="Seguidores"
                position="top"
                style={{ fontSize: 10, fill: themeColors.mutedFg }}
                content={({ x, y, width, index }: { x?: number; y?: number; width?: number; index?: number }) => {
                  if (x == null || y == null || width == null || index == null) return null;
                  const entry = followersData[index];
                  if (!entry) return null;
                  const label = entry.isMissing ? "N/D" : formatNumber(entry.Seguidores);
                  return (
                    <text x={x + width / 2} y={y - 6} textAnchor="middle" fontSize={10} fill={themeColors.mutedFg}>
                      {label}
                    </text>
                  );
                }}
              />
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

const EMPTY_MONTHLY: MonthlyData = {
  facebook: { reach: 0, engagement: 0, followers_total: 0 },
  instagram: { reach: 0, engagement: 0, new_followers: 0, likes: 0, comments: 0, saves: 0, shares: 0 },
  meta_ads: { spend: 0, impressions: 0, clicks: 0, ctr: 0 },
};

function computeFallbackMonths(): string[] {
  const now = new Date();
  const months: string[] = [];
  for (let i = 4; i >= 1; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    months.push(`${y}-${m}`);
  }
  return months;
}

function buildFallbackResponse(): SheetsApiResponse {
  const months = computeFallbackMonths();
  const monthly: Record<string, MonthlyData> = {};
  for (const m of months) {
    monthly[m] = { ...EMPTY_MONTHLY };
  }
  return {
    plazas: { fallback: { months, monthly } },
    availablePlazas: [],
  };
}

export default function Home() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [activeChart, setActiveChart] = useState<ChartData | null>(null);
  const [canvasOpen, setCanvasOpen] = useState(true);
  const [questionChips, setQuestionChips] = useState<string[]>([]);
  const [chipsLoading, setChipsLoading] = useState(true);
  const [sheetsResponse, setSheetsResponse] = useState<SheetsApiResponse>(buildFallbackResponse());
  const [selectedPlazaIds, setSelectedPlazaIds] = useState<string[]>(["all"]);
  const [availablePlazas, setAvailablePlazas] = useState<PlazaSummary[]>([]);
  const [dataLoaded, setDataLoaded] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const aggregatedData = useMemo(
    () => aggregatePlazaData(sheetsResponse, selectedPlazaIds),
    [sheetsResponse, selectedPlazaIds],
  );

  const dataContext = useMemo(
    () => JSON.stringify({ plazas: sheetsResponse.plazas, availablePlazas: sheetsResponse.availablePlazas }, null, 2),
    [sheetsResponse],
  );

  useEffect(() => {
    async function loadPlazas() {
      try {
        const res = await fetch("/api/plazas");
        if (res.ok) {
          const data = await res.json();
          setAvailablePlazas(data);
        }
      } catch {}
    }
    loadPlazas();
  }, []);

  useEffect(() => {
    async function fetchData() {
      try {
        const plazasParam = selectedPlazaIds.includes("all") ? "all" : selectedPlazaIds.join(",");
        const res = await fetch(`/api/sheets-data?plazas=${encodeURIComponent(plazasParam)}`);
        if (res.ok) {
          const data: SheetsApiResponse = await res.json();
          setSheetsResponse(data);
          if (data.availablePlazas.length > 0) {
            setAvailablePlazas(data.availablePlazas);
          }
        }
      } catch {}
      setDataLoaded(true);
    }
    fetchData();
  }, [selectedPlazaIds]);

  useEffect(() => {
    if (!dataLoaded) return;
    async function fetchChips() {
      try {
        const plazaIds = selectedPlazaIds.includes("all") ? ["all"] : selectedPlazaIds;
        const res = await apiRequest("POST", "/api/chat", {
          messages: [
            {
              role: "user",
              content:
                "Based on this social media data, generate 6 relevant opening questions a marketing manager would want to ask. Return ONLY a JSON array of 6 questions in Spanish, nothing else. Example: [\"question 1\", \"question 2\", ...]. Do NOT include any CHART_DATA or SUGGESTED block.",
            },
          ],
          context: dataContext,
          plazaIds,
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
      const plazaIds = selectedPlazaIds.includes("all") ? ["all"] : selectedPlazaIds;
      const res = await apiRequest("POST", "/api/chat", {
        messages: newMessages,
        context: dataContext,
        plazaIds,
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

  function handlePlazaChange(ids: string[]) {
    setSelectedPlazaIds(ids);
  }

  const currentMonth = aggregatedData.months.length > 0 ? aggregatedData.months[aggregatedData.months.length - 1] : "";
  const currentMonthLabel = currentMonth ? getMonthLabel(currentMonth) : "";
  const currentYear = currentMonth ? getMonthYear(currentMonth) : "";

  const canvasTitle = selectedPlazaIds.includes("all") || selectedPlazaIds.length === 0
    ? "Todas las plazas"
    : selectedPlazaIds.length === 1
      ? availablePlazas.find((p) => p.id === selectedPlazaIds[0])?.displayName || selectedPlazaIds[0]
      : `${selectedPlazaIds.length} plazas`;

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
            <div className="flex items-center gap-3">
              {availablePlazas.length > 0 && (
                <PlazaMultiSelect
                  availablePlazas={availablePlazas}
                  selectedPlazaIds={selectedPlazaIds}
                  onChange={handlePlazaChange}
                />
              )}
              <img
                src={CLIENT_LOGO}
                alt="FUNO"
                className="h-5 md:h-6"
                data-testid="img-client-logo"
              />
            </div>
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
                  <span className="text-sm font-medium text-foreground">{canvasTitle}</span>
                  <span className="text-xs text-muted-foreground">{currentMonthLabel} {currentYear}</span>
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
              <KpiCards data={aggregatedData} />
              <PlatformTable data={aggregatedData} />
              {activeChart ? <DynamicChart chartData={activeChart} /> : <DefaultCharts data={aggregatedData} />}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
