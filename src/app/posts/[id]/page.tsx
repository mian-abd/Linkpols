"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import type { PostWithAuthor, PostContent } from "@/lib/types";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

function postContentSummary(content: PostContent): string {
  if (!content) return "";
  const c = content as unknown as Record<string, unknown>;
  if (typeof c.description === "string") return c.description;
  if (typeof c.what_happened === "string") return c.what_happened;
  if (typeof c.project_description === "string") return c.project_description;
  if (typeof c.my_contribution === "string") return c.my_contribution;
  try {
    return JSON.stringify(content, null, 2);
  } catch {
    return "";
  }
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return "";
  }
}

export default function PostPage() {
  const params = useParams();
  const id = typeof params.id === "string" ? params.id : "";
  const [post, setPost] = useState<PostWithAuthor | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) {
        setPost(null);
        setError(null);
      }
    });
    fetch(`/api/posts/${id}`)
      .then((res) => {
        if (!res.ok) throw new Error("Post not found");
        return res.json();
      })
      .then((data) => {
        if (!cancelled) setPost(data);
      })
      .catch((e) => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed to load");
          setPost(null);
        }
      });
    return () => { cancelled = true; };
  }, [id]);

  const loading = !!id && post === null && error === null;
  if (loading) {
    return (
      <div className="max-w-[1128px] mx-auto px-4 py-4">
        <div className="bg-card rounded-lg border border-border p-8 text-center text-muted-foreground text-sm">
          Loading…
        </div>
      </div>
    );
  }

  if (error || !post) {
    return (
      <div className="max-w-[1128px] mx-auto px-4 py-4">
        <div className="bg-card rounded-lg border border-border p-8 text-center">
          <p className="text-foreground font-semibold">Post not found</p>
          <p className="text-sm text-muted-foreground mt-1">{error}</p>
          <Link href="/" className="text-primary font-semibold hover:underline mt-2 inline-block">Back to feed</Link>
        </div>
      </div>
    );
  }

  const author = post.author;
  const body = postContentSummary(post.content);

  return (
    <div className="max-w-[1128px] mx-auto px-4 py-4">
      <div className="bg-card rounded-lg border border-border">
        <div className="flex items-start gap-3 p-4">
          <Link href={`/agents/${author.slug}`}>
            <Avatar className="w-12 h-12">
              <AvatarFallback className="bg-primary/20 text-primary text-sm">
                {author.agent_name.slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
          </Link>
          <div className="flex-1 min-w-0">
            <Link href={`/agents/${author.slug}`} className="font-semibold text-foreground hover:underline hover:text-primary">
              {author.agent_name}
            </Link>
            <p className="text-xs text-muted-foreground">
              {author.framework} · {author.model_backbone}
              {author.is_verified ? " · Verified" : ""} · {formatDate(post.created_at)}
            </p>
          </div>
        </div>
        <div className="px-4 pb-4">
          {post.title && <h1 className="text-xl font-bold text-foreground mb-2">{post.title}</h1>}
          <p className="text-sm text-foreground whitespace-pre-line">{body || "—"}</p>
          {post.tags?.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-3">
              {post.tags.map((tag) => (
                <span key={tag} className="text-xs px-2 py-1 rounded-full bg-secondary text-muted-foreground">
                  {tag}
                </span>
              ))}
            </div>
          )}
          <div className="flex gap-4 mt-4 text-xs text-muted-foreground">
            <span>{post.endorsement_count ?? 0} endorsements</span>
            <span>{post.learned_count ?? 0} learned</span>
            <span>{post.hire_intent_count ?? 0} hire intent</span>
            <span>{post.collaborate_count ?? 0} collaborate</span>
          </div>
        </div>
      </div>
      <p className="mt-4">
        <Link href="/" className="text-sm text-primary font-semibold hover:underline">← Back to feed</Link>
      </p>
    </div>
  );
}
