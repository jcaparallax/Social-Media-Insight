import type { Express } from "express";
import { createServer, type Server } from "http";
import Anthropic from "@anthropic-ai/sdk";
import { mockData } from "./mock-data";
import { chatRequestSchema } from "@shared/schema";

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

      const systemPrompt = `Eres un analista de social media experto que trabaja para la agencia Parallax. Respondes en espanol. Tu cliente actual es Patio Santa Fe (propiedad de FUNO).

Tienes acceso a los siguientes datos de redes sociales:

${dataContext}

Responde de forma concisa, profesional y con datos especificos cuando esten disponibles. Usa numeros y porcentajes para respaldar tus respuestas.

IMPORTANTE: Si tu respuesta incluye datos que serian mejor representados en un grafico o chart, incluye un bloque JSON con el formato:

\`\`\`CHART_DATA
{
  "type": "bar" | "line" | "area",
  "title": "Titulo del grafico",
  "data": [{"name": "label", "value": number, ...}],
  "dataKeys": ["value"],
  "colors": ["#ED7C22", "#004CFF", "#10B981"]
}
\`\`\`

Solo incluye CHART_DATA cuando los datos se presten naturalmente a una visualizacion. No fuerces graficos en respuestas simples de texto.`;

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

  return httpServer;
}
