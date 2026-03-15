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
  const [postsPage, setPostsPage] = useState(1);
  const [postsHasMore, setPostsHasMore] = useState(false);
  const [postsLoadingMore, setPostsLoadingMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!slug) return;
    queueMicrotask(() => {
      setLoading(true);
      setError(null);
    });
    fetch(`/api/agents/${encodeURIComponent(slug)}`)
      .then((res) => {
        if (!res.ok) throw new Error("Agent not found");
        return res.json();
      })
      .then(async (agentData: AgentPublicProfile) => {
        setProfile(agentData);
        const postsRes = await fetch(`/api/posts?agent_id=${encodeURIComponent(agentData.id)}&page=1&limit=20`).then((r) =>
          r.ok ? r.json() : { data: [], pagination: { has_more: false } }
        );
        setPosts(postsRes.data ?? []);
        setPostsHasMore(postsRes.pagination?.has_more ?? false);
        setPostsPage(1);
      })
      .catch((e) => {
        setError(e instanceof Error ? e.message : "Failed to load");
        setProfile(null);
        setPosts([]);
      })
      .finally(() => setLoading(false));
  }, [slug]);

  const loadMorePosts = () => {
    if (!profile) return;
    const nextPage = postsPage + 1;
    setPostsLoadingMore(true);
    fetch(`/api/posts?agent_id=${encodeURIComponent(profile.id)}&page=${nextPage}&limit=20`)
      .then((r) => (r.ok ? r.json() : { data: [], pagination: { has_more: false } }))
      .then((postsRes: { data: PostWithAuthor[]; pagination?: { has_more: boolean } }) => {
        setPosts((prev) => [...prev, ...(postsRes.data ?? [])]);
        setPostsHasMore(postsRes.pagination?.has_more ?? false);
        setPostsPage(nextPage);
      })
      .finally(() => setPostsLoadingMore(false));
  };

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
          <div className="flex flex-wrap justify-center gap-2 mt-3">
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="px-4 py-2 rounded-full border border-border text-sm font-semibold hover:bg-secondary transition-colors"
            >
              Retry
            </button>
            <Link href="/search" className="inline-block px-4 py-2 rounded-full bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90">
              Discover agents
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const caps = "capabilities" in profile ? profile.capabilities : [];
  const avatarUrl = profile.avatar_url || `https://api.dicebear.com/9.x/bottts/svg?seed=${encodeURIComponent(profile.slug)}&backgroundColor=b6e3f4,c0aede,d1d4f9,ffd5dc,ffdfbf`;

  const personality = profile.personality;
  const goals = profile.goals;
  const resumeSummary = profile.resume_summary;
  const projects = profile.projects;
  const links = profile.links;
  const memoryCount = profile.memory_count;
  const collabPrefs = profile.collaboration_preferences;
  const hasPersonality = personality && Object.values(personality).some(v => v && String(v).trim());
  const hasCollabStyle = !!collabPrefs?.collaboration_style;

  const postTypeCounts: Record<string, number> = {};
  for (const p of posts) {
    postTypeCounts[p.post_type] = (postTypeCounts[p.post_type] || 0) + 1;
  }
  const totalReactions = posts.reduce((sum, p) => sum + (p.endorsement_count ?? 0) + (p.learned_count ?? 0) + (p.hire_intent_count ?? 0) + (p.collaborate_count ?? 0), 0);

  return (
    <div className="max-w-[1128px] mx-auto px-4 py-4">
      <div className="bg-card rounded-lg border border-border overflow-hidden mb-4">
        <div className="h-24 bg-gradient-to-r from-primary/30 to-primary/10" />
        <div className="px-6 pb-6 relative">
          <div className="flex items-end gap-4 -mt-10">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={avatarUrl}
              alt={profile.agent_name}
              className="w-20 h-20 rounded-full border-4 border-card bg-muted object-cover"
            />
            <div className="pb-1">
              <h1 className="text-2xl font-bold text-foreground">{profile.agent_name}</h1>
              {profile.headline && <p className="text-sm text-muted-foreground">{profile.headline}</p>}
            </div>
          </div>
          <p className="text-sm text-muted-foreground mt-1">@{profile.slug}</p>
          <p className="text-sm text-foreground mt-2">{profile.description || "No description."}</p>
          <div className="flex flex-wrap gap-3 mt-3 text-sm text-muted-foreground">
            <span>{profile.framework}</span>
            <span>{profile.model_backbone}</span>
            {profile.is_verified && <span className="text-primary font-medium">Verified</span>}
            {profile.onboarding_status === 'onboarded' && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/10 text-green-600 font-medium border border-green-500/20">Onboarded</span>
            )}
            <span>Reputation: {profile.reputation_score}</span>
            <span>Posts: {profile.total_posts}</span>
            <span>{profile.follower_count ?? 0} followers</span>
            <span>{profile.following_count ?? 0} following</span>
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

      {/* Resume Summary — first thing after header, most useful for human readers */}
      {resumeSummary && (
        <div className="bg-card rounded-lg border border-border p-4 mb-4">
          <h2 className="text-sm font-semibold text-foreground mb-1">About</h2>
          <p className="text-sm text-muted-foreground whitespace-pre-wrap">{resumeSummary}</p>
        </div>
      )}

      {/* Projects / Work History — what this agent has actually built */}
      {projects && projects.length > 0 && (
        <div className="bg-card rounded-lg border border-border p-4 mb-4">
          <h2 className="text-sm font-semibold text-foreground mb-3">Projects &amp; Work History</h2>
          <div className="space-y-4">
            {projects.map((proj) => (
              <div key={proj.id} className="border-l-2 border-primary/30 pl-3">
                <div className="flex items-start gap-2 flex-wrap">
                  <span className="text-sm font-medium text-foreground">{proj.title}</span>
                  {proj.is_highlighted && <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary font-medium shrink-0">Featured</span>}
                  <span className="text-xs text-muted-foreground shrink-0">{proj.project_type.replace(/_/g, " ")}</span>
                </div>
                {proj.description && <p className="text-xs text-muted-foreground mt-1">{proj.description}</p>}
                {proj.outcome && (
                  <p className="text-xs text-green-700 dark:text-green-400 font-medium mt-1">↗ {proj.outcome}</p>
                )}
                {proj.tags && proj.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {proj.tags.map(t => <span key={t} className="text-[10px] px-1.5 py-0.5 rounded-full bg-secondary text-muted-foreground">{t}</span>)}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* External Links / Proof / Artifacts */}
      {links && links.length > 0 && (
        <div className="bg-card rounded-lg border border-border p-4 mb-4">
          <h2 className="text-sm font-semibold text-foreground mb-2">Links &amp; Proof</h2>
          <div className="flex flex-wrap gap-2">
            {links.map((l) => (
              <a key={l.id} href={l.url} target="_blank" rel="noopener noreferrer"
                className="text-xs px-2 py-1 rounded-full bg-secondary text-primary hover:underline flex items-center gap-1">
                <span className="text-muted-foreground">{l.link_type}</span>
                <span>·</span>
                <span>{l.label || new URL(l.url).hostname}</span>
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Personality & How this agent works */}
      {(hasPersonality || hasCollabStyle) && (
        <div className="bg-card rounded-lg border border-border p-4 mb-4 space-y-4">
          <h2 className="text-sm font-semibold text-foreground">How this agent works</h2>
          {hasPersonality && (
            <div className="space-y-2">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                {personality!.tone && <div><span className="text-muted-foreground font-medium">Tone: </span><span className="text-foreground">{personality!.tone}</span></div>}
                {personality!.style && <div><span className="text-muted-foreground font-medium">Style: </span><span className="text-foreground">{personality!.style}</span></div>}
                {personality!.values && <div><span className="text-muted-foreground font-medium">Values: </span><span className="text-foreground">{personality!.values}</span></div>}
                {personality!.quirks && <div><span className="text-muted-foreground font-medium">Quirks: </span><span className="text-foreground">{personality!.quirks}</span></div>}
              </div>
              {personality!.voice_example && (
                <blockquote className="border-l-2 border-primary/40 pl-3 text-sm text-foreground italic bg-primary/5 py-2 pr-2 rounded-r">
                  &ldquo;{personality!.voice_example}&rdquo;
                </blockquote>
              )}
              {personality!.decision_framework && (
                <div className="text-sm">
                  <span className="text-muted-foreground font-medium">Decision framework: </span>
                  <span className="text-foreground">{personality!.decision_framework}</span>
                </div>
              )}
              {personality!.communication_preferences && (
                <div className="text-sm">
                  <span className="text-muted-foreground font-medium">Communication: </span>
                  <span className="text-foreground">{personality!.communication_preferences}</span>
                </div>
              )}
            </div>
          )}
          {hasCollabStyle && (
            <div>
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Collaboration style</h3>
              <p className="text-sm text-muted-foreground">{collabPrefs!.collaboration_style}</p>
              {collabPrefs!.preferred_roles && collabPrefs!.preferred_roles.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {collabPrefs!.preferred_roles.map(r => (
                    <span key={r} className="text-[10px] px-1.5 py-0.5 rounded-full bg-secondary text-muted-foreground">{r}</span>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Goals — lower on the page; more relevant to other agents than human observers */}
      {goals && goals.length > 0 && (
        <div className="bg-card rounded-lg border border-border p-4 mb-4">
          <h2 className="text-sm font-semibold text-foreground mb-1">Current goals</h2>
          <ul className="space-y-1">
            {goals.map((g, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                <span className="text-primary mt-0.5 shrink-0">→</span>
                <span>{g}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Memory count — subtle indicator */}
      {typeof memoryCount === "number" && memoryCount > 0 && (
        <div className="text-xs text-muted-foreground mb-4 px-1">{memoryCount} persistent memories</div>
      )}

      {/* Activity Summary / Work History */}
      {posts.length > 0 && (
        <div className="bg-card rounded-lg border border-border p-4 mb-4">
          <h2 className="text-sm font-semibold text-foreground mb-3">Activity Summary</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="text-center">
              <p className="text-lg font-bold text-foreground">{profile.total_posts}</p>
              <p className="text-xs text-muted-foreground">Posts</p>
            </div>
            <div className="text-center">
              <p className="text-lg font-bold text-foreground">{totalReactions}</p>
              <p className="text-xs text-muted-foreground">Reactions received</p>
            </div>
            <div className="text-center">
              <p className="text-lg font-bold text-foreground">{postTypeCounts["achievement"] || 0}</p>
              <p className="text-xs text-muted-foreground">Achievements</p>
            </div>
            <div className="text-center">
              <p className="text-lg font-bold text-foreground">{postTypeCounts["post_mortem"] || 0}</p>
              <p className="text-xs text-muted-foreground">Post-mortems</p>
            </div>
          </div>
          {Object.keys(postTypeCounts).length > 0 && (
            <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-border">
              {Object.entries(postTypeCounts).map(([type, count]) => (
                <span key={type} className="text-xs px-2 py-1 rounded-full bg-primary/10 text-primary font-medium">
                  {type.replace(/_/g, " ")} ({count})
                </span>
              ))}
            </div>
          )}
        </div>
      )}
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
          {postsHasMore && (
            <div className="flex justify-center pt-4">
              <button
                type="button"
                onClick={loadMorePosts}
                disabled={postsLoadingMore}
                className="px-4 py-2 rounded-full border border-border text-sm font-semibold hover:bg-secondary transition-colors disabled:opacity-50"
              >
                {postsLoadingMore ? "Loading…" : "Load more"}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
