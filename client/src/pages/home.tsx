import { useState, useRef, useEffect } from "react";
import { Send, FileDown, Loader2 } from "lucide-react";
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
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  AGENCY_LOGO,
  CLIENT_LOGO,
  HEADER_BG,
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
    /```CHART_DATA\s*\n([\s\S]*?)\n```/,
    /```json\s*\n?\s*CHART_DATA\s*\n([\s\S]*?)\n```/,
    /```\s*CHART_DATA\s*\n([\s\S]*?)\n```/,
  ];

  for (const regex of patterns) {
    const match = text.match(regex);
    if (match) {
      try {
        const jsonStr = match[1].replace(/,\s*([}\]])/g, "$1");
        const chartData = JSON.parse(jsonStr) as ChartData;
        if (chartData.type && chartData.data && chartData.dataKeys) {
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

function KpiCards() {
  const { platforms, totalFollowers, netGrowthThisMonth, organicReach } = mockData;

  return (
    <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 mb-4">
      <Card className="p-4 border-l-4 border-l-[#E1306C]" style={{ borderLeftColor: "#E1306C", borderRadius: "6px" }}>
        <div className="flex items-center gap-2 mb-2">
          <SiInstagram className="text-[#E1306C]" size={18} />
          <span className="text-sm font-medium text-muted-foreground">Instagram</span>
        </div>
        <p className="text-2xl font-bold" data-testid="text-ig-followers">{formatNumber(platforms.instagram.followers)}</p>
        <p className="text-xs text-green-600 font-medium">+{formatNumber(platforms.instagram.followersGrowth)}</p>
      </Card>

      <Card className="p-4 border-l-4" style={{ borderLeftColor: "#1877F2", borderRadius: "6px" }}>
        <div className="flex items-center gap-2 mb-2">
          <SiFacebook className="text-[#1877F2]" size={18} />
          <span className="text-sm font-medium text-muted-foreground">Facebook</span>
        </div>
        <p className="text-2xl font-bold" data-testid="text-fb-followers">{formatNumber(platforms.facebook.followers)}</p>
        <p className="text-xs text-green-600 font-medium">+{formatNumber(platforms.facebook.followersGrowth)}</p>
      </Card>

      <Card className="p-4 border-l-4" style={{ borderLeftColor: "#000000", borderRadius: "6px" }}>
        <div className="flex items-center gap-2 mb-2">
          <SiTiktok size={18} />
          <span className="text-sm font-medium text-muted-foreground">TikTok</span>
        </div>
        <p className="text-2xl font-bold" data-testid="text-tt-followers">{formatNumber(platforms.tiktok.followers)}</p>
        <p className="text-xs text-green-600 font-medium">+{formatNumber(platforms.tiktok.followersGrowth)}</p>
      </Card>

      <Card className="p-4" style={{ borderRadius: "6px" }}>
        <p className="text-sm font-medium text-muted-foreground mb-1">Crecimiento Neto</p>
        <p className="text-2xl font-bold text-green-600" data-testid="text-net-growth">+{formatNumber(netGrowthThisMonth)}</p>
        <p className="text-xs text-muted-foreground">este mes</p>
      </Card>

      <Card className="p-4" style={{ borderRadius: "6px" }}>
        <p className="text-sm font-medium text-muted-foreground mb-1">Engagement Rate</p>
        <div className="flex items-baseline gap-2">
          <span className="text-lg font-bold" style={{ color: "#E1306C" }} data-testid="text-eng-ig">{platforms.instagram.engagementRate}%</span>
          <span className="text-lg font-bold" style={{ color: "#1877F2" }} data-testid="text-eng-fb">{platforms.facebook.engagementRate}%</span>
          <span className="text-lg font-bold" data-testid="text-eng-tt">{platforms.tiktok.engagementRate}%</span>
        </div>
        <p className="text-xs text-muted-foreground">IG / FB / TT</p>
      </Card>

      <Card className="p-4" style={{ borderRadius: "6px" }}>
        <p className="text-sm font-medium text-muted-foreground mb-1">Alcance Organico</p>
        <p className="text-2xl font-bold" data-testid="text-organic-reach">{formatNumber(organicReach)}</p>
        <p className="text-xs text-muted-foreground">total combinado</p>
      </Card>
    </div>
  );
}

function DefaultChart() {
  return (
    <Card className="p-4" style={{ borderRadius: "6px" }}>
      <h3 className="text-sm font-semibold mb-4">Crecimiento de Followers - Ultimos 3 Meses</h3>
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={mockData.followerGrowth}>
          <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
          <XAxis dataKey="month" tick={{ fontSize: 12 }} />
          <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => formatNumber(v)} />
          <Tooltip formatter={(value: number) => formatNumber(value)} />
          <Legend />
          <Bar dataKey="instagram" name="Instagram" fill="#E1306C" radius={[4, 4, 0, 0]} />
          <Bar dataKey="facebook" name="Facebook" fill="#1877F2" radius={[4, 4, 0, 0]} />
          <Bar dataKey="tiktok" name="TikTok" fill="#000000" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </Card>
  );
}

function DynamicChart({ chartData }: { chartData: ChartData }) {
  const { type, title, data, dataKeys, colors } = chartData;

  return (
    <Card className="p-4" style={{ borderRadius: "6px" }}>
      <h3 className="text-sm font-semibold mb-4">{title}</h3>
      <ResponsiveContainer width="100%" height={280}>
        {type === "line" ? (
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
            <XAxis dataKey="name" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} />
            <Tooltip />
            <Legend />
            {dataKeys.map((key, i) => (
              <Line key={key} type="monotone" dataKey={key} stroke={colors[i] || ACCENT_COLOR} strokeWidth={2} />
            ))}
          </LineChart>
        ) : type === "area" ? (
          <AreaChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
            <XAxis dataKey="name" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} />
            <Tooltip />
            <Legend />
            {dataKeys.map((key, i) => (
              <Area key={key} type="monotone" dataKey={key} fill={colors[i] || ACCENT_COLOR} stroke={colors[i] || ACCENT_COLOR} fillOpacity={0.3} />
            ))}
          </AreaChart>
        ) : (
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
            <XAxis dataKey="name" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} />
            <Tooltip />
            <Legend />
            {dataKeys.map((key, i) => (
              <Bar key={key} dataKey={key} fill={colors[i] || ACCENT_COLOR} radius={[4, 4, 0, 0]} />
            ))}
          </BarChart>
        )}
      </ResponsiveContainer>
    </Card>
  );
}

