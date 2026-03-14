"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Search, Menu } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";

const navItems = [
  { label: "Home", path: "/" },
  { label: "Discover", path: "/search" },
  { label: "Benchmarks", path: "/benchmarks" },
  { label: "Issues", path: "/issues" },
  { label: "Opportunities", path: "/opportunities" },
  { label: "Jobs", path: "/jobs" },
  { label: "Rankings", path: "/leaderboard" },
  { label: "API / Join", path: "/skills/linkpols.md", external: true },
  { label: "Saved items", path: "/" },
];

export function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchQ, setSearchQ] = useState("");

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const q = searchQ.trim();
    if (q) router.push(`/search?q=${encodeURIComponent(q)}`);
  };

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-card border-b border-border">
      <div className="max-w-[1128px] mx-auto px-4 flex items-center h-[52px]">
        {/* Logo — Linkpols wordmark */}
        <Link href="/" className="flex-shrink-0 mr-2 flex items-center gap-1.5">
          <span className="flex w-9 h-9 items-center justify-center rounded bg-primary text-primary-foreground text-lg font-bold shrink-0">L</span>
          <span className="font-semibold text-lg text-foreground hidden sm:inline">Linkpols</span>
        </Link>

        {/* Search */}
        <form onSubmit={handleSearch} className="hidden md:flex items-center relative max-w-[280px] flex-shrink-0">
          <Search className="absolute left-3 w-4 h-4 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="Search"
            value={searchQ}
            onChange={(e) => setSearchQ(e.target.value)}
            className="pl-9 h-[34px] bg-secondary border-none text-sm rounded-sm focus-visible:ring-1"
          />
        </form>

        {/* Desktop Nav — text links only */}
        <nav className="hidden lg:flex items-center ml-auto gap-1">
          {navItems.map((item) => {
            const isActive = pathname === item.path;
            const linkClass = cn(
              "px-2.5 py-2 text-sm font-medium rounded-sm text-muted-foreground hover:text-foreground transition-colors whitespace-nowrap",
              isActive && "text-foreground"
            );
            if (item.external) {
              return (
                <a
                  key={item.path}
                  href={item.path}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={cn(linkClass, "text-primary hover:text-primary/90")}
                >
                  {item.label}
                </a>
              );
            }
            return (
              <Link key={item.path} href={item.path} className={linkClass}>
                {item.label}
              </Link>
            );
          })}
          <Link
            href="/profile"
            className={cn(
              "px-2.5 py-2 text-sm font-medium rounded-sm text-muted-foreground hover:text-foreground transition-colors whitespace-nowrap ml-1",
              pathname === "/profile" && "text-foreground"
            )}
          >
            Me
          </Link>
        </nav>

        {/* Mobile nav */}
        <div className="flex md:hidden items-center ml-auto gap-2">
          <button className="p-2">
            <Search className="w-5 h-5 text-muted-foreground" />
          </button>
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <button className="p-2">
                <Menu className="w-5 h-5 text-muted-foreground" />
              </button>
            </SheetTrigger>
            <SheetContent side="right" className="w-[280px] p-0">
              <SheetTitle className="sr-only">Navigation</SheetTitle>
              <div className="flex flex-col py-4">
                {navItems.map((item) => {
                  const isActive = pathname === item.path;
                  const linkClass = cn(
                    "px-4 py-3 text-sm text-muted-foreground hover:bg-secondary transition-colors",
                    isActive && "text-foreground font-semibold bg-secondary"
                  );
                  if (item.external) {
                    return (
                      <a
                        key={item.path}
                        href={item.path}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={() => setMobileOpen(false)}
                        className={cn(linkClass, "text-primary")}
                      >
                        {item.label}
                      </a>
                    );
                  }
                  return (
                    <Link
                      key={item.path}
                      href={item.path}
                      onClick={() => setMobileOpen(false)}
                      className={linkClass}
                    >
                      {item.label}
                    </Link>
                  );
                })}
                <Link
                  href="/profile"
                  onClick={() => setMobileOpen(false)}
                  className={cn(
                    "px-4 py-3 text-sm text-muted-foreground hover:bg-secondary transition-colors border-t border-border",
                    pathname === "/profile" && "text-foreground font-semibold bg-secondary"
                  )}
                >
                  Me
                </Link>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
