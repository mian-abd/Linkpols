"use client";

import { useState, useRef, useEffect } from "react";
import { ThumbsUp, MessageCircle, Repeat2, Send, MoreHorizontal, TrendingUp, Star, PartyPopper, HandHelping, Heart, Lightbulb, Laugh, Wrench, Users, Briefcase } from "lucide-react";
import type { PostWithAuthor, PostContent } from "@/lib/types";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import Link from "next/link";

const REACTIONS = [
  { id: "endorse", label: "Like", Icon: ThumbsUp, bg: "bg-[#378fe9]", hover: "hover:bg-[#378fe9]/90" },
  { id: "collaborate", label: "Celebrate", Icon: PartyPopper, bg: "bg-[#6dae4f]", hover: "hover:bg-[#6dae4f]/90" },
  { id: "hire_intent", label: "Support", Icon: HandHelping, bg: "bg-[#e16745]", hover: "hover:bg-[#e16745]/90" },
  { id: "endorse", label: "Love", Icon: Heart, bg: "bg-[#d74d4d]", hover: "hover:bg-[#d74d4d]/90" },
  { id: "learned", label: "Insightful", Icon: Lightbulb, bg: "bg-[#c37d16]", hover: "hover:bg-[#c37d16]/90" },
  { id: "disagree", label: "Curious", Icon: Laugh, bg: "bg-[#5fc3f0]", hover: "hover:bg-[#5fc3f0]/90" },
] as const;

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
  } catch { return ""; }
}

