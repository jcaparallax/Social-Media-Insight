import { google } from "googleapis";

const SPREADSHEET_ID = "15PdHhPO-ecHavV27SLfkh6Nx-fXGM06As0-5O_i8vvs";
const SHEET_NAMES = [
  "Facebook Page Insights",
  "Instagram Page Insights",
  "Instagram Followers 30 días",
  "Meta Ads",
];

const TARGET_MONTHS = ["2025-11", "2025-12", "2026-01", "2026-02"];

function getAuth() {
  const credsJson = process.env.GOOGLE_SHEETS_CREDENTIALS;
  if (!credsJson) throw new Error("GOOGLE_SHEETS_CREDENTIALS secret not set");
  const creds = JSON.parse(credsJson);
  return new google.auth.GoogleAuth({
    credentials: creds,
    scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
  });
}

async function readSheet(sheetName: string): Promise<Record<string, string>[]> {
  const auth = getAuth();
  const sheets = google.sheets({ version: "v4", auth });
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
      obj[h] = row[i] ?? "";
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

function groupByMonth<T extends Record<string, string>>(rows: T[]): Record<string, T[]> {
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

export async function fetchSheetsData() {
  const [fbRows, igRows, igFollowersRows, adsRows] = await Promise.all(
    SHEET_NAMES.map((name) => readSheet(name))
  );

  const fbFiltered = fbRows.filter(
    (r) => r["Account: Account name"] === "Patio Santa Fe"
  );
  const igFiltered = igRows.filter(
    (r) => r["Account: Account name"] === "patiosantafe"
  );
  const igFollowersFiltered = igFollowersRows.filter(
    (r) => r["Account: Account name"] === "patiosantafe"
  );
  const adsFiltered = adsRows.filter((r) =>
    (r["Campaign: Campaign name"] || "").toLowerCase().includes("f1_01sfe")
  );

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
        new Date(a["Report: Date"] || a["Report: Start date"] || "").getTime()
    );
    return parseNum(sorted[0]["Engagement: Lifetime followers"]);
  };

  const monthly: Record<string, {
    facebook: { reach: number; engagement: number; followers_total: number };
    instagram: { reach: number; engagement: number; new_followers: number; likes: number; comments: number; saves: number; shares: number };
    meta_ads: { spend: number; impressions: number; clicks: number; ctr: number };
  }> = {};

  for (const ym of TARGET_MONTHS) {
    const fbMonth = fbByMonth[ym] || [];
    const igMonth = igByMonth[ym] || [];
    const igFollowersMonth = igFollowersByMonth[ym] || [];
    const adsMonth = adsByMonth[ym] || [];

    const adsClickSum = sumField(adsMonth, "Performance: Link clicks");
    const adsImpressionSum = sumField(adsMonth, "Performance: Impressions");

    monthly[ym] = {
      facebook: {
        reach: sumField(fbMonth, "Performance: Reach"),
        engagement: sumField(fbMonth, "Engagement: Posts engagements"),
        followers_total: latestFbFollowers(fbMonth) || latestFbFollowers(fbFiltered),
      },
      instagram: {
        reach: sumField(igMonth, "Performance: Reach"),
        engagement: sumField(igMonth, "Performance: Engagements"),
        new_followers: sumField(igFollowersMonth, "Engagement: New followers"),
        likes: sumField(igMonth, "Engagement: Likes"),
        comments: sumField(igMonth, "Engagement: Comments"),
        saves: sumField(igMonth, "Engagement: Saves"),
        shares: sumField(igMonth, "Engagement: Shares"),
      },
      meta_ads: {
        spend: sumField(adsMonth, "Performance: Amount spent"),
        impressions: adsImpressionSum,
        clicks: adsClickSum,
        ctr: adsImpressionSum > 0 ? (adsClickSum / adsImpressionSum) * 100 : 0,
      },
    };
  }

  return {
    plaza: "Patio Santa Fe",
    months: TARGET_MONTHS,
    monthly,
  };
}
