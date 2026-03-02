import { getUncachableGoogleSheetClient } from "./googleSheetsClient";
import { PLAZAS, type PlazaConfig } from "./config/plazas";
import type {
  MonthlyData,
  PlazaData,
  SheetsDataResponse,
} from "@shared/schema";

const SPREADSHEET_ID = "15PdHhPO-ecHavV27SLfkh6Nx-fXGM06As0-5O_i8vvs";
const SHEET_NAMES = [
  "Facebook Page Insights",
  "Instagram Page Insights",
  "Instagram Followers 30 días",
  "Meta Ads",
];

function computeTargetMonths(): string[] {
  const now = new Date();
  const months: string[] = [];
  for (let i = 2; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - 1 - i, 1);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    months.push(`${y}-${m}`);
  }
  return months;
}

async function readSheet(sheetName: string): Promise<Record<string, string>[]> {
  const sheets = await getUncachableGoogleSheetClient();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `'${sheetName}'`,
  });
  const rows = res.data.values;
  if (!rows || rows.length < 2) return [];
  const headers = rows[0] as string[];
  return rows.slice(1).map((row) => {
    const obj: Record<string, string> = {};
    headers.forEach((h, i) => {
      obj[h] = (row as string[])[i] ?? "";
    });
    return obj;
  });
}

function parseNum(val: string | undefined): number {
  if (!val) return 0;
  const cleaned = val.replace(/,/g, "").replace(/\s/g, "");
  const n = parseFloat(cleaned);
  return isNaN(n) ? 0 : n;
}

function getYearMonth(dateStr: string): string {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

function groupByMonth<T extends Record<string, string>>(
  rows: T[],
): Record<string, T[]> {
  const byMonth: Record<string, T[]> = {};
  for (const row of rows) {
    const ym = getYearMonth(row["Report: Date"] || row["Report: Start date"]);
    if (ym) {
      if (!byMonth[ym]) byMonth[ym] = [];
      byMonth[ym].push(row);
    }
  }
  return byMonth;
}

function filterForPlaza(
  rows: Record<string, string>[],
  field: string,
  value: string,
): Record<string, string>[] {
  return rows.filter((r) => r[field] === value);
}

function filterAdsForPlaza(
  rows: Record<string, string>[],
  keyword: string,
): Record<string, string>[] {
  const lower = keyword.toLowerCase();
  return rows.filter((r) =>
    (r["Campaign: Campaign name"] || "").toLowerCase().includes(lower),
  );
}

function buildMonthlyData(
  targetMonths: string[],
  fbFiltered: Record<string, string>[],
  igFiltered: Record<string, string>[],
  igFollowersFiltered: Record<string, string>[],
  adsFiltered: Record<string, string>[],
): Record<string, MonthlyData> {
  const fbByMonth = groupByMonth(fbFiltered);
  const igByMonth = groupByMonth(igFiltered);
  const igFollowersByMonth = groupByMonth(igFollowersFiltered);
  const adsByMonth = groupByMonth(adsFiltered);

  const sumField = (rows: Record<string, string>[], field: string) =>
    rows.reduce((acc, r) => acc + parseNum(r[field]), 0);

  const latestFbFollowers = (rows: Record<string, string>[]) => {
    if (rows.length === 0) return 0;
    const sorted = [...rows].sort(
      (a, b) =>
        new Date(b["Report: Date"] || b["Report: Start date"] || "").getTime() -
        new Date(a["Report: Date"] || a["Report: Start date"] || "").getTime(),
    );
    return parseNum(sorted[0]["Engagement: Lifetime followers"]);
  };

  const monthly: Record<string, MonthlyData> = {};

  for (const ym of targetMonths) {
    const fbMonth = fbByMonth[ym] || [];
    const igMonth = igByMonth[ym] || [];
    const igFollowersMonth = igFollowersByMonth[ym] || [];
    const adsMonth = adsByMonth[ym] || [];

    const adsClickSum = sumField(adsMonth, "Performance: Clicks");
    const adsImpressionSum = sumField(adsMonth, "Performance: Impressions");

    monthly[ym] = {
      facebook: {
        reach: sumField(fbMonth, "Performance: Reach"),
        reach_organic: sumField(fbMonth, "Performance: Posts organic reach"),
        engagement: sumField(fbMonth, "Engagement: Posts engagements"),
        followers_total:
          latestFbFollowers(fbMonth) || latestFbFollowers(fbFiltered),
      },
      instagram: {
        reach: sumField(igMonth, "Performance: Reach"),
        engagement: sumField(igMonth, "Performance: Engagements"),
        new_followers: sumField(igFollowersMonth, "Engagement: New followers"),
        likes: sumField(igMonth, "Engagement: Likes"),
        comments: sumField(igMonth, "Engagement: Comments"),
        saves: sumField(igMonth, "Engagement: Saves"),
        shares: sumField(igMonth, "Engagement: Shares"),
        has_followers_data: igFollowersMonth.length > 0,
      },
      meta_ads: {
        spend: sumField(adsMonth, "Cost: Amount spend"),
        impressions: adsImpressionSum,
        clicks: adsClickSum,
        ctr: adsImpressionSum > 0 ? (adsClickSum / adsImpressionSum) * 100 : 0,
      },
    };
  }

  return monthly;
}

export async function fetchSheetsData(
  plazaIds: string[],
): Promise<SheetsDataResponse> {
  const targetMonths = computeTargetMonths();

  const [fbRows, igRows, igFollowersRows, adsRows] = await Promise.all(
    SHEET_NAMES.map((name) => readSheet(name)),
  );

  const useAll =
    plazaIds.length === 0 || (plazaIds.length === 1 && plazaIds[0] === "all");
  const selectedPlazas: PlazaConfig[] = useAll
    ? PLAZAS
    : PLAZAS.filter((p) => plazaIds.includes(p.id));

  const plazas: Record<string, PlazaData> = {};

  for (const plaza of selectedPlazas) {
    const fbFiltered = filterForPlaza(
      fbRows,
      "Account: Account name",
      plaza.fbAccount,
    );
    const igFiltered = filterForPlaza(
      igRows,
      "Account: Account name",
      plaza.igAccount,
    );
    const igFollowersFiltered = filterForPlaza(
      igFollowersRows,
      "Account: Account name",
      plaza.igAccount,
    );
    const adsFiltered = filterAdsForPlaza(adsRows, plaza.adsCampaignKeyword);

    const monthly = buildMonthlyData(
      targetMonths,
      fbFiltered,
      igFiltered,
      igFollowersFiltered,
      adsFiltered,
    );

    plazas[plaza.id] = {
      months: targetMonths,
      monthly,
    };
  }

  return {
    plazas,
    availablePlazas: PLAZAS.map((p) => ({
      id: p.id,
      displayName: p.displayName,
    })),
  };
}
