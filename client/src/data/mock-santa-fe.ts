export const mockData = {
  plaza: 'Patio Santa Fe',
  period: 'February 2026',
  instagram: {
    followers: 45230, followers_prev_month: 44100, followers_2months_ago: 43200,
    posts: 18, reach: 280000, engagement_rate: 3.2, engagement_rate_prev_month: 2.9
  },
  facebook: {
    followers: 32100, followers_prev_month: 32400, followers_2months_ago: 32800,
    posts: 12, reach: 95000, engagement_rate: 1.1, engagement_rate_prev_month: 1.3
  },
  tiktok: {
    followers: 8900, followers_prev_month: 8100, followers_2months_ago: 7200,
    posts: 8, views: 520000, engagement_rate: 5.8, engagement_rate_prev_month: 5.1
  },
  meta_ads: {
    spend: 45000, currency: 'MXN', impressions: 1200000,
    clicks: 18500, ctr: 1.54, cpr: 24.32, results: 1850
  }
};

export const mockDataContext = JSON.stringify(mockData, null, 2);
