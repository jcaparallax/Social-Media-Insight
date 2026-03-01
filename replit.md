# FUNO Social Media Analytics Chat App

## Overview
A social media analytics chat app for marketing agency Parallax, serving client FUNO (Patio Santa Fe). Features a split-screen layout with a Claude AI-powered chat panel and a data visualization canvas.

## Architecture
- **Frontend**: React + TypeScript (Vite), Recharts for charts (including PieChart), Tailwind CSS
- **Backend**: Express with `/api/chat` endpoint using Anthropic Claude (via Replit AI Integrations)
- **Data Source**: Google Sheets API via service account — returns monthly aggregations for Nov 2025 through Feb 2026
- **State**: In-memory only, no database, no session persistence
- **Auth**: None (V1)

## Key Files
- `client/src/pages/home.tsx` - Main page with split layout (chat + canvas), KPI cards, platform summary table, 4 default charts
- `client/src/data/config.ts` - Client/agency logos, colors
- `server/routes.ts` - `/api/chat` (Claude AI), `/api/data` (mock data), `/api/sheets-data` (Google Sheets) endpoints
- `server/sheets.ts` - Google Sheets data fetching with multi-month aggregation (TARGET_MONTHS: 2025-11 through 2026-02)
- `server/mock-data.ts` - Server-side mock data (fallback for AI context)

## Data Pipeline
- Spreadsheet ID: `15PdHhPO-ecHavV27SLfkh6Nx-fXGM06As0-5O_i8vvs`
- Sheets read: "Facebook Page Insights", "Instagram Page Insights", "Instagram Followers 30 días", "Meta Ads"
- Filtered for Patio Santa Fe (FB: "Patio Santa Fe", IG: "patiosantafe", Ads: campaigns containing "f1_01sfe")
- Aggregated by month for 4 target months (Nov 2025 – Feb 2026)
- API returns `{ plaza, months: string[], monthly: Record<string, MonthlyData> }`
- Credentials: Google Service Account JSON stored in `GOOGLE_SHEETS_CREDENTIALS` Replit Secret

## Dashboard Components
### KPI Cards (5 cards)
1. **Alcance Total** — FB + IG combined reach, deltas vs previous month and 3 months ago
2. **Engagement Rate** — total engagements / total reach * 100, delta vs previous month
3. **Interacciones Totales** — sum of likes + comments + saves + shares (IG + FB), delta vs previous
4. **Nuevos Seguidores Instagram** — new followers current month, delta vs previous
5. **Gasto Meta Ads** — total spend, delta vs previous (shows "Sin pauta este mes" if $0)

### Platform Summary Table
- Columns: Plataforma, Alcance, Interacciones, Engagement Rate, Nuevos Seguidores, vs Mes Anterior
- Rows: Facebook (#1877F2), Instagram (#E1306C), TikTok (#69C9D0 — shows "Sin datos")

### Charts (4 shown by default)
1. Bar chart — Alcance Mensual por Plataforma (grouped FB + IG)
2. Line chart — Evolución de Engagement Rate (FB + IG lines)
3. Pie chart — Tipo de Interacciones Instagram (Likes, Comentarios, Guardados, Compartidos)
4. Bar chart — Nuevos Seguidores Mensuales Instagram

### AI Chat
- Every AI response must include a text answer (2-3 sentences) plus at least one CHART_DATA block
- Chart type matches question: trend → line, comparison → bar, composition → pie
- Supports bar, line, area, and pie chart types

## Design
- Accent color: #ED7C22 (buttons, chart fills)
- Platform colors: Facebook #1877F2, Instagram #E1306C, TikTok #69C9D0
- Split screen: 42% chat (left), 58% canvas (right)
- Mobile responsive (stacks vertically)

## Dependencies
- `googleapis` - Google Sheets API client for fetching real data
