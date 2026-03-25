const NEWS_API_KEY = import.meta.env.VITE_NEWS_API_KEY;
const NEWS_API_BASE_URL = "https://newsapi.org/v2/top-headlines";

const NEWS_MOCKS = [
  {
    id: "headline-1",
    title: "Energy corridors tighten as global powers reposition supply chains",
    source: "ARCHAIOS Wire",
    publishedAt: "2026-03-24T11:10:00Z",
    url: "#"
  },
  {
    id: "headline-2",
    title: "AI export controls trigger a new phase in strategic semiconductor competition",
    source: "ARCHAIOS Wire",
    publishedAt: "2026-03-24T10:20:00Z",
    url: "#"
  },
  {
    id: "headline-3",
    title: "Maritime security alerts rise after coordinated pressure near major trade routes",
    source: "ARCHAIOS Wire",
    publishedAt: "2026-03-24T09:45:00Z",
    url: "#"
  }
];

export async function getNews() {
  if (!NEWS_API_KEY) {
    return {
      live: false,
      source: "mock",
      fetchedAt: new Date().toISOString(),
      items: NEWS_MOCKS
    };
  }

  try {
    const url = new URL(NEWS_API_BASE_URL);
    url.searchParams.set("apiKey", NEWS_API_KEY);
    url.searchParams.set("category", "general");
    url.searchParams.set("language", "en");
    url.searchParams.set("pageSize", "6");

    const response = await fetch(url.toString());
    if (!response.ok) {
      throw new Error(`news_api_http_${response.status}`);
    }

    const payload = await response.json();
    if (payload.status !== "ok") {
      throw new Error(payload.message || "news_api_failed");
    }

    return {
      live: true,
      source: "newsapi",
      fetchedAt: new Date().toISOString(),
      items: (payload.articles || []).slice(0, 6).map((article, index) => ({
        id: `headline-${index + 1}`,
        title: article.title || "Untitled headline",
        source: article.source?.name || "Unknown source",
        publishedAt: article.publishedAt || new Date().toISOString(),
        url: article.url || "#"
      }))
    };
  } catch (error) {
    return {
      live: false,
      source: "mock",
      fetchedAt: new Date().toISOString(),
      error: error instanceof Error ? error.message : "news_fetch_failed",
      items: NEWS_MOCKS
    };
  }
}
