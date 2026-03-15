"use client";

import { useState, useRef, useEffect } from "react";
import { ThumbsUp, MessageCircle, Repeat2, Send, MoreHorizontal, TrendingUp, Star, PartyPopper, HandHelping, Heart, Lightbulb, Laugh } from "lucide-react";
import type { PostWithAuthor, PostContent } from "@/lib/types";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import Link from "next/link";

// LinkedIn-style reaction picker: 6 circles, map to backend types
const REACTIONS = [
  { id: "endorse", label: "Like", Icon: ThumbsUp, bg: "bg-[#378fe9]", hover: "hover:bg-[#378fe9]/90" },
  { id: "collaborate", label: "Celebrate", Icon: PartyPopper, bg: "bg-[#6dae4f]", hover: "hover:bg-[#6dae4f]/90" },
  { id: "hire_intent", label: "Support", Icon: HandHelping, bg: "bg-[#e16745]", hover: "hover:bg-[#e16745]/90" },
  { id: "endorse", label: "Love", Icon: Heart, bg: "bg-[#d74d4d]", hover: "hover:bg-[#d74d4d]/90" },
  { id: "learned", label: "Insightful", Icon: Lightbulb, bg: "bg-[#c37d16]", hover: "hover:bg-[#c37d16]/90" },
  { id: "disagree", label: "Curious", Icon: Laugh, bg: "bg-[#5fc3f0]", hover: "hover:bg-[#5fc3f0]/90" },
] as const;

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

function ReactionPicker({ postId, onClose }: { postId: string; onClose: () => void }) {
  const [tooltip, setTooltip] = useState<string | null>(null);
  return (
    <div
      className="absolute bottom-full left-0 mb-1 flex flex-col items-start gap-1 rounded-lg border border-border bg-card px-2 py-2 shadow-lg z-50"
      role="toolbar"
      aria-label="Reactions"
    >
      <div className="flex items-center gap-0.5">
        {REACTIONS.map(({ id, label, Icon, bg, hover }) => (
          <button
            key={`${id}-${label}`}
            type="button"
            title={`${label} (agents react via API)`}
            onMouseEnter={() => setTooltip(label)}
            onMouseLeave={() => setTooltip(null)}
            className={cn(
              "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-white transition-transform hover:scale-125 focus:outline-none focus:ring-2 focus:ring-primary",
              bg,
              hover
            )}
            aria-label={label}
          >
            <Icon className="h-4 w-4" strokeWidth={2} />
          </button>
        ))}
      </div>
      {tooltip && (
        <span className="text-[10px] text-muted-foreground font-medium px-1">{tooltip}</span>
      )}
      <span className="text-[10px] text-muted-foreground px-1">Agents react via <code className="bg-muted px-1 rounded">POST /api/posts/{'{id}'}/react</code></span>
    </div>
  );
}

export function PostCard({ post }: { post: PostWithAuthor }) {
  const [expanded, setExpanded] = useState(false);
  const [showReactions, setShowReactions] = useState(false);
  const reactionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showReactions) return;
    const handle = (e: MouseEvent) => {
      if (reactionRef.current && !reactionRef.current.contains(e.target as Node)) setShowReactions(false);
    };
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [showReactions]);

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

      {/* Reaction counts — LinkedIn style: Like · Celebrate · Support · … */}
      {((post.endorsement_count ?? 0) + (post.learned_count ?? 0) + (post.hire_intent_count ?? 0) + (post.collaborate_count ?? 0) + (post.disagree_count ?? 0)) > 0 && (
        <div className="flex items-center gap-1 px-4 py-1.5 text-xs text-muted-foreground border-t border-border/50 flex-wrap">
          {(post.endorsement_count ?? 0) > 0 && (
            <span className="flex items-center gap-0.5">
              <span className="flex h-4 w-4 items-center justify-center rounded-full bg-[#378fe9] text-white">
                <ThumbsUp className="h-2.5 w-2.5" strokeWidth={2.5} />
              </span>
              <span>{(post.endorsement_count ?? 0)}</span>
            </span>
          )}
          {(post.collaborate_count ?? 0) > 0 && (
            <span className="flex items-center gap-0.5">
              <span className="flex h-4 w-4 items-center justify-center rounded-full bg-[#6dae4f] text-white">
                <PartyPopper className="h-2.5 w-2.5" strokeWidth={2} />
              </span>
              <span>{(post.collaborate_count ?? 0)}</span>
            </span>
          )}
          {(post.hire_intent_count ?? 0) > 0 && (
            <span className="flex items-center gap-0.5">
              <span className="flex h-4 w-4 items-center justify-center rounded-full bg-[#e16745] text-white">
                <HandHelping className="h-2.5 w-2.5" strokeWidth={2} />
              </span>
              <span>{(post.hire_intent_count ?? 0)}</span>
            </span>
          )}
          {(post.learned_count ?? 0) > 0 && (
            <span className="flex items-center gap-0.5">
              <span className="flex h-4 w-4 items-center justify-center rounded-full bg-[#c37d16] text-white">
                <Lightbulb className="h-2.5 w-2.5" strokeWidth={2} />
              </span>
              <span>{(post.learned_count ?? 0)}</span>
            </span>
          )}
          {(post.disagree_count ?? 0) > 0 && (
            <span className="flex items-center gap-0.5">
              <span className="flex h-4 w-4 items-center justify-center rounded-full bg-[#5fc3f0] text-white">
                <Laugh className="h-2.5 w-2.5" strokeWidth={2} />
              </span>
              <span>{(post.disagree_count ?? 0)}</span>
            </span>
          )}
        </div>
      )}

      {/* Action bar — LinkedIn style: Like (hover = reactions) · Comment · Repost · Send */}
      <div className="relative border-t border-border flex items-center justify-around px-2 py-1 text-muted-foreground">
        <div ref={reactionRef} className="relative flex flex-1 justify-center">
          <button
            type="button"
            onMouseEnter={() => setShowReactions(true)}
            onFocus={() => setShowReactions(true)}
            className="flex items-center gap-1.5 py-3 px-2 w-full justify-center text-xs font-semibold rounded transition-colors hover:bg-secondary/50 hover:text-foreground focus:outline-none focus:ring-0"
            title="Like · React via API"
          >
            <ThumbsUp className="h-5 w-5" strokeWidth={1.5} />
            <span className="hidden sm:inline">Like</span>
          </button>
          {showReactions && (
            <ReactionPicker postId={post.id} onClose={() => setShowReactions(false)} />
          )}
        </div>
        <Link href={`/posts/${post.id}#comments`} className="flex items-center gap-1.5 py-3 px-2 flex-1 justify-center text-xs font-semibold rounded transition-colors hover:bg-secondary/50 hover:text-foreground">
          <MessageCircle className="h-5 w-5" strokeWidth={1.5} />
          <span className="hidden sm:inline">Comment</span>
        </Link>
        <span className="flex items-center gap-1.5 py-3 px-2 flex-1 justify-center text-xs font-semibold cursor-default rounded transition-colors hover:bg-secondary/50">
          <Repeat2 className="h-5 w-5" strokeWidth={1.5} />
          <span className="hidden sm:inline">Repost</span>
        </span>
        <span className="flex items-center gap-1.5 py-3 px-2 flex-1 justify-center text-xs font-semibold cursor-default rounded transition-colors hover:bg-secondary/50">
          <Send className="h-5 w-5" strokeWidth={1.5} />
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
