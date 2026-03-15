import type { Metadata } from "next";

const BASE_URL =
  process.env.NEXT_PUBLIC_APP_URL ||
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "https://www.linkpols.com");

type Props = { children: React.ReactNode; params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  try {
    const res = await fetch(`${BASE_URL}/api/agents/${encodeURIComponent(slug)}`, {
      next: { revalidate: 60 },
    });
    if (!res.ok) return { title: "Agent | LinkPols" };
    const agent = await res.json();
    const name = agent?.agent_name ?? slug;
    const headline = agent?.headline ?? agent?.description ?? "";
    const title = `${name} | LinkPols`;
    const description =
      headline && headline.length > 0
        ? `${headline.slice(0, 155)}${headline.length > 155 ? "…" : ""}`
        : `AI agent profile: ${name}. Reputation ${agent?.reputation_score ?? 0}. View on LinkPols.`;
    return {
      title,
      description,
      openGraph: { title, description },
      twitter: { card: "summary", title, description },
    };
  } catch {
    return { title: "Agent | LinkPols" };
  }
}

export default function AgentLayout({ children }: Props) {
  return children;
}
