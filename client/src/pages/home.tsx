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
} from "recharts";
import {
  AGENCY_LOGO,
  CLIENT_LOGO,
} from "@/data/config";
import { mockData as fallbackMockData, mockDataContext as fallbackMockDataContext } from "@/data/mock-santa-fe";
import { apiRequest } from "@/lib/queryClient";

marked.setOptions({
  breaks: true,
  gfm: true,
});

const SPANISH_MONTHS: Record<string, string> = {
  january: "Ene", february: "Feb", march: "Mar", april: "Abr",
  may: "May", june: "Jun", july: "Jul", august: "Ago",
  september: "Sep", october: "Oct", november: "Nov", december: "Dic",
};

const SPANISH_MONTHS_FULL: Record<string, string> = {
  january: "Enero", february: "Febrero", march: "Marzo", april: "Abril",
  may: "Mayo", june: "Junio", july: "Julio", august: "Agosto",
  september: "Septiembre", october: "Octubre", november: "Noviembre", december: "Diciembre",
};

function getMonthLabel(date: string): string {
  const [monthName, year] = date.trim().split(/\s+/);
  const abbr = SPANISH_MONTHS[monthName.toLowerCase()] ?? monthName.slice(0, 3);
  return `${abbr} ${year ?? ""}`.trim();
}

function getPrevMonthLabel(date: string): string {
  const [monthName, yearStr] = date.trim().split(/\s+/);
  const months = Object.keys(SPANISH_MONTHS);
  const idx = months.indexOf(monthName.toLowerCase());
  const prevIdx = idx <= 0 ? 11 : idx - 1;
  const prevYear = idx === 0 ? String(Number(yearStr) - 1) : yearStr;
  const prevAbbr = SPANISH_MONTHS[months[prevIdx]];
  return `${prevAbbr} ${prevYear ?? ""}`.trim();
}

