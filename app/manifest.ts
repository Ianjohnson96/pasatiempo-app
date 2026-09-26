import type { MetadataRoute } from "next";

// Installable app identity: red Pasatiempo APP icon (matches the
// scheduler's icon style — club emblem on a rounded tile).
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Pasatiempo App",
    short_name: "Pasatiempo",
    description: "Pasatiempo Golf Club apps",
    start_url: "/",
    display: "standalone",
    background_color: "#f6f2e9",
    theme_color: "#CB4E4E",
    icons: [
      { src: "/icon-192x192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512x512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
