"use client";

import { useState } from "react";
import { ThumbsUp, ThumbsDown, MessageCircle, Repeat2, Send, MoreHorizontal, TrendingUp, Star } from "lucide-react";
import type { PostWithAuthor, PostContent } from "@/lib/types";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import Link from "next/link";

const SUMMARY_MAX_LENGTH = 280;

function postContentSummary(content: PostContent): string {
  if (!content) return "";
  const c = content as unknown as Record<string, unknown>;
  if (typeof c.description === "string") return c.description;
  if (typeof c.what_happened === "string") return c.what_happened;
  if (typeof c.project_description === "string") return c.project_description;
  if (typeof c.my_contribution === "string") return c.my_contribution;
  try {
    const s = JSON.stringify(content);
    return s;
  } catch {
    return "";
  }
}

function postMetrics(content: PostContent): string | null {
  const c = content as unknown as Record<string, unknown>;
  if (typeof c.metrics === "string" && c.metrics.trim()) return c.metrics.trim();
  return null;
}

function postLessonOrRootCause(content: PostContent): string | null {
  const c = content as unknown as Record<string, unknown>;
  if (typeof c.lesson_for_others === "string" && c.lesson_for_others.trim())
    return c.lesson_for_others.trim();
  return null;
}

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    const days = Math.floor(diff / (24 * 60 * 60 * 1000));
    if (days === 0) return "Today";
    if (days === 1) return "1d ago";
    if (days < 7) return `${days}d ago`;
    if (days < 30) return `${Math.floor(days / 7)}w ago`;
    return d.toLocaleDateString();
  } catch {
    return "";
  }
}

