# FUNO Social Media Analytics Chat App

## Overview
A social media analytics chat app for marketing agency Parallax, serving client FUNO (Patio Santa Fe). Features a split-screen layout with a Claude AI-powered chat panel and a data visualization canvas.

## Architecture
- **Frontend**: React + TypeScript (Vite), Recharts for charts, Tailwind CSS
- **Backend**: Express with `/api/chat` endpoint using Anthropic Claude (via Replit AI Integrations)
- **State**: In-memory only, no database, no session persistence
- **Auth**: None (V1)

## Key Files
- `client/src/pages/home.tsx` - Main page with split layout (chat + canvas)
- `client/src/data/config.ts` - Client/agency logos, colors, question chips
- `client/src/data/mock-santa-fe.ts` - Mock analytics data for Patio Santa Fe
- `server/routes.ts` - `/api/chat` (Claude AI) and `/api/data` (mock data) endpoints
- `server/mock-data.ts` - Server-side mock data

## Design
- Header: #004CFF background, agency logo left, client logo right
- Accent color: #ED7C22 (buttons, chart fills)
- Background: #ffffff, Text: #000000
- Split screen: 40% chat (left), 60% canvas (right)
- Mobile responsive (stacks vertically)

## Features
- 6 predefined question chips (Spanish)
- Chat with Claude AI using mock data as context
- KPI summary cards (followers, growth, engagement, reach)
- Bar chart for 3-month follower growth
- Dynamic chart rendering from Claude CHART_DATA responses
- PDF export via window.print()

## Configuration
- Client logo path stored as config constant in `client/src/data/config.ts`
- To swap clients: update logo import and mock data file
