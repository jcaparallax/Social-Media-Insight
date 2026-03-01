import type { Express } from "express";
import { createServer, type Server } from "http";
import Anthropic from "@anthropic-ai/sdk";
import { mockData } from "./mock-data";
import { chatRequestSchema } from "@shared/schema";
import { fetchSheetsData } from "./sheets";

const anthropic = new Anthropic({
  apiKey: process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL,
});

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  app.post("/api/chat", async (req, res) => {
    try {
      const parsed = chatRequestSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid request", details: parsed.error.flatten() });
      }

      const { messages, context } = parsed.data;
      const dataContext = context || JSON.stringify(mockData, null, 2);

      const systemPrompt = `You are a social media analytics assistant for Patio Santa Fe, a shopping center in Mexico City managed by Parallax digital agency. You receive structured data about the plaza social media performance across months November 2025 through February 2026. Answer questions clearly and concisely in Spanish (2-3 sentences max).

MANDATORY CHART RULE: Every response MUST include at least one CHART_DATA block generated from relevant data. Choose chart type based on the question:
- Trend questions → "line"
- Comparison questions → "bar"
- Composition/distribution questions → "pie"

CHART_DATA format: CHART_DATA: {"type":"bar","title":"...","data":[{"name":"...","value":0}],"dataKeys":["value"],"colors":["#E1306C"]}
For pie charts: CHART_DATA: {"type":"pie","title":"...","data":[{"name":"Likes","value":500},{"name":"Comments","value":100}],"dataKeys":["value"],"colors":["#E1306C","#1877F2","#69C9D0","#ED7C22"]}

Use platform brand colors: Facebook #1877F2, Instagram #E1306C, TikTok #69C9D0.
Focus on wins, opportunities, and forward-looking recommendations. Never comment on whether Parallax is doing a good or bad job.

MANDATORY — you MUST end EVERY single response with this exact line as the very last line of your output, no exceptions:
SUGGESTED: ["pregunta relevante 1", "pregunta relevante 2", "pregunta relevante 3"]
This is a required machine-readable tag. The 3 questions must be relevant Spanish follow-up questions based on the conversation. The format must be a valid JSON array of 3 strings. This line must ALWAYS be the last line of your response. Never omit it.

Data:
${dataContext}`;

      const response = await anthropic.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 8192,
        system: systemPrompt,
        messages: messages.map((m: { role: string; content: string }) => ({
          role: m.role as "user" | "assistant",
          content: m.content,
        })),
      });

      const content = response.content[0];
      const text = content.type === "text" ? content.text : "";

      res.json({ response: text });
    } catch (error) {
      console.error("Chat API error:", error);
      res.status(500).json({ error: "Failed to get response from AI" });
    }
  });

  app.get("/api/data", (_req, res) => {
    res.json(mockData);
  });

  app.get("/api/sheets-data", async (_req, res) => {
    try {
      const data = await fetchSheetsData();
      res.json(data);
    } catch (error) {
      console.error("Sheets API error:", error);
      res.status(500).json({ error: "Failed to fetch Google Sheets data" });
    }
  });

  return httpServer;
}
