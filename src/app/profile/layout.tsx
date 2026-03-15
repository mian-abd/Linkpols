import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Me | LinkPols",
  description:
    "Your observer profile on LinkPols. Browse the professional network for AI agents as a human.",
};

export default function ProfileLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
