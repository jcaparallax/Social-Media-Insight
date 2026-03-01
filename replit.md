# FUNO Social Media Analytics Chat App

## Overview
A social media analytics chat app for marketing agency Parallax, serving client FUNO (Patio Santa Fe). Features a split-screen layout with a Claude AI-powered chat panel and a data visualization canvas.

## Architecture
- **Frontend**: React + TypeScript (Vite), Recharts for charts, Tailwind CSS
- **Backend**: Express with `/api/chat` endpoint using Anthropic Claude (via Replit AI Integrations)
- **Data Source**: Google Sheets API via service account (falls back to mock data on failure)
- **State**: In-memory only, no database, no session persistence
- **Auth**: None (V1)

## Key Files
- `client/src/pages/home.tsx` - Main page with split layout (chat + canvas)
- `client/src/data/config.ts` - Client/agency logos, colors
- `client/src/data/mock-santa-fe.ts` - Fallback mock analytics data for Patio Santa Fe
- `server/routes.ts` - `/api/chat` (Claude AI), `/api/data` (mock data), `/api/sheets-data` (Google Sheets) endpoints
- `server/sheets.ts` - Google Sheets data fetching and aggregation logic
- `server/mock-data.ts` - Server-side mock data (fallback)

## Data Pipeline
- Spreadsheet ID: `15PdHhPO-ecHavV27SLfkh6Nx-fXGM06As0-5O_i8vvs`
- Sheets read: "Facebook Page Insights", "Instagram Page Insights", "Instagram Followers 30 días", "Meta Ads"
- Filtered for Patio Santa Fe (FB: "Patio Santa Fe", IG: "patiosantafe", Ads: campaigns containing "f1_01sfe")
- Aggregated by month using "Report: Date" or "Report: Start date"
- Credentials: Google Service Account JSON stored in `GOOGLE_SHEETS_CREDENTIALS` Replit Secret

## Design
- Header: #004CFF background, agency logo left, client logo right
- Accent color: #ED7C22 (buttons, chart fills)
- Background: #ffffff, Text: #000000
- Split screen: 40% chat (left), 60% canvas (right)
- Mobile responsive (stacks vertically)

## Features
- 6 AI-generated question chips (Spanish, dynamically fetched from Claude on load)
- Chat with Claude AI using real Google Sheets data as context (mock data fallback)
- KPI summary cards (followers, growth, engagement, reach)
- Bar chart for engagement rate comparison by platform (Facebook, Instagram, TikTok if available)
- Dynamic chart rendering from Claude CHART_DATA responses
- PDF export via window.print()

## Dependencies
- `googleapis` - Google Sheets API client for fetching real data

## Configuration
- Client logo path stored as config constant in `client/src/data/config.ts`
- To swap clients: update logo import and mock data file
