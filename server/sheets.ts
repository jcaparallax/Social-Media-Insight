import { google } from "googleapis";

const SPREADSHEET_ID = "15PdHhPO-ecHavV27SLfkh6Nx-fXGM06As0-5O_i8vvs";
const SHEET_NAMES = [
  "Facebook Page Insights",
  "Instagram Page Insights",
  "Instagram Followers 30 días",
  "Meta Ads",
];

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

function getCurrentPeriods() {
  const now = new Date();
  const cur = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const prev = new Date(cur.getFullYear(), cur.getMonth() - 1, 1);
  const twoAgo = new Date(prev.getFullYear(), prev.getMonth() - 1, 1);

  function fmt(d: Date) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  }

  return {
    current: fmt(cur),
    previous: fmt(prev),
    two_months_ago: fmt(twoAgo),
  };
}

export async function fetchSheetsData() {
  const [fbRows, igRows, igFollowersRows, adsRows] = await Promise.all(
    SHEET_NAMES.map((name) => readSheet(name))
  );

  const periods = getCurrentPeriods();

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

  const fbByMonth: Record<string, typeof fbFiltered> = {};
  for (const row of fbFiltered) {
    const ym = getYearMonth(row["Report: Date"] || row["Report: Start date"]);
    if (ym) {
      if (!fbByMonth[ym]) fbByMonth[ym] = [];
      fbByMonth[ym].push(row);
    }
  }

  const igByMonth: Record<string, typeof igFiltered> = {};
  for (const row of igFiltered) {
    const ym = getYearMonth(row["Report: Date"] || row["Report: Start date"]);
    if (ym) {
      if (!igByMonth[ym]) igByMonth[ym] = [];
      igByMonth[ym].push(row);
    }
  }

  const igFollowersByMonth: Record<string, typeof igFollowersFiltered> = {};
  for (const row of igFollowersFiltered) {
    const ym = getYearMonth(row["Report: Date"] || row["Report: Start date"]);
    if (ym) {
      if (!igFollowersByMonth[ym]) igFollowersByMonth[ym] = [];
      igFollowersByMonth[ym].push(row);
    }
  }

  const adsByMonth: Record<string, typeof adsFiltered> = {};
  for (const row of adsFiltered) {
    const ym = getYearMonth(row["Report: Date"] || row["Report: Start date"]);
    if (ym) {
      if (!adsByMonth[ym]) adsByMonth[ym] = [];
      adsByMonth[ym].push(row);
    }
  }

  const fbCurrent = fbByMonth[periods.current] || [];
  const fbPrev = fbByMonth[periods.previous] || [];
  const fb2m = fbByMonth[periods.two_months_ago] || [];

  const latestFbFollowers = (rows: typeof fbFiltered) => {
    if (rows.length === 0) return 0;
    const sorted = [...rows].sort(
      (a, b) =>
        new Date(b["Report: Date"] || b["Report: Start date"] || "").getTime() -
        new Date(a["Report: Date"] || a["Report: Start date"] || "").getTime()
    );
    return parseNum(sorted[0]["Engagement: Lifetime followers"]);
  };

  const igCurrentRows = igByMonth[periods.current] || [];
  const igFollowersCurrent = igFollowersByMonth[periods.current] || [];
  const igFollowersPrev = igFollowersByMonth[periods.previous] || [];

  const adsCurrent = adsByMonth[periods.current] || [];

  const sumField = (rows: Record<string, string>[], field: string) =>
    rows.reduce((acc, r) => acc + parseNum(r[field]), 0);

  const avgField = (rows: Record<string, string>[], field: string) => {
    if (rows.length === 0) return 0;
    return sumField(rows, field) / rows.length;
  };

  return {
    plaza: "Patio Santa Fe",
    period: periods,
    facebook: {
      followers_total: latestFbFollowers(fbCurrent) || latestFbFollowers(fbFiltered),
      followers_prev: latestFbFollowers(fbPrev),
      followers_2m: latestFbFollowers(fb2m),
      reach: sumField(fbCurrent, "Performance: Reach"),
      engagement: sumField(fbCurrent, "Engagement: Posts engagements"),
    },
    instagram: {
      new_followers: sumField(igFollowersCurrent, "Engagement: New followers"),
      new_followers_prev: sumField(igFollowersPrev, "Engagement: New followers"),
      reach: sumField(igCurrentRows, "Performance: Reach"),
      engagement: sumField(igCurrentRows, "Engagement: Posts engagements"),
      likes: sumField(igCurrentRows, "Engagement: Likes"),
      comments: sumField(igCurrentRows, "Engagement: Comments"),
      saves: sumField(igCurrentRows, "Engagement: Saves"),
      shares: sumField(igCurrentRows, "Engagement: Shares"),
    },
    meta_ads: {
      spend: sumField(adsCurrent, "Performance: Amount spent"),
      impressions: sumField(adsCurrent, "Performance: Impressions"),
      clicks: sumField(adsCurrent, "Performance: Link clicks"),
      ctr: avgField(adsCurrent, "Performance: CTR (link click-through rate)"),
      cpm: avgField(adsCurrent, "Performance: CPM (cost per 1,000 impressions)"),
    },
  };
}
