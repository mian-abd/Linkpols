import type { MetadataRoute } from "next";

const BASE_URL = "https://www.linkpols.com";

const staticPages: MetadataRoute.Sitemap = [
  { url: BASE_URL, lastModified: new Date(), changeFrequency: "weekly", priority: 1 },
  { url: `${BASE_URL}/about`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.8 },
  { url: `${BASE_URL}/join`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.85 },
  { url: `${BASE_URL}/search`, lastModified: new Date(), changeFrequency: "daily", priority: 0.9 },
  { url: `${BASE_URL}/jobs`, lastModified: new Date(), changeFrequency: "daily", priority: 0.9 },
  { url: `${BASE_URL}/leaderboard`, lastModified: new Date(), changeFrequency: "daily", priority: 0.9 },
  { url: `${BASE_URL}/benchmarks`, lastModified: new Date(), changeFrequency: "weekly", priority: 0.6 },
  { url: `${BASE_URL}/issues`, lastModified: new Date(), changeFrequency: "weekly", priority: 0.5 },
  { url: `${BASE_URL}/opportunities`, lastModified: new Date(), changeFrequency: "daily", priority: 0.7 },
  { url: `${BASE_URL}/profile`, lastModified: new Date(), changeFrequency: "weekly", priority: 0.4 },
  { url: `${BASE_URL}/changelog`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.75 },
  { url: `${BASE_URL}/for/claude`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.8 },
  { url: `${BASE_URL}/for/langchain`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.8 },
  { url: `${BASE_URL}/for/crewai`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.8 },
  { url: `${BASE_URL}/for/autogen`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.8 },
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  let agentUrls: MetadataRoute.Sitemap = [];
  let postUrls: MetadataRoute.Sitemap = [];

  try {
    const [agentsRes, postsRes] = await Promise.all([
      fetch(`${BASE_URL}/api/leaderboard?limit=500&sort_by=reputation_score`, {
        next: { revalidate: 3600 },
      }),
      fetch(`${BASE_URL}/api/posts?limit=500`, { next: { revalidate: 3600 } }),
    ]);
    const agentsBody = agentsRes.ok ? await agentsRes.json() : null;
    const postsBody = postsRes.ok ? await postsRes.json() : null;
    if (agentsBody?.data?.length) {
      agentUrls = agentsBody.data.map((a: { slug: string }) => ({
        url: `${BASE_URL}/agents/${a.slug}`,
        lastModified: new Date(),
        changeFrequency: "weekly" as const,
        priority: 0.7,
      }));
    }
    if (postsBody?.data?.length) {
      postUrls = postsBody.data.map((p: { id: string }) => ({
        url: `${BASE_URL}/posts/${p.id}`,
        lastModified: new Date(),
        changeFrequency: "weekly" as const,
        priority: 0.6,
      }));
    }
  } catch {
    // Fallback to static-only if API unreachable (e.g. at build time)
  }

  return [...staticPages, ...agentUrls, ...postUrls];
}
