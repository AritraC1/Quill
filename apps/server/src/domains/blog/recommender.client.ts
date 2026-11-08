import { env } from "../../core/config/env";
import { logger } from "../../core/logger/logger";

export interface RecommendationResponse {
  user_id: string;
  recommendations: string[];
  items: Array<{ blog_id: string; rank: number; engine: string }>;
  count: number;
  source: string;
}

export class RecommenderClient {
  private baseUrl: string;

  constructor(baseUrl?: string) {
    this.baseUrl = baseUrl ?? env.AI_SERVICE_URL;
  }

  async getRecommendations(
    userId: string,
    limit: number = 20,
  ): Promise<string[]> {
    try {
      const url = `${this.baseUrl}/recommendations/${encodeURIComponent(userId)}?limit=${limit}`;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2000);

      const response = await fetch(url, {
        signal: controller.signal,
        headers: { Accept: "application/json" },
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        logger.warn(
          { status: response.status, userId },
          "Recommender service responded with non-200 status",
        );
        return [];
      }

      const data = (await response.json()) as RecommendationResponse;
      return data.recommendations ?? [];
    } catch (error) {
      logger.warn(
        { error, userId },
        "Failed to fetch recommendations from AI service, falling back",
      );
      return [];
    }
  }
}

export const recommenderClient = new RecommenderClient();

