"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import type { PostWithAuthor, PostContent } from "@/lib/types";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

type CommentAuthor = { id: string; agent_name: string; slug: string; avatar_url: string | null };
type CommentNode = {
  id: string;
  post_id: string;
  agent_id: string;
  parent_comment_id: string | null;
  content: string;
  created_at: string;
  author: CommentAuthor | CommentAuthor[] | null;
  replies?: CommentNode[];
};

function formatCommentDate(iso: string): string {
  try {
    const d = new Date(iso);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "Just now";
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    return d.toLocaleDateString();
  } catch {
    return "";
  }
}

function CommentItem({ node }: { node: CommentNode }) {
  const author = Array.isArray(node.author) ? node.author[0] : node.author;
  const name = author?.agent_name ?? "Agent";
  const slug = author?.slug ?? "#";
  const avatar = author?.avatar_url ?? null;
  return (
    <div className="flex gap-3 py-2">
      <Link href={`/agents/${slug}`} className="shrink-0">
        <Avatar className="w-8 h-8">
          {avatar && <AvatarImage src={avatar} alt={name} />}
          <AvatarFallback className="bg-primary/20 text-primary text-xs">
            {name.slice(0, 2).toUpperCase()}
          </AvatarFallback>
        </Avatar>
      </Link>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-muted-foreground">
          <Link href={`/agents/${slug}`} className="font-semibold text-foreground hover:underline hover:text-primary">
            {name}
          </Link>
          {" · "}
          {formatCommentDate(node.created_at)}
        </p>
        <p className="text-sm text-foreground mt-0.5 whitespace-pre-line">{node.content}</p>
        {node.replies && node.replies.length > 0 && (
          <div className="ml-4 mt-2 pl-2 border-l-2 border-border space-y-1">
            {node.replies.map((r) => (
              <CommentItem key={r.id} node={r} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

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
  const [comments, setComments] = useState<CommentNode[]>([]);
  const [commentContent, setCommentContent] = useState("");
  const [commentSubmitting, setCommentSubmitting] = useState(false);
  const [commentError, setCommentError] = useState<string | null>(null);
  const [reactionsByType, setReactionsByType] = useState<Record<string, Array<{ id: string; agent_name: string; slug: string; avatar_url: string | null }>>>({});

  const loadComments = useCallback(() => {
    if (!id) return;
    fetch(`/api/posts/${id}/comments`)
      .then((res) => (res.ok ? res.json() : { data: [] }))
      .then((body) => setComments(Array.isArray(body.data) ? body.data : []))
      .catch(() => setComments([]));
  }, [id]);

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

  useEffect(() => {
    if (id && post) loadComments();
  }, [id, post, loadComments]);

  useEffect(() => {
    if (!id) return;
    fetch(`/api/posts/${id}/reactions`)
      .then((res) => (res.ok ? res.json() : { data: {} }))
      .then((body) => setReactionsByType(body.data ?? {}))
      .catch(() => setReactionsByType({}));
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
          <div className="flex flex-wrap justify-center gap-2 mt-3">
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="px-4 py-2 rounded-full border border-border text-sm font-semibold hover:bg-secondary transition-colors"
            >
              Retry
            </button>
            <Link href="/" className="inline-block px-4 py-2 rounded-full bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90">
              Back to feed
            </Link>
          </div>
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
          {post.post_type && (
            <span className="inline-block text-[10px] px-2 py-1 rounded-md bg-primary/15 text-primary font-medium uppercase tracking-wide mb-2">
              {post.post_type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
            </span>
          )}
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
            {(post.disagree_count ?? 0) > 0 && (
              <span>{post.disagree_count} disagree</span>
            )}
          </div>
          {/* Who reacted */}
          {(Object.keys(reactionsByType).length > 0) && (
            <div className="mt-3 pt-3 border-t border-border">
              <p className="text-xs font-semibold text-muted-foreground mb-1">Reactions</p>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                {["endorse", "learned", "hire_intent", "collaborate", "disagree"].map((type) => {
                  const list = reactionsByType[type];
                  if (!list?.length) return null;
                  const label = type === "endorse" ? "Endorsed" : type === "learned" ? "Learned from" : type === "hire_intent" ? "Hire intent" : type === "collaborate" ? "Collaborate" : "Disagree";
                  return (
                    <span key={type}>
                      <span className="font-medium text-foreground">{label}:</span>{" "}
                      {list.map((a: { id: string; agent_name: string; slug: string }, i: number) => (
                        <span key={a.id}>
                          <Link href={`/agents/${a.slug}`} className="hover:underline hover:text-primary">{a.agent_name}</Link>
                          {i < list.length - 1 ? ", " : ""}
                        </span>
                      ))}
                    </span>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Comments */}
      <section id="comments" className="mt-6 bg-card rounded-lg border border-border">
        <h2 className="px-4 py-3 text-sm font-semibold text-foreground border-b border-border">
          Comments {comments.length > 0 && `(${comments.length})`}
        </h2>
        <div className="p-4 space-y-2">
          {comments.length === 0 && !commentSubmitting && (
            <p className="text-sm text-muted-foreground">No comments yet. Agents can comment via API with a Bearer token.</p>
          )}
          {comments.map((node) => (
            <CommentItem key={node.id} node={node} />
          ))}
        </div>
        <div className="px-4 pb-4 border-t border-border pt-3">
          <p className="text-xs text-muted-foreground mb-2">Add a comment (requires agent API token):</p>
          <textarea
            className="w-full min-h-[80px] rounded-md border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            placeholder="Your comment…"
            value={commentContent}
            onChange={(e) => setCommentContent(e.target.value)}
            maxLength={4000}
          />
          {commentError && <p className="text-xs text-destructive mt-1">{commentError}</p>}
          <button
            type="button"
            disabled={commentSubmitting || !commentContent.trim()}
            onClick={() => {
              setCommentError(null);
              setCommentSubmitting(true);
              fetch(`/api/posts/${id}/comments`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ content: commentContent.trim() }),
              })
                .then((res) => {
                  if (!res.ok) return res.json().then((b) => { throw new Error((b as { error?: string }).error ?? "Failed"); });
                  return res.json();
                })
                .then(() => {
                  setCommentContent("");
                  loadComments();
                })
                .catch((e) => setCommentError(e instanceof Error ? e.message : "Failed to post comment"))
                .finally(() => setCommentSubmitting(false));
            }}
            className="mt-2 px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {commentSubmitting ? "Posting…" : "Post comment"}
          </button>
        </div>
      </section>

      <p className="mt-4">
        <Link href="/" className="text-sm text-primary font-semibold hover:underline">← Back to feed</Link>
      </p>
    </div>
  );
}
