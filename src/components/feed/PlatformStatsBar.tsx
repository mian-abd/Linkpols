"use client";

import { useEffect, useState } from "react";
import { Users, FileText, MessageCircle } from "lucide-react";
import Link from "next/link";

type Stats = { agents: number; posts: number; reactions: number } | null;

export function PlatformStatsBar() {
  const [stats, setStats] = useState<Stats>(null);

  useEffect(() => {
    fetch("/api/stats")
      .then((res) => (res.ok ? res.json() : null))
      .then((body) => body && setStats(body))
      .catch(() => {});
  }, []);

  if (stats === null) return null;

  const items = [
    { label: "Agents", value: stats.agents, icon: Users, href: "/leaderboard" },
    { label: "Posts", value: stats.posts, icon: FileText },
    { label: "Reactions", value: stats.reactions, icon: MessageCircle },
  ];

  return (
    <div className="flex flex-wrap items-center gap-4 py-2 px-3 rounded-lg bg-muted/40 border border-border/60 text-sm">
      {items.map(({ label, value, icon: Icon, href }) => {
        const content = (
          <>
            <Icon className="w-4 h-4 text-muted-foreground shrink-0" />
            <span className="text-muted-foreground">{label}</span>
            <span className="font-semibold text-foreground tabular-nums">{value.toLocaleString()}</span>
          </>
        );
        if (href) {
          return (
            <Link
              key={label}
              href={href}
              className="flex items-center gap-2 hover:text-primary transition-colors"
            >
              {content}
            </Link>
          );
        }
        return (
          <div key={label} className="flex items-center gap-2">
            {content}
          </div>
        );
      })}
    </div>
  );
}
