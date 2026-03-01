import { useState, useRef, useEffect } from "react";
import { Copy, Check, ArrowUp, X, RefreshCw } from "lucide-react";
import { SiInstagram, SiFacebook, SiTiktok } from "react-icons/si";
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
} from "recharts";
import {
  AGENCY_LOGO,
  CLIENT_LOGO,
  ACCENT_COLOR,
  QUESTION_CHIPS,
} from "@/data/config";
import { mockData, mockDataContext } from "@/data/mock-santa-fe";
import { apiRequest } from "@/lib/queryClient";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
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
    /CHART_DATA:\s*(\{[\s\S]*\})\s*$/,
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
          colors: parsed.colors || ["#ED7C22", "#004CFF", "#10B981"],
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

function ThinkingAnimation() {
  return (
    <div className="flex items-start gap-3 mb-6">
      <div className="thinking-logo">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="10" stroke="#D97706" strokeWidth="2" className="thinking-circle" />
          <circle cx="12" cy="12" r="4" fill="#D97706" className="thinking-dot" />
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
      className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-md transition-colors"
      style={{ color: "#8B7355" }}
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

function KpiCards() {
  const { instagram, facebook, tiktok, meta_ads } = mockData;
  const igGrowth = instagram.followers - instagram.followers_prev_month;
  const fbGrowth = facebook.followers - facebook.followers_prev_month;
  const ttGrowth = tiktok.followers - tiktok.followers_prev_month;
  const totalReach = instagram.reach + facebook.reach;

  return (
    <div className="grid grid-cols-2 xl:grid-cols-3 gap-3 mb-5">
      <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
        <div className="flex items-center gap-2 mb-2">
          <SiInstagram className="text-[#E1306C]" size={16} />
          <span className="text-xs font-medium" style={{ color: "#6B5B4E" }}>Instagram</span>
        </div>
        <p className="text-2xl font-bold text-gray-900" data-testid="text-ig-followers">{formatNumber(instagram.followers)}</p>
        <p className="text-xs font-medium" style={{ color: igGrowth >= 0 ? "#16A34A" : "#DC2626" }}>{igGrowth >= 0 ? "+" : ""}{formatNumber(igGrowth)}</p>
      </div>

      <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
        <div className="flex items-center gap-2 mb-2">
          <SiFacebook className="text-[#1877F2]" size={16} />
          <span className="text-xs font-medium" style={{ color: "#6B5B4E" }}>Facebook</span>
        </div>
        <p className="text-2xl font-bold text-gray-900" data-testid="text-fb-followers">{formatNumber(facebook.followers)}</p>
        <p className="text-xs font-medium" style={{ color: fbGrowth >= 0 ? "#16A34A" : "#DC2626" }}>{fbGrowth >= 0 ? "+" : ""}{formatNumber(fbGrowth)}</p>
      </div>

      <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
        <div className="flex items-center gap-2 mb-2">
          <SiTiktok size={16} className="text-gray-900" />
          <span className="text-xs font-medium" style={{ color: "#6B5B4E" }}>TikTok</span>
        </div>
        <p className="text-2xl font-bold text-gray-900" data-testid="text-tt-followers">{formatNumber(tiktok.followers)}</p>
        <p className="text-xs font-medium" style={{ color: ttGrowth >= 0 ? "#16A34A" : "#DC2626" }}>{ttGrowth >= 0 ? "+" : ""}{formatNumber(ttGrowth)}</p>
      </div>

      <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
        <p className="text-xs font-medium mb-1" style={{ color: "#6B5B4E" }}>Engagement Rate</p>
        <div className="flex items-baseline gap-1.5">
          <span className="text-base font-bold" style={{ color: "#E1306C" }} data-testid="text-eng-ig">{instagram.engagement_rate}%</span>
          <span className="text-base font-bold" style={{ color: "#1877F2" }} data-testid="text-eng-fb">{facebook.engagement_rate}%</span>
          <span className="text-base font-bold text-gray-900" data-testid="text-eng-tt">{tiktok.engagement_rate}%</span>
        </div>
        <p className="text-xs" style={{ color: "#9B8B7A" }}>IG / FB / TT</p>
      </div>

      <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
        <p className="text-xs font-medium mb-1" style={{ color: "#6B5B4E" }}>Alcance Total</p>
        <p className="text-2xl font-bold text-gray-900" data-testid="text-total-reach">{formatNumber(totalReach)}</p>
        <p className="text-xs" style={{ color: "#9B8B7A" }}>IG + FB</p>
      </div>

      <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
        <p className="text-xs font-medium mb-1" style={{ color: "#6B5B4E" }}>Pauta Meta</p>
        <p className="text-2xl font-bold text-gray-900" data-testid="text-meta-spend">${formatNumber(meta_ads.spend)}</p>
        <p className="text-xs" style={{ color: "#9B8B7A" }}>CTR: {meta_ads.ctr}%</p>
      </div>
    </div>
  );
}

function DefaultChart() {
  const { instagram, facebook, tiktok } = mockData;
  const followerGrowth = [
    { month: "Dic 2025", instagram: instagram.followers_2months_ago, facebook: facebook.followers_2months_ago, tiktok: tiktok.followers_2months_ago },
    { month: "Ene 2026", instagram: instagram.followers_prev_month, facebook: facebook.followers_prev_month, tiktok: tiktok.followers_prev_month },
    { month: "Feb 2026", instagram: instagram.followers, facebook: facebook.followers, tiktok: tiktok.followers },
  ];

  return (
    <div className="bg-white rounded-xl p-5 border border-gray-100 shadow-sm">
      <h3 className="text-sm font-semibold text-gray-900 mb-4">Crecimiento de Followers - Ultimos 3 Meses</h3>
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={followerGrowth}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0ebe3" />
          <XAxis dataKey="month" tick={{ fontSize: 12, fill: "#6B5B4E" }} />
          <YAxis tick={{ fontSize: 12, fill: "#6B5B4E" }} tickFormatter={(v) => formatNumber(v)} />
          <Tooltip formatter={(value: number) => formatNumber(value)} contentStyle={{ borderRadius: "8px", border: "1px solid #e8e0d4", fontSize: "12px" }} />
          <Legend wrapperStyle={{ fontSize: "12px" }} />
          <Bar dataKey="instagram" name="Instagram" fill="#E1306C" radius={[6, 6, 0, 0]} />
          <Bar dataKey="facebook" name="Facebook" fill="#1877F2" radius={[6, 6, 0, 0]} />
          <Bar dataKey="tiktok" name="TikTok" fill="#1a1a1a" radius={[6, 6, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function DynamicChart({ chartData }: { chartData: ChartData }) {
  const { type, title, data, dataKeys, colors } = chartData;

  return (
    <div className="bg-white rounded-xl p-5 border border-gray-100 shadow-sm">
      <h3 className="text-sm font-semibold text-gray-900 mb-4">{title}</h3>
      <ResponsiveContainer width="100%" height={280}>
        {type === "line" ? (
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0ebe3" />
            <XAxis dataKey="name" tick={{ fontSize: 12, fill: "#6B5B4E" }} />
            <YAxis tick={{ fontSize: 12, fill: "#6B5B4E" }} />
            <Tooltip contentStyle={{ borderRadius: "8px", border: "1px solid #e8e0d4", fontSize: "12px" }} />
            <Legend wrapperStyle={{ fontSize: "12px" }} />
            {dataKeys.map((key, i) => (
              <Line key={key} type="monotone" dataKey={key} stroke={colors[i] || ACCENT_COLOR} strokeWidth={2} dot={{ r: 4 }} />
            ))}
          </LineChart>
        ) : type === "area" ? (
          <AreaChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0ebe3" />
            <XAxis dataKey="name" tick={{ fontSize: 12, fill: "#6B5B4E" }} />
            <YAxis tick={{ fontSize: 12, fill: "#6B5B4E" }} />
            <Tooltip contentStyle={{ borderRadius: "8px", border: "1px solid #e8e0d4", fontSize: "12px" }} />
            <Legend wrapperStyle={{ fontSize: "12px" }} />
            {dataKeys.map((key, i) => (
              <Area key={key} type="monotone" dataKey={key} fill={colors[i] || ACCENT_COLOR} stroke={colors[i] || ACCENT_COLOR} fillOpacity={0.2} />
            ))}
          </AreaChart>
        ) : (
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0ebe3" />
            <XAxis dataKey="name" tick={{ fontSize: 12, fill: "#6B5B4E" }} />
            <YAxis tick={{ fontSize: 12, fill: "#6B5B4E" }} />
            <Tooltip contentStyle={{ borderRadius: "8px", border: "1px solid #e8e0d4", fontSize: "12px" }} />
            <Legend wrapperStyle={{ fontSize: "12px" }} />
            {dataKeys.map((key, i) => (
              <Bar key={key} dataKey={key} fill={colors[i] || ACCENT_COLOR} radius={[6, 6, 0, 0]} />
            ))}
          </BarChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}

export default function Home() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [activeChart, setActiveChart] = useState<ChartData | null>(null);
  const [canvasOpen, setCanvasOpen] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

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
        context: mockDataContext,
      });
      const data = await res.json();
      const { cleanText, chartData } = parseChartData(data.response);

      if (chartData) {
        setActiveChart(chartData);
        setCanvasOpen(true);
      }

      setMessages((prev) => [...prev, { role: "assistant", content: cleanText }]);
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
    <div className="h-screen flex flex-col" style={{ backgroundColor: "#FAF6F0" }}>
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
        <div className={`flex flex-col h-full transition-all duration-300 ${canvasOpen ? "w-full md:w-[42%]" : "w-full"}`}>
          <div className="flex items-center justify-between px-4 py-3 border-b pt-[15px] pb-[15px]" style={{ borderColor: "#E8E0D4" }}>
            <div className="flex items-center gap-2">
              <img
                src={AGENCY_LOGO}
                alt="Parallax"
                className="h-5 md:h-6"
                data-testid="img-agency-logo"
              />
            </div>
            <div className="flex items-center gap-2">
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
                <h1 className="text-2xl font-semibold text-gray-900 mb-6">Hola, pregunta lo que necesites sobre tus redes sociales.</h1>
                <div className="flex flex-wrap gap-2">
                  {QUESTION_CHIPS.map((q, i) => (
                    <button
                      key={i}
                      onClick={() => sendMessage(q)}
                      disabled={isLoading}
                      className="chip-button text-sm px-4 py-2 rounded-full border transition-all disabled:opacity-50"
                      style={{ borderColor: "#D4C9B8", color: "#5C4D3C", backgroundColor: "transparent" }}
                      data-testid={`button-chip-${i}`}
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="max-w-xl mx-auto">
              {messages.map((msg, i) => (
                <div key={i} className="mb-5">
                  {msg.role === "user" ? (
                    <div className="flex justify-end">
                      <div
                        className="px-4 py-2.5 rounded-2xl text-sm leading-relaxed max-w-[85%]"
                        style={{ backgroundColor: "#EEDDC8", color: "#3D3224" }}
                        data-testid={`text-message-${i}`}
                      >
                        <p className="whitespace-pre-wrap">{msg.content}</p>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-start">
                      <div
                        className="text-sm leading-relaxed max-w-full"
                        style={{ color: "#3D3224" }}
                        data-testid={`text-message-${i}`}
                      >
                        <p className="whitespace-pre-wrap">{msg.content}</p>
                      </div>
                      <div className="mt-1.5">
                        <CopyButton text={msg.content} />
                      </div>
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
              className="relative rounded-2xl border shadow-sm"
              style={{ backgroundColor: "#FFFFFF", borderColor: "#D4C9B8" }}
            >
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Responder..."
                disabled={isLoading}
                rows={1}
                className="w-full resize-none bg-transparent px-4 pt-3.5 pb-12 text-sm focus:outline-none disabled:opacity-50"
                style={{ color: "#3D3224", minHeight: "52px" }}
                data-testid="input-chat"
              />
              <div className="absolute bottom-2.5 right-2.5">
                <button
                  type="submit"
                  disabled={isLoading || !input.trim()}
                  className="w-8 h-8 rounded-lg flex items-center justify-center transition-opacity disabled:opacity-30"
                  style={{ backgroundColor: ACCENT_COLOR }}
                  data-testid="button-send"
                >
                  <ArrowUp className="w-4 h-4 text-white" />
                </button>
              </div>
            </form>
            <p className="text-center text-xs mt-2" style={{ color: "#9B8B7A" }}>
              La IA puede cometer errores. Verifica los datos importantes.
            </p>
          </div>
        </div>

        {canvasOpen && (
          <div
            className="w-full md:w-[58%] flex flex-col border-l overflow-hidden print:w-1/2"
            style={{ borderColor: "#E8E0D4", backgroundColor: "#F7F3ED" }}
          >
            <div className="flex items-center justify-between gap-2 px-5 py-3 border-b" style={{ borderColor: "#E8E0D4" }}>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <RefreshCw className="w-3.5 h-3.5" style={{ color: "#8B7B6B" }} />
                  <span className="text-sm font-medium text-gray-900">{mockData.plaza}</span>
                  <span className="text-xs" style={{ color: "#8B7B6B" }}>{mockData.period}</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleExportPdf}
                  className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-md border transition-colors"
                  style={{ borderColor: "#D4C9B8", color: "#5C4D3C", backgroundColor: "transparent" }}
                  data-testid="button-export-pdf"
                >
                  Exportar PDF
                </button>
                <button
                  onClick={() => setCanvasOpen(false)}
                  className="w-7 h-7 rounded-md flex items-center justify-center transition-colors md:hidden"
                  style={{ color: "#8B7B6B" }}
                  data-testid="button-close-canvas"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-5">
              <KpiCards />
              {activeChart ? <DynamicChart chartData={activeChart} /> : <DefaultChart />}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
