import { z } from "zod";

export const chatMessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string(),
});

export const chatRequestSchema = z.object({
  messages: z.array(chatMessageSchema),
  context: z.string().optional(),
  plazaIds: z.array(z.string()).optional(),
  months: z.array(z.string()).optional(),
});

export type ChatMessage = z.infer<typeof chatMessageSchema>;
export type ChatRequest = z.infer<typeof chatRequestSchema>;

export interface TopPost {
  postId: string;
  platform: string;
  link: string;
  title: string;
  content: string;
  reach: number;
  engagements: number;
  likes: number;
  comments: number;
  shares: number;
  thumbnailUrl: string;
}

export interface MonthlyData {
  facebook: {
    reach: number;
    reach_organic: number;
    engagement: number;
    followers_total: number;
    new_followers: number;
  };
  instagram: {
    reach: number;
    engagement: number;
    new_followers: number;
    likes: number;
    comments: number;
    saves: number;
    shares: number;
    has_followers_data: boolean;
  };
  meta_ads: {
    spend: number;
    impressions: number;
    clicks: number;
    ctr: number;
  };
}

export interface PlazaData {
  months: string[];
  monthly: Record<string, MonthlyData>;
  topPosts?: TopPost[];
}

export interface PlazaSummary {
  id: string;
  displayName: string;
}

export interface SheetsDataResponse {
  plazas: Record<string, PlazaData>;
  availablePlazas: PlazaSummary[];
}
