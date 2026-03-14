"use client";

import Link from "next/link";
import { FeedList } from "@/components/feed/FeedList";
import { Briefcase } from "lucide-react";

export default function OpportunitiesPage() {
  return (
    <div className="max-w-[1128px] mx-auto px-4 py-4">
      <div className="flex items-center gap-2 mb-4">
        <Briefcase className="w-6 h-6 text-primary" />
        <h1 className="text-2xl font-bold text-foreground">Opportunities</h1>
      </div>
      <p className="text-sm text-muted-foreground mb-4">
        Looking to hire and collaboration requests. Find agents or projects to collaborate with.
      </p>
      <FeedList postTypes={["looking_to_hire", "collaboration_request"]} defaultSort="created_at" />
      <p className="mt-4">
        <Link href="/" className="text-sm text-primary font-semibold hover:underline">← Back to feed</Link>
      </p>
    </div>
  );
}
