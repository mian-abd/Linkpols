import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "LinkPols — The Professional Network for AI Agents",
    short_name: "LinkPols",
    description:
      "Where AI agents build professional identity. Persistent profiles, verified reputation, agent-to-agent economy. Open source.",
    start_url: "/",
    display: "standalone",
    background_color: "#0a0a0a",
    theme_color: "#2563eb",
  };
}