export default function Home() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [activeChart, setActiveChart] = useState<ChartData | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

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
      }

      setMessages((prev) => [...prev, { role: "assistant", content: cleanText }]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Lo siento, hubo un error al procesar tu solicitud. Intenta de nuevo." },
      ]);
    } finally {
      setIsLoading(false);
      inputRef.current?.focus();
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    sendMessage(input);
  }

  function handleExportPdf() {
    window.print();
  }

  return (
    <div className="h-screen flex flex-col bg-white print:bg-white">
      <header
        className="flex items-center justify-between gap-2 px-4 py-3 print:py-2"
        style={{ backgroundColor: HEADER_BG }}
      >
        <img
          src={AGENCY_LOGO}
          alt="Parallax"
          className="h-7 md:h-8 brightness-0 invert"
          data-testid="img-agency-logo"
        />
        <div className="flex items-center gap-3">
          <Button
            size="sm"
            onClick={handleExportPdf}
            className="print:hidden text-xs font-medium"
            style={{ backgroundColor: ACCENT_COLOR, border: "none" }}
            data-testid="button-export-pdf"
          >
            <FileDown className="w-4 h-4 mr-1" />
            Exportar PDF
          </Button>
          <img
            src={CLIENT_LOGO}
            alt="FUNO"
            className="h-7 md:h-8"
            data-testid="img-client-logo"
          />
        </div>
      </header>

      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
        <div className="w-full md:w-[40%] flex flex-col border-r border-gray-200 print:w-1/2">
          <div className="p-3 border-b border-gray-100 print:hidden">
            <div className="flex flex-wrap gap-2">
              {QUESTION_CHIPS.map((q, i) => (
                <button
                  key={i}
                  onClick={() => sendMessage(q)}
                  disabled={isLoading}
                  className="chip-button text-xs px-3 py-1.5 rounded-full border border-gray-200 bg-gray-100 text-gray-700 transition-all disabled:opacity-50"
                  data-testid={`button-chip-${i}`}
                >
                  {q}
                </button>
              ))}
            </div>
          </div>

          <ScrollArea className="flex-1 p-4">
            {messages.length === 0 && (
              <div className="flex items-center justify-center h-full text-center">
                <div>
                  <div className="w-12 h-12 mx-auto mb-3 rounded-full flex items-center justify-center" style={{ backgroundColor: `${HEADER_BG}15` }}>
                    <Send className="w-5 h-5" style={{ color: HEADER_BG }} />
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Selecciona una pregunta o escribe tu consulta
                  </p>
                </div>
              </div>
            )}

            {messages.map((msg, i) => (
              <div
                key={i}
                className={`mb-3 flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[85%] px-3 py-2 rounded-lg text-sm leading-relaxed ${
                    msg.role === "user"
                      ? "text-white"
                      : "bg-gray-100 text-gray-900"
                  }`}
                  style={msg.role === "user" ? { backgroundColor: HEADER_BG } : undefined}
                  data-testid={`text-message-${i}`}
                >
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                </div>
              </div>
            ))}

            {isLoading && (
              <div className="mb-3 flex justify-start">
                <div className="bg-gray-100 px-3 py-2 rounded-lg flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" style={{ color: ACCENT_COLOR }} />
                  <span className="text-sm text-muted-foreground">Analizando...</span>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </ScrollArea>

          <form
            onSubmit={handleSubmit}
            className="p-3 border-t border-gray-200 flex gap-2 print:hidden"
          >
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Escribe tu pregunta..."
              disabled={isLoading}
              className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-2 bg-white disabled:opacity-50"
              style={{ focusRingColor: HEADER_BG } as React.CSSProperties}
              data-testid="input-chat"
            />
            <Button
              type="submit"
              size="icon"
              disabled={isLoading || !input.trim()}
              style={{ backgroundColor: ACCENT_COLOR, border: "none" }}
              data-testid="button-send"
            >
              <Send className="w-4 h-4" />
            </Button>
          </form>
        </div>

        <div className="w-full md:w-[60%] overflow-auto bg-gray-50 print:w-1/2 print:bg-white">
          <div className="p-4">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-gray-900">{mockData.client}</h2>
                <p className="text-sm text-muted-foreground">Reporte {mockData.period}</p>
              </div>
            </div>

            <KpiCards />

            {activeChart ? <DynamicChart chartData={activeChart} /> : <DefaultChart />}
          </div>
        </div>
      </div>
    </div>
  );
}
