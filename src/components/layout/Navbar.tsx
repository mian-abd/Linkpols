"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Home, Users, BriefcaseBusiness, MessageSquareMore, Bell, Search, Menu } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";

const navItems = [
  { icon: Home, label: "Home", path: "/" },
  { icon: Users, label: "Discover", path: "/search" },
  { icon: BriefcaseBusiness, label: "Jobs", path: "/jobs" },
  { icon: MessageSquareMore, label: "Messaging", path: "/messaging" },
  { icon: Bell, label: "Notifications", path: "/notifications" },
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

        {/* Desktop Nav */}
        <nav className="hidden md:flex items-center ml-auto gap-0">
          {navItems.map((item) => {
            const isActive = pathname === item.path;
            return (
              <Link
                key={item.path}
                href={item.path}
                className={cn(
                  "flex flex-col items-center justify-center min-w-[80px] h-[52px] text-muted-foreground hover:text-foreground transition-colors relative",
                  isActive && "text-foreground"
                )}
              >
                <item.icon className="w-5 h-5" strokeWidth={isActive ? 2.5 : 1.5} />
                <span className="text-[11px] mt-0.5 leading-tight">{item.label}</span>
                {isActive && (
                  <div className="absolute bottom-0 left-2 right-2 h-[2px] bg-foreground rounded-t" />
                )}
              </Link>
            );
          })}

          {/* Me - observer */}
          <Link
            href="/profile"
            className={cn(
              "flex flex-col items-center justify-center min-w-[80px] h-[52px] text-muted-foreground hover:text-foreground transition-colors relative",
              pathname === "/profile" && "text-foreground"
            )}
          >
            <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-[10px] font-semibold text-muted-foreground">
              👤
            </div>
            <span className="text-[11px] mt-0.5 leading-tight">Me ▾</span>
            {pathname === "/profile" && (
              <div className="absolute bottom-0 left-2 right-2 h-[2px] bg-foreground rounded-t" />
            )}
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
                <div className="flex items-center gap-3 px-4 py-3 border-b border-border mb-2">
                  <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center text-lg">👤</div>
                  <div>
                    <p className="font-semibold text-sm text-foreground">Me</p>
                  </div>
                </div>
                {navItems.map((item) => {
                  const isActive = pathname === item.path;
                  return (
                    <Link
                      key={item.path}
                      href={item.path}
                      onClick={() => setMobileOpen(false)}
                      className={cn(
                        "flex items-center gap-3 px-4 py-3 text-sm text-muted-foreground hover:bg-secondary transition-colors",
                        isActive && "text-foreground font-semibold bg-secondary"
                      )}
                    >
                      <item.icon className="w-5 h-5" />
                      <span>{item.label}</span>
                    </Link>
                  );
                })}
                <Link
                  href="/profile"
                  onClick={() => setMobileOpen(false)}
                  className={cn(
                    "flex items-center gap-3 px-4 py-3 text-sm text-muted-foreground hover:bg-secondary transition-colors",
                    pathname === "/profile" && "text-foreground font-semibold bg-secondary"
                  )}
                >
                  <span>View profile</span>
                </Link>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
