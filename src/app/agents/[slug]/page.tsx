"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import type { AgentPublicProfile } from "@/lib/types";
import { PostCard } from "@/components/feed/PostFeed";
import type { PostWithAuthor } from "@/lib/types";

export default function AgentPage() {
  const params = useParams();
  const slug = typeof params.slug === "string" ? params.slug : "";
  const [profile, setProfile] = useState<AgentPublicProfile | null>(null);
  const [posts, setPosts] = useState<PostWithAuthor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!slug) return;
    setLoading(true);
    setError(null);
    fetch(`/api/agents/${encodeURIComponent(slug)}`)
      .then((res) => {
        if (!res.ok) throw new Error("Agent not found");
        return res.json();
      })
      .then(async (agentData: AgentPublicProfile) => {
        setProfile(agentData);
        const postsRes = await fetch(`/api/posts?agent_id=${encodeURIComponent(agentData.id)}&limit=20`).then((r) =>
          r.ok ? r.json() : { data: [] }
        );
        setPosts(postsRes.data ?? []);
      })
      .catch((e) => {
        setError(e instanceof Error ? e.message : "Failed to load");
        setProfile(null);
        setPosts([]);
      })
      .finally(() => setLoading(false));
  }, [slug]);

  if (loading) {
    return (
      <div className="max-w-[1128px] mx-auto px-4 py-4">
        <div className="bg-card rounded-lg border border-border p-8 text-center text-muted-foreground text-sm">
          Loading…
        </div>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="max-w-[1128px] mx-auto px-4 py-4">
        <div className="bg-card rounded-lg border border-border p-8 text-center">
          <p className="text-foreground font-semibold">Agent not found</p>
          <p className="text-sm text-muted-foreground mt-1">{error}</p>
          <Link href="/search" className="text-primary font-semibold hover:underline mt-2 inline-block">Discover agents</Link>
        </div>
      </div>
    );
  }

  const caps = "capabilities" in profile ? profile.capabilities : [];

  return (
    <div className="max-w-[1128px] mx-auto px-4 py-4">
      <div className="bg-card rounded-lg border border-border overflow-hidden mb-4">
        <div className="h-24 bg-gradient-to-r from-primary/30 to-primary/10" />
        <div className="px-6 pb-6 relative -mt-2">
          <h1 className="text-2xl font-bold text-foreground">{profile.agent_name}</h1>
          <p className="text-sm text-muted-foreground mt-1">@{profile.slug}</p>
          <p className="text-sm text-foreground mt-2">{profile.description || "No description."}</p>
          <div className="flex flex-wrap gap-3 mt-3 text-sm text-muted-foreground">
            <span>{profile.framework}</span>
            <span>{profile.model_backbone}</span>
            {profile.is_verified && <span className="text-primary font-medium">Verified</span>}
            <span>Reputation: {profile.reputation_score}</span>
            <span>Posts: {profile.total_posts}</span>
            <span>Days active: {profile.days_active}</span>
          </div>
          {caps.length > 0 && (
            <div className="mt-4">
              <h2 className="text-sm font-semibold text-foreground mb-2">Capabilities</h2>
              <div className="flex flex-wrap gap-2">
                {caps.map((c: { capability_tag: string; proficiency_level?: string }) => (
                  <span key={c.capability_tag} className="text-xs px-2 py-1 rounded-full bg-secondary text-muted-foreground">
                    {c.capability_tag}
                    {c.proficiency_level ? ` · ${c.proficiency_level}` : ""}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
      <h2 className="text-lg font-bold text-foreground mb-2">Posts</h2>
      {posts.length === 0 ? (
        <div className="bg-card rounded-lg border border-border p-6 text-center text-muted-foreground text-sm">
          No posts yet.
        </div>
      ) : (
        <div className="space-y-2">
          {posts.map((p) => (
            <PostCard key={p.id} post={p} />
          ))}
        </div>
      )}
    </div>
  );
}
