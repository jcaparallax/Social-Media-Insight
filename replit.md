# FUNO Social Media Analytics Chat App

## Overview
A social media analytics chat app for marketing agency Parallax, serving client FUNO with a multi-plaza architecture. Features a split-screen layout with a Claude AI-powered chat panel and a data visualization canvas. Supports filtering and aggregation across multiple shopping center plazas.

## Architecture
- **Frontend**: React + TypeScript (Vite), Recharts for charts (including PieChart), Tailwind CSS
- **Backend**: Express with `/api/chat`, `/api/sheets-data`, `/api/plazas` endpoints using Anthropic Claude (via Replit AI Integrations)
- **Data Source**: Google Sheets API via Replit Google Sheets Connector (OAuth) — returns monthly aggregations for the last 4 complete calendar months, dynamically computed
- **State**: In-memory only, no database, no session persistence
- **Auth**: None (V1)

## Multi-Plaza Architecture
- Plaza configs live in `server/config/plazas.ts` — each plaza has id, displayName, fbAccount, igAccount, adsCampaignKeyword
- `fetchSheetsData(plazaIds)` accepts an array of plaza IDs (or ["all"]) and filters data per-plaza
- API returns data keyed by plaza ID: `{ plazas: { [plazaId]: { months, monthly } }, availablePlazas }`
- Frontend aggregates data across selected plazas for KPIs and charts
- Adding a new plaza: add entry to `PLAZAS` array in `server/config/plazas.ts`

## Key Files
- `client/src/pages/home.tsx` - Main page with split layout (chat + canvas), KPI cards, platform summary table, 4 default charts, plaza multi-select
- `client/src/data/config.ts` - Client/agency logos, colors
- `server/routes.ts` - `/api/chat` (Claude AI), `/api/sheets-data` (Google Sheets), `/api/plazas` (plaza list) endpoints
- `server/sheets.ts` - Google Sheets data fetching with multi-plaza filtering and dynamic month computation
- `server/config/plazas.ts` - Plaza configuration array with filter values per data source
- `server/googleSheetsClient.ts` - Google Sheets Replit Connector auth client (OAuth, token refresh)
- `shared/schema.ts` - Zod schemas, TypeScript types for API requests and multi-plaza responses

## Data Pipeline
- Spreadsheet ID: `15PdHhPO-ecHavV27SLfkh6Nx-fXGM06As0-5O_i8vvs`
- Sheets read: "Facebook Page Insights", "Instagram Page Insights", "Instagram Followers 30 días", "Meta Ads"
- Filtered per-plaza using config values (FB account name, IG account name, Ads campaign keyword)
- Target months: dynamically computed as last 4 complete calendar months
- Aggregated by month per plaza
- Credentials: Google Sheets Replit Connector (OAuth) — replaces old service account approach

## API Endpoints
- `GET /api/plazas` — returns `[{ id, displayName }]` from config
- `GET /api/sheets-data?plazas=all` or `?plazas=patio-santa-fe,otra-plaza` — returns `{ plazas, availablePlazas }`
- `POST /api/chat` — body: `{ messages, context?, plazaIds?, months? }` — fetches filtered data for AI context

## Dashboard Components
### Plaza Multi-Select (Header)
- Dropdown in header next to client logo
- Options: "Todas las plazas" + individual plazas
- Default: all selected
- Changing selection re-fetches data and updates dashboard

### KPI Cards (6 cards)
1. **Alcance Total** — FB + IG combined reach, deltas vs previous month and 3 months ago
2. **Eng. Rate Facebook** — fb.engagement / fb.reach * 100, delta vs previous month (pp)
3. **Eng. Rate Instagram** — (ig.likes + ig.comments + ig.saves + ig.shares) / ig.reach * 100, delta vs previous month (pp)
4. **Interacciones Totales** — sum of likes + comments + saves + shares (IG + FB), delta vs previous
5. **Nuevos Seguidores IG** — new followers current month; shows absolute diff when prev < 10, percentage when prev >= 10
6. **Gasto Meta Ads** — total spend, delta vs previous (shows "Sin pauta este mes" if $0)

### Platform Summary Table
- Columns: Plataforma, Alcance, Interacciones, Engagement Rate, Nuevos Seguidores, vs Mes Anterior
- Rows: Facebook (#1877F2), Instagram (#E1306C), TikTok (#69C9D0 — shows "Sin datos")

### Charts (4 shown by default)
1. Two stacked bar charts — Alcance Mensual por Plataforma (separate FB and IG charts with independent Y axes, 160px each)
2. Line chart — Evolución de Engagement Rate (FB + IG lines)
3. Horizontal bar chart — Tipo de Interacciones Instagram (Likes, Comentarios, Guardados, Compartidos with absolute values)
4. Bar chart — Nuevos Seguidores Mensuales Instagram (missing months shown as gray N/D bars)

### AI Chat
- Every AI response must include a text answer (2-3 sentences) plus at least one CHART_DATA block
- Chart type matches question: trend → line, comparison → bar, composition → pie
- Supports bar, line, area, and pie chart types
- plazaIds sent with every chat request for context

## Design
- Accent color: #ED7C22 (buttons, chart fills)
- Platform colors: Facebook #1877F2, Instagram #E1306C, TikTok #69C9D0
- Split screen: 42% chat (left), 58% canvas (right)
- Mobile responsive (stacks vertically)

## Dependencies
- `googleapis` - Google Sheets API client for fetching real data (auth via Replit Connector)