function getTwoMonthsAgoLabel(date: string): string {
  const [monthName, yearStr] = date.trim().split(/\s+/);
  const months = Object.keys(SPANISH_MONTHS);
  const idx = months.indexOf(monthName.toLowerCase());
  const twoAgoIdx = idx <= 1 ? 12 + idx - 2 : idx - 2;
  const twoAgoYear = idx < 2 ? String(Number(yearStr) - 1) : yearStr;
  const twoAgoAbbr = SPANISH_MONTHS[months[twoAgoIdx]];
  return `${twoAgoAbbr} ${twoAgoYear ?? ""}`.trim();
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
  type: "bar" | "line" | "area";
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

function KpiCards({ data }: { data: typeof fallbackMockData }) {
  const { instagram, facebook, tiktok, meta_ads, period } = data;
  const igGrowth = instagram.followers - instagram.followers_prev_month;
  const fbGrowth = facebook.followers - facebook.followers_prev_month;
  const ttGrowth = tiktok.followers - tiktok.followers_prev_month;
  const totalReach = instagram.reach + facebook.reach + tiktok.views;
  const curMonth = getMonthLabel(period);
  const prevMonth = getPrevMonthLabel(period);

  return (
    <div className="grid grid-cols-2 xl:grid-cols-3 gap-3 mb-5">
      <div className="bg-card rounded-xl p-4 border border-card-border shadow-sm">
        <div className="flex items-center gap-2 mb-2">
          <SiInstagram className="text-chart-1" size={16} />
          <span className="text-xs font-medium text-muted-foreground">Instagram</span>
        </div>
        <p className="text-2xl font-bold text-foreground" data-testid="text-ig-followers">{formatNumber(instagram.followers)}</p>
        <p className="text-[10px] font-bold text-[#392e22]" data-testid="subtitle-ig-followers">Nuevos seguidores {curMonth}</p>
        <p className={`text-xs font-medium ${igGrowth >= 0 ? "text-green-600" : "text-red-600"}`}>{igGrowth >= 0 ? "+" : ""}{formatNumber(igGrowth)}</p>
        <p className="text-[10px] text-muted-foreground" data-testid="subtitle-ig-growth">vs {prevMonth}</p>
      </div>
      <div className="bg-card rounded-xl p-4 border border-card-border shadow-sm">
        <div className="flex items-center gap-2 mb-2">
          <SiFacebook className="text-chart-2" size={16} />
          <span className="text-xs font-medium text-muted-foreground">Facebook</span>
        </div>
        <p className="text-2xl font-bold text-foreground" data-testid="text-fb-followers">{formatNumber(facebook.followers)}</p>
        <p className="text-[10px] text-[#392e22] font-bold" data-testid="subtitle-fb-followers">Seguidores totales</p>
        <p className={`text-xs font-medium ${fbGrowth >= 0 ? "text-green-600" : "text-red-600"}`}>{fbGrowth >= 0 ? "+" : ""}{formatNumber(fbGrowth)}</p>
        <p className="text-[10px] text-muted-foreground" data-testid="subtitle-fb-growth">Crecimiento {curMonth} vs {prevMonth}</p>
      </div>
      <div className="bg-card rounded-xl p-4 border border-card-border shadow-sm">
        <div className="flex items-center gap-2 mb-2">
          <SiTiktok size={16} className="text-chart-5" />
          <span className="text-xs font-medium text-muted-foreground">TikTok</span>
        </div>
        <p className="text-2xl font-bold text-foreground" data-testid="text-tt-followers">{tiktok.followers > 0 ? formatNumber(tiktok.followers) : "Sin datos"}</p>
        <p className="text-[10px] font-bold text-[#392e22]" data-testid="subtitle-tt-followers">Seguidores totales</p>
        {tiktok.followers > 0 && (
          <>
            <p className={`text-xs font-medium ${ttGrowth >= 0 ? "text-green-600" : "text-red-600"}`}>{ttGrowth >= 0 ? "+" : ""}{formatNumber(ttGrowth)}</p>
            <p className="text-[10px] text-muted-foreground" data-testid="subtitle-tt-growth">Crecimiento {curMonth} vs {prevMonth}</p>
          </>
        )}
      </div>
      <div className="bg-card rounded-xl p-4 border border-card-border shadow-sm">
        <p className="mb-1 text-[#392e22] text-[12px] font-bold">Engagement Rate</p>
        <div className="flex items-baseline gap-1.5">
          <span className="text-base font-bold text-chart-1" data-testid="text-eng-ig">{instagram.engagement_rate}%</span>
          <span className="text-base font-bold text-chart-2" data-testid="text-eng-fb">{facebook.engagement_rate}%</span>
          <span className="text-base font-bold text-chart-5" data-testid="text-eng-tt">{tiktok.engagement_rate}%</span>
        </div>
        <div className="flex items-baseline gap-1.5 mt-1">
          {[
            { delta: +(instagram.engagement_rate - instagram.engagement_rate_prev_month).toFixed(1), id: "delta-eng-ig" },
            { delta: +(facebook.engagement_rate - facebook.engagement_rate_prev_month).toFixed(1), id: "delta-eng-fb" },
            { delta: +(tiktok.engagement_rate - tiktok.engagement_rate_prev_month).toFixed(1), id: "delta-eng-tt" },
          ].map(({ delta, id }) => (
            <span key={id} className={`text-[10px] font-medium ${delta >= 0 ? "text-green-600" : "text-red-600"}`} data-testid={id}>
              {delta >= 0 ? "+" : ""}{delta.toFixed(1)}%
            </span>
          ))}
        </div>
        <p className="text-[10px] text-muted-foreground" data-testid="subtitle-engagement">vs {prevMonth}</p>
      </div>
      <div className="bg-card rounded-xl p-4 border border-card-border shadow-sm">
        <p className="text-xs mb-1 font-bold text-[#392e22]">Alcance Total</p>
        <p className="text-2xl font-bold text-foreground" data-testid="text-total-reach">{formatNumber(totalReach)}</p>
        <p className="text-xs text-muted-foreground">IG + FB + TikTok</p>
        <p className="text-[10px] text-muted-foreground" data-testid="subtitle-reach">Alcance orgánico {curMonth}</p>
      </div>
      <div className="bg-card rounded-xl p-4 border border-card-border shadow-sm">
        <p className="text-xs mb-1 font-bold text-[#392e22]">Meta Ads</p>
        <p className="text-2xl font-bold text-foreground" data-testid="text-meta-spend">${formatNumber(meta_ads.spend)}</p>
        <p className="text-xs text-muted-foreground">CTR: {meta_ads.ctr}%</p>
        <p className="text-[10px] text-muted-foreground" data-testid="subtitle-meta-spend">Inversión Meta Ads {curMonth}</p>
      </div>
    </div>
  );
}

function DefaultChartTooltip({ active, payload, label, data }: any) {
  const chartData = data || fallbackMockData;
  const { instagram, facebook, tiktok } = chartData;
  const colors = useChartColors();
  if (!active || !payload?.length) return null;
  const engRates: Record<string, number> = {
    instagram: instagram.engagement_rate,
    facebook: facebook.engagement_rate,
    tiktok: tiktok.engagement_rate,
  };
  return (
    <div style={{ background: "#ffffff", color: "#000000", borderRadius: "8px", border: "1px solid #e0e0e0", padding: "12px", fontSize: "12px" }}>
      <p style={{ fontWeight: 600, marginBottom: 4 }}>{label}</p>
      {payload.map((entry: any) => (
        <div key={entry.dataKey} style={{ color: entry.color, marginBottom: 2 }}>
          <span>{entry.name}: {formatNumber(entry.value)}</span>
          <span style={{ color: "#666666", marginLeft: 8 }}>Eng: {engRates[entry.dataKey]}%</span>
        </div>
      ))}
    </div>
  );
}

function DefaultChart({ data }: { data: typeof fallbackMockData }) {
  const { instagram, facebook, tiktok, period } = data;
  const colors = useChartColors();
  const curMonth = getMonthLabel(period);
  const hasTiktok = tiktok.engagement_rate > 0;

  const engagementData: { platform: string; rate: number; fill: string }[] = [
    { platform: "Facebook", rate: facebook.engagement_rate, fill: "#1877F2" },
    { platform: "Instagram", rate: instagram.engagement_rate, fill: "#E1306C" },
  ];
  if (hasTiktok) {
    engagementData.push({ platform: "TikTok", rate: tiktok.engagement_rate, fill: "#69C9D0" });
  }

  return (
    <div className="bg-card rounded-xl p-5 border border-card-border shadow-sm">
      <h3 className="text-sm mb-4 font-bold text-[#392e22]" data-testid="text-engagement-chart-title">Engagement Rate por Plataforma — {curMonth}</h3>
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={engagementData}>
          <CartesianGrid strokeDasharray="3 3" stroke={colors.border} />
          <XAxis dataKey="platform" tick={{ fontSize: 12, fill: colors.mutedFg }} />
          <YAxis tick={{ fontSize: 12, fill: colors.mutedFg }} tickFormatter={(v) => `${v}%`} />
          <Tooltip contentStyle={{ background: "#ffffff", color: "#000000", borderRadius: "8px", border: "1px solid #e0e0e0", padding: "12px", fontSize: "12px" }} cursor={false} formatter={(v: number) => `${v}%`} />
          <Bar dataKey="rate" name="Engagement Rate" radius={[6, 6, 0, 0]}>
            {engagementData.map((entry, index) => (
              <Cell key={index} fill={entry.fill} />
            ))}
            <LabelList dataKey="rate" position="top" formatter={(v: number) => `${v}%`} style={{ fontSize: 10, fill: colors.mutedFg }} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function DynamicChart({ chartData }: { chartData: ChartData }) {
  const { type, title, data, dataKeys, colors: chartColors } = chartData;
  const themeColors = useChartColors();
  const defaultColors = [themeColors.chart3, themeColors.chart1, themeColors.chart2, themeColors.chart4, themeColors.chart5];

  return (
    <div className="bg-card rounded-xl p-5 border border-card-border shadow-sm">
      <h3 className="text-sm font-semibold text-foreground mb-4">{title}</h3>
      <ResponsiveContainer width="100%" height={280}>
        {type === "line" ? (
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke={themeColors.border} />
            <XAxis dataKey="name" tick={{ fontSize: 12, fill: themeColors.mutedFg }} />
            <YAxis tick={{ fontSize: 12, fill: themeColors.mutedFg }} />
            <Tooltip contentStyle={{ background: "#ffffff", color: "#000000", borderRadius: "8px", border: "1px solid #e0e0e0", padding: "12px", fontSize: "12px" }} cursor={false} />
            <Legend wrapperStyle={{ fontSize: "12px" }} />
            {dataKeys.map((key, i) => (
              <Line key={key} type="monotone" dataKey={key} stroke={chartColors[i] || defaultColors[i] || themeColors.primary} strokeWidth={2} dot={{ r: 4 }} />
            ))}
          </LineChart>
        ) : type === "area" ? (
          <AreaChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke={themeColors.border} />
            <XAxis dataKey="name" tick={{ fontSize: 12, fill: themeColors.mutedFg }} />
            <YAxis tick={{ fontSize: 12, fill: themeColors.mutedFg }} />
            <Tooltip contentStyle={{ background: "#ffffff", color: "#000000", borderRadius: "8px", border: "1px solid #e0e0e0", padding: "12px", fontSize: "12px" }} cursor={false} />
            <Legend wrapperStyle={{ fontSize: "12px" }} />
            {dataKeys.map((key, i) => (
              <Area key={key} type="monotone" dataKey={key} fill={chartColors[i] || defaultColors[i] || themeColors.primary} stroke={chartColors[i] || defaultColors[i] || themeColors.primary} fillOpacity={0.2} />
            ))}
          </AreaChart>
        ) : (
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke={themeColors.border} />
            <XAxis dataKey="name" tick={{ fontSize: 12, fill: themeColors.mutedFg }} />
            <YAxis tick={{ fontSize: 12, fill: themeColors.mutedFg }} />
            <Tooltip contentStyle={{ background: "#ffffff", color: "#000000", borderRadius: "8px", border: "1px solid #e0e0e0", padding: "12px", fontSize: "12px" }} formatter={(value: number) => formatNumber(value)} cursor={false} />
            <Legend wrapperStyle={{ fontSize: "12px" }} />
            {dataKeys.map((key, i) => (
              <Bar key={key} dataKey={key} fill={chartColors[i] || defaultColors[i] || themeColors.primary} radius={[6, 6, 0, 0]}>
                <LabelList dataKey={key} position="top" formatter={(v: number) => formatNumber(v)} style={{ fontSize: 10, fill: themeColors.mutedFg }} />
              </Bar>
            ))}
          </BarChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}

function ymToMonthLabel(ym: string): string {
  const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const [y, m] = ym.split("-");
  return `${MONTH_NAMES[parseInt(m, 10) - 1]} ${y}`;
}

function transformSheetsData(api: any): typeof fallbackMockData {
  const currentLabel = ymToMonthLabel(api.period.current);
  return {
    plaza: api.plaza,
    period: currentLabel,
    instagram: {
      followers: api.instagram.new_followers,
      followers_prev_month: api.instagram.new_followers_prev,
      followers_2months_ago: 0,
      posts: 0,
      reach: api.instagram.reach,
      engagement_rate: api.instagram.reach > 0 ? +((api.instagram.engagement / api.instagram.reach) * 100).toFixed(1) : 0,
      engagement_rate_prev_month: 0,
    },
    facebook: {
      followers: api.facebook.followers_total,
      followers_prev_month: api.facebook.followers_prev,
      followers_2months_ago: api.facebook.followers_2m,
      posts: 0,
      reach: api.facebook.reach,
      engagement_rate: api.facebook.reach > 0 ? +((api.facebook.engagement / api.facebook.reach) * 100).toFixed(1) : 0,
      engagement_rate_prev_month: 0,
    },
    tiktok: {
      followers: 0, followers_prev_month: 0, followers_2months_ago: 0,
      posts: 0, views: 0, engagement_rate: 0, engagement_rate_prev_month: 0,
    },
    meta_ads: {
      spend: api.meta_ads.spend,
      currency: "MXN",
      impressions: api.meta_ads.impressions,
      clicks: api.meta_ads.clicks,
      ctr: +api.meta_ads.ctr.toFixed(2),
      cpr: api.meta_ads.clicks > 0 ? +(api.meta_ads.spend / api.meta_ads.clicks).toFixed(2) : 0,
      results: api.meta_ads.clicks,
    },
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
  const [dashboardData, setDashboardData] = useState(fallbackMockData);
  const [dataContext, setDataContext] = useState(fallbackMockDataContext);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    async function fetchSheetsData() {
      try {
        const res = await fetch("/api/sheets-data");
        if (res.ok) {
          const apiData = await res.json();
          const transformed = transformSheetsData(apiData);
          setDashboardData(transformed);
          setDataContext(JSON.stringify(apiData, null, 2));
        }
      } catch {
      }
    }
    fetchSheetsData();
  }, []);

  useEffect(() => {
    async function fetchChips() {
      try {
        const res = await apiRequest("POST", "/api/chat", {
          messages: [
            {
              role: "user",
              content:
                "Based on this social media data, generate 6 relevant opening questions a marketing manager would want to ask. Return ONLY a JSON array of 6 questions in Spanish, nothing else. Example: [\"question 1\", \"question 2\", ...]",
            },
          ],
          context: dataContext,
        });
        const data = await res.json();
        const stripped = data.response.replace(/\n?SUGGESTED:\s*\[[\s\S]*?\]\s*$/, "").trim();
        const raw = stripped.replace(/```json\s*/g, "").replace(/```/g, "").trim();
        const jsonMatch = raw.match(/\[[\s\S]*\]/);
        const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setQuestionChips(parsed);
        }
      } catch {
      } finally {
        setChipsLoading(false);
      }
    }
    fetchChips();
  }, [dataContext]);

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
                  <span className="text-sm font-medium text-foreground">{dashboardData.plaza}</span>
                  <span className="text-xs text-muted-foreground">{(() => { const [m, y] = dashboardData.period.trim().split(/\s+/); return `${SPANISH_MONTHS_FULL[m.toLowerCase()] ?? m} ${y ?? ""}`.trim(); })()}</span>
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
              <KpiCards data={dashboardData} />
              {activeChart ? <DynamicChart chartData={activeChart} /> : <DefaultChart data={dashboardData} />}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
