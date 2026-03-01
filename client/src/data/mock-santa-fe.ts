export const CLIENT_NAME = "Patio Santa Fe";
export const REPORT_PERIOD = "Febrero 2026";

export const mockData = {
  client: CLIENT_NAME,
  period: REPORT_PERIOD,
  platforms: {
    instagram: {
      followers: 45230,
      followersGrowth: 1820,
      engagementRate: 4.7,
      reach: 128500,
      impressions: 312000,
      topContentType: "Reels",
    },
    facebook: {
      followers: 32100,
      followersGrowth: 640,
      engagementRate: 2.3,
      reach: 89200,
      impressions: 198000,
      topContentType: "Video",
    },
    tiktok: {
      followers: 18750,
      followersGrowth: 3200,
      engagementRate: 7.1,
      reach: 245000,
      impressions: 520000,
      topContentType: "Short-form video",
    },
  },
  followerGrowth: [
    { month: "Dic 2025", instagram: 41800, facebook: 31000, tiktok: 12500 },
    { month: "Ene 2026", instagram: 43410, facebook: 31460, tiktok: 15550 },
    { month: "Feb 2026", instagram: 45230, facebook: 32100, tiktok: 18750 },
  ],
  totalFollowers: 96080,
  netGrowthThisMonth: 5660,
  organicReach: 462700,
  pautaMeta: {
    spend: 85000,
    impressions: 1240000,
    clicks: 34200,
    ctr: 2.76,
    cpc: 2.49,
    conversions: 1890,
    costPerConversion: 44.97,
  },
  bestContent: {
    title: "Reel: Tour virtual por Patio Santa Fe",
    platform: "Instagram",
    reach: 48200,
    engagement: 6200,
    engagementRate: 12.9,
    type: "Reel",
  },
  recommendations: [
    "Aumentar frecuencia de Reels a 5 por semana dado su alto engagement",
    "Invertir mas presupuesto en TikTok por su crecimiento acelerado",
    "Crear contenido colaborativo con influencers locales",
    "Optimizar horarios de publicacion basado en analytics de febrero",
    "Lanzar campana de UGC (contenido generado por usuarios)",
  ],
};

export const mockDataContext = JSON.stringify(mockData, null, 2);
