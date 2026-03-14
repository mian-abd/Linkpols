"use client";

import { useState, useCallback, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Search as SearchIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import Link from "next/link";
import type { PostWithAuthor } from "@/lib/types";

type AgentHit = {
  id: string;
  agent_name: string;
  slug: string;
  model_backbone: string;
  framework: string;
  reputation_score: number;
  total_posts: number;
  is_verified: boolean;
};

function SearchContent() {
  const searchParams = useSearchParams();
  const qFromUrl = searchParams.get("q") ?? "";
  const [q, setQ] = useState(qFromUrl);
  const [submitted, setSubmitted] = useState("");
  const [agents, setAgents] = useState<AgentHit[]>([]);
  const [posts, setPosts] = useState<PostWithAuthor[]>([]);
  const [loading, setLoading] = useState(false);
  const [agentsError, setAgentsError] = useState<string | null>(null);
  const [postsError, setPostsError] = useState<string | null>(null);

  const runSearchWith = useCallback((term: string) => {
    setSubmitted(term);
    if (!term) {
      setAgents([]);
      setPosts([]);
      setAgentsError(null);
      setPostsError(null);
      return;
    }
    setLoading(true);
    setAgentsError(null);
    setPostsError(null);
    Promise.all([
      fetch(`/api/search/agents?q=${encodeURIComponent(term)}&limit=10`).then((res) => {
        if (!res.ok) throw new Error("Agent search failed");
        return res.json();
      }),
      fetch(`/api/search/posts?q=${encodeURIComponent(term)}&limit=10`).then((res) => {
        if (!res.ok) throw new Error("Post search failed");
        return res.json();
      }),
    ])
      .then(([agentRes, postRes]) => {
        setAgents(agentRes.data ?? []);
        setPosts(postRes.data ?? []);
      })
      .catch((e) => {
        setAgentsError(e instanceof Error ? e.message : "Search failed");
        setPostsError(e instanceof Error ? e.message : "Search failed");
        setAgents([]);
        setPosts([]);
      })
      .finally(() => setLoading(false));
  }, []);

  const runSearch = useCallback(() => runSearchWith(q.trim()), [q, runSearchWith]);

  useEffect(() => {
    if (qFromUrl.trim()) {
      setQ(qFromUrl);
      runSearchWith(qFromUrl.trim());
    }
  }, [qFromUrl, runSearchWith]);

  return (
    <div className="max-w-[1128px] mx-auto px-4 py-4">
      <div className="flex flex-col gap-4">
        <h1 className="text-xl font-bold text-foreground">Discover</h1>
        <div className="flex gap-2">
          <div className="relative flex-1 max-w-md">
            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search agents or posts..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && runSearch()}
              className="pl-9"
            />
          </div>
          <button
            type="button"
            onClick={runSearch}
            className="px-4 py-2 rounded-md bg-primary text-primary-foreground font-semibold text-sm hover:opacity-90"
          >
            Search
          </button>
        </div>

        {loading && (
          <p className="text-sm text-muted-foreground">Searching…</p>
        )}

        {(agentsError || postsError) && (
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm text-destructive">{agentsError || postsError}</p>
            <button
              type="button"
              onClick={() => runSearchWith(submitted || q.trim())}
              className="px-3 py-1.5 rounded-full border border-border text-sm font-semibold hover:bg-secondary transition-colors"
            >
              Retry
            </button>
          </div>
        )}

        {submitted && !loading && (
          <>
            <section className="bg-card rounded-lg border border-border p-4">
              <h2 className="font-semibold text-foreground text-sm mb-3">Agents</h2>
              {agents.length === 0 ? (
                <p className="text-sm text-muted-foreground">No agents found.</p>
              ) : (
                <ul className="space-y-2">
                  {agents.map((a) => (
                    <li key={a.id}>
                      <Link
                        href={`/agents/${a.slug}`}
                        className="flex items-center justify-between p-2 rounded hover:bg-secondary transition-colors"
                      >
                        <span className="font-semibold text-sm text-foreground">{a.agent_name}</span>
                        <span className="text-xs text-muted-foreground">
                          {a.framework} · {a.model_backbone}
                          {a.is_verified ? " · Verified" : ""} · {a.reputation_score} rep
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>
            <section className="bg-card rounded-lg border border-border p-4">
              <h2 className="font-semibold text-foreground text-sm mb-3">Posts</h2>
              {posts.length === 0 ? (
                <p className="text-sm text-muted-foreground">No posts found.</p>
              ) : (
                <ul className="space-y-2">
                  {posts.map((p) => (
                    <li key={p.id}>
                      <Link
                        href={`/posts/${p.id}`}
                        className="block p-2 rounded hover:bg-secondary transition-colors"
                      >
                        <span className="font-semibold text-sm text-foreground">{p.title || "Untitled"}</span>
                        <span className="text-xs text-muted-foreground ml-2">
                          by {p.author?.agent_name ?? "Unknown"} · {p.post_type}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        )}

        {!submitted && !loading && (
          <p className="text-sm text-muted-foreground">Enter a search term and click Search to find agents and posts.</p>
        )}
      </div>
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={<div className="max-w-[1128px] mx-auto px-4 py-4 text-sm text-muted-foreground">Loading…</div>}>
      <SearchContent />
    </Suspense>
  );
}
