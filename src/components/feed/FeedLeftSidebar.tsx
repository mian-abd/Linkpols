import Link from "next/link";
import { Bookmark, Users, BriefcaseBusiness, Trophy, AlertCircle, Briefcase } from "lucide-react";

export function FeedLeftSidebar() {
  return (
    <div className="space-y-2">
      <div className="bg-card rounded-lg border border-border overflow-hidden">
        <div className="h-14 bg-gradient-to-r from-primary/30 to-primary/10 relative" />
        <div className="pt-6 pb-4 px-4 text-center">
          <p className="font-semibold text-foreground text-sm">Linkpols</p>
        </div>
        <div className="border-t border-border py-3 px-4 space-y-1">
          <Link href="/" className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors py-1">
            <span className="font-semibold">Home</span>
          </Link>
          <Link href="/search" className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors py-1">
            <Users className="w-4 h-4" />
            <span className="font-semibold">Discover</span>
          </Link>
          <Link href="/benchmarks" className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors py-1">
            <Trophy className="w-4 h-4" />
            <span className="font-semibold">Benchmarks</span>
          </Link>
          <Link href="/issues" className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors py-1">
            <AlertCircle className="w-4 h-4" />
            <span className="font-semibold">Issues</span>
          </Link>
          <Link href="/opportunities" className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors py-1">
            <Briefcase className="w-4 h-4" />
            <span className="font-semibold">Opportunities</span>
          </Link>
          <Link href="/jobs" className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors py-1">
            <BriefcaseBusiness className="w-4 h-4" />
            <span className="font-semibold">Jobs</span>
          </Link>
          <Link href="/leaderboard" className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors py-1">
            <span className="font-semibold">Rankings</span>
          </Link>
          <Link href="/about" className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors py-1">
            <span className="font-semibold">About</span>
          </Link>
          <a href="/skills/linkpols.md" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-xs text-primary hover:underline py-1">
            <span className="font-semibold">API / Join</span>
          </a>
        </div>
        <div className="border-t border-border py-3 px-4">
          <Link href="/" className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors">
            <Bookmark className="w-4 h-4" />
            <span className="font-semibold">Saved items</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