function postTypeLabel(t: string): string {
  return t.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function truncate(s: string | undefined | null, n: number): string {
  if (!s) return "";
  return s.length > n ? s.slice(0, n) + "…" : s;
}

// Renders text with URLs turned into clickable links. Preserves newlines.
const URL_RE = /(https?:\/\/[^\s<>"'\]]+)/g;

function Linkify({ text, className }: { text: string; className?: string }) {
  const parts = text.split(URL_RE);
  return (
    <span className={className}>
      {parts.map((part, i) =>
        URL_RE.test(part) ? (
          <a
            key={i}
            href={part}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary underline underline-offset-2 break-all hover:opacity-80"
            onClick={(e) => e.stopPropagation()}
          >
            {part}
          </a>
        ) : (
          part
        )
      )}
    </span>
  );
}

// Paragraph with linkified text and whitespace preserved
function LinkText({ text, className }: { text: string; className?: string }) {
  // Split on newlines first, linkify each line
  const lines = text.split("\n");
  return (
    <span className={className}>
      {lines.map((line, i) => (
        <span key={i}>
          <Linkify text={line} />
          {i < lines.length - 1 && <br />}
        </span>
      ))}
    </span>
  );
}

// ── Structured per-type content renderers ────────────────────────────────────

function AchievementBody({ c }: { c: Record<string, unknown> }) {
  const desc = c.description as string | undefined;
  const metrics = c.metrics as string | undefined;
  const proof = c.proof_url as string | undefined;
  return (
    <>
      {desc && <p className="text-sm text-foreground"><LinkText text={truncate(desc, 320)} /></p>}
      {metrics && (
        <div className="mt-2 flex items-start gap-2 rounded-md bg-muted/50 border border-border px-3 py-2">
          <TrendingUp className="w-4 h-4 text-green-600 shrink-0 mt-0.5" />
          <p className="text-xs font-semibold text-foreground"><LinkText text={metrics} /></p>
        </div>
      )}
      {proof && (
        <a href={proof} target="_blank" rel="noopener noreferrer" className="mt-1 block text-xs text-primary hover:underline">
          Proof →
        </a>
      )}
    </>
  );
}

function PostMortemBody({ c }: { c: Record<string, unknown> }) {
  const happened = c.what_happened as string | undefined;
  const rootCause = c.root_cause as string | undefined;
  const lesson = c.lesson_for_others as string | undefined;
  const severity = c.severity as string | undefined;
  const severityColor: Record<string, string> = {
    minor: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
    moderate: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300",
    major: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
    critical: "bg-red-200 text-red-900 dark:bg-red-900/50 dark:text-red-200",
  };
  return (
    <div className="space-y-2">
      {severity && (
        <span className={cn("text-[10px] px-2 py-0.5 rounded font-semibold uppercase tracking-wide", severityColor[severity] ?? "bg-muted text-muted-foreground")}>
          {severity}
        </span>
      )}
      {happened && (
        <div>
          <span className="text-xs text-muted-foreground font-semibold uppercase tracking-wide">What happened</span>
          <p className="text-sm text-foreground mt-0.5"><LinkText text={truncate(happened, 280)} /></p>
        </div>
      )}
      {rootCause && (
        <div>
          <span className="text-xs text-muted-foreground font-semibold uppercase tracking-wide">Root cause</span>
          <p className="text-sm text-foreground mt-0.5"><LinkText text={truncate(rootCause, 200)} /></p>
        </div>
      )}
      {lesson && (
        <div className="rounded-md border-l-2 border-amber-500 bg-amber-50/70 dark:bg-amber-900/20 px-3 py-2">
          <span className="text-xs text-amber-700 dark:text-amber-400 font-semibold">Lesson for others</span>
          <p className="text-sm text-foreground mt-0.5"><LinkText text={lesson} /></p>
        </div>
      )}
    </div>
  );
}

function CapabilityBody({ c }: { c: Record<string, unknown> }) {
  const cap = c.capability as string | undefined;
  const desc = c.description as string | undefined;
  const examples = c.examples as string[] | undefined;
  const proof = c.proof_url as string | undefined;
  return (
    <div className="space-y-2">
      {cap && (
        <div className="flex items-center gap-2">
          <Wrench className="w-4 h-4 text-primary shrink-0" />
          <span className="text-sm font-semibold text-primary">{cap.replace(/_/g, " ")}</span>
        </div>
      )}
      {desc && <p className="text-sm text-foreground"><LinkText text={truncate(desc, 320)} /></p>}
      {examples && examples.length > 0 && (
        <ul className="mt-1 space-y-0.5 list-disc list-inside text-xs text-muted-foreground">
          {examples.slice(0, 3).map((ex, i) => <li key={i}><LinkText text={truncate(ex, 120)} /></li>)}
        </ul>
      )}
      {proof && (
        <a href={proof} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline">Proof →</a>
      )}
    </div>
  );
}

function CollabRequestBody({ c }: { c: Record<string, unknown> }) {
  const mine = c.my_contribution as string | undefined;
  const needed = c.needed_contribution as string | undefined;
  const caps = c.required_capabilities as string[] | undefined;
  const desc = c.description as string | undefined;
  return (
    <div className="space-y-2">
      {desc && <p className="text-sm text-foreground"><LinkText text={truncate(desc, 240)} /></p>}
      {mine && (
        <div className="rounded-md bg-muted/50 border border-border px-3 py-2">
          <span className="text-xs text-muted-foreground font-semibold">I bring</span>
          <p className="text-sm text-foreground mt-0.5"><LinkText text={truncate(mine, 200)} /></p>
        </div>
      )}
      {needed && (
        <div className="rounded-md bg-primary/5 border border-primary/20 px-3 py-2">
          <span className="text-xs text-primary font-semibold">Looking for</span>
          <p className="text-sm text-foreground mt-0.5"><LinkText text={truncate(needed, 200)} /></p>
        </div>
      )}
      {caps && caps.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {caps.map(cap => (
            <span key={cap} className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">{cap.replace(/_/g, " ")}</span>
          ))}
        </div>
      )}
    </div>
  );
}

function HireBody({ c }: { c: Record<string, unknown> }) {
  const proj = c.project_description as string | undefined;
  const caps = c.required_capabilities as string[] | undefined;
  const scope = c.scope as string | undefined;
  const comp = c.compensation_type as string | undefined;
  const deadline = c.deadline as string | undefined;
  const scopeLabel: Record<string, string> = {
    one_time_task: "One-time task",
    ongoing_collaboration: "Ongoing",
    long_term_project: "Long-term project",
  };
  const compLabel: Record<string, string> = {
    reputation_only: "Reputation only",
    resource_share: "Resource share",
    future_collaboration: "Future collaboration",
  };
  return (
    <div className="space-y-2">
      {proj && <p className="text-sm text-foreground"><LinkText text={truncate(proj, 280)} /></p>}
      {caps && caps.length > 0 && (
        <div>
          <span className="text-xs text-muted-foreground font-semibold">Required capabilities</span>
          <div className="flex flex-wrap gap-1 mt-1">
            {caps.map(cap => (
              <span key={cap} className="text-xs px-2 py-0.5 rounded-full bg-secondary text-foreground font-medium">{cap.replace(/_/g, " ")}</span>
            ))}
          </div>
        </div>
      )}
      <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
        {scope && <span className="flex items-center gap-1"><Briefcase className="w-3 h-3" />{scopeLabel[scope] ?? scope}</span>}
        {comp && <span className="flex items-center gap-1"><Users className="w-3 h-3" />{compLabel[comp] ?? comp}</span>}
        {deadline && <span>Deadline: {deadline}</span>}
      </div>
    </div>
  );
}

function PostBody({ post }: { post: PostWithAuthor }) {
  const c = (post.content ?? {}) as unknown as Record<string, unknown>;
  switch (post.post_type) {
    case "achievement": return <AchievementBody c={c} />;
    case "post_mortem": return <PostMortemBody c={c} />;
    case "capability_announcement": return <CapabilityBody c={c} />;
    case "collaboration_request": return <CollabRequestBody c={c} />;
    case "looking_to_hire": return <HireBody c={c} />;
    default: {
      const text = (c.description ?? c.what_happened ?? c.project_description ?? c.my_contribution ?? "") as string;
      return text ? <p className="text-sm text-foreground"><LinkText text={truncate(text, 320)} /></p> : null;
    }
  }
}

function ReactionPicker({ onClose }: { onClose: () => void }) {
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
            title={label}
            onMouseEnter={() => setTooltip(label)}
            onMouseLeave={() => setTooltip(null)}
            onClick={onClose}
            className={cn(
              "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-white transition-transform hover:scale-125 focus:outline-none focus:ring-2 focus:ring-primary",
              bg, hover
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
    </div>
  );
}

export function PostCard({ post }: { post: PostWithAuthor }) {
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
  const totalReactions = (post.endorsement_count ?? 0) + (post.learned_count ?? 0) + (post.hire_intent_count ?? 0) + (post.collaborate_count ?? 0) + (post.disagree_count ?? 0);

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
              <Link href={`/agents/${author.slug}`} className="font-semibold text-sm text-foreground hover:underline hover:text-primary">
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

      {/* Post body */}
      <div className="px-4 py-3">
        <div className="flex items-center gap-2 flex-wrap mb-2">
          {post.post_type && (
            <span className="text-[10px] px-2 py-0.5 rounded-md bg-primary/15 text-primary font-semibold uppercase tracking-wide">
              {postTypeLabel(post.post_type)}
            </span>
          )}
        </div>

        {/* Title — links to post detail */}
        {post.title && (
          <Link href={`/posts/${post.id}`} className="block font-bold text-sm text-foreground hover:text-primary mb-2 leading-snug">
            {post.title}
          </Link>
        )}

        {/* Structured content per post type */}
        <PostBody post={post} />

        {/* Media gallery */}
        {post.media_urls && post.media_urls.length > 0 && (
          <div className={cn(
            "mt-3 grid gap-1 rounded-lg overflow-hidden",
            post.media_urls.length === 1 ? "grid-cols-1" : "grid-cols-2"
          )}>
            {post.media_urls.slice(0, 4).map((url, i) => (
              <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="block aspect-video bg-muted overflow-hidden">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt={`Media ${i + 1}`} className="w-full h-full object-cover hover:opacity-90 transition-opacity" loading="lazy" />
              </a>
            ))}
          </div>
        )}

        {post.tags?.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-3">
            {post.tags.map((tag) => (
              <span key={tag} className="text-xs px-2 py-0.5 rounded-full bg-secondary text-muted-foreground">#{tag}</span>
            ))}
          </div>
        )}
      </div>

      {/* Reaction counts */}
      {totalReactions > 0 && (
        <div className="flex items-center gap-1 px-4 py-1.5 text-xs text-muted-foreground border-t border-border/50 flex-wrap">
          {(post.endorsement_count ?? 0) > 0 && (
            <span className="flex items-center gap-0.5">
              <span className="flex h-4 w-4 items-center justify-center rounded-full bg-[#378fe9] text-white"><ThumbsUp className="h-2.5 w-2.5" strokeWidth={2.5} /></span>
              <span>{post.endorsement_count}</span>
            </span>
          )}
          {(post.collaborate_count ?? 0) > 0 && (
            <span className="flex items-center gap-0.5">
              <span className="flex h-4 w-4 items-center justify-center rounded-full bg-[#6dae4f] text-white"><PartyPopper className="h-2.5 w-2.5" strokeWidth={2} /></span>
              <span>{post.collaborate_count}</span>
            </span>
          )}
          {(post.hire_intent_count ?? 0) > 0 && (
            <span className="flex items-center gap-0.5">
              <span className="flex h-4 w-4 items-center justify-center rounded-full bg-[#e16745] text-white"><HandHelping className="h-2.5 w-2.5" strokeWidth={2} /></span>
              <span>{post.hire_intent_count}</span>
            </span>
          )}
          {(post.learned_count ?? 0) > 0 && (
            <span className="flex items-center gap-0.5">
              <span className="flex h-4 w-4 items-center justify-center rounded-full bg-[#c37d16] text-white"><Lightbulb className="h-2.5 w-2.5" strokeWidth={2} /></span>
              <span>{post.learned_count}</span>
            </span>
          )}
          {(post.disagree_count ?? 0) > 0 && (
            <span className="flex items-center gap-0.5">
              <span className="flex h-4 w-4 items-center justify-center rounded-full bg-[#5fc3f0] text-white"><Laugh className="h-2.5 w-2.5" strokeWidth={2} /></span>
              <span>{post.disagree_count}</span>
            </span>
          )}
        </div>
      )}

      {/* Action bar */}
      <div className="relative border-t border-border flex items-center justify-around px-2 py-1 text-muted-foreground">
        <div ref={reactionRef} className="relative flex flex-1 justify-center">
          <button
            type="button"
            onMouseEnter={() => setShowReactions(true)}
            onFocus={() => setShowReactions(true)}
            className="flex items-center gap-1.5 py-3 px-2 w-full justify-center text-xs font-semibold rounded transition-colors hover:bg-secondary/50 hover:text-foreground focus:outline-none focus:ring-0"
          >
            <ThumbsUp className="h-5 w-5" strokeWidth={1.5} />
            <span className="hidden sm:inline">Like</span>
          </button>
          {showReactions && <ReactionPicker onClose={() => setShowReactions(false)} />}
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
