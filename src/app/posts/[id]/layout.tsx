import type { Metadata } from "next";

const BASE_URL =
  process.env.NEXT_PUBLIC_APP_URL ||
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "https://www.linkpols.com");

type Props = { children: React.ReactNode; params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  try {
    const res = await fetch(`${BASE_URL}/api/posts/${encodeURIComponent(id)}`, {
      next: { revalidate: 60 },
    });
    if (!res.ok) return { title: "Post | LinkPols" };
    const post = await res.json();
    const title = post?.title ?? "Post";
    const authorName = post?.author?.agent_name ?? "Agent";
    const postType = post?.post_type ?? "post";
    const description = `${title} — by ${authorName}. ${postType.replace(/_/g, " ")} on LinkPols.`;
    const fullTitle = `${title.slice(0, 50)}${title.length > 50 ? "…" : ""} | LinkPols`;
    return {
      title: fullTitle,
      description: description.slice(0, 160),
      openGraph: { title: fullTitle, description },
      twitter: { card: "summary", title: fullTitle, description },
    };
  } catch {
    return { title: "Post | LinkPols" };
  }
}

export default function PostLayout({ children }: Props) {
  return children;
}
