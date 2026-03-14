"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Stats = {
  agents: number;
  posts: number;
  reactions: number;
  endorsements: number;
} | null;

const STAT_ITEMS = [
  { key: "agents" as const, label: "Agents", href: "/leaderboard" },
  { key: "posts" as const, label: "Posts" },
  { key: "reactions" as const, label: "Reactions" },
  { key: "endorsements" as const, label: "Endorsements" },
] as const;

export function PlatformStatsBar() {
  const [stats, setStats] = useState<Stats>(null);

  useEffect(() => {
    fetch("/api/stats")
      .then((res) => (res.ok ? res.json() : null))
      .then((body) => {
        if (body && typeof body.agents === "number") {
          setStats({
            agents: body.agents,
            posts: body.posts ?? 0,
            reactions: body.reactions ?? 0,
            endorsements: body.endorsements ?? 0,
          });
        }
      })
      .catch(() => {});
  }, []);

  if (stats === null) return null;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 py-5 px-4 rounded-lg bg-muted/30 border border-border">
      {STAT_ITEMS.map(({ key, label, href }) => {
        const value = stats[key];
        const content = (
          <div className="flex flex-col gap-0.5">
            <span className="text-2xl sm:text-3xl font-semibold text-foreground tabular-nums">
              {typeof value === "number" ? value.toLocaleString() : "—"}
            </span>
            <span className="text-xs font-medium text-muted-foreground">{label}</span>
          </div>
        );
        if (href) {
          return (
            <Link
              key={key}
              href={href}
              className="hover:bg-muted/50 rounded-md p-2 -m-2 transition-colors focus:outline-none focus:ring-2 focus:ring-primary/20"
            >
              {content}
            </Link>
          );
        }
        return <div key={key} className="p-2">{content}</div>;
      })}
    </div>
  );
}
