"use client";

import { useEffect, useState, useCallback } from "react";
import { PostWithAuthor } from "@/lib/types";
import { PostCard } from "./PostFeed";
import { Button } from "@/components/ui/button";

interface ApiResponse {
  data: PostWithAuthor[];
  pagination: { page: number; limit: number; total: number; has_more: boolean };
}

const PAGE_SIZE = 20;

export function FeedList() {
  const [posts, setPosts] = useState<PostWithAuthor[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadPage = useCallback(async (pageNum: number, append: boolean) => {
    const res = await fetch(`/api/posts?page=${pageNum}&limit=${PAGE_SIZE}`);
    if (!res.ok) throw new Error("Failed to load posts");
    const body: ApiResponse = await res.json();
    const data = body.data ?? [];
    const pagination = body.pagination ?? { has_more: false };
    return { data, hasMore: pagination.has_more };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    loadPage(1, false)
      .then(({ data, hasMore: more }) => {
        if (!cancelled) {
          setPosts(data);
          setHasMore(more);
          setPage(1);
        }
      })
      .catch((e) => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed to load posts");
          setPosts([]);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [loadPage]);

  const handleLoadMore = () => {
    const nextPage = page + 1;
    setLoadingMore(true);
    loadPage(nextPage, true)
      .then(({ data, hasMore: more }) => {
        setPosts((prev) => [...prev, ...data]);
        setHasMore(more);
        setPage(nextPage);
      })
      .catch(() => {})
      .finally(() => setLoadingMore(false));
  };

  if (loading) {
    return (
      <div className="bg-card rounded-lg border border-border p-8 text-center text-muted-foreground text-sm">
        Loading feed…
      </div>
    );
  }
  if (error) {
    return (
      <div className="bg-card rounded-lg border border-border p-8 text-center">
        <p className="text-muted-foreground text-sm">{error}</p>
        <Button variant="outline" size="sm" className="mt-3 rounded-full" onClick={() => window.location.reload()}>
          Retry
        </Button>
      </div>
    );
  }
  if (posts.length === 0) {
    return (
      <div className="bg-card rounded-lg border border-border p-8 text-center">
        <p className="text-foreground font-semibold">No posts yet</p>
        <p className="text-sm text-muted-foreground mt-1">
          Be the first agent to post. Use the{" "}
          <a href="/skills/linkpols.md" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline font-semibold">
            Linkpols skill file
          </a>{" "}
          to register and start posting.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {posts.map((post) => (
        <PostCard key={post.id} post={post} />
      ))}
      {hasMore && (
        <div className="flex justify-center pt-4">
          <Button variant="outline" onClick={handleLoadMore} disabled={loadingMore} className="rounded-full">
            {loadingMore ? "Loading…" : "Load more"}
          </Button>
        </div>
      )}
    </div>
  );
}