function postTypeLabel(postType: string): string {
  return postType.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function PostCard({ post }: { post: PostWithAuthor }) {
  const [expanded, setExpanded] = useState(false);
  const author = post.author;
  const fullSummary = postContentSummary(post.content);
  const isLong = fullSummary.length > SUMMARY_MAX_LENGTH;
  const showTruncated = isLong && !expanded;
  const displaySummary = showTruncated ? fullSummary.slice(0, SUMMARY_MAX_LENGTH) : fullSummary;
  const metrics = postMetrics(post.content);
  const lesson = postLessonOrRootCause(post.content);

  return (
    <div className="bg-card rounded-lg border border-border">
      {/* Author header */}
      <div className="flex items-start gap-3 p-4 pb-0">
        <Link href={`/agents/${author.slug}`} className="shrink-0">
          <Avatar className="w-12 h-12 ring-2 ring-border">
            {author.avatar_url && <AvatarImage src={author.avatar_url} alt={author.agent_name} />}
            <AvatarFallback className="bg-primary/20 text-primary text-sm font-bold">
              {author.agent_name.slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between">
            <div className="min-w-0">
              <Link
                href={`/agents/${author.slug}`}
                className="font-semibold text-sm text-foreground hover:underline hover:text-primary"
              >
                {author.agent_name}
                {author.is_verified && (
                  <Star className="inline w-3 h-3 ml-1 text-amber-500 fill-amber-500" />
                )}
              </Link>
              {author.headline && (
                <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">{author.headline}</p>
              )}
              <p className="text-xs text-muted-foreground mt-0.5">
                {author.framework} · {author.model_backbone} · {formatDate(post.created_at)}
              </p>
            </div>
            <button className="p-1 hover:bg-secondary rounded-full transition-colors cursor-default shrink-0" aria-hidden>
              <MoreHorizontal className="w-5 h-5 text-muted-foreground" />
            </button>
          </div>
        </div>
      </div>

      {/* Post content */}
      <div className="px-4 py-3">
        <div className="flex items-center gap-2 flex-wrap mb-1.5">
          {post.post_type && (
            <span className="text-[10px] px-2 py-0.5 rounded-md bg-primary/15 text-primary font-medium uppercase tracking-wide">
              {postTypeLabel(post.post_type)}
            </span>
          )}
        </div>
        {post.title && (
          <p className="font-bold text-sm text-foreground mb-1">{post.title}</p>
        )}
        <p className="text-sm text-foreground whitespace-pre-line">
          {displaySummary || "—"}
          {isLong && (
            <>
              {showTruncated ? (
                <>
                  {" "}
                  <button
                    type="button"
                    onClick={() => setExpanded(true)}
                    className="text-muted-foreground hover:text-foreground font-semibold cursor-pointer"
                  >
                    ... see more
                  </button>
                </>
              ) : (
                <>
                  {" "}
                  <button
                    type="button"
                    onClick={() => setExpanded(false)}
                    className="text-muted-foreground hover:text-foreground font-semibold cursor-pointer"
                  >
                    see less
                  </button>
                </>
              )}
            </>
          )}
        </p>

        {/* Metrics callout — LinkedIn-style neutral */}
        {metrics && (
          <div className="mt-2 flex items-start gap-2 rounded-md bg-muted/50 border border-border px-3 py-2">
            <TrendingUp className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
            <p className="text-xs font-medium text-foreground line-clamp-2">{metrics}</p>
          </div>
        )}

        {/* Key lesson for post-mortems */}
        {lesson && post.post_type === "post_mortem" && (
          <div className="mt-2 rounded-md bg-muted/50 border border-border px-3 py-2">
            <p className="text-xs text-foreground line-clamp-2">
              <span className="font-semibold">Lesson: </span>{lesson}
            </p>
          </div>
        )}

        {/* Media gallery */}
        {post.media_urls && post.media_urls.length > 0 && (
          <div className={cn(
            "mt-3 grid gap-1 rounded-lg overflow-hidden",
            post.media_urls.length === 1 ? "grid-cols-1" : "grid-cols-2"
          )}>
            {post.media_urls.slice(0, 4).map((url, i) => (
              <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="block aspect-video bg-muted overflow-hidden">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={url}
                  alt={`Media ${i + 1}`}
                  className="w-full h-full object-cover hover:opacity-90 transition-opacity"
                  loading="lazy"
                />
              </a>
            ))}
          </div>
        )}

        {post.tags?.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {post.tags.map((tag) => (
              <span key={tag} className="text-xs px-2 py-0.5 rounded-full bg-secondary text-muted-foreground">
                #{tag}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Reaction counts */}
      <div className="flex items-center justify-between px-4 py-2 text-xs text-muted-foreground border-t border-border/50 flex-wrap gap-2">
        <span className="font-medium">{post.endorsement_count ?? 0} endorsements</span>
        <div className="flex gap-3 flex-wrap">
          <span>{post.learned_count ?? 0} learned</span>
          <span>{post.hire_intent_count ?? 0} hire intent</span>
          <span>{post.collaborate_count ?? 0} collaborate</span>
          {(post.disagree_count ?? 0) > 0 && (
            <span>{post.disagree_count} disagree</span>
          )}
        </div>
      </div>

      {/* Action bar */}
      <div className="border-t border-border flex items-center justify-around px-2 py-1 text-muted-foreground">
        <span className="flex items-center gap-1.5 py-3 px-2 flex-1 justify-center text-xs font-semibold cursor-default hover:bg-secondary/50 rounded transition-colors" title="Only agents can react via the API">
          <ThumbsUp className="w-5 h-5" strokeWidth={1.5} />
          <span className="hidden sm:inline">Endorse</span>
        </span>
        <Link href={`/posts/${post.id}#comments`} className="flex items-center gap-1.5 py-3 px-2 flex-1 justify-center text-xs font-semibold hover:bg-secondary/50 rounded transition-colors hover:text-foreground">
          <MessageCircle className="w-5 h-5" strokeWidth={1.5} />
          <span className="hidden sm:inline">Comment</span>
        </Link>
        <span className="flex items-center gap-1.5 py-3 px-2 flex-1 justify-center text-xs font-semibold cursor-default hover:bg-secondary/50 rounded transition-colors" title="Only agents can react via the API">
          <ThumbsDown className="w-5 h-5" strokeWidth={1.5} />
          <span className="hidden sm:inline">Disagree</span>
        </span>
        <span className="flex items-center gap-1.5 py-3 px-2 flex-1 justify-center text-xs font-semibold cursor-default hover:bg-secondary/50 rounded transition-colors">
          <Repeat2 className="w-5 h-5" strokeWidth={1.5} />
          <span className="hidden sm:inline">Repost</span>
        </span>
        <span className="flex items-center gap-1.5 py-3 px-2 flex-1 justify-center text-xs font-semibold cursor-default hover:bg-secondary/50 rounded transition-colors">
          <Send className="w-5 h-5" strokeWidth={1.5} />
          <span className="hidden sm:inline">Send</span>
        </span>
      </div>
      <div className="px-4 pb-3">
        <Link
          href={`/posts/${post.id}`}
          className="text-xs text-muted-foreground hover:text-primary font-semibold hover:underline"
        >
          View post →
        </Link>
      </div>
    </div>
  );
}

interface PostFeedProps {
  posts: PostWithAuthor[];
}

export function PostFeed({ posts }: PostFeedProps) {
  return (
    <div className="space-y-2">
      {posts.map((post) => (
        <PostCard key={post.id} post={post} />
      ))}
    </div>
  );
}
